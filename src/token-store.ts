import { readFileSync, writeFileSync, existsSync } from 'fs';

const PUZZLE_TOKENS_PATH = '.puzzle-tokens.json';

export function loadPuzzleTokens(): { access_token?: string; refresh_token?: string; api_key?: string } {
  try {
    if (existsSync(PUZZLE_TOKENS_PATH)) return JSON.parse(readFileSync(PUZZLE_TOKENS_PATH, 'utf8'));
  } catch { /* corrupted */ }
  return {};
}

export function savePuzzleTokens(tokens: object): void {
  try { writeFileSync(PUZZLE_TOKENS_PATH, JSON.stringify(tokens, null, 2)); }
  catch { console.warn('[puzzle-tokens] Could not persist tokens'); }
}
