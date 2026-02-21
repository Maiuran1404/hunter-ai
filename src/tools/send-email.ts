import { z } from 'zod';
import { google } from 'googleapis';
import { Resend } from 'resend';
import { state, isDemoMode, saveTokens, logActivity } from '../state.js';
import { randomUUID } from 'crypto';
import type { SentEmail } from '../types.js';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const RESEND_FROM = process.env.RESEND_FROM || 'HunterAI <noreply@notifications.craftedstudio.ai>';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
];

export function createOAuth2Client() {
  const client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI,
  );
  if (state.gmail_tokens.access_token) {
    client.setCredentials(state.gmail_tokens);
  }
  client.on('tokens', (tokens) => {
    if (tokens.refresh_token) state.gmail_tokens.refresh_token = tokens.refresh_token;
    if (tokens.access_token) state.gmail_tokens.access_token = tokens.access_token;
    if (tokens.expiry_date) state.gmail_tokens.expiry_date = tokens.expiry_date;
    saveTokens(state.gmail_tokens);
  });
  return client;
}

export function getGmailAuthUrl(): string {
  const client = createOAuth2Client();
  return client.generateAuthUrl({ access_type: 'offline', scope: SCOPES, prompt: 'consent' });
}

export async function handleGmailCallback(code: string): Promise<void> {
  const client = createOAuth2Client();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);
  state.gmail_tokens = {
    access_token: tokens.access_token ?? undefined,
    refresh_token: tokens.refresh_token ?? undefined,
    expiry_date: tokens.expiry_date ?? undefined,
  };
  saveTokens(state.gmail_tokens);
}

export async function sendEmailTool(input: {
  to: string;
  subject: string;
  body: string;
  program_id: string;
  thread_id?: string;
  demo_mode?: boolean;
}): Promise<{ sent: boolean; email: SentEmail; suggestions: unknown[] }> {
  const emailId = randomUUID();

  if (isDemoMode(input.demo_mode)) {
    const sent: SentEmail = {
      id: emailId,
      gmail_message_id: `demo-msg-${emailId.slice(0, 8)}`,
      gmail_thread_id: input.thread_id || `demo-thread-${emailId.slice(0, 8)}`,
      program_id: input.program_id,
      to: input.to,
      subject: input.subject,
      body: input.body,
      sent_at: new Date().toISOString(),
      status: 'sent',
    };
    state.sent_emails.push(sent);
    logActivity('email_sent', `Sent email to ${input.to} for program ${input.program_id} (demo)`, { to: input.to, program_id: input.program_id });
    return {
      sent: true, email: sent,
      suggestions: [
        { label: '📨 Send next application', sub: '', primary: true },
        { label: '📊 Show dashboard', sub: '' },
      ],
    };
  }

  // Try Resend first, then Gmail as fallback
  let messageId: string | undefined;
  let threadId: string | undefined;

  if (resend) {
    // Send via Resend
    try {
      const { data, error } = await resend.emails.send({
        from: RESEND_FROM,
        to: [input.to],
        subject: input.subject,
        text: input.body,
        replyTo: state.profile?.contact_email || undefined,
      });
      if (error) throw new Error(error.message);
      messageId = data?.id;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logActivity('email_failed', `Failed to send email to ${input.to} via Resend: ${msg}`, { to: input.to, program_id: input.program_id, error: msg });
      throw new Error(`Resend send failed: ${msg}`);
    }
  } else if (state.gmail_tokens.refresh_token) {
    // Fallback to Gmail OAuth
    const client = createOAuth2Client();
    const gmail = google.gmail({ version: 'v1', auth: client });
    const raw = Buffer.from(
      `To: ${input.to}\r\nSubject: ${input.subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${input.body}`
    ).toString('base64url');
    try {
      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw, threadId: input.thread_id || undefined },
      });
      messageId = response.data.id ?? undefined;
      threadId = response.data.threadId ?? undefined;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logActivity('email_failed', `Failed to send email to ${input.to}: ${msg}`, { to: input.to, program_id: input.program_id, error: msg });
      throw new Error(`Gmail send failed: ${msg}`);
    }
  } else {
    throw new Error('No email provider configured. Set RESEND_API_KEY or connect Gmail via /auth/gmail.');
  }

  const sent: SentEmail = {
    id: emailId,
    gmail_message_id: messageId,
    gmail_thread_id: threadId || input.thread_id,
    program_id: input.program_id,
    to: input.to,
    subject: input.subject,
    body: input.body,
    sent_at: new Date().toISOString(),
    status: 'sent',
  };
  state.sent_emails.push(sent);
  logActivity('email_sent', `Sent email to ${input.to} for program ${input.program_id}`, { to: input.to, program_id: input.program_id });

  return {
    sent: true, email: sent,
    suggestions: [
      { label: '📨 Send next application', sub: '', primary: true },
      { label: '📊 Show dashboard', sub: '' },
    ],
  };
}

export const sendEmailSchema = z.object({
  to: z.string(),
  subject: z.string(),
  body: z.string(),
  program_id: z.string(),
  thread_id: z.string().optional(),
  demo_mode: z.boolean().optional(),
});
