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
import { authenticateUser } from '../auth/middleware.js';
import { getDatabase } from '../db/database.js';

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
      team: agents.map((a) => ({
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

  // ===== SKILLS =====

  app.get('/api/skills', async () => {
    const skills = skillRegistry.getAllSkills();
    return {
      skills: skills.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        version: s.version,
        enabled: s.enabled,
        parameters: s.parameters
      })),
      count: skills.length
    };
  });

  app.post('/api/skills/upload', async (request, reply) => {
    const files = await request.saveRequestFiles();
    const fileData = files.map((f) => ({
      filename: f.filename,
      content: f.file as unknown as Buffer
    }));
    const result = await skillRegistry.uploadSkills(fileData);
    return result;
  });

  app.patch('/api/skills/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { enabled } = request.body as { enabled: boolean };
    const skill = skillRegistry.getSkill(id);
    if (!skill) {
      return reply.code(404).send({ error: 'Skill not found' });
    }
    skill.enabled = enabled;
    return { skill: { id: skill.id, enabled: skill.enabled } };
  });

  // ===== CONFIGS =====

  app.get('/api/configs/export', async () => {
    const agents = agentManager.getAllAgents();
    const skills = skillRegistry.getAllSkills();
    return {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      agents: agents.map((a) => a.config),
      skills: skills.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        version: s.version,
        enabled: s.enabled,
        parameters: s.parameters
      }))
    };
  });

  app.post('/api/configs/import', async (request) => {
    const data = request.body as any;
    const user = request.currentUser!;
    const results = { agents: { created: 0, failed: 0 }, skills: { enabled: 0 } };
    if (data.agents) {
      for (const agentConfig of data.agents) {
        try {
          await agentManager.createAgent(agentConfig, user.id);
          results.agents.created++;
        } catch {
          results.agents.failed++;
        }
      }
    }
    if (data.skills) {
      for (const skillData of data.skills) {
        const skill = skillRegistry.getSkill(skillData.id);
        if (skill) {
          skill.enabled = skillData.enabled;
          results.skills.enabled++;
        }
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
