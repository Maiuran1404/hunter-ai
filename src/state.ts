import type { AppState, GmailTokens } from './types.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';

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
};

export function isDemoMode(inputFlag?: boolean): boolean {
  return inputFlag === true || process.env.DEMO_MODE === 'true';
}

export function resetState(): void {
  state.subscriptions = []; state.profile = null;
  state.opportunities = []; state.sent_emails = [];
}
