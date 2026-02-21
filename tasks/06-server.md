# Task 06 — MCP Server (mcp-use)

## What this creates
- `src/index.ts` — mcp-use server entry point with all tools and widget registered

## mcp-use server pattern
The scaffold from Task 01 created an `index.ts`. Replace or update it to register
all HunterAI tools and the widget resource.

## DON'T
- Don't import from `@modelcontextprotocol/sdk` directly — use mcp-use patterns
- Don't start reply polling at <24h intervals
- Don't log statement body content

---

## Update src/index.ts

```typescript
import { createMcpServer, registerTool, registerResource } from 'mcp-use/server';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import { analyzeStatementSchema, analyzeStatementTool } from './tools/analyze-statement.js';
import { findOpportunitiesSchema, findOpportunitiesTool } from './tools/find-opportunities.js';
import { draftEmailSchema, draftEmailTool } from './tools/draft-email.js';
import { sendEmailSchema, sendEmailTool, getGmailAuthUrl, handleGmailCallback } from './tools/send-email.js';
import { fillFormSchema, fillFormTool } from './tools/fill-form.js';
import { checkRepliesSchema, checkRepliesTool, sendReplySchema, sendReplyTool, startReplyPolling } from './tools/check-replies.js';
import { saveProfileSchema, saveProfileTool } from './tools/save-profile.js';
import { state, isDemoMode } from './state.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '3001');

const WIDGET_URI = 'ui://hunterAI-dashboard';
const WIDGET_HTML = readFileSync(join(__dirname, '../resources/hunterAI-dashboard/widget.tsx'), 'utf8');

const server = createMcpServer({
  name: 'HunterAI',
  version: '2.0.0',
  port: PORT,
});

// ── Widget resource ───────────────────────────────────────────
registerResource(server, {
  uri: WIDGET_URI,
  name: 'HunterAI Dashboard',
  description: 'Interactive startup credits dashboard',
  mimeType: 'text/html',
  handler: async () => ({ contents: [{ uri: WIDGET_URI, mimeType: 'text/html', text: WIDGET_HTML }] }),
});

// ── Tool: analyze_statement ───────────────────────────────────
registerTool(server, {
  name: 'analyze_statement',
  description: 'Parse a bank statement PDF to find recurring software subscriptions',
  schema: analyzeStatementSchema,
  handler: async (input) => {
    const result = await analyzeStatementTool(input);
    return { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: { ...result, widget: WIDGET_URI } };
  },
});

// ── Tool: find_opportunities ──────────────────────────────────
registerTool(server, {
  name: 'find_opportunities',
  description: 'Find all startup credits, grants, and programs the company qualifies for (66 programs)',
  schema: findOpportunitiesSchema,
  handler: async (input) => {
    const result = await findOpportunitiesTool(input);
    return { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: { ...result, widget: WIDGET_URI } };
  },
});

// ── Tool: draft_email ─────────────────────────────────────────
registerTool(server, {
  name: 'draft_email',
  description: 'Draft a personalized application email for a specific program',
  schema: draftEmailSchema,
  handler: async (input) => {
    const result = await draftEmailTool(input);
    return { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result };
  },
});

// ── Tool: send_email ──────────────────────────────────────────
registerTool(server, {
  name: 'send_email',
  description: 'Send an application email via Gmail OAuth2',
  schema: sendEmailSchema,
  handler: async (input) => {
    const result = await sendEmailTool(input);
    return { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: { ...result, widget: WIDGET_URI } };
  },
});

// ── Tool: fill_form ───────────────────────────────────────────
registerTool(server, {
  name: 'fill_form',
  description: 'Auto-fill a program application form using Playwright. Shows preview before submitting.',
  schema: fillFormSchema,
  handler: async (input) => {
    const result = await fillFormTool(input);
    return { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result };
  },
});

// ── Tool: check_replies ───────────────────────────────────────
registerTool(server, {
  name: 'check_replies',
  description: 'Check Gmail for replies to sent applications. Drafts AI responses automatically.',
  schema: checkRepliesSchema,
  handler: async (input) => {
    const result = await checkRepliesTool(input);
    return { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: { ...result, widget: WIDGET_URI } };
  },
});

// ── Tool: send_reply ──────────────────────────────────────────
registerTool(server, {
  name: 'send_reply',
  description: 'Send the AI-drafted or custom reply to a vendor',
  schema: sendReplySchema,
  handler: async (input) => {
    const result = await sendReplyTool(input);
    return { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result };
  },
});

// ── Tool: save_company_profile ────────────────────────────────
registerTool(server, {
  name: 'save_company_profile',
  description: 'Save company context for personalization — name, stage, incubators, founder identities for diversity grants',
  schema: saveProfileSchema,
  handler: async (input) => {
    const result = await saveProfileTool(input);
    return { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: { ...result, widget: WIDGET_URI } };
  },
});

// ── Tool: show_dashboard ──────────────────────────────────────
registerTool(server, {
  name: 'show_dashboard',
  description: 'Refresh and return full HunterAI dashboard state',
  schema: {},
  handler: async () => {
    const result = {
      opportunities: state.opportunities,
      sent_emails: state.sent_emails,
      subscriptions: state.subscriptions,
      profile: state.profile,
      total_potential_value: state.opportunities.reduce((s, o) => s + o.potential_value, 0),
    };
    return { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: { ...result, widget: WIDGET_URI } };
  },
});

// ── Gmail OAuth routes ────────────────────────────────────────
server.addRoute('GET', '/auth/gmail', (req, res) => {
  res.redirect(getGmailAuthUrl());
});
server.addRoute('GET', '/auth/gmail/callback', async (req, res) => {
  const code = new URL(req.url!, `http://localhost:${PORT}`).searchParams.get('code');
  if (!code) { res.end('Missing code'); return; }
  await handleGmailCallback(code);
  res.end('✅ Gmail Connected — return to Claude and continue');
});
server.addRoute('GET', '/auth/gmail/status', (req, res) => {
  res.json({ connected: !!state.gmail_tokens.refresh_token });
});

// ── Start ─────────────────────────────────────────────────────
server.listen(() => {
  console.log(`
  ╔══════════════════════════════════════════╗
  ║         HunterAI v2 MCP Server           ║
  ╠══════════════════════════════════════════╣
  ║  Health:  http://localhost:${PORT}/health     ║
  ║  MCP:     http://localhost:${PORT}/mcp        ║
  ║  Gmail:   http://localhost:${PORT}/auth/gmail ║
  ║  Inspect: http://localhost:${PORT}/inspector  ║
  ╠══════════════════════════════════════════╣
  ║  Run: npx @mcp-use/cli deploy            ║
  ╚══════════════════════════════════════════╝`);
  startReplyPolling(24 * 60 * 60 * 1000);
});
```

## Verify
```bash
npm run build
# Expected: TypeScript OK

npm run dev
# Expected: banner prints with all endpoints listed
# Expected: [Replies] Background poll every 24 hours
```
