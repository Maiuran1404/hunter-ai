# Task 09 — Gmail Reply Handler

## What this creates
- `src/tools/check-replies.ts`

## Critical rules
- Primary search: `thread:${sentEmail.gmail_thread_id} -from:me`
- Fallback only: subject-line search if no thread ID
- Background polling: 24-hour interval (NEVER 15 minutes)
- Guard double-start: `if (state.reply_poll_active) return;`
- Per-email errors: catch individually, don't abort whole poll
- `sendEmailTool` must be dynamically imported inside `sendReplyTool` (avoids circular deps)

---

Read the full implementation from your training on the check-replies.ts pattern, using:
- `checkRepliesForAllSentEmails()` — loops sent_emails, searches by thread ID
- `draftReplyWithAI()` — uses `claude-haiku-4-5-20251001`, under 150 words
- `checkRepliesTool()` — demo mode simulates a realistic vendor reply
- `sendReplyTool()` — dynamic import of `sendEmailTool`
- `startReplyPolling(intervalMs = 24 * 60 * 60 * 1000)` — 24hr guard

Export: `checkRepliesTool`, `checkRepliesSchema`, `sendReplyTool`, `sendReplySchema`, `startReplyPolling`

## Verify
```bash
npm run build
npm run dev
# Expected: server starts + "[Replies] Background poll every 24 hours"
```
