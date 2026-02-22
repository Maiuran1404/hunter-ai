import { MCPServer, object, widget, error } from "mcp-use/server";
import { z } from "zod";
import { state } from "./state.js";
import { analyzeStatementTool, analyzeStatementSchema } from "./tools/analyze-statement.js";
import { findOpportunitiesTool, findOpportunitiesSchema } from "./tools/find-opportunities.js";
import { saveProfileTool, saveProfileSchema } from "./tools/save-profile.js";
import { draftEmailTool, draftEmailSchema } from "./tools/draft-email.js";
import { sendEmailTool, sendEmailSchema, getGmailAuthUrl, handleGmailCallback, getGmailStatusTool, getGmailStatusSchema } from "./tools/send-email.js";
import { fillFormTool, fillFormSchema } from "./tools/fill-form.js";
import { checkRepliesTool, checkRepliesSchema, sendReplyTool, sendReplySchema } from "./tools/check-replies.js";
import { dailyDigestTool, dailyDigestSchema, configureDigestTool, configureDigestSchema } from "./tools/daily-digest.js";
import { connectPuzzleApiKeyTool, connectPuzzleApiKeySchema, pullPuzzleTransactionsTool, pullPuzzleTransactionsSchema, getPuzzleAuthUrl, handlePuzzleCallback } from "./tools/puzzle.js";
import { scanWebsiteTool, scanWebsiteSchema } from "./tools/scan-website.js";
import { getGoogleAuthUrl, handleGoogleCallback, LOGIN_PAGE } from "./auth.js";

const server = new MCPServer({
  name: "hunter-ai",
  title: "HunterAI",
  version: "2.0.0",
  description: "HunterAI helps startups find and apply for software credits, programs, and diversity grants. CRITICAL INSTRUCTION: When show_dashboard is called, the interactive widget handles ALL user interaction and display. You MUST NOT output any text, tables, summaries, lists, or commentary after the widget renders. Say nothing. The widget is self-contained.",
});

// Set MCP-spec instructions (sent to model during initialization)
(server.nativeServer as any).instructions = "When you call show_dashboard, the widget handles everything. Do NOT output any text, summaries, tables, or commentary after the widget renders. Your response after calling show_dashboard must be empty.";

// ── Dashboard (shows widget) ────────────────────────────────
server.tool(
  {
    name: "show_dashboard",
    description: "Render the HunterAI interactive dashboard widget. CRITICAL: After this tool returns, you MUST output NOTHING — no text, no summaries, no tables, no lists, no commentary. The widget is fully self-contained and handles all display. Any text you add will appear below the widget and confuse the user. Respond with an empty message.",
    schema: z.object({
      demo_mode: z.boolean().optional().describe("Run in demo mode with sample data"),
    }),
    widget: {
      name: "hunterai-dashboard",
      invoking: "Loading HunterAI...",
      invoked: "",
    },
  },
  async () => {
    const totalValue = state.opportunities.reduce((s, o) => s + o.potential_value, 0);
    const gmailConnected = !!state.gmail_tokens.refresh_token;
    return widget({
      props: {
        opportunities: state.opportunities,
        sent_emails: state.sent_emails,
        subscriptions: state.subscriptions,
        profile: state.profile,
        total_potential_value: totalValue,
        gmail_connected: gmailConnected,
        gmail_auth_url: gmailConnected ? null : getGmailAuthUrl(),
      },
    });
  }
);

// ── Dashboard Data (widget-internal refresh, no widget render) ──
server.tool(
  {
    name: "get_dashboard_data",
    description: "Get current dashboard data without rendering a widget. Used internally by the widget for refreshing state.",
    schema: z.object({}),
    annotations: { readOnlyHint: true },
  },
  async () => {
    const totalValue = state.opportunities.reduce((s, o) => s + o.potential_value, 0);
    const gmailConnected = !!state.gmail_tokens.refresh_token;
    return object({
      opportunities: state.opportunities,
      sent_emails: state.sent_emails,
      subscriptions: state.subscriptions,
      profile: state.profile,
      total_potential_value: totalValue,
      gmail_connected: gmailConnected,
      gmail_auth_url: gmailConnected ? null : getGmailAuthUrl(),
    });
  }
);

// ── Save Company Profile ────────────────────────────────────
server.tool(
  {
    name: "save_company_profile",
    description: "Save or update company profile for matching with startup credit programs and grants",
    schema: saveProfileSchema,
  },
  async (input) => {
    try {
      const result = await saveProfileTool(input);
      return object(result);
    } catch (err) {
      return error(err instanceof Error ? err.message : String(err));
    }
  }
);

