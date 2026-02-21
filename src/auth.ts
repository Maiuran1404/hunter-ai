import { createSession, getSession, upsertUser } from './db.js';
import type { AppState } from './types.js';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/auth/google/callback';

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
  if (!tokenRes.ok) {
    throw new Error(`Google token exchange failed: ${tokenRes.status}`);
  }
  const tokens = await tokenRes.json() as { access_token: string };
  const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!userRes.ok) {
    throw new Error(`Google userinfo fetch failed: ${userRes.status}`);
  }
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
<head><title>HunterAI \u2014 Sign In</title>
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
    <h1>HunterAI</h1>
    <p>Find startup credits, grants, and programs worth $50K-$500K</p>
    <a href="/auth/google">Sign in with Google</a>
  </div>
</body>
</html>`;
