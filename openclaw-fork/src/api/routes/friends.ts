import { FastifyInstance } from 'fastify';
import { AgentSpawner } from '../../agents/spawner.js';
import { AgentManager } from '../../agents/manager.js';
import { authenticateUser, requireAdmin } from '../../auth/middleware.js';

export async function friendRoutes(app: FastifyInstance, agentManager: AgentManager): Promise<void> {
  const spawner = new AgentSpawner(agentManager);

  /**
   * POST /api/friends — Create friend user + agent in one call (admin only)
   */
  app.post('/api/friends', { preHandler: [authenticateUser, requireAdmin] }, async (request, reply) => {
    const { user: userData, agent: agentData } = request.body as {
      user: { email: string; username: string; password: string; displayName?: string };
      agent: { name: string; description?: string; allowedSkills: string[]; model?: string; systemPrompt?: string };
    };

    if (!userData?.email || !userData?.username || !userData?.password) {
      return reply.code(400).send({ error: 'User email, username, and password required' });
    }
    if (!agentData?.name || !agentData?.allowedSkills?.length) {
      return reply.code(400).send({ error: 'Agent name and allowedSkills required' });
    }

    try {
      const result = await spawner.createFriendWithAgent(
        request.currentUser!.id,
        userData,
        {
          agentName: agentData.name,
          description: agentData.description,
          allowedSkills: agentData.allowedSkills,
          model: agentData.model,
          systemPrompt: agentData.systemPrompt
        }
      );
      return result;
    } catch (err: any) {
      if (err.message?.includes('UNIQUE')) {
        return reply.code(409).send({ error: 'Email or username already exists' });
      }
      return reply.code(400).send({ error: err.message });
    }
  });

  /**
   * GET /api/friends — List all friend agents (admin only)
   */
  app.get('/api/friends', { preHandler: [authenticateUser, requireAdmin] }, async () => {
    const friends = spawner.listFriendAgents();
    return { friends, count: friends.length };
  });

  /**
   * POST /api/friends/:userId/agent — Spawn additional agent for existing friend (admin only)
   */
  app.post('/api/friends/:userId/agent', { preHandler: [authenticateUser, requireAdmin] }, async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const { name, description, allowedSkills, model, systemPrompt } = request.body as any;

    if (!name || !allowedSkills?.length) {
      return reply.code(400).send({ error: 'Agent name and allowedSkills required' });
    }

    try {
      const agent = await spawner.spawnFriendAgent({
        friendUserId: userId,
        agentName: name,
        description,
        allowedSkills,
        model,
        systemPrompt
      });
      return { agent: agent.config };
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  /**
   * PATCH /api/friends/:agentId/skills — Update friend agent skills (admin only)
   */
  app.patch('/api/friends/:agentId/skills', { preHandler: [authenticateUser, requireAdmin] }, async (request, reply) => {
    const { agentId } = request.params as { agentId: string };
    const { allowedSkills } = request.body as { allowedSkills: string[] };

    if (!allowedSkills?.length) {
      return reply.code(400).send({ error: 'allowedSkills required' });
    }

    try {
      await spawner.updateFriendAgentSkills(agentId, allowedSkills);
      return { updated: true };
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });
}
