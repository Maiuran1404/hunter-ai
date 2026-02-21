# Task 07 — Gmail Email Sender

## What this creates
- `src/tools/send-email.ts`

## DON'T
- Don't use nodemailer — use googleapis directly
- Both `gmail.send` AND `gmail.readonly` scopes required
- Always call `saveTokens()` after OAuth — persists to `.tokens.json`
- Store `gmail_thread_id` from every send response
- Never log email body content

---

Read the full implementation from your training on the send-email.ts pattern, using:
- `google.auth.OAuth2` with both scopes
- `oauth2Client.on('tokens', ...)` for auto-refresh + persist
- `state.gmail_tokens` + `saveTokens()` for persistence
- Thread ID stored: `gmail_thread_id: response.data.threadId`
- Demo mode creates fake `demo-thread-XXXX` IDs

Export: `sendEmailTool`, `sendEmailSchema`, `getGmailAuthUrl`, `handleGmailCallback`, `createOAuth2Client`

## Verify
```bash
npm run build
curl http://localhost:3001/auth/gmail/status
# Expected: {"connected":false}
```