// ── Analyze Bank Statement ──────────────────────────────────
server.tool(
  {
    name: "analyze_statement",
    description: "Analyze a bank statement PDF to detect recurring SaaS subscriptions. When called from the widget, do NOT add any text response — the widget handles display.",
    schema: analyzeStatementSchema,
  },
  async (input) => {
    try {
      const result = await analyzeStatementTool(input);
      return object(result);
    } catch (err) {
      return error(err instanceof Error ? err.message : String(err));
    }
  }
);

// ── Scan Website ────────────────────────────────────────────
server.tool(
  {
    name: "scan_website",
    description: "Scan a website URL to detect its tech stack. When called from the widget, do NOT add any text response — the widget handles display.",
    schema: scanWebsiteSchema,
    annotations: { readOnlyHint: true },
  },
  async (input) => {
    try {
      const result = await scanWebsiteTool(input);
      return object(result);
    } catch (err) {
      return error(err instanceof Error ? err.message : String(err));
    }
  }
);

// ── Find Opportunities ──────────────────────────────────────
server.tool(
  {
    name: "find_opportunities",
    description: "Find startup credit programs, grants, and discounts matching the company profile. When called from the widget, do NOT add any text response — the widget handles display.",
    schema: findOpportunitiesSchema,
  },
  async (input) => {
    try {
      const result = await findOpportunitiesTool(input);
      return object(result);
    } catch (err) {
      return error(err instanceof Error ? err.message : String(err));
    }
  }
);

// ── Draft Email ─────────────────────────────────────────────
server.tool(
  {
    name: "draft_email",
    description: "Draft an application email for a specific opportunity using AI",
    schema: draftEmailSchema,
  },
  async (input) => {
    try {
      const result = await draftEmailTool(input);
      return object({ ...result });
    } catch (err) {
      return error(err instanceof Error ? err.message : String(err));
    }
  }
);

// ── Gmail Status ────────────────────────────────────────────
server.tool(
  {
    name: "get_gmail_status",
    description: "Check whether Gmail OAuth is connected and get the auth URL if not",
    schema: getGmailStatusSchema,
    annotations: { readOnlyHint: true },
  },
  async () => {
    try {
      const result = await getGmailStatusTool();
      return object(result);
    } catch (err) {
      return error(err instanceof Error ? err.message : String(err));
    }
  }
);

// ── Send Email ──────────────────────────────────────────────
server.tool(
  {
    name: "send_email",
    description: "Send an application email from the user's connected Gmail account to a startup program contact. Requires Gmail OAuth connection first.",
    schema: sendEmailSchema,
    annotations: { openWorldHint: true },
  },
  async (input) => {
    try {
      const result = await sendEmailTool(input);
      return object(result);
    } catch (err) {
      return error(err instanceof Error ? err.message : String(err));
    }
  }
);

// ── Fill Form ───────────────────────────────────────────────
server.tool(
  {
    name: "fill_form",
    description: "Auto-fill a web application form using saved company profile data",
    schema: fillFormSchema,
    annotations: { openWorldHint: true },
  },
  async (input) => {
    try {
      const result = await fillFormTool(input);
      return object({ ...result });
    } catch (err) {
      return error(err instanceof Error ? err.message : String(err));
    }
  }
);

// ── Check Replies ───────────────────────────────────────────
server.tool(
  {
    name: "check_replies",
    description: "Check Gmail for replies to sent application emails and draft AI responses",
    schema: checkRepliesSchema,
    annotations: { readOnlyHint: true },
  },
  async (input) => {
    try {
      const result = await checkRepliesTool(input);
      return object(result);
    } catch (err) {
      return error(err instanceof Error ? err.message : String(err));
    }
  }
);

// ── Send Reply ──────────────────────────────────────────────
server.tool(
  {
    name: "send_reply",
    description: "Send an AI-drafted or custom reply to a vendor that responded to an application",
    schema: sendReplySchema,
    annotations: { openWorldHint: true },
  },
  async (input) => {
    try {
      const result = await sendReplyTool(input);
      return object(result);
    } catch (err) {
      return error(err instanceof Error ? err.message : String(err));
    }
  }
);

