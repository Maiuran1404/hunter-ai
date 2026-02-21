import { randomUUID } from 'crypto';

// In-memory session store (no native dependencies needed for cloud deployment)
interface Session {
  token: string;
  userId: string;
  email: string;
  name?: string;
  createdAt: number;
  expiresAt: number;
}

interface User {
  id: string;
  email: string;
  name?: string;
  picture?: string;
  createdAt: number;
}

const sessions = new Map<string, Session>();
const users = new Map<string, User>(); // keyed by email

export function cleanExpiredSessions(): void {
  const now = Date.now();
  for (const [token, session] of sessions) {
    if (session.expiresAt < now) sessions.delete(token);
  }
}

// Clean up periodically
setInterval(cleanExpiredSessions, 60 * 60 * 1000);

export function createSession(userId: string, email: string, name?: string): string {
  const token = randomUUID();
  const now = Date.now();
  sessions.set(token, {
    token, userId, email, name,
    createdAt: now,
    expiresAt: now + 30 * 24 * 60 * 60 * 1000,
  });
  return token;
}

export function getSession(token: string): { userId: string; email: string; name?: string } | null {
  const session = sessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    if (session) sessions.delete(token);
    return null;
  }
  return { userId: session.userId, email: session.email, name: session.name };
}

export function deleteSession(token: string): void {
  sessions.delete(token);
}

export function upsertUser(googleId: string, email: string, name?: string, picture?: string): string {
  const existing = users.get(email);
  if (existing) return existing.id;
  const id = randomUUID();
  users.set(email, { id, email, name, picture, createdAt: Date.now() });
  return id;
}
