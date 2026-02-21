# HunterAI — Project Overview

## What you're building
HunterAI is an MCP App for the Manufact/YC Hackathon. It helps startup founders find and
apply for software credits, startup programs, and diversity grants — rendered as an
interactive widget inside Claude and ChatGPT.

## Hackathon scoring (100pt total)
| Criteria | Points | How HunterAI wins |
|---|---|---|
| Originality | 30pt | First MCP App to automate the entire startup credits workflow |
| Real-World Usefulness | 30pt | Saves founders $50K-$500K in real credits they're leaving on the table |
| Widget-Model Interaction | 20pt | Heavy use of `useCallTool`, `sendFollowUpMessage`, `state`, `setState` |
| User Experience & UI | 10pt | Polished opportunity cards, one-click apply, live status tracking |
| Production Readiness | 10pt | Gmail OAuth, Google sign-in, Manufact Cloud deployment |

## Tech stack (hackathon-required)
- **mcp-use SDK** — `npx create-mcp-use-app@latest`, template: MCP Apps
- **React TSX widgets** in `resources/` folder with mcp-use hooks
- **Deploy target** — Manufact MCP Cloud (`npx @mcp-use/cli deploy`)
- **Demo client** — Claude.ai or ChatGPT

## Key mcp-use patterns to use everywhere
```tsx
import { useCallTool, sendFollowUpMessage, state, setState } from 'mcp-use/widget'

// Call server tools from widget
const result = await useCallTool('find_opportunities', { profile })

// Trigger model follow-up
sendFollowUpMessage('Found 18 programs. Ready to send applications?')

// Widget state (persists across renders)
const current = state('opportunities') ?? []
setState('opportunities', [...current, newOpportunity])
```

## File structure
```
hunterAI/
├── src/
│   ├── index.ts            ← mcp-use server entry point
│   ├── state.ts            ← isDemoMode(), saveTokens(), loadTokens()
│   ├── types.ts            ← all TypeScript interfaces
│   ├── auth.ts             ← Google OAuth + session middleware
│   ├── db.ts               ← SQLite sessions
│   ├── tools/
│   │   ├── analyze-statement.ts
│   │   ├── find-opportunities.ts
│   │   ├── draft-email.ts
│   │   ├── send-email.ts
│   │   ├── fill-form.ts
│   │   ├── check-replies.ts
│   │   ├── save-profile.ts
│   │   └── puzzle.ts
│   └── data/
│       └── programs.json   ← 66 programs, no // comments
├── resources/
│   └── hunterAI-dashboard/
│       └── widget.tsx      ← React widget with mcp-use hooks
├── scripts/
│   └── validate-programs.mjs
└── tasks/                  ← build task files (read one at a time)
```

## Runtime
- Port: 3001
- Demo mode: `DEMO_MODE=true` (no real API keys needed)
- Screenshots: `/tmp/hunterAI-screenshots/` auto-deleted 60s
- DB: `.hunterAI.db`
- Tokens: `.tokens.json`, `.puzzle-tokens.json` (gitignored)
