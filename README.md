# HunterAI

### Your startup is burning cash on software. What if you didn't have to?

There are **66 credit programs** across AWS, Google Cloud, Anthropic, Vercel, and 53 other vendors — worth up to **$500K** for your startup. You just don't have time to find them, check if you qualify, and fill out 18 different applications.

**HunterAI does all of it in 5 minutes.** It lives right inside ChatGPT.

![HunterAI Dashboard](https://img.shields.io/badge/MCP_App-Hackathon-orange?style=for-the-badge) ![Programs](https://img.shields.io/badge/66_Programs-$16M+_in_Credits-green?style=for-the-badge) ![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)

---

## See It In Action

```
 YOU                                    HUNTERAI
  |                                        |
  |  "Scan my website"                     |
  |--------------------------------------->|
  |                                        |  Detects AWS, Vercel, Figma,
  |                                        |  Linear, Anthropic...
  |                                        |
  |        "You qualify for 18 programs    |
  |         worth $2.4M. 5 are one-click." |
  |<---------------------------------------|
  |                                        |
  |  *clicks Apply on AWS Activate*        |
  |--------------------------------------->|
  |                                        |  Drafts personalized email
  |                                        |  Connects your Gmail
  |                                        |  Sends it
  |                                        |
  |        "Sent! Apply to the next one?"  |
  |<---------------------------------------|
  |                                        |
  |                    ... 3 days later ... |
  |                                        |
  |        "AWS replied. Here's a draft    |
  |         follow-up. Send it?"           |
  |<---------------------------------------|
```

**That's it.** Scan. Click. Get credits. No spreadsheets. No tab-switching. No forgetting to follow up.

---

## How It Works

### 1. Drop in your website or bank statement
HunterAI scans your URL for tech signatures (60+ vendors) or reads your bank statement PDF to find every SaaS tool you're paying for.

### 2. Instant matching against 66 programs
Your ARR, team size, geography, incubators, and founder identity are checked against every program. Results are ranked by dollar value and sorted by effort — easy ones first.

### 3. One-click apply
Hit "Apply." AI writes a personalized email using your real company details (never placeholder text), connects to your Gmail, and sends it. Done.

### 4. Auto-follow-up
HunterAI watches your inbox for vendor replies and drafts a response. You review, click send, repeat.

---

## Program Coverage

| Category | Count | Examples |
|---|---|---|
| Startup Programs | 34 | AWS Activate, Google Cloud, Azure, Anthropic, Vercel |
| Diversity Grants | 16 | Backstage Capital, Google for Startups Black Founders, SheWorx |
| Incubator Credits | 12 | YC deals, Antler portfolio perks, 500 Global |
| Government Grants | 3 | NSF SBIR, state-level innovation funds |

**57 vendors. 66 programs. $16.5M+ in total available credits.**

---

## Quick Start

### Prerequisites
- Node.js 18+
- pnpm (`npm install -g pnpm`)

### Install & Run

```bash
git clone https://github.com/your-org/hunter-ai.git
cd hunter-ai
pnpm install
pnpm dev
```

The server starts on `http://localhost:3001`.

### Demo Mode (no API keys needed)

```bash
DEMO_MODE=true pnpm dev
```

Every tool works with realistic sample data — perfect for trying the full workflow.

### Environment Variables

Create a `.env` file in the project root:

```env
# Required for AI-powered email drafting
ANTHROPIC_API_KEY=sk-ant-...

# Required for sending emails from user's Gmail
GMAIL_CLIENT_ID=your-google-client-id
GMAIL_CLIENT_SECRET=your-google-client-secret
GMAIL_REDIRECT_URI=http://localhost:3001/auth/gmail/callback

# Optional: Google Sign-In
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Optional: Puzzle.io accounting integration
PUZZLE_API_KEY=your-puzzle-api-key

# Optional: Run with sample data (no keys needed)
DEMO_MODE=true
```

### Deploy to Manufact Cloud

```bash
pnpm deploy
```

---

## Architecture

```
src/
  index.ts                 MCP server — 18 tools, OAuth routes
  state.ts                 Runtime state, demo mode, token storage
  types.ts                 TypeScript interfaces
  auth.ts                  Google OAuth + session management
  tools/
    scan-website.ts        Detect tech stack from URL (60+ signatures)
    analyze-statement.ts   Extract subscriptions from bank statement PDF
    find-opportunities.ts  Match company profile to 66 programs
    draft-email.ts         AI-personalized application emails
    send-email.ts          Gmail OAuth + send via Gmail API
    fill-form.ts           Auto-fill web application forms (Playwright)
    check-replies.ts       Monitor Gmail threads for vendor replies
    save-profile.ts        Store company context for personalization
    puzzle.ts              Puzzle.io accounting integration
    daily-digest.ts        Activity summary + scheduled email digest
  data/
    programs.json          66 verified credit programs

resources/
  hunterAI-dashboard/
    widget.tsx             React dashboard widget (mcp-use hooks)
```

## Tools

| Tool | Description |
|---|---|
| `show_dashboard` | Render the interactive dashboard widget |
| `scan_website` | Detect tech stack from a URL |
| `analyze_statement` | Parse bank statement PDF for SaaS subscriptions |
| `save_company_profile` | Save company context for matching |
| `find_opportunities` | Match against 66 credit programs |
| `draft_email` | AI-draft a personalized application email |
| `send_email` | Send application via connected Gmail |
| `fill_form` | Auto-fill web application forms |
| `check_replies` | Monitor Gmail for vendor responses |
| `send_reply` | Send AI-drafted follow-up replies |
| `daily_digest` | Generate activity summary report |
| `configure_digest` | Schedule automatic digest emails |
| `connect_puzzle_api_key` | Connect Puzzle.io for real transaction data |
| `pull_puzzle_transactions` | Import subscriptions from Puzzle.io |

---

## Tech Stack

- **[mcp-use](https://mcp-use.com)** — MCP server framework with React widget support
- **React 19** + **Tailwind CSS 4** — Interactive dashboard widget
- **Anthropic Claude** — AI email drafting and bank statement parsing
- **Google Gmail API** — OAuth2 email sending from user's account
- **Playwright** — Headless form auto-fill
- **Zod** — Runtime schema validation

---

## License

MIT
