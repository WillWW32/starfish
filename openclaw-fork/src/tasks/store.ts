import { getDatabase } from '../db/database.js';
import { v4 as uuid } from 'uuid';

// ─── Types ───

export type TaskType = 'social_post' | 'lead_followup' | 'content_gen' | 'monitoring';
export type ExecutionStatus = 'running' | 'success' | 'failed' | 'skipped';

export interface ScheduledTask {
  id: string;
  agentId: string;
  name: string;
  description: string | null;
  taskType: TaskType;
  cronExpression: string;
  timezone: string;
  config: any;
  enabled: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskExecutionLog {
  id: string;
  taskId: string;
  agentId: string;
  startedAt: string;
  completedAt: string | null;
  status: ExecutionStatus;
  resultSummary: string | null;
  errorMessage: string | null;
  executionTimeMs: number | null;
  createdAt: string;
}

// ─── Schema ───

export function initTasksTables(): void {
  const db = getDatabase();
  db.exec(`
    CREATE TABLE IF NOT EXISTS scheduled_tasks (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      task_type TEXT NOT NULL,
      cron_expression TEXT NOT NULL,
      timezone TEXT DEFAULT 'America/New_York',
      config TEXT NOT NULL DEFAULT '{}',
      enabled INTEGER DEFAULT 1,
      last_run_at TEXT,
      next_run_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_tasks_agent ON scheduled_tasks(agent_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_enabled ON scheduled_tasks(enabled);

    CREATE TABLE IF NOT EXISTS task_execution_logs (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      status TEXT NOT NULL DEFAULT 'running',
      result_summary TEXT,
      error_message TEXT,
      execution_time_ms INTEGER,
      created_at TEXT NOT NULL,
      FOREIGN KEY (task_id) REFERENCES scheduled_tasks(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_task_logs_task ON task_execution_logs(task_id);
    CREATE INDEX IF NOT EXISTS idx_task_logs_status ON task_execution_logs(status);
  `);
}

// ─── Task CRUD ───

export function createTask(
  agentId: string,
  name: string,
  taskType: TaskType,
  cronExpression: string,
  config: any,
  description?: string,
  timezone?: string
): ScheduledTask {
  const db = getDatabase();
  const id = uuid();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO scheduled_tasks (id, agent_id, name, description, task_type, cron_expression, timezone, config, enabled, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `).run(id, agentId, name, description || null, taskType, cronExpression, timezone || 'America/New_York', JSON.stringify(config), now, now);

  return getTask(id)!;
}

export function updateTask(id: string, updates: Partial<Pick<ScheduledTask, 'name' | 'description' | 'cronExpression' | 'config' | 'enabled' | 'timezone'>>): ScheduledTask | null {
  const db = getDatabase();
  const now = new Date().toISOString();
  const sets: string[] = ['updated_at = ?'];
  const vals: any[] = [now];

  if (updates.name !== undefined) { sets.push('name = ?'); vals.push(updates.name); }
  if (updates.description !== undefined) { sets.push('description = ?'); vals.push(updates.description); }
  if (updates.cronExpression !== undefined) { sets.push('cron_expression = ?'); vals.push(updates.cronExpression); }
  if (updates.config !== undefined) { sets.push('config = ?'); vals.push(JSON.stringify(updates.config)); }
  if (updates.enabled !== undefined) { sets.push('enabled = ?'); vals.push(updates.enabled ? 1 : 0); }
  if (updates.timezone !== undefined) { sets.push('timezone = ?'); vals.push(updates.timezone); }

  vals.push(id);
  db.prepare(`UPDATE scheduled_tasks SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  return getTask(id);
}

export function deleteTask(id: string): void {
  const db = getDatabase();
  db.prepare('DELETE FROM task_execution_logs WHERE task_id = ?').run(id);
  db.prepare('DELETE FROM scheduled_tasks WHERE id = ?').run(id);
}

export function getTask(id: string): ScheduledTask | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM scheduled_tasks WHERE id = ?').get(id) as any;
  return row ? mapTask(row) : null;
}

export function getEnabledTasks(): ScheduledTask[] {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM scheduled_tasks WHERE enabled = 1 ORDER BY created_at ASC').all() as any[];
  return rows.map(mapTask);
}

export function getTasksByAgent(agentId: string): ScheduledTask[] {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM scheduled_tasks WHERE agent_id = ? ORDER BY created_at DESC').all(agentId) as any[];
  return rows.map(mapTask);
}

export function getAllTasks(): ScheduledTask[] {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM scheduled_tasks ORDER BY created_at DESC').all() as any[];
  return rows.map(mapTask);
}

export function updateTaskRunTime(id: string, runAt: string, nextRunAt?: string): void {
  const db = getDatabase();
  db.prepare('UPDATE scheduled_tasks SET last_run_at = ?, next_run_at = ?, updated_at = ? WHERE id = ?')
    .run(runAt, nextRunAt || null, new Date().toISOString(), id);
}

// ─── Execution Logs ───

export function logExecutionStart(taskId: string, agentId: string): TaskExecutionLog {
  const db = getDatabase();
  const id = uuid();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO task_execution_logs (id, task_id, agent_id, started_at, status, created_at)
    VALUES (?, ?, ?, ?, 'running', ?)
  `).run(id, taskId, agentId, now, now);

  return { id, taskId, agentId, startedAt: now, completedAt: null, status: 'running', resultSummary: null, errorMessage: null, executionTimeMs: null, createdAt: now };
}

export function logExecutionComplete(logId: string, status: ExecutionStatus, summary?: string, error?: string, timeMs?: number): void {
  const db = getDatabase();
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE task_execution_logs SET completed_at = ?, status = ?, result_summary = ?, error_message = ?, execution_time_ms = ? WHERE id = ?
  `).run(now, status, summary || null, error || null, timeMs || null, logId);
}

export function getExecutionLogs(taskId: string, limit: number = 50): TaskExecutionLog[] {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM task_execution_logs WHERE task_id = ? ORDER BY started_at DESC LIMIT ?').all(taskId, limit) as any[];
  return rows.map(mapLog);
}

export function getRecentExecutions(agentId?: string, limit: number = 50): TaskExecutionLog[] {
  const db = getDatabase();
  let rows: any[];
  if (agentId) {
    rows = db.prepare('SELECT * FROM task_execution_logs WHERE agent_id = ? ORDER BY started_at DESC LIMIT ?').all(agentId, limit) as any[];
  } else {
    rows = db.prepare('SELECT * FROM task_execution_logs ORDER BY started_at DESC LIMIT ?').all(limit) as any[];
  }
  return rows.map(mapLog);
}

// ─── Mappers ───

function mapTask(row: any): ScheduledTask {
  return {
    id: row.id,
    agentId: row.agent_id,
    name: row.name,
    description: row.description,
    taskType: row.task_type,
    cronExpression: row.cron_expression,
    timezone: row.timezone,
    config: JSON.parse(row.config || '{}'),
    enabled: !!row.enabled,
    lastRunAt: row.last_run_at,
    nextRunAt: row.next_run_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapLog(row: any): TaskExecutionLog {
  return {
    id: row.id,
    taskId: row.task_id,
    agentId: row.agent_id,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    status: row.status,
    resultSummary: row.result_summary,
    errorMessage: row.error_message,
    executionTimeMs: row.execution_time_ms,
    createdAt: row.created_at
  };
}
