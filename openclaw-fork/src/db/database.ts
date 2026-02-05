import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (!db) {
    const dbPath = process.env.DB_PATH || './data/starfish.db';
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initializeSchema(db);
  }
  return db;
}

function initializeSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      totp_secret TEXT,
      totp_enabled INTEGER DEFAULT 0,
      is_admin INTEGER DEFAULT 0,
      display_name TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_permissions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      agent_id TEXT,
      permission_type TEXT NOT NULL,
      skill_name TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(token);
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON user_sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_permissions_user ON user_permissions(user_id);
  `);
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
