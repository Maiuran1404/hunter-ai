import { MCPServer, text, widget } from 'mcp-use/server';
import { z } from 'zod';

import { analyzeStatementSchema, analyzeStatementTool } from './src/tools/analyze-statement.js';
import { findOpportunitiesSchema, findOpportunitiesTool } from './src/tools/find-opportunities.js';
import { draftEmailSchema, draftEmailTool } from './src/tools/draft-email.js';
import { sendEmailSchema, sendEmailTool, getGmailAuthUrl, handleGmailCallback } from './src/tools/send-email.js';
import { fillFormSchema, fillFormTool } from './src/tools/fill-form.js';
import { checkRepliesSchema, checkRepliesTool, sendReplySchema, sendReplyTool, startReplyPolling } from './src/tools/check-replies.js';
import { saveProfileSchema, saveProfileTool } from './src/tools/save-profile.js';
import { connectPuzzleApiKeySchema, connectPuzzleApiKeyTool, pullPuzzleTransactionsSchema, pullPuzzleTransactionsTool, getPuzzleAuthUrl, handlePuzzleCallback } from './src/tools/puzzle.js';
import { loadPuzzleTokens } from './src/token-store.js';
import { getGoogleAuthUrl as getGoogleLoginUrl, handleGoogleCallback as handleGoogleLoginCallback, getSessionFromRequest, LOGIN_PAGE } from './src/auth.js';
import { state } from './src/state.js';

const PORT = parseInt(process.env.PORT || '3001');

const server = new MCPServer({
  name: 'HunterAI',
  title: 'HunterAI',
  version: '2.0.0',
  description: 'Find and apply for startup credits, programs, and diversity grants',
  baseUrl: process.env.MCP_URL || `http://localhost:${PORT}`,
});

// ── Tool: analyze_statement ───────────────────────────────────
server.tool({
  name: 'analyze_statement',
  description: 'Parse a bank statement PDF to find recurring software subscriptions',
  schema: analyzeStatementSchema,
  widget: {
    name: 'hunterai-dashboard',
    invoking: 'Analyzing statement...',
    invoked: 'Statement analyzed',
  },
}, async (input) => {
  const result = await analyzeStatementTool(input);
  return widget({
    props: result,
    output: text(`Found ${result.found} subscriptions totaling $${result.total_monthly}/mo`),
  });
});

// ── Tool: find_opportunities ──────────────────────────────────
server.tool({
  name: 'find_opportunities',
  description: 'Find all startup credits, grants, and programs the company qualifies for (66 programs)',
  schema: findOpportunitiesSchema,
  widget: {
    name: 'hunterai-dashboard',
    invoking: 'Scanning 66 programs...',
    invoked: 'Opportunities found',
  },
}, async (input) => {
  const result = await findOpportunitiesTool(input);
  return widget({
    props: result,
    output: text(`Found ${result.found} opportunities worth $${result.total_potential_value.toLocaleString()}`),
  });
});

// ── Tool: draft_email ─────────────────────────────────────────
server.tool({
  name: 'draft_email',
  description: 'Draft a personalized application email for a specific program',
  schema: draftEmailSchema,
}, async (input) => {
  const result = await draftEmailTool(input);
  return text(JSON.stringify(result));
});

// ── Tool: send_email ──────────────────────────────────────────
server.tool({
  name: 'send_email',
  description: 'Send an application email via Gmail OAuth2',
  schema: sendEmailSchema,
  widget: {
    name: 'hunterai-dashboard',
    invoking: 'Sending email...',
    invoked: 'Email sent',
  },
}, async (input) => {
  const result = await sendEmailTool(input);
  return widget({
    props: result,
    output: text(`Email sent to ${result.email.to}`),
  });
});

// ── Tool: fill_form ───────────────────────────────────────────
server.tool({
  name: 'fill_form',
  description: 'Auto-fill a program application form using Playwright. Shows preview before submitting.',
  schema: fillFormSchema,
}, async (input) => {
  const result = await fillFormTool(input);
  return text(JSON.stringify(result));
});

// ── Tool: check_replies ───────────────────────────────────────
server.tool({
  name: 'check_replies',
  description: 'Check Gmail for replies to sent applications. Drafts AI responses automatically.',
  schema: checkRepliesSchema,
  widget: {
    name: 'hunterai-dashboard',
    invoking: 'Checking replies...',
    invoked: 'Replies checked',
  },
}, async (input) => {
  const result = await checkRepliesTool(input);
  return widget({
    props: result,
    output: text(`Found ${result.found} new replies`),
  });
});

// ── Tool: send_reply ──────────────────────────────────────────
server.tool({
  name: 'send_reply',
  description: 'Send the AI-drafted or custom reply to a vendor',
  schema: sendReplySchema,
}, async (input) => {
  const result = await sendReplyTool(input);
  return text(JSON.stringify(result));
});