// ── Daily Digest ────────────────────────────────────────────
server.tool(
  {
    name: "daily_digest",
    description: "Generate a summary of recent HunterAI activity and optionally email it",
    schema: dailyDigestSchema,
  },
  async (input) => {
    try {
      const result = await dailyDigestTool(input);
      return object(result);
    } catch (err) {
      return error(err instanceof Error ? err.message : String(err));
    }
  }
);

// ── Configure Digest ────────────────────────────────────────
server.tool(
  {
    name: "configure_digest",
    description: "Enable or disable automatic daily email digest with schedule settings",
    schema: configureDigestSchema,
  },
  async (input) => {
    try {
      const result = await configureDigestTool(input);
      return object(result);
    } catch (err) {
      return error(err instanceof Error ? err.message : String(err));
    }
  }
);

// ── Connect Puzzle API Key ──────────────────────────────────
server.tool(
  {
    name: "connect_puzzle_api_key",
    description: "Connect your Puzzle.io account using an API key to import real transactions",
    schema: connectPuzzleApiKeySchema,
  },
  async (input) => {
    try {
      const result = await connectPuzzleApiKeyTool(input);
      return object(result);
    } catch (err) {
      return error(err instanceof Error ? err.message : String(err));
    }
  }
);

// ── Pull Puzzle Transactions ────────────────────────────────
server.tool(
  {
    name: "pull_puzzle_transactions",
    description: "Pull recurring transactions from Puzzle.io to detect SaaS subscriptions",
    schema: pullPuzzleTransactionsSchema,
    annotations: { readOnlyHint: true },
  },
  async (input) => {
    try {
      const result = await pullPuzzleTransactionsTool(input);
      return object(result);
    } catch (err) {
      return error(err instanceof Error ? err.message : String(err));
    }
  }
);

// ── OAuth HTTP Routes ───────────────────────────────────────
server.app.get("/auth/gmail", (c) => c.redirect(getGmailAuthUrl()));

server.app.get("/auth/gmail/callback", async (c) => {
  const code = c.req.query("code");
  if (!code) return c.text("Missing code parameter", 400);
  try {
    await handleGmailCallback(code);
    return c.html(`<!DOCTYPE html>
<html>
<head><title>HunterAI — Gmail Connected</title>
<style>
  body { font-family: -apple-system,BlinkMacSystemFont,sans-serif; display:flex; align-items:center; justify-content:center; height:100vh; margin:0; background:#f5f5f5; }
  .card { background:#fff; border-radius:16px; padding:48px; text-align:center; box-shadow:0 4px 24px rgba(0,0,0,0.08); max-width:380px; }
  h1 { margin:0 0 8px; font-size:28px; } p { color:#666; margin:0 0 12px; }
  .check { font-size:48px; margin-bottom:16px; }
</style>
</head>
<body>
  <div class="card">
    <div class="check">&#10003;</div>
    <h1>Gmail Connected</h1>
    <p>Your Gmail account is now linked to HunterAI.</p>
    <p>Return to your chat — the dashboard will update automatically.</p>
  </div>
</body>
</html>`);
  } catch (err) {
    return c.text(`Gmail auth failed: ${err instanceof Error ? err.message : String(err)}`, 500);
  }
});

server.app.get("/auth/google", (c) => c.redirect(getGoogleAuthUrl()));

server.app.get("/auth/google/callback", async (c) => {
  const code = c.req.query("code");
  if (!code) return c.text("Missing code parameter", 400);
  try {
    const sessionToken = await handleGoogleCallback(code);
    return c.html(`<h2>Signed in!</h2><p>Session: ${sessionToken.slice(0, 8)}...</p><p>You can close this tab.</p>`);
  } catch (err) {
    return c.text(`Google auth failed: ${err instanceof Error ? err.message : String(err)}`, 500);
  }
});

server.app.get("/auth/puzzle", (c) => c.redirect(getPuzzleAuthUrl()));

server.app.get("/auth/puzzle/callback", async (c) => {
  const code = c.req.query("code");
  if (!code) return c.text("Missing code parameter", 400);
  try {
    await handlePuzzleCallback(code);
    return c.html("<h2>Puzzle connected!</h2><p>You can close this tab.</p>");
  } catch (err) {
    return c.text(`Puzzle auth failed: ${err instanceof Error ? err.message : String(err)}`, 500);
  }
});

server.app.get("/login", (c) => c.html(LOGIN_PAGE));

// ── Start ───────────────────────────────────────────────────
server.listen();
