import type { AppState, GmailTokens, ActivityType, ActivityEntry, Subscription } from './types';
import { randomUUID } from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';

const TOKENS_PATH = path.join(process.cwd(), '.tokens.json');

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

// Use globalThis to survive Next.js dev hot-reloads
const globalKey = '__hunterAiState__' as const;

function getInitialState(): AppState {
  return {
    subscriptions: [],
    profile: null,
    opportunities: [],
    sent_emails: [],
    gmail_tokens: loadTokens(),
    activity_log: [],
  };
}

export function getState(): AppState {
  if (!(globalThis as Record<string, unknown>)[globalKey]) {
    (globalThis as Record<string, unknown>)[globalKey] = getInitialState();
  }
  return (globalThis as Record<string, unknown>)[globalKey] as AppState;
}

export function resetState(): void {
  const s = getState();
  s.subscriptions = [];
  s.profile = null;
  s.opportunities = [];
  s.sent_emails = [];
  s.activity_log = [];
}

export function mergeSubscriptions(newSubs: Subscription[]): void {
  const s = getState();
  const existing = new Map(s.subscriptions.map(sub => [sub.normalized_name, sub]));
  for (const sub of newSubs) {
    existing.set(sub.normalized_name, sub);
  }
  s.subscriptions = Array.from(existing.values());
}

export function logActivity(type: ActivityType, summary: string, metadata: Record<string, unknown> = {}): void {
  const entry: ActivityEntry = {
    id: randomUUID(),
    type,
    timestamp: new Date().toISOString(),
    summary,
    metadata,
  };
  getState().activity_log.push(entry);
}

export function ensureProfileFromSubscriptions(): void {
  const s = getState();
  if (s.profile) return;
  s.profile = {
    name: 'My Startup',
    stage: 'seed',
    team_size: 5,
    monthly_arr: 0,
    incubators: [],
    geography: '',
    tech_stack: s.subscriptions.map(sub => sub.vendor),
  };
}
