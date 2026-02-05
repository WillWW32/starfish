import { FastifyRequest, FastifyReply } from 'fastify';
import { UserService, User } from '../users/service.js';
import { getDatabase } from '../db/database.js';
import { v4 as uuid } from 'uuid';

// Extend Fastify request to include user
declare module 'fastify' {
  interface FastifyRequest {
    currentUser?: User;
  }
}

const userService = new UserService();

/**
 * Authenticate user via Bearer token from session
 * Attaches user to request.currentUser
 */
export async function authenticateUser(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    reply.code(401).send({ error: 'Authentication required' });
    return;
  }

  const token = authHeader.slice(7);
  const user = userService.validateSession(token);

  if (!user) {
    reply.code(401).send({ error: 'Invalid or expired session' });
    return;
  }

  request.currentUser = user;
}

/**
 * Require the authenticated user to be an admin
 */
export async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!request.currentUser) {
    reply.code(401).send({ error: 'Authentication required' });
    return;
  }

  if (request.currentUser.is_admin !== 1) {
    reply.code(403).send({ error: 'Admin access required' });
    return;
  }
}

/**
 * Check if user owns a resource (agent, etc.)
 * Uses user_permissions table to verify
 */
export function requireOwnership(resourceType: string) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.currentUser) {
      reply.code(401).send({ error: 'Authentication required' });
      return;
    }

    // Admins bypass ownership check
    if (request.currentUser.is_admin === 1) return;

    const params = request.params as { id?: string };
    if (!params.id) return;

    const db = getDatabase();
    const permission = db.prepare(`
      SELECT * FROM user_permissions
      WHERE user_id = ? AND agent_id = ? AND permission_type = ?
    `).get(request.currentUser.id, params.id, resourceType);

    if (!permission) {
      reply.code(403).send({ error: 'Access denied' });
      return;
    }
  };
}

/**
 * Grant a user permission to access an agent
 */
export function grantPermission(userId: string, agentId: string, permissionType: string, skillName?: string): void {
  const db = getDatabase();

  db.prepare(`
    INSERT INTO user_permissions (id, user_id, agent_id, permission_type, skill_name, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(uuid(), userId, agentId, permissionType, skillName || null, new Date().toISOString());
}
