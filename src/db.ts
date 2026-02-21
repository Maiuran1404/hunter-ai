import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

const db = new Database('.hunterAI.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    email TEXT NOT NULL,
    name TEXT,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    picture TEXT,
    created_at INTEGER NOT NULL
  );
`);

export function createSession(userId: string, email: string, name?: string): string {
  const token = randomUUID();
  const now = Date.now();
  db.prepare('INSERT INTO sessions (token,user_id,email,name,created_at,expires_at) VALUES (?,?,?,?,?,?)')
    .run(token, userId, email, name || null, now, now + 30 * 24 * 60 * 60 * 1000);
  return token;
}

export function getSession(token: string): { userId: string; email: string; name?: string } | null {
  const row = db.prepare('SELECT user_id,email,name,expires_at FROM sessions WHERE token=?').get(token) as
    { user_id: string; email: string; name: string; expires_at: number } | undefined;
  if (!row || row.expires_at < Date.now()) return null;
  return { userId: row.user_id, email: row.email, name: row.name };
}

export function deleteSession(token: string): void {
  db.prepare('DELETE FROM sessions WHERE token=?').run(token);
}

export function upsertUser(googleId: string, email: string, name?: string, picture?: string): string {
  const existing = db.prepare('SELECT id FROM users WHERE email=?').get(email) as { id: string } | undefined;
  if (existing) return existing.id;
  const id = randomUUID();
  db.prepare('INSERT INTO users (id,email,name,picture,created_at) VALUES (?,?,?,?,?)')
    .run(id, email, name || null, picture || null, Date.now());
  return id;
}
