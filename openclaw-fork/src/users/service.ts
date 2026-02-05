import { getDatabase } from '../db/database.js';
import { v4 as uuid } from 'uuid';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

export interface User {
  id: string;
  email: string;
  username: string;
  password_hash: string;
  totp_secret: string | null;
  totp_enabled: number;
  is_admin: number;
  display_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserPublic {
  id: string;
  email: string;
  username: string;
  totpEnabled: boolean;
  isAdmin: boolean;
  displayName: string | null;
  createdAt: string;
}

export interface Session {
  id: string;
  user_id: string;
  token: string;
  expires_at: string;
  created_at: string;
}

const SALT_ROUNDS = 12;
const SESSION_DURATION_HOURS = 72;

export class UserService {
  /**
   * Create a new user (admin only operation)
   */
  async createUser(data: {
    email: string;
    username: string;
    password: string;
    isAdmin?: boolean;
    displayName?: string;
  }): Promise<UserPublic> {
    const db = getDatabase();
    const now = new Date().toISOString();
    const id = uuid();
    const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);

    const stmt = db.prepare(`
      INSERT INTO users (id, email, username, password_hash, is_admin, display_name, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(id, data.email, data.username, passwordHash, data.isAdmin ? 1 : 0, data.displayName || null, now, now);

    return this.toPublic({ id, email: data.email, username: data.username, password_hash: passwordHash, totp_secret: null, totp_enabled: 0, is_admin: data.isAdmin ? 1 : 0, display_name: data.displayName || null, created_at: now, updated_at: now });
  }

  /**
   * Authenticate user with email/username and password
   * Returns user if credentials valid, null otherwise
   */
  async authenticate(login: string, password: string): Promise<User | null> {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM users WHERE email = ? OR username = ?
    `);
    const user = stmt.get(login, login) as User | undefined;

    if (!user) return null;

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return null;

    return user;
  }

  /**
   * Create a new session token for a user
   */
  createSession(userId: string): Session {
    const db = getDatabase();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_DURATION_HOURS * 60 * 60 * 1000);
    const token = crypto.randomBytes(48).toString('hex');

    const session: Session = {
      id: uuid(),
      user_id: userId,
      token,
      expires_at: expiresAt.toISOString(),
      created_at: now.toISOString()
    };

    const stmt = db.prepare(`
      INSERT INTO user_sessions (id, user_id, token, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(session.id, session.user_id, session.token, session.expires_at, session.created_at);

    return session;
  }

  /**
   * Validate a session token and return the user
   */
  validateSession(token: string): User | null {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT u.* FROM users u
      JOIN user_sessions s ON u.id = s.user_id
      WHERE s.token = ? AND s.expires_at > ?
    `);
    const user = stmt.get(token, new Date().toISOString()) as User | undefined;
    return user || null;
  }

  /**
   * Destroy a session
   */
  destroySession(token: string): void {
    const db = getDatabase();
    db.prepare('DELETE FROM user_sessions WHERE token = ?').run(token);
  }

  /**
   * Clean up expired sessions
   */
  cleanExpiredSessions(): void {
    const db = getDatabase();
    db.prepare('DELETE FROM user_sessions WHERE expires_at < ?').run(new Date().toISOString());
  }

  /**
   * Enable 2FA for a user — store the secret
   */
  enableTotp(userId: string, secret: string): void {
    const db = getDatabase();
    db.prepare('UPDATE users SET totp_secret = ?, totp_enabled = 1, updated_at = ? WHERE id = ?')
      .run(secret, new Date().toISOString(), userId);
  }

  /**
   * Disable 2FA for a user
   */
  disableTotp(userId: string): void {
    const db = getDatabase();
    db.prepare('UPDATE users SET totp_secret = NULL, totp_enabled = 0, updated_at = ? WHERE id = ?')
      .run(new Date().toISOString(), userId);
  }

  /**
   * Get user by ID
   */
  getUserById(id: string): User | null {
    const db = getDatabase();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
    return user || null;
  }

  /**
   * Get all users (admin)
   */
  getAllUsers(): UserPublic[] {
    const db = getDatabase();
    const users = db.prepare('SELECT * FROM users ORDER BY created_at DESC').all() as User[];
    return users.map(u => this.toPublic(u));
  }

  /**
   * Update user profile
   */
  updateUser(id: string, data: { email?: string; username?: string; displayName?: string }): UserPublic | null {
    const db = getDatabase();
    const user = this.getUserById(id);
    if (!user) return null;

    const updates: string[] = [];
    const values: any[] = [];

    if (data.email) { updates.push('email = ?'); values.push(data.email); }
    if (data.username) { updates.push('username = ?'); values.push(data.username); }
    if (data.displayName !== undefined) { updates.push('display_name = ?'); values.push(data.displayName); }

    if (updates.length === 0) return this.toPublic(user);

    updates.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    return this.toPublic(this.getUserById(id)!);
  }

  /**
   * Change password
   */
  async changePassword(id: string, newPassword: string): Promise<void> {
    const db = getDatabase();
    const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
      .run(hash, new Date().toISOString(), id);
  }

  /**
   * Delete user
   */
  deleteUser(id: string): void {
    const db = getDatabase();
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
  }

  /**
   * Convert internal user to public-safe version
   */
  private toPublic(user: User): UserPublic {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      totpEnabled: user.totp_enabled === 1,
      isAdmin: user.is_admin === 1,
      displayName: user.display_name,
      createdAt: user.created_at
    };
  }
}
