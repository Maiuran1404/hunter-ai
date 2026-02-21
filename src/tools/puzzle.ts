import { z } from 'zod';
import { state, isDemoMode, mergeSubscriptions } from '../state.js';
import { loadPuzzleTokens, savePuzzleTokens } from '../token-store.js';
import { randomUUID } from 'crypto';
import type { Subscription } from '../types.js';

const PUZZLE_CLIENT_ID = process.env.PUZZLE_CLIENT_ID || '';
const PUZZLE_CLIENT_SECRET = process.env.PUZZLE_CLIENT_SECRET || '';
const PUZZLE_REDIRECT_URI = process.env.PUZZLE_REDIRECT_URI || `http://localhost:${process.env.PORT || '3001'}/auth/puzzle/callback`;
const PUZZLE_API_KEY = process.env.PUZZLE_API_KEY || '';

export function getPuzzleAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: PUZZLE_CLIENT_ID,
    redirect_uri: PUZZLE_REDIRECT_URI,
    response_type: 'code',
    scope: 'transactions:read',
  });
  return `https://api.puzzle.io/oauth/authorize?${params}`;
}

export async function handlePuzzleCallback(code: string): Promise<void> {
  const res = await fetch('https://api.puzzle.io/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: PUZZLE_CLIENT_ID, client_secret: PUZZLE_CLIENT_SECRET,
      code, redirect_uri: PUZZLE_REDIRECT_URI, grant_type: 'authorization_code' }),
  });
  const tokens = await res.json() as { access_token?: string; refresh_token?: string };
  savePuzzleTokens(tokens);
}

export async function connectPuzzleApiKeyTool(input: { api_key: string; demo_mode?: boolean }) {
  if (isDemoMode(input.demo_mode)) {
    return { connected: true, message: 'Puzzle API key saved (demo). You can now pull real transactions.' };
  }
  // Test the key
  const res = await fetch('https://api.puzzle.io/v1/me', {
    headers: { Authorization: `Bearer ${input.api_key}` },
  }).catch(() => null);
  if (!res?.ok) throw new Error('Invalid API key — could not connect to Puzzle');
  savePuzzleTokens({ api_key: input.api_key });
  return { connected: true, message: 'Puzzle API key saved. You can now pull real transactions.' };
}

export async function pullPuzzleTransactionsTool(input: { demo_mode?: boolean }) {
  if (isDemoMode(input.demo_mode)) {
    const demo: Subscription[] = [
      { id: randomUUID(), vendor: 'AWS', normalized_name: 'aws', monthly_cost: 2400, category: 'infrastructure', confidence: 0.98, source: 'csv' },
      { id: randomUUID(), vendor: 'Anthropic', normalized_name: 'anthropic', monthly_cost: 1800, category: 'infrastructure', confidence: 0.98, source: 'csv' },
      { id: randomUUID(), vendor: 'Vercel', normalized_name: 'vercel', monthly_cost: 200, category: 'infrastructure', confidence: 0.95, source: 'csv' },
      { id: randomUUID(), vendor: 'Linear', normalized_name: 'linear', monthly_cost: 80, category: 'productivity', confidence: 0.9, source: 'csv' },
      { id: randomUUID(), vendor: 'Figma', normalized_name: 'figma', monthly_cost: 150, category: 'design', confidence: 0.9, source: 'csv' },
    ];
    mergeSubscriptions(demo);
    return {
      source: 'puzzle_demo', found: demo.length,
      total_monthly: demo.reduce((s, x) => s + x.monthly_cost, 0),
      subscriptions: demo,
      suggestions: [{ label: '\uD83D\uDD0D Find all credits', sub: '', primary: true }],
    };
  }

  const tokens = loadPuzzleTokens();
  const key = tokens.api_key || PUZZLE_API_KEY || tokens.access_token;
  if (!key) throw new Error('Puzzle not connected. Visit /auth/puzzle or use connect_puzzle_api_key tool.');

  const res = await fetch('https://api.puzzle.io/v1/transactions?limit=200&days=90', {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`Puzzle API error: ${res.status}`);
  const data = await res.json() as { transactions?: Array<{ vendor: string; amount: number; date: string }> };
  const txns = data.transactions || [];

  // Group by vendor, find recurring (2+ charges)
  const vendorMap = new Map<string, { original: string; amounts: number[] }>();
  for (const t of txns) {
    const normalized = t.vendor.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const existing = vendorMap.get(normalized);
    if (existing) {
      existing.amounts.push(t.amount);
    } else {
      vendorMap.set(normalized, { original: t.vendor, amounts: [t.amount] });
    }
  }

  const subs: Subscription[] = [];
  for (const [normalized, { original, amounts }] of vendorMap.entries()) {
    if (amounts.length < 2) continue;
    const avg = amounts.reduce((s, a) => s + a, 0) / amounts.length;
    subs.push({ id: randomUUID(), vendor: original, normalized_name: normalized,
      monthly_cost: Math.round(avg), category: 'other', confidence: 0.85, source: 'csv' });
  }

  mergeSubscriptions(subs);
  return {
    source: 'puzzle_live', found: subs.length,
    total_monthly: subs.reduce((s, x) => s + x.monthly_cost, 0),
    subscriptions: subs,
    suggestions: [{ label: '\uD83D\uDD0D Find all credits I qualify for', sub: '', primary: true }],
  };
}

export const connectPuzzleApiKeySchema = z.object({
  api_key: z.string().describe('Your Puzzle.io API key'),
  demo_mode: z.boolean().optional(),
});
export const pullPuzzleTransactionsSchema = z.object({
  demo_mode: z.boolean().optional(),
});
