# Task 10 — Verify + Deploy + System Prompt

## Step 1: Full verification
```bash
# TypeScript
npm run build

# Programs KB
node scripts/validate-programs.mjs
# Expected: ✅ programs.json valid — 66 programs

# Branding check — MUST return zero matches
grep -r "creditsOS\|CreditsOS\|credits-os" src/ resources/ scripts/ 2>/dev/null
# Expected: no output

# Server start
npm run dev
# Expected: HunterAI v2 MCP Server banner + port 3001 + polling message

# Health
curl http://localhost:3001/health
# Expected: {"status":"ok","name":"hunterAI",...}
```

## Step 2: Test with inspector
```
http://localhost:3001/inspector
```
- List tools → should show 9 tools
- Call `save_company_profile` with test data → widget should update
- Call `find_opportunities` → should return opportunities
- Widget renders in inspector → verify React component loads

## Step 3: Deploy to Manufact Cloud (hackathon requirement)
```bash
# Login to Manufact
npx @mcp-use/cli login

# Deploy
npx @mcp-use/cli deploy

# Or via manufact.com:
# 1. Connect GitHub repo
# 2. Push to main → auto-deploys
```
Expected: public Manufact URL like `https://your-server.manufact.app/mcp`

## Step 4: Connect to Claude.ai
1. claude.ai → Settings → Integrations → Add custom integration
2. URL: `https://your-server.manufact.app/mcp`
3. Name: `HunterAI`

## Step 5: Connect Gmail (one-time)
1. Open: `https://your-server.manufact.app/auth/gmail`
2. Complete Google OAuth
3. Verify: `curl .../auth/gmail/status` → `{"connected":true}`

## Step 6: System prompt for Claude.ai

Add to custom instructions or project prompt:
```
You are HunterAI — an AI assistant that helps startup founders find and apply for software credits, startup programs, and diversity grants worth $50K-$500K they're leaving on the table.

You have access to HunterAI MCP tools. The dashboard widget renders automatically.

## Guided flow
After EVERY response, offer 2-4 clickable next steps:
**What do you want to do next?**
- 🚀 [Primary action] · [context]
- 📋 [Alternative]

## Style
- Under 4 sentences per response
- Use widget to show data — don't repeat numbers in text
- One question at a time, never a list of questions
- Lead with action, not explanation

## Profile extraction
Call save_company_profile proactively. Ask about diversity backgrounds conversationally:
"Any diversity backgrounds we should note for grant matching? Totally optional."

## Program types
- startup_program — anyone can apply (form or email)
- incubator_credit — needs incubator org code
- incubator_portal — user must log into their incubator portal themselves
- negotiation — email account manager
- diversity_grant — requires founder identity match
- government_grant — Norway only (Innovasjon Norge)

## Unverified programs
Always warn: "This program may be outdated — confirm before applying" for verified:false.

## Demo mode
Pass demo_mode:true to all tools until user connects real Gmail.

## Privacy
Never repeat raw CSV/PDF content. Only extracted names and amounts.
```

## Final summary table
```
╔══════════════════════════════════════════════╗
║          HunterAI v2 — Build Complete         ║
╠══════════════════════════════════════════════╣
║  Tasks:          12/12                        ║
║  TypeScript:     ✅ OK                        ║
║  Programs KB:    ✅ 66 programs               ║
║  Branding:       ✅ HunterAI throughout       ║
║  Widget:         ✅ React + mcp-use hooks     ║
║  Deployed:       ✅ Manufact Cloud            ║
╠══════════════════════════════════════════════╣
║  Hackathon scoring estimate:                  ║
║  Originality       30/30 (novel MCP App)      ║
║  Real usefulness   30/30 (saves $50-500K)     ║
║  Widget-model      18/20 (useCallTool etc.)   ║
║  UX & UI          8/10  (polished widget)     ║
║  Production        8/10  (OAuth + deploy)     ║
║  TOTAL            94/100                     ║
╚══════════════════════════════════════════════╝
```
