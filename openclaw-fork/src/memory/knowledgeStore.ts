import { getDatabase } from '../db/database.js';
import { v4 as uuid } from 'uuid';
import { estimateTokens } from '../utils/tokenCounter.js';

export interface KnowledgeItem {
  id: string;
  agentId: string;
  filename: string;
  contentType: string;
  originalContent: string;
  summary: string;
  tokens: number;
  createdAt: string;
}

/**
 * Initialize the knowledge tables in the main database
 */
export function initKnowledgeTables(): void {
  const db = getDatabase();
  db.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_items (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      content_type TEXT NOT NULL,
      original_content TEXT NOT NULL,
      summary TEXT NOT NULL,
      tokens INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_knowledge_agent ON knowledge_items(agent_id);
  `);
}

/**
 * Add a knowledge item with pre-generated summary
 */
export function addKnowledgeItem(item: Omit<KnowledgeItem, 'id' | 'createdAt'>): KnowledgeItem {
  const db = getDatabase();
  const id = uuid();
  const createdAt = new Date().toISOString();

  db.prepare(`
    INSERT INTO knowledge_items (id, agent_id, filename, content_type, original_content, summary, tokens, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, item.agentId, item.filename, item.contentType, item.originalContent, item.summary, item.tokens, createdAt);

  return { ...item, id, createdAt };
}

/**
 * Get all knowledge items for an agent
 */
export function getKnowledgeItems(agentId: string): KnowledgeItem[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT * FROM knowledge_items WHERE agent_id = ? ORDER BY created_at DESC
  `).all(agentId) as any[];

  return rows.map(row => ({
    id: row.id,
    agentId: row.agent_id,
    filename: row.filename,
    contentType: row.content_type,
    originalContent: row.original_content,
    summary: row.summary,
    tokens: row.tokens,
    createdAt: row.created_at
  }));
}

/**
 * Get concatenated knowledge summaries for injection into system prompt.
 * Respects a token budget — stops adding when budget is exceeded.
 */
export function getKnowledgeSummary(agentId: string, maxTokens: number = 15000): string {
  const items = getKnowledgeItems(agentId);
  if (items.length === 0) return '';

  const parts: string[] = [];
  let totalTokens = 0;

  for (const item of items) {
    if (totalTokens + item.tokens > maxTokens) break;
    parts.push(`### ${item.filename}\n${item.summary}`);
    totalTokens += item.tokens;
  }

  return parts.join('\n\n');
}

/**
 * Delete a knowledge item
 */
export function deleteKnowledgeItem(id: string): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM knowledge_items WHERE id = ?').run(id);
  return result.changes > 0;
}

/**
 * Get total token cost of all knowledge for an agent
 */
export function getKnowledgeTokenCost(agentId: string): number {
  const db = getDatabase();
  const row = db.prepare(`
    SELECT COALESCE(SUM(tokens), 0) as total FROM knowledge_items WHERE agent_id = ?
  `).get(agentId) as { total: number };
  return row.total;
}
