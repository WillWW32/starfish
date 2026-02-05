import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import jwt from '@fastify/jwt';
import { AgentManager } from '../agents/manager.js';
import { SkillRegistry } from '../skills/registry.js';
import { ChannelManager } from '../channels/manager.js';
import { ApiAdapter } from '../channels/adapters/api.js';
import { v4 as uuid } from 'uuid';

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

  // Auth middleware (optional, based on API_KEY env)
  app.addHook('preHandler', async (request, reply) => {
    const publicPaths = ['/health', '/api/auth/login'];
    if (publicPaths.includes(request.url)) return;

    const apiKey = process.env.API_KEY;
    if (!apiKey) return; // No auth required if no API_KEY set

    const authHeader = request.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${apiKey}`) {
      reply.code(401).send({ error: 'Unauthorized' });
    }
  });

  // Health check
  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  // ===== AGENTS =====

  // List all agents
  app.get('/api/agents', async () => {
    const agents = agentManager.getAllAgents();
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

  // Get single agent
  app.get('/api/agents/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const agent = agentManager.getAgent(id);
    if (!agent) {
      return reply.code(404).send({ error: 'Agent not found' });
    }
    return { agent: agent.config };
  });

  // Create agent
  app.post('/api/agents', async (request) => {
    const config = request.body as any;
    const agent = await agentManager.createAgent(config);
    return { agent: agent.config };
  });

  // Update agent
  app.put('/api/agents/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const updates = request.body as any;
    try {
      const agent = await agentManager.updateAgent(id, updates);
      return { agent: agent.config };
    } catch (err: any) {
      return reply.code(404).send({ error: err.message });
    }
  });

  // Delete agent
  app.delete('/api/agents/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await agentManager.deleteAgent(id);
      return { deleted: true };
    } catch (err: any) {
      return reply.code(404).send({ error: err.message });
    }
  });

  // Spawn sub-agent
  app.post('/api/agents/:id/spawn', async (request, reply) => {
    const { id } = request.params as { id: string };
    const config = request.body as any;
    try {
      const subAgent = await agentManager.spawnSubAgent(id, config);
      return { subAgent };
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  // Send message to agent
  app.post('/api/agents/:id/message', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { content, channel = 'api', from = 'api-user' } = request.body as any;

    try {
      const response = await agentManager.processMessage(id, {
        agentId: id,
        channel,
        role: 'user',
        content,
        metadata: { from }
      });
      return { response: response.content };
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  // ===== SKILLS =====

  // List all skills
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

  // Upload skills
  app.post('/api/skills/upload', async (request, reply) => {
    const files = await request.saveRequestFiles();
    const fileData = files.map((f) => ({
      filename: f.filename,
      content: f.file as unknown as Buffer
    }));

    const result = await skillRegistry.uploadSkills(fileData);
    return result;
  });

  // Enable/disable skill
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

  // Export all configs
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

  // Import configs
  app.post('/api/configs/import', async (request) => {
    const data = request.body as any;
    const results = { agents: { created: 0, failed: 0 }, skills: { enabled: 0 } };

    // Import agents
    if (data.agents) {
      for (const agentConfig of data.agents) {
        try {
          await agentManager.createAgent(agentConfig);
          results.agents.created++;
        } catch {
          results.agents.failed++;
        }
      }
    }

    // Enable imported skills
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

  // List channels
  app.get('/api/channels', async () => {
    return { channels: ['imessage', 'api'] };
  });

  // Test channel
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
