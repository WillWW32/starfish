import { Agent } from './agent.js';
import { AgentConfig, Message } from '../types.js';
import { SkillRegistry } from '../skills/registry.js';
import { ChannelManager } from '../channels/manager.js';
import { getDatabase } from '../db/database.js';
import { createDelegateSkill } from '../skills/builtin/delegate.js';
import { v4 as uuid } from 'uuid';
import fs from 'fs/promises';
import path from 'path';

export class AgentManager {
  private agents: Map<string, Agent> = new Map();
  private skillRegistry: SkillRegistry;
  private channelManager: ChannelManager;

  constructor(skillRegistry: SkillRegistry, channelManager: ChannelManager) {
    this.skillRegistry = skillRegistry;
    this.channelManager = channelManager;
    this.initializeAgentsTable();
  }

  /**
   * Create agents table for persistence + ownership tracking
   */
  private initializeAgentsTable(): void {
    const db = getDatabase();
    db.exec(`
      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL,
        config TEXT NOT NULL,
        status TEXT DEFAULT 'stopped',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_agents_owner ON agents(owner_id);
    `);
  }

  /**
   * Load agent configs from filesystem (legacy support)
   */
  async loadAgents(agentsPath: string): Promise<void> {
    try {
      const files = await fs.readdir(agentsPath);
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const raw = await fs.readFile(path.join(agentsPath, file), 'utf-8');
            const config = JSON.parse(raw) as AgentConfig;
            const agent = new Agent(config);
            await agent.initialize();

            // Register skills for agent
            this.bindSkillsToAgent(agent);

            this.agents.set(config.id, agent);
          } catch (err) {
            console.warn(`  Failed to load agent from ${file}:`, err);
          }
        }
      }
    } catch {
      // Agents directory doesn't exist yet
    }

    // Also load from database
    await this.loadAgentsFromDB();
  }

  /**
   * Load agents persisted in database
   */
  private async loadAgentsFromDB(): Promise<void> {
    const db = getDatabase();
    const rows = db.prepare('SELECT * FROM agents WHERE status = ?').all('running') as any[];

    for (const row of rows) {
      if (this.agents.has(row.id)) continue; // Already loaded from filesystem

      try {
        const config = JSON.parse(row.config) as AgentConfig;
        const agent = new Agent(config);
        await agent.initialize();
        this.bindSkillsToAgent(agent);
        this.agents.set(config.id, agent);
      } catch (err) {
        console.warn(`  Failed to load agent ${row.id} from DB:`, err);
      }
    }
  }

  /**
   * Bind registered skills to an agent based on its config
   */
  private bindSkillsToAgent(agent: Agent): void {
    const bound: string[] = [];
    const skipped: string[] = [];

    for (const skillId of agent.config.skills) {
      // Delegate skill is special — needs agentManager reference via factory
      if (skillId === 'delegate') {
        const delegateSkill = createDelegateSkill(this);
        agent.registerTool(
          { name: delegateSkill.id, description: delegateSkill.description, parameters: delegateSkill.parameters as any },
          delegateSkill.execute!
        );
        bound.push('delegate');
        continue;
      }

      const skill = this.skillRegistry.getSkill(skillId);
      if (skill && skill.enabled && skill.execute) {
        agent.registerTool(
          { name: skill.id, description: skill.description, parameters: skill.parameters as any },
          skill.execute
        );
        bound.push(skillId);
      } else {
        const reason = !skill ? 'not found in registry' : !skill.enabled ? 'disabled' : 'no execute fn';
        skipped.push(`${skillId} (${reason})`);
        console.warn(`  ⚠️ Skill "${skillId}" not bound to ${agent.config.name}: ${reason}`);
      }
    }

    console.log(`  🔧 ${agent.config.name}: ${bound.length} tools bound [${bound.join(', ')}]`);
    if (skipped.length > 0) {
      console.warn(`  ❌ ${agent.config.name}: ${skipped.length} skills skipped [${skipped.join(', ')}]`);
    }
  }

  // ===== MULTI-TENANT CRUD =====

  /**
   * Create agent owned by a user
   */
  async createAgent(config: Partial<AgentConfig> & { systemPrompt: string; name: string }, ownerId: string): Promise<Agent> {
    const now = new Date().toISOString();
    const agentConfig: AgentConfig = {
      id: config.id || uuid(),
      name: config.name,
      description: config.description,
      model: config.model || 'claude-sonnet-4-5-20250929',
      systemPrompt: config.systemPrompt,
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens ?? 4096,
      skills: config.skills || [],
      channels: config.channels || {},
      memory: config.memory || { type: 'sqlite', maxMessages: 1000, summarizeAfter: 50 },
      parentAgentId: config.parentAgentId,
      metadata: config.metadata || {},
      unrestricted: config.unrestricted ?? true,
      autoStart: config.autoStart ?? true,
      createdAt: now,
      updatedAt: now
    };

    // Persist to DB
    const db = getDatabase();
    db.prepare(`
      INSERT INTO agents (id, owner_id, config, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(agentConfig.id, ownerId, JSON.stringify(agentConfig), 'running', now, now);

    // Create and start agent
    const agent = new Agent(agentConfig);
    await agent.initialize();
    this.bindSkillsToAgent(agent);
    this.agents.set(agentConfig.id, agent);

    // Grant owner permission
    db.prepare(`
      INSERT INTO user_permissions (id, user_id, agent_id, permission_type, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(uuid(), ownerId, agentConfig.id, 'owner', now);

    return agent;
  }

  /**
   * Get all agents for a specific user (or all for admin)
   */
  getAgentsForUser(userId: string, isAdmin: boolean): Agent[] {
    if (isAdmin) {
      return Array.from(this.agents.values());
    }

    const db = getDatabase();
    const permissions = db.prepare(`
      SELECT agent_id FROM user_permissions WHERE user_id = ?
    `).all(userId) as { agent_id: string }[];

    const allowedIds = new Set(permissions.map(p => p.agent_id));
    return Array.from(this.agents.values()).filter(a => allowedIds.has(a.config.id));
  }

  /**
   * Check if user can access an agent
   */
  canAccessAgent(userId: string, agentId: string, isAdmin: boolean): boolean {
    if (isAdmin) return true;

    const db = getDatabase();
    const perm = db.prepare(`
      SELECT * FROM user_permissions WHERE user_id = ? AND agent_id = ?
    `).get(userId, agentId);

    return !!perm;
  }

  /**
   * Get agent owner ID
   */
  getAgentOwner(agentId: string): string | null {
    const db = getDatabase();
    const row = db.prepare('SELECT owner_id FROM agents WHERE id = ?').get(agentId) as { owner_id: string } | undefined;
    return row?.owner_id || null;
  }

  // ===== EXISTING INTERFACE =====

  getAllAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  getAgent(id: string): Agent | undefined {
    return this.agents.get(id);
  }

  async updateAgent(id: string, updates: Partial<AgentConfig>): Promise<Agent> {
    const agent = this.agents.get(id);
    if (!agent) throw new Error(`Agent ${id} not found`);

    const now = new Date().toISOString();
    Object.assign(agent.config, updates, { updatedAt: now });

    // Update DB
    const db = getDatabase();
    db.prepare('UPDATE agents SET config = ?, updated_at = ? WHERE id = ?')
      .run(JSON.stringify(agent.config), now, id);

    return agent;
  }

  async deleteAgent(id: string): Promise<void> {
    const agent = this.agents.get(id);
    if (!agent) throw new Error(`Agent ${id} not found`);

    await agent.stop();
    this.agents.delete(id);

    // Remove from DB
    const db = getDatabase();
    db.prepare('DELETE FROM agents WHERE id = ?').run(id);
    db.prepare('DELETE FROM user_permissions WHERE agent_id = ?').run(id);
  }

  async processMessage(id: string, message: Omit<Message, 'id' | 'timestamp'>): Promise<Message> {
    const agent = this.agents.get(id);
    if (!agent) throw new Error(`Agent ${id} not found`);
    return agent.processMessage(message);
  }

  async spawnSubAgent(parentId: string, config: Partial<AgentConfig> & { systemPrompt: string; name: string }): Promise<Agent> {
    const parent = this.agents.get(parentId);
    if (!parent) throw new Error(`Parent agent ${parentId} not found`);

    // Find owner of parent
    const ownerId = this.getAgentOwner(parentId) || 'system';

    const subConfig = {
      ...config,
      parentAgentId: parentId
    };

    return this.createAgent(subConfig, ownerId);
  }

  async stopAll(): Promise<void> {
    for (const agent of this.agents.values()) {
      await agent.stop();
    }
    this.agents.clear();
  }

  count(): number {
    return this.agents.size;
  }
}