// ── Tool: save_company_profile ────────────────────────────────
server.tool({
  name: 'save_company_profile',
  description: 'Save company context for personalization — name, stage, incubators, founder identities for diversity grants',
  schema: saveProfileSchema,
  widget: {
    name: 'hunterai-dashboard',
    invoking: 'Saving profile...',
    invoked: 'Profile saved',
  },
}, async (input) => {
  const result = await saveProfileTool(input);
  return widget({
    props: result,
    output: text(`Profile saved for ${result.profile.name}`),
  });
});

// ── Tool: connect_puzzle_api_key ─────────────────────────────
server.tool({
  name: 'connect_puzzle_api_key',
  description: 'Save your Puzzle.io API key to pull real transaction data',
  schema: connectPuzzleApiKeySchema,
}, async (input) => {
  const result = await connectPuzzleApiKeyTool(input);
  return text(JSON.stringify(result));
});

// ── Tool: pull_puzzle_transactions ───────────────────────────
server.tool({
  name: 'pull_puzzle_transactions',
  description: 'Pull real subscription data from Puzzle.io accounting',
  schema: pullPuzzleTransactionsSchema,
  widget: {
    name: 'hunterai-dashboard',
    invoking: 'Pulling transactions from Puzzle...',
    invoked: 'Transactions pulled',
  },
}, async (input) => {
  const result = await pullPuzzleTransactionsTool(input);
  return widget({
    props: result,
    output: text(`Found ${result.found} subscriptions from Puzzle ($${result.total_monthly}/mo)`),
  });
});

// ── Tool: show_dashboard ──────────────────────────────────────
server.tool({
  name: 'show_dashboard',
  description: 'Refresh and return full HunterAI dashboard state',
  schema: z.object({}),
  widget: {
    name: 'hunterai-dashboard',
    invoking: 'Loading dashboard...',
    invoked: 'Dashboard loaded',
  },
}, async () => {
  const result = {
    opportunities: state.opportunities,
    sent_emails: state.sent_emails,
    subscriptions: state.subscriptions,
    profile: state.profile,
    total_potential_value: state.opportunities.reduce((s, o) => s + o.potential_value, 0),
  };
  return widget({
    props: result,
    output: text(`Dashboard: ${state.opportunities.length} opportunities, ${state.sent_emails.length} sent`),
  });
});

// ── Gmail OAuth routes ────────────────────────────────────────
server.app.get('/auth/gmail', (c) => {
  return c.redirect(getGmailAuthUrl());
});
server.app.get('/auth/gmail/callback', async (c) => {
  const code = c.req.query('code');
  if (!code) return c.text('Missing code', 400);
  await handleGmailCallback(code);
  return c.text('✅ Gmail Connected — return to Claude and continue');
});
server.app.get('/auth/gmail/status', (c) => {
  return c.json({ connected: !!state.gmail_tokens.refresh_token });
});

// ── Login & Google Auth routes ───────────────────────────────
server.app.get('/login', (c) => {
  return c.html(LOGIN_PAGE);
});
server.app.get('/auth/google', (c) => {
  return c.redirect(getGoogleLoginUrl());
});
server.app.get('/auth/google/callback', async (c) => {
  const code = c.req.query('code');
  if (!code) return c.text('Missing code', 400);
  const sessionToken = await handleGoogleLoginCallback(code);
  c.header('Set-Cookie', `session=${sessionToken}; HttpOnly; SameSite=Lax; Path=/`);
  return c.redirect('/');
});
server.app.get('/auth/me', (c) => {
  const session = getSessionFromRequest(c.req.header('authorization'));
  if (!session) return c.json({ authenticated: false }, 401);
  return c.json({ authenticated: true, user: { email: session.email, name: session.name } });
});
server.app.post('/auth/logout', (c) => {
  return c.json({ ok: true });
});

// ── Puzzle OAuth routes ──────────────────────────────────────
server.app.get('/auth/puzzle', (c) => {
  return c.redirect(getPuzzleAuthUrl());
});
server.app.get('/auth/puzzle/callback', async (c) => {
  const code = c.req.query('code');
  if (!code) return c.text('Missing code', 400);
  await handlePuzzleCallback(code);
  return c.text('✅ Puzzle Connected');
});
server.app.get('/auth/puzzle/status', (c) => {
  const t = loadPuzzleTokens();
  return c.json({ connected: !!(t.api_key || t.access_token) });
});

// ── Start ─────────────────────────────────────────────────────
server.listen(PORT).then(() => {
  console.log(`
  ╔══════════════════════════════════════════╗
  ║         HunterAI v2 MCP Server           ║
  ╠══════════════════════════════════════════╣
  ║  Health:  http://localhost:${PORT}/health      ║
  ║  MCP:     http://localhost:${PORT}/mcp         ║
  ║  Login:   http://localhost:${PORT}/login       ║
  ║  Gmail:   http://localhost:${PORT}/auth/gmail  ║
  ║  Puzzle:  http://localhost:${PORT}/auth/puzzle ║
  ║  Inspect: http://localhost:${PORT}/inspector   ║
  ╠══════════════════════════════════════════╣
  ║  Run: npx @mcp-use/cli deploy            ║
  ╚══════════════════════════════════════════╝`);
  startReplyPolling(24 * 60 * 60 * 1000);
});
