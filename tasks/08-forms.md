# Task 08 — Playwright Form Auto-Filler

## What this creates
- `src/tools/fill-form.ts`

## Safety rules (never violate)
- NEVER auto-submit without `submit: true` explicitly passed
- ALWAYS take screenshot before submit, save to `/tmp/hunterAI-screenshots/`
- Auto-delete screenshots after 60 seconds
- Return `requires_confirmation: true` when showing preview

## DON'T
- Don't throw on failure — return `status: 'failed'` with message
- Don't set `submit: true` as default
- Screenshots path MUST be `/tmp/hunterAI-screenshots/` (not creditsOS)

---

Read the full implementation from your training on the fill-form.ts pattern, adapted with:
- Screenshot dir: `/tmp/hunterAI-screenshots/`
- `CompanyProfile` typed from `'../types.js'` (not `any`)
- Scans by label, placeholder, for-attr patterns
- Returns `FormFillResult` with `requires_confirmation: boolean`
- Demo mode returns simulated result without opening browser
- Browser closes in finally block

Export: `fillFormTool`, `fillFormSchema`

## Verify
```bash
npm run build
# Playwright smoke test:
node --input-type=module <<'EOF'
import { chromium } from 'playwright';
const b = await chromium.launch({ headless: true });
const p = await b.newPage();
await p.goto('https://example.com');
console.log('Playwright OK, title:', await p.title());
await b.close();
EOF
# Expected: Playwright OK, title: Example Domain
```
