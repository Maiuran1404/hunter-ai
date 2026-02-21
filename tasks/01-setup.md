# Task 01 — Project Setup

## What this creates
Full project scaffold using mcp-use SDK (hackathon required).

## DON'T
- Don't use `npm init` — use the mcp-use scaffolder
- Don't use raw `@modelcontextprotocol/sdk` — use `mcp-use`
- Don't run `npm run dev` until Task 06 complete

---

## Step 1: Scaffold with mcp-use
```bash
npx create-mcp-use-app@latest hunterAI
cd hunterAI
# When prompted: select "MCP Apps" template
```

## Step 2: Install additional deps
```bash
pnpm add @anthropic-ai/sdk zod googleapis playwright @playwright/browser-chromium dotenv better-sqlite3
pnpm add -D @types/better-sqlite3 @types/node
npx playwright install chromium
```

## Step 3: Create directory structure
```bash
mkdir -p src/tools src/data resources/hunterAI-dashboard scripts tasks /tmp/hunterAI-screenshots
```

## Step 4: Update package.json name and scripts
```json
{
  "name": "hunterAI",
  "version": "2.0.0",
  "scripts": {
    "validate-programs": "node scripts/validate-programs.mjs"
  }
}
```
(Keep all existing scripts from scaffold, just add `validate-programs`)

## Step 5: Create .env
```
ANTHROPIC_API_KEY=sk-ant-placeholder
PORT=3001
DEMO_MODE=true
GMAIL_CLIENT_ID=placeholder.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=placeholder
GMAIL_REDIRECT_URI=http://localhost:3001/auth/gmail/callback
LOG_SENSITIVE=false
```

## Step 6: Create .gitignore additions
```
.tokens.json
.puzzle-tokens.json
.hunterAI.db
/tmp/hunterAI-screenshots/
```

## Step 7: Create scripts/validate-programs.mjs
```javascript
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const programs = JSON.parse(readFileSync(join(__dirname, '../src/data/programs.json'), 'utf8'));
const errors = [];
const ids = new Set();

for (const p of programs) {
  if (ids.has(p.id)) errors.push(`Duplicate id: "${p.id}"`);
  ids.add(p.id);
  for (const f of ['id','name','vendor','type','potential_value','currency','application_url','application_type']) {
    if (p[f] === undefined || p[f] === '') errors.push(`"${p.id}" missing: ${f}`);
  }
  if (p.verified === false && (!p.notes || !p.notes.includes('⚠️')))
    errors.push(`"${p.id}" verified:false needs ⚠️ in notes`);
  if (p.type === 'incubator_portal' && !p.notes)
    errors.push(`"${p.id}" incubator_portal needs notes`);
  if (p.type === 'diversity_grant' && !p.eligibility?.requires_identities?.length)
    errors.push(`"${p.id}" diversity_grant needs eligibility.requires_identities`);
}

if (errors.length) { errors.forEach(e => console.error('•', e)); process.exit(1); }
const byType = programs.reduce((a,p) => ({...a,[p.type]:(a[p.type]||0)+1}),{});
console.log(`✅ programs.json valid — ${programs.length} programs`);
Object.entries(byType).forEach(([t,n]) => console.log(`   ${t}: ${n}`));
```

## Verify
```bash
npm run build
node -e "import('playwright').then(p=>p.chromium.launch({headless:true})).then(b=>{b.close();console.log('Playwright OK')})"
```
Expected: build passes, `Playwright OK`
