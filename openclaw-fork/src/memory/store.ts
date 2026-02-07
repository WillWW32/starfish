import Database from 'better-sqlite3';
import { createClient, RedisClientType } from 'redis';
import { Message, MemoryConfig } from '../types.js';
import { v4 as uuid } from 'uuid';
import path from 'path';
import fs from 'fs';

export class MemoryStore {
  private config: MemoryConfig;
  private agentId: string;
  private db?: Database.Database;
  private redis?: RedisClientType;
  private inMemory: Message[] = [];

  constructor(config: MemoryConfig, agentId: string) {
    this.config = config;
    this.agentId = agentId;
  }

  async initialize(): Promise<void> {
    switch (this.config.type) {
      case 'sqlite': {
        const dbPath = this.config.path || `./data/memory_${this.agentId}.db`;
        const dir = path.dirname(dbPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        this.db = new Database(dbPath);
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            agent_id TEXT NOT NULL,
            channel TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            tool_calls TEXT,
            metadata TEXT,
            timestamp TEXT NOT NULL
          );
          CREATE INDEX IF NOT EXISTS idx_agent_timestamp ON messages(agent_id, timestamp);
          CREATE TABLE IF NOT EXISTS summaries (
            id TEXT PRIMARY KEY,
            agent_id TEXT NOT NULL,
            summary TEXT NOT NULL,
            message_count INTEGER NOT NULL,
            created_at TEXT NOT NULL
          );
          CREATE INDEX IF NOT EXISTS idx_summary_agent ON summaries(agent_id, created_at);
        `);
        break;
      }

      case 'redis': {
        this.redis = createClient({ url: this.config.redisUrl });
        await this.redis.connect();
        break;
      }

      case 'memory':
      default:
        // In-memory store, nothing to initialize
        break;
    }
  }

  async addMessage(message: Message): Promise<void> {
    const msg: Message = {
      ...message,
      id: message.id || uuid(),
      timestamp: message.timestamp || new Date().toISOString()
    };

    switch (this.config.type) {
      case 'sqlite': {
        const stmt = this.db!.prepare(`
          INSERT INTO messages (id, agent_id, channel, role, content, tool_calls, metadata, timestamp)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(
          msg.id,
          msg.agentId,
          msg.channel,
          msg.role,
          msg.content,
          JSON.stringify(msg.toolCalls || []),
          JSON.stringify(msg.metadata || {}),
          msg.timestamp
        );
        break;
      }

      case 'redis': {
        const key = `messages:${this.agentId}`;
        await this.redis!.zAdd(key, {
          score: new Date(msg.timestamp).getTime(),
          value: JSON.stringify(msg)
        });
        // Trim to max messages
        const count = await this.redis!.zCard(key);
        if (count > (this.config.maxMessages || 1000)) {
          await this.redis!.zRemRangeByRank(key, 0, count - (this.config.maxMessages || 1000) - 1);
        }
        break;
      }

      case 'memory':
      default: {
        this.inMemory.push(msg);
        if (this.inMemory.length > (this.config.maxMessages || 1000)) {
          this.inMemory = this.inMemory.slice(-this.config.maxMessages!);
        }
        break;
      }
    }
  }

  async getMessages(limit: number = 50): Promise<Message[]> {
    switch (this.config.type) {
      case 'sqlite': {
        const stmt = this.db!.prepare(`
          SELECT * FROM messages
          WHERE agent_id = ?
          ORDER BY timestamp DESC
          LIMIT ?
        `);
        const rows = stmt.all(this.agentId, limit) as any[];
        return rows.reverse().map((row) => ({
          id: row.id,
          agentId: row.agent_id,
          channel: row.channel,
          role: row.role,
          content: row.content,
          toolCalls: JSON.parse(row.tool_calls || '[]'),
          metadata: JSON.parse(row.metadata || '{}'),
          timestamp: row.timestamp
        }));
      }

      case 'redis': {
        const key = `messages:${this.agentId}`;
        const values = await this.redis!.zRange(key, -limit, -1);
        return values.map((v) => JSON.parse(v));
      }

      case 'memory':
      default: {
        return this.inMemory.slice(-limit);
      }
    }
  }

  async clearMessages(): Promise<void> {
    switch (this.config.type) {
      case 'sqlite': {
        this.db!.exec(`DELETE FROM messages WHERE agent_id = '${this.agentId}'`);
        break;
      }

      case 'redis': {
        await this.redis!.del(`messages:${this.agentId}`);
        break;
      }

      case 'memory':
      default: {
        this.inMemory = [];
        break;
      }
    }
  }

  /**
   * Store a conversation summary (used when archiving old messages)
   */
  async storeSummary(summary: string, messageCount: number): Promise<void> {
    if (this.config.type === 'sqlite' && this.db) {
      this.db.prepare(`
        INSERT INTO summaries (id, agent_id, summary, message_count, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(uuid(), this.agentId, summary, messageCount, new Date().toISOString());
    }
  }

  /**
   * Get the latest conversation summary
   */
  async getLatestSummary(): Promise<string | null> {
    if (this.config.type === 'sqlite' && this.db) {
      const row = this.db.prepare(`
        SELECT summary FROM summaries WHERE agent_id = ? ORDER BY created_at DESC LIMIT 1
      `).get(this.agentId) as { summary: string } | undefined;
      return row?.summary || null;
    }
    return null;
  }

  /**
   * Archive old messages: keep recent N, delete the rest.
   * Call storeSummary() before this to preserve context.
   */
  async archiveOldMessages(keepRecent: number = 20): Promise<number> {
    if (this.config.type === 'sqlite' && this.db) {
      // Get IDs of messages to keep
      const recentIds = this.db.prepare(`
        SELECT id FROM messages WHERE agent_id = ? ORDER BY timestamp DESC LIMIT ?
      `).all(this.agentId, keepRecent) as { id: string }[];

      const keepSet = new Set(recentIds.map(r => r.id));

      // Count messages to delete
      const totalCount = this.db.prepare(`
        SELECT COUNT(*) as count FROM messages WHERE agent_id = ?
      `).get(this.agentId) as { count: number };

      const deleteCount = totalCount.count - keepSet.size;
      if (deleteCount <= 0) return 0;

      // Delete old messages (keep recent ones)
      if (keepSet.size > 0) {
        const placeholders = recentIds.map(() => '?').join(',');
        this.db.prepare(`
          DELETE FROM messages WHERE agent_id = ? AND id NOT IN (${placeholders})
        `).run(this.agentId, ...recentIds.map(r => r.id));
      }

      return deleteCount;
    }
    return 0;
  }

  /**
   * Get message count for this agent
   */
  async getMessageCount(): Promise<number> {
    if (this.config.type === 'sqlite' && this.db) {
      const row = this.db.prepare(`
        SELECT COUNT(*) as count FROM messages WHERE agent_id = ?
      `).get(this.agentId) as { count: number };
      return row.count;
    }
    if (this.config.type === 'memory') {
      return this.inMemory.length;
    }
    return 0;
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
    }
    if (this.redis) {
      await this.redis.disconnect();
    }
  }
}
