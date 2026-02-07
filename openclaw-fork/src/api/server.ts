import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import jwt from '@fastify/jwt';
import { AgentManager } from '../agents/manager.js';
import { SkillRegistry } from '../skills/registry.js';
import { ChannelManager } from '../channels/manager.js';
import { ApiAdapter } from '../channels/adapters/api.js';
import { v4 as uuid } from 'uuid';
import { authRoutes } from './routes/auth.js';
import { friendRoutes } from './routes/friends.js';
import { authenticateUser, requireAdmin } from '../auth/middleware.js';
import { getDatabase } from '../db/database.js';
import { UserService } from '../users/service.js';

interface ServerOptions {
  port: number;
  agentManager: AgentManager;
  skillRegistry: SkillRegistry;
  channelManager: ChannelManager;
}

export async function startServer(options: ServerOptions): Promise<FastifyInstance> {
  const { port, agentManager, skillRegistry, channelManager } = options;

  const app = Fastify({ logger: false });

  // Plugins
  await app.register(cors, { origin: true });
  await app.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB
  await app.register(jwt, { secret: process.env.JWT_SECRET || 'starfish-secret-key' });

  // Initialize database
  getDatabase();

  // Register auth routes (public + protected)
  await authRoutes(app);
  await friendRoutes(app, agentManager);

  // Auth middleware for all /api/* routes (except auth routes which handle their own)
  app.addHook('preHandler', async (request, reply) => {
    const publicPaths = ['/health', '/api/auth/login', '/api/auth/verify-2fa'];
    if (publicPaths.includes(request.url)) return;
    if (request.url.startsWith('/api/auth/')) return;
    if (request.url.startsWith('/api/public/')) return;
    if (request.url === '/api/transcribe') return;

    await authenticateUser(request, reply);
  });

  // Health check
  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  // ===== AGENTS (Multi-Tenant) =====

  app.get('/api/agents', async (request) => {
    const user = request.currentUser!;
    const agents = agentManager.getAgentsForUser(user.id, user.is_admin === 1);
    return {
      agents: agents.map((a) => ({
        id: a.config.id,
        name: a.config.name,
        description: a.config.description,
        model: a.config.model,
        skills: a.config.skills,
        running: a.isRunning(),
        createdAt: a.config.createdAt,
        updatedAt: a.config.updatedAt
      })),
      count: agents.length
    };
  });

  app.get('/api/agents/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.currentUser!;
    if (!agentManager.canAccessAgent(user.id, id, user.is_admin === 1)) {
      return reply.code(403).send({ error: 'Access denied' });
    }
    const agent = agentManager.getAgent(id);
    if (!agent) {
      return reply.code(404).send({ error: 'Agent not found' });
    }
    return { agent: agent.config };
  });

  app.post('/api/agents', async (request) => {
    const config = request.body as any;
    const user = request.currentUser!;
    const agent = await agentManager.createAgent(config, user.id);
    return { agent: agent.config };
  });

  app.put('/api/agents/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.currentUser!;
    if (!agentManager.canAccessAgent(user.id, id, user.is_admin === 1)) {
      return reply.code(403).send({ error: 'Access denied' });
    }
    const updates = request.body as any;
    try {
      const agent = await agentManager.updateAgent(id, updates);
      return { agent: agent.config };
    } catch (err: any) {
      return reply.code(404).send({ error: err.message });
    }
  });

  app.delete('/api/agents/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.currentUser!;
    if (!agentManager.canAccessAgent(user.id, id, user.is_admin === 1)) {
      return reply.code(403).send({ error: 'Access denied' });
    }
    try {
      await agentManager.deleteAgent(id);
      return { deleted: true };
    } catch (err: any) {
      return reply.code(404).send({ error: err.message });
    }
  });

  app.post('/api/agents/:id/spawn', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.currentUser!;
    if (!agentManager.canAccessAgent(user.id, id, user.is_admin === 1)) {
      return reply.code(403).send({ error: 'Access denied' });
    }
    const config = request.body as any;
    try {
      const subAgent = await agentManager.spawnSubAgent(id, config);
      return { subAgent: subAgent.config };
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  app.post('/api/agents/:id/message', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.currentUser!;
    if (!agentManager.canAccessAgent(user.id, id, user.is_admin === 1)) {
      return reply.code(403).send({ error: 'Access denied' });
    }
    const { content, channel = 'api', from } = request.body as any;
    try {
      const response = await agentManager.processMessage(id, {
        agentId: id,
        channel,
        role: 'user',
        content,
        metadata: { from: from || user.username }
      });
      return { response: response.content };
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  app.get('/api/agents/team-status', async (request) => {
    const user = request.currentUser!;
    const agents = agentManager.getAgentsForUser(user.id, user.is_admin === 1);
    return {
      agents: agents.map((a) => ({
        id: a.config.id,
        name: a.config.name,
        description: a.config.description,
        model: a.config.model,
        skills: a.config.skills,
        running: a.isRunning(),
        parentAgentId: a.config.parentAgentId,
        createdAt: a.config.createdAt,
        updatedAt: a.config.updatedAt,
        owner: agentManager.getAgentOwner(a.config.id)
      })),
      count: agents.length
    };
  });

  // ===== CLIENT ONBOARDING (Admin Only) =====

  const userService = new UserService();

  app.post('/api/onboard', async (request, reply) => {
    const user = request.currentUser!;
    if (user.is_admin !== 1) {
      return reply.code(403).send({ error: 'Admin access required' });
    }

    const { clientEmail, clientName, clientPassword, businessName, businessDescription, agentName, agentPrompt } = request.body as any;

    if (!clientEmail || !clientName || !businessName) {
      return reply.code(400).send({ error: 'clientEmail, clientName, and businessName required' });
    }

    try {
      const password = clientPassword || Math.random().toString(36).slice(-12);
      const clientUser = await userService.createUser({
        email: clientEmail,
        username: clientName.toLowerCase().replace(/\s+/g, '-'),
        password,
        isAdmin: false,
        displayName: clientName
      });

      const defaultPrompt = `You are an AI assistant for ${businessName}. ${businessDescription || ''}\n\nBe helpful, professional, and represent the business well.`;

      const agent = await agentManager.createAgent({
        name: agentName || `${businessName} Agent`,
        description: `AI employee for ${businessName}`,
        model: 'claude-sonnet-4-5-20250929',
        systemPrompt: agentPrompt || defaultPrompt,
        skills: ['email', 'http', 'scheduler'],
        temperature: 0.7,
        maxTokens: 4096,
        memory: { type: 'sqlite', maxMessages: 1000, summarizeAfter: 50 }
      } as any, clientUser.id);

      return {
        success: true,
        client: { id: clientUser.id, email: clientUser.email, username: clientUser.username, password: clientPassword ? undefined : password },
        agent: { id: agent.config.id, name: agent.config.name }
      };
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  // ===== PUBLIC CHAT (No Auth Required) =====

  const PUBLIC_AGENT_ID = process.env.PUBLIC_AGENT_ID || 'boss-b-001';

  app.post('/api/public/chat', async (request, reply) => {
    const { content, visitorId } = request.body as { content: string; visitorId?: string };
    if (!content?.trim()) {
      return reply.code(400).send({ error: 'Message content required' });
    }
    const agent = agentManager.getAgent(PUBLIC_AGENT_ID);
    if (!agent) {
      return reply.code(503).send({ error: 'Sales agent not available' });
    }
    try {
      // Log lead conversation
      const { getOrCreateLead, addLeadMessage } = await import('../leads/store.js');
      const vid = visitorId || 'anonymous';
      const lead = getOrCreateLead(vid);
      addLeadMessage(lead.id, 'user', content.trim());

      // Tag message so Boss knows to use PUBLIC CHAT MODE (consultant, not executor)
      const taggedContent = `[PUBLIC] ${content.trim()}`;
      const response = await agentManager.processMessage(PUBLIC_AGENT_ID, {
        agentId: PUBLIC_AGENT_ID, channel: 'web-public', role: 'user',
        content: taggedContent, metadata: { from: vid, public: true }
      });

      // Log assistant response
      addLeadMessage(lead.id, 'assistant', response.content);

      // Extract lead info async (doesn't block response)
      import('../leads/extractor.js').then(({ extractLeadInfo }) => {
        extractLeadInfo(lead.id).catch(() => {});
      });

      return { response: response.content };
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  app.get('/api/public/agent', async () => {
    const agent = agentManager.getAgent(PUBLIC_AGENT_ID);
    if (!agent) return { available: false };
    return { available: true, name: agent.config.name, description: agent.config.description };
  });

  // ===== LEADS MANAGEMENT =====

  app.get('/api/leads', async (request, reply) => {
    const user = request.currentUser!;
    if (user.is_admin !== 1) return reply.code(403).send({ error: 'Admin access required' });
    const { getAllLeads } = await import('../leads/store.js');
    return { leads: getAllLeads() };
  });

  app.get('/api/leads/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.currentUser!;
    if (user.is_admin !== 1) return reply.code(403).send({ error: 'Admin access required' });
    const { getLead, getLeadMessages, getLeadComments } = await import('../leads/store.js');
    const lead = getLead(id);
    if (!lead) return reply.code(404).send({ error: 'Lead not found' });
    return { lead, messages: getLeadMessages(id), comments: getLeadComments(id) };
  });

  app.patch('/api/leads/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.currentUser!;
    if (user.is_admin !== 1) return reply.code(403).send({ error: 'Admin access required' });
    const body = request.body as any;
    const { updateLeadStatus, updateLeadNotes, updateLeadInfo, getLead } = await import('../leads/store.js');
    if (body.status) updateLeadStatus(id, body.status);
    if (body.notes !== undefined) updateLeadNotes(id, body.notes);
    if (body.contactEmail || body.businessName || body.useCase || body.channels || body.nextStep || body.contactName) {
      updateLeadInfo(id, body);
    }
    return { lead: getLead(id) };
  });

  app.post('/api/leads/:id/comments', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.currentUser!;
    if (user.is_admin !== 1) return reply.code(403).send({ error: 'Admin access required' });
    const { content } = request.body as { content: string };
    if (!content?.trim()) return reply.code(400).send({ error: 'Comment content required' });
    const { addLeadComment } = await import('../leads/store.js');
    const comment = addLeadComment(id, user.display_name || user.username, content.trim());
    return { comment };
  });

  // ===== CONVERSATION HISTORY =====

  app.get('/api/agents/:id/messages', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.currentUser!;
    if (!agentManager.canAccessAgent(user.id, id, user.is_admin === 1)) {
      return reply.code(403).send({ error: 'Access denied' });
    }
    const { limit } = request.query as { limit?: string };
    const agent = agentManager.getAgent(id);
    if (!agent) return reply.code(404).send({ error: 'Agent not found' });
    const messages = await (agent as any).memory.getMessages(parseInt(limit || '100'));
    return { messages };
  });

  app.delete('/api/agents/:id/messages', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.currentUser!;
    if (!agentManager.canAccessAgent(user.id, id, user.is_admin === 1)) {
      return reply.code(403).send({ error: 'Access denied' });
    }
    const agent = agentManager.getAgent(id);
    if (!agent) return reply.code(404).send({ error: 'Agent not found' });
    await (agent as any).memory.clearMessages();
    return { cleared: true };
  });

  // ===== FILE UPLOADS =====

  app.post('/api/agents/:id/files', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.currentUser!;
    if (!agentManager.canAccessAgent(user.id, id, user.is_admin === 1)) {
      return reply.code(403).send({ error: 'Access denied' });
    }
    const data = await request.file();
    if (!data) return reply.code(400).send({ error: 'No file provided' });

    const uploadDir = `./data/uploads/${id}`;
    const fs = await import('fs');
    const path = await import('path');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    const chunks: Buffer[] = [];
    for await (const chunk of data.file) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);
    const filePath = path.join(uploadDir, data.filename);
    fs.writeFileSync(filePath, buffer);
    return { success: true, filename: data.filename, size: buffer.length, path: filePath };
  });

  app.get('/api/agents/:id/files', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.currentUser!;
    if (!agentManager.canAccessAgent(user.id, id, user.is_admin === 1)) {
      return reply.code(403).send({ error: 'Access denied' });
    }
    const fs = await import('fs');
    const uploadDir = `./data/uploads/${id}`;
    if (!fs.existsSync(uploadDir)) return { files: [] };
    const entries = fs.readdirSync(uploadDir, { withFileTypes: true });
    const files = entries.filter(e => e.isFile()).map(e => {
      const stats = fs.statSync(`${uploadDir}/${e.name}`);
      return { name: e.name, size: stats.size, modified: stats.mtime };
    });
    return { files };
  });

  app.delete('/api/agents/:id/files/:filename', async (request, reply) => {
    const { id, filename } = request.params as { id: string; filename: string };
    const user = request.currentUser!;
    if (!agentManager.canAccessAgent(user.id, id, user.is_admin === 1)) {
      return reply.code(403).send({ error: 'Access denied' });
    }
    const fs = await import('fs');
    const filePath = `./data/uploads/${id}/${filename}`;
    if (!fs.existsSync(filePath)) return reply.code(404).send({ error: 'File not found' });
    fs.unlinkSync(filePath);
    return { deleted: true, filename };
  });

  // ===== KNOWLEDGE BASE =====

  app.post('/api/agents/:id/knowledge', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.currentUser!;
    if (!agentManager.canAccessAgent(user.id, id, user.is_admin === 1)) {
      return reply.code(403).send({ error: 'Access denied' });
    }

    const { ingestKnowledgeFile, ingestPdfFile } = await import('../memory/knowledgeManager.js');

    let filename: string;
    let content: string;
    let isPdf = false;
    let pdfBuffer: Buffer | null = null;

    // Support both JSON body and multipart upload
    const contentType = request.headers['content-type'] || '';
    if (contentType.includes('application/json')) {
      const body = request.body as { filename?: string; content?: string };
      if (!body.filename || !body.content) {
        return reply.code(400).send({ error: 'filename and content required' });
      }
      filename = body.filename;
      content = body.content;
    } else {
      const data = await request.file();
      if (!data) return reply.code(400).send({ error: 'No file provided' });
      const chunks: Buffer[] = [];
      for await (const chunk of data.file) chunks.push(chunk);
      const buffer = Buffer.concat(chunks);
      filename = data.filename;
      if (filename.toLowerCase().endsWith('.pdf')) {
        isPdf = true;
        pdfBuffer = buffer;
        content = ''; // Will be extracted by ingestPdfFile
      } else {
        content = buffer.toString('utf-8');
      }
    }

    try {
      const item = isPdf && pdfBuffer
        ? await ingestPdfFile(id, filename, pdfBuffer)
        : await ingestKnowledgeFile(id, filename, content);

      // Refresh agent's knowledge cache
      const { getAgentKnowledge } = await import('../memory/knowledgeManager.js');
      const agent = agentManager.getAgent(id);
      if (agent) {
        (agent as any).setKnowledge(getAgentKnowledge(id));
      }

      return { success: true, item: { id: item.id, filename: item.filename, summary: item.summary, tokens: item.tokens } };
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  app.get('/api/agents/:id/knowledge', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.currentUser!;
    if (!agentManager.canAccessAgent(user.id, id, user.is_admin === 1)) {
      return reply.code(403).send({ error: 'Access denied' });
    }

    const { listAgentKnowledge, getTokenCost } = await import('../memory/knowledgeManager.js');
    const items = listAgentKnowledge(id);
    const totalTokens = getTokenCost(id);

    return {
      items: items.map(i => ({ id: i.id, filename: i.filename, summary: i.summary, tokens: i.tokens, createdAt: i.createdAt })),
      totalTokens
    };
  });

  app.delete('/api/agents/:id/knowledge/:itemId', async (request, reply) => {
    const { id, itemId } = request.params as { id: string; itemId: string };
    const user = request.currentUser!;
    if (!agentManager.canAccessAgent(user.id, id, user.is_admin === 1)) {
      return reply.code(403).send({ error: 'Access denied' });
    }

    const { removeKnowledgeItem, getAgentKnowledge } = await import('../memory/knowledgeManager.js');
    const deleted = removeKnowledgeItem(itemId);

    // Refresh agent's knowledge cache
    const agent = agentManager.getAgent(id);
    if (agent) {
      (agent as any).setKnowledge(getAgentKnowledge(id));
    }

    return { deleted };
  });

  // ===== KNOWLEDGE SHARING =====

  app.post('/api/agents/:id/knowledge/share', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.currentUser!;
    if (!agentManager.canAccessAgent(user.id, id, user.is_admin === 1)) {
      return reply.code(403).send({ error: 'Access denied' });
    }
    const { targetAgentId, itemIds } = request.body as { targetAgentId: string; itemIds?: string[] };
    if (!targetAgentId) return reply.code(400).send({ error: 'targetAgentId required' });
    if (!agentManager.getAgent(targetAgentId)) return reply.code(404).send({ error: 'Target agent not found' });

    const { shareKnowledge, getAgentKnowledge } = await import('../memory/knowledgeManager.js');
    try {
      const shared = shareKnowledge(id, targetAgentId, itemIds);
      // Refresh target agent's knowledge cache
      const targetAgent = agentManager.getAgent(targetAgentId);
      if (targetAgent) {
        (targetAgent as any).setKnowledge(getAgentKnowledge(targetAgentId));
      }
      return { success: true, sharedCount: shared };
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // ===== SYNC DAEMON =====

  app.post('/api/agents/:id/sync', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.currentUser!;
    if (!agentManager.canAccessAgent(user.id, id, user.is_admin === 1)) {
      return reply.code(403).send({ error: 'Access denied' });
    }
    const { folderPath, intervalSeconds } = request.body as { folderPath: string; intervalSeconds?: number };
    if (!folderPath) return reply.code(400).send({ error: 'folderPath required' });

    const { startSyncDaemon } = await import('../sync/daemon.js');
    try {
      startSyncDaemon(id, folderPath, intervalSeconds || 30, agentManager);
      return { success: true, watching: folderPath, interval: intervalSeconds || 30 };
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  app.delete('/api/agents/:id/sync', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.currentUser!;
    if (!agentManager.canAccessAgent(user.id, id, user.is_admin === 1)) {
      return reply.code(403).send({ error: 'Access denied' });
    }
    const { stopSyncDaemon } = await import('../sync/daemon.js');
    stopSyncDaemon(id);
    return { success: true, stopped: true };
  });

  app.get('/api/agents/:id/sync', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.currentUser!;
    if (!agentManager.canAccessAgent(user.id, id, user.is_admin === 1)) {
      return reply.code(403).send({ error: 'Access denied' });
    }
    const { getSyncStatus } = await import('../sync/daemon.js');
    return getSyncStatus(id);
  });

  // ===== TRANSCRIPTION (AssemblyAI) =====

  app.post('/api/transcribe', async (request, reply) => {
    const apiKey = process.env.ASSEMBLYAI_API_KEY;
    if (!apiKey) return reply.code(500).send({ error: 'AssemblyAI API key not configured' });

    try {
      const data = await request.file();
      if (!data) return reply.code(400).send({ error: 'No audio file provided' });

      const chunks: Buffer[] = [];
      for await (const chunk of data.file) chunks.push(chunk);
      const audioBuffer = Buffer.concat(chunks);

      const uploadRes = await fetch('https://api.assemblyai.com/v2/upload', {
        method: 'POST',
        headers: { authorization: apiKey, 'content-type': 'application/octet-stream' },
        body: audioBuffer
      });
      const { upload_url } = await uploadRes.json() as { upload_url: string };

      const transcriptRes = await fetch('https://api.assemblyai.com/v2/transcript', {
        method: 'POST',
        headers: { authorization: apiKey, 'content-type': 'application/json' },
        body: JSON.stringify({ audio_url: upload_url })
      });
      const transcript = await transcriptRes.json() as { id: string };

      let result: any;
      while (true) {
        const pollRes = await fetch(`https://api.assemblyai.com/v2/transcript/${transcript.id}`, {
          headers: { authorization: apiKey }
        });
        result = await pollRes.json();
        if (result.status === 'completed') break;
        if (result.status === 'error') return reply.code(500).send({ error: 'Transcription failed: ' + result.error });
        await new Promise(r => setTimeout(r, 1000));
      }
      return { text: result.text };
    } catch (err: any) {
      return reply.code(500).send({ error: 'Transcription error: ' + err.message });
    }
  });

  // ===== SKILLS =====

  app.get('/api/skills', async () => {
    const skills = skillRegistry.getAllSkills();
    return {
      skills: skills.map((s) => ({
        id: s.id, name: s.name, description: s.description,
        version: s.version, enabled: s.enabled, parameters: s.parameters
      })),
      count: skills.length
    };
  });

  app.post('/api/skills/upload', async (request, reply) => {
    const files = await request.saveRequestFiles();
    const fileData = files.map((f) => ({ filename: f.filename, content: f.file as unknown as Buffer }));
    const result = await skillRegistry.uploadSkills(fileData);
    return result;
  });

  app.patch('/api/skills/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { enabled } = request.body as { enabled: boolean };
    const skill = skillRegistry.getSkill(id);
    if (!skill) return reply.code(404).send({ error: 'Skill not found' });
    skill.enabled = enabled;
    return { skill: { id: skill.id, enabled: skill.enabled } };
  });

  // ===== CONFIGS =====

  app.get('/api/configs/export', async () => {
    const agents = agentManager.getAllAgents();
    const skills = skillRegistry.getAllSkills();
    return {
      version: '1.0.0', exportedAt: new Date().toISOString(),
      agents: agents.map((a) => a.config),
      skills: skills.map((s) => ({
        id: s.id, name: s.name, description: s.description,
        version: s.version, enabled: s.enabled, parameters: s.parameters
      }))
    };
  });

  app.post('/api/configs/import', async (request) => {
    const data = request.body as any;
    const user = request.currentUser!;
    const results = { agents: { created: 0, failed: 0 }, skills: { enabled: 0 } };
    if (data.agents) {
      for (const agentConfig of data.agents) {
        try { await agentManager.createAgent(agentConfig, user.id); results.agents.created++; } catch { results.agents.failed++; }
      }
    }
    if (data.skills) {
      for (const skillData of data.skills) {
        const skill = skillRegistry.getSkill(skillData.id);
        if (skill) { skill.enabled = skillData.enabled; results.skills.enabled++; }
      }
    }
    return { imported: true, results };
  });

  // ===== CHANNELS =====

  app.get('/api/channels', async () => {
    return { channels: ['imessage', 'api'] };
  });

  app.post('/api/channels/:channel/test', async (request, reply) => {
    const { channel } = request.params as { channel: string };
    const { to, message } = request.body as { to: string; message: string };
    try {
      await channelManager.sendMessage(channel, to, message);
      return { sent: true };
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  // Start server
  await app.listen({ port, host: '0.0.0.0' });

  return app;
}
