import { getDatabase } from '../db/database.js';
import { v4 as uuid } from 'uuid';

export interface Lead {
  id: string;
  visitorId: string;
  status: 'new' | 'hot' | 'warm' | 'cold' | 'converted' | 'lost';
  contactEmail: string | null;
  contactName: string | null;
  businessName: string | null;
  useCase: string | null;
  channels: string | null;
  summary: string | null;
  nextStep: string | null;
  notes: string | null;
  messageCount: number;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface LeadMessage {
  id: string;
  leadId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface LeadComment {
  id: string;
  leadId: string;
  authorName: string;
  content: string;
  createdAt: string;
}

/**
 * Initialize leads tables
 */
export function initLeadsTables(): void {
  const db = getDatabase();
  db.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      visitor_id TEXT NOT NULL,
      status TEXT DEFAULT 'new',
      contact_email TEXT,
      contact_name TEXT,
      business_name TEXT,
      use_case TEXT,
      channels TEXT,
      summary TEXT,
      next_step TEXT,
      notes TEXT,
      message_count INTEGER DEFAULT 0,
      last_message_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_leads_visitor ON leads(visitor_id);
    CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);

    CREATE TABLE IF NOT EXISTS lead_messages (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_lead_messages_lead ON lead_messages(lead_id);

    CREATE TABLE IF NOT EXISTS lead_comments (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL,
      author_name TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_lead_comments_lead ON lead_comments(lead_id);
  `);
}

/**
 * Find or create a lead by visitor ID
 */
export function getOrCreateLead(visitorId: string): Lead {
  const db = getDatabase();
  const now = new Date().toISOString();

  let row = db.prepare('SELECT * FROM leads WHERE visitor_id = ? ORDER BY created_at DESC LIMIT 1').get(visitorId) as any;

  if (!row) {
    const id = uuid();
    db.prepare(`
      INSERT INTO leads (id, visitor_id, status, message_count, created_at, updated_at)
      VALUES (?, ?, 'new', 0, ?, ?)
    `).run(id, visitorId, now, now);
    row = db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
  }

  return mapRow(row);
}

/**
 * Add a message to a lead's conversation
 */
export function addLeadMessage(leadId: string, role: 'user' | 'assistant', content: string): LeadMessage {
  const db = getDatabase();
  const id = uuid();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO lead_messages (id, lead_id, role, content, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, leadId, role, content, now);

  // Update lead message count and timestamp
  db.prepare(`
    UPDATE leads SET message_count = message_count + 1, last_message_at = ?, updated_at = ? WHERE id = ?
  `).run(now, now, leadId);

  return { id, leadId, role, content, createdAt: now };
}

/**
 * Update lead metadata (extracted from conversation)
 */
export function updateLeadInfo(leadId: string, info: Partial<Pick<Lead, 'contactEmail' | 'contactName' | 'businessName' | 'useCase' | 'channels' | 'summary' | 'nextStep'>>): void {
  const db = getDatabase();
  const now = new Date().toISOString();
  const sets: string[] = ['updated_at = ?'];
  const vals: any[] = [now];

  if (info.contactEmail !== undefined) { sets.push('contact_email = ?'); vals.push(info.contactEmail); }
  if (info.contactName !== undefined) { sets.push('contact_name = ?'); vals.push(info.contactName); }
  if (info.businessName !== undefined) { sets.push('business_name = ?'); vals.push(info.businessName); }
  if (info.useCase !== undefined) { sets.push('use_case = ?'); vals.push(info.useCase); }
  if (info.channels !== undefined) { sets.push('channels = ?'); vals.push(info.channels); }
  if (info.summary !== undefined) { sets.push('summary = ?'); vals.push(info.summary); }
  if (info.nextStep !== undefined) { sets.push('next_step = ?'); vals.push(info.nextStep); }

  vals.push(leadId);
  db.prepare(`UPDATE leads SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
}

/**
 * Update lead status
 */
export function updateLeadStatus(leadId: string, status: Lead['status']): void {
  const db = getDatabase();
  db.prepare('UPDATE leads SET status = ?, updated_at = ? WHERE id = ?').run(status, new Date().toISOString(), leadId);
}

/**
 * Update lead notes
 */
export function updateLeadNotes(leadId: string, notes: string): void {
  const db = getDatabase();
  db.prepare('UPDATE leads SET notes = ?, updated_at = ? WHERE id = ?').run(notes, new Date().toISOString(), leadId);
}

/**
 * Add a comment to a lead
 */
export function addLeadComment(leadId: string, authorName: string, content: string): LeadComment {
  const db = getDatabase();
  const id = uuid();
  const now = new Date().toISOString();
  db.prepare('INSERT INTO lead_comments (id, lead_id, author_name, content, created_at) VALUES (?, ?, ?, ?, ?)').run(id, leadId, authorName, content, now);
  return { id, leadId, authorName, content, createdAt: now };
}

/**
 * Get all leads, newest first
 */
export function getAllLeads(): Lead[] {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM leads ORDER BY updated_at DESC').all() as any[];
  return rows.map(mapRow);
}

/**
 * Get a single lead by ID
 */
export function getLead(id: string): Lead | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM leads WHERE id = ?').get(id) as any;
  return row ? mapRow(row) : null;
}

/**
 * Get messages for a lead
 */
export function getLeadMessages(leadId: string): LeadMessage[] {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM lead_messages WHERE lead_id = ? ORDER BY created_at ASC').all(leadId) as any[];
  return rows.map(r => ({ id: r.id, leadId: r.lead_id, role: r.role, content: r.content, createdAt: r.created_at }));
}

/**
 * Get comments for a lead
 */
export function getLeadComments(leadId: string): LeadComment[] {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM lead_comments WHERE lead_id = ? ORDER BY created_at ASC').all(leadId) as any[];
  return rows.map(r => ({ id: r.id, leadId: r.lead_id, authorName: r.author_name, content: r.content, createdAt: r.created_at }));
}

function mapRow(row: any): Lead {
  return {
    id: row.id,
    visitorId: row.visitor_id,
    status: row.status,
    contactEmail: row.contact_email,
    contactName: row.contact_name,
    businessName: row.business_name,
    useCase: row.use_case,
    channels: row.channels,
    summary: row.summary,
    nextStep: row.next_step,
    notes: row.notes,
    messageCount: row.message_count,
    lastMessageAt: row.last_message_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
