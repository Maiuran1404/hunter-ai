import type { AppState, GmailTokens, ActivityType, ActivityEntry } from './types.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { randomUUID } from 'crypto';

const TOKENS_PATH = '.tokens.json';

function loadTokens(): GmailTokens {
  try {
    if (existsSync(TOKENS_PATH)) return JSON.parse(readFileSync(TOKENS_PATH, 'utf8'));
  } catch { /* corrupted */ }
  return {};
}

export function saveTokens(tokens: GmailTokens): void {
  try { writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2)); }
  catch { console.warn('[tokens] Could not persist tokens'); }
}

export const state: AppState = {
  subscriptions: [], profile: null, opportunities: [],
  sent_emails: [], gmail_tokens: loadTokens(), reply_poll_active: false,
  activity_log: [], digest_preferences: null,
};

export function isDemoMode(override?: boolean): boolean {
  if (override !== undefined) return override;
  return process.env.DEMO_MODE === 'true';
}

export function mergeSubscriptions(newSubs: AppState['subscriptions']): void {
  const existing = new Map(state.subscriptions.map(s => [s.normalized_name, s]));
  for (const sub of newSubs) {
    existing.set(sub.normalized_name, sub); // newer data wins
  }
  state.subscriptions = Array.from(existing.values());
}

export function resetState(): void {
  state.subscriptions = []; state.profile = null;
  state.opportunities = []; state.sent_emails = [];
  state.activity_log = [];
}

export function logActivity(type: ActivityType, summary: string, metadata: Record<string, unknown> = {}): void {
  const entry: ActivityEntry = {
    id: randomUUID(),
    type,
    timestamp: new Date().toISOString(),
    summary,
    metadata,
  };
  state.activity_log.push(entry);
}
