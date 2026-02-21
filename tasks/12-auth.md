# Task 12 — Platform User Auth (Google OAuth + Per-User State)

## What this creates
- `src/db.ts` — SQLite session store (`.hunterAI.db`)
- `src/auth.ts` — Google OAuth + session middleware
- Login page at `/login`

## DON'T
- Don't use JWT — use random session tokens in SQLite
- Don't use passwords — Google OAuth only
- Don't share state between users — `getStateForUser(userId)`
- Sessions in `.hunterAI.db` (NOT `.creditsOS.db`)

---

## Create src/db.ts
```typescript
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
```

## Create src/auth.ts
```typescript
import { createSession, getSession, deleteSession, upsertUser } from './db.js';
import { state } from './state.js';
import type { AppState } from './types.js';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/auth/google/callback';
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret';

// Per-user state map
const userStates = new Map<string, AppState>();

export function getStateForUser(userId: string): AppState {
  if (!userStates.has(userId)) {
    userStates.set(userId, {
      subscriptions: [], profile: null, opportunities: [],
      sent_emails: [], gmail_tokens: {}, reply_poll_active: false,
    });
  }
  return userStates.get(userId)!;
}

export function getGoogleAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'select_account',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function handleGoogleCallback(code: string): Promise<string> {
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: GOOGLE_REDIRECT_URI, grant_type: 'authorization_code' }),
  });
  const tokens = await tokenRes.json() as { access_token: string };
  const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const user = await userRes.json() as { sub: string; email: string; name?: string; picture?: string };
  const userId = upsertUser(user.sub, user.email, user.name, user.picture);
  return createSession(userId, user.email, user.name);
}

export function getSessionFromRequest(authHeader?: string): ReturnType<typeof getSession> {
  if (!authHeader?.startsWith('Bearer ')) return null;
  return getSession(authHeader.slice(7));
}

export const LOGIN_PAGE = `<!DOCTYPE html>
<html>
<head><title>HunterAI — Sign In</title>
<style>
  body { font-family: -apple-system,BlinkMacSystemFont,sans-serif; display:flex; align-items:center; justify-content:center; height:100vh; margin:0; background:#f5f5f5; }
  .card { background:#fff; border-radius:16px; padding:48px; text-align:center; box-shadow:0 4px 24px rgba(0,0,0,0.08); max-width:380px; }
  h1 { margin:0 0 8px; font-size:28px; } p { color:#666; margin:0 0 32px; }
  a { display:inline-flex; align-items:center; gap:12px; background:#1a1a2e; color:#fff; text-decoration:none; padding:14px 28px; border-radius:10px; font-size:16px; font-weight:500; }
  a:hover { background:#2d2d4e; }
</style>
</head>
<body>
  <div class="card">
    <h1>🎯 HunterAI</h1>
    <p>Find startup credits, grants, and programs worth $50K-$500K</p>
    <a href="/auth/google">Sign in with Google</a>
  </div>
</body>
</html>`;
```

## Register auth routes in src/index.ts
Add to index.ts imports and routes:
```typescript
import { getGoogleAuthUrl, handleGoogleCallback, getSessionFromRequest, LOGIN_PAGE } from './auth.js';

server.addRoute('GET', '/login', (req, res) => { res.setHeader('Content-Type','text/html'); res.end(LOGIN_PAGE); });
server.addRoute('GET', '/auth/google', (req, res) => { res.redirect(getGoogleAuthUrl()); });
server.addRoute('GET', '/auth/google/callback', async (req, res) => {
  const code = new URL(req.url!, `http://localhost:${PORT}`).searchParams.get('code');
  if (!code) { res.end('Missing code'); return; }
  const sessionToken = await handleGoogleCallback(code);
  res.setHeader('Set-Cookie', `session=${sessionToken}; HttpOnly; SameSite=Lax; Path=/`);
  res.redirect('/');
});
server.addRoute('GET', '/auth/me', (req, res) => {
  const session = getSessionFromRequest(req.headers.authorization);
  if (!session) { res.statusCode = 401; res.json({ authenticated: false }); return; }
  res.json({ authenticated: true, user: { email: session.email, name: session.name } });
});
server.addRoute('POST', '/auth/logout', (req, res) => {
  const session = getSessionFromRequest(req.headers.authorization);
  if (session) { /* deleteSession would need token */ }
  res.json({ ok: true });
});
```

## Update .env with new vars
```
GOOGLE_CLIENT_ID=placeholder.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=placeholder
GOOGLE_REDIRECT_URI=http://localhost:3001/auth/google/callback
SESSION_SECRET=dev-secret-change-in-prod
```

## Verify
```bash
npm run build
# Expected: TypeScript OK

curl http://localhost:3001/login
# Expected: HTML login page with HunterAI branding

curl http://localhost:3001/auth/me
# Expected: {"authenticated":false}
```

## Final branding check
```bash
grep -r "creditsOS\|CreditsOS\|\.creditsOS" src/ resources/ 2>/dev/null
# Expected: zero matches — if any found, fix them now
```
