import { z } from 'zod';
import { google } from 'googleapis';
import Anthropic from '@anthropic-ai/sdk';
import { state, isDemoMode } from '../state.js';
import { createOAuth2Client } from './send-email.js';
import type { EmailReply, SentEmail } from '../types.js';

const anthropic = new Anthropic();

async function draftReplyWithAI(originalBody: string, replyBody: string, vendor: string): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY?.startsWith('sk-ant-api')) {
    return `Thank you for getting back to us, ${vendor} team! We'd love to proceed with the startup program. Could you share the next steps? We're happy to provide any additional information needed.\n\nBest regards`;
  }
  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001', max_tokens: 300,
    messages: [{ role: 'user', content: `You're replying to a vendor (${vendor}) about a startup credits program.
Original email: ${originalBody.slice(0, 300)}
Their reply: ${replyBody.slice(0, 500)}
Write a warm, professional response under 150 words. Be grateful, express interest, ask about next steps. Return ONLY the reply body.` }],
  });
  return msg.content[0].type === 'text' ? msg.content[0].text : '';
}

async function checkRepliesForAllSentEmails(): Promise<{ found: number; emails: SentEmail[] }> {
  if (!state.gmail_tokens.refresh_token) {
    return { found: 0, emails: state.sent_emails };
  }

  const client = createOAuth2Client();
  const gmail = google.gmail({ version: 'v1', auth: client });
  let found = 0;

  for (const sent of state.sent_emails) {
    if (sent.reply) continue;
    try {
      let query = '';
      if (sent.gmail_thread_id && !sent.gmail_thread_id.startsWith('demo-')) {
        query = `thread:${sent.gmail_thread_id} -from:me`;
      } else {
        query = `subject:"${sent.subject}" -from:me`;
      }

      const res = await gmail.users.messages.list({ userId: 'me', q: query, maxResults: 1 });
      if (!res.data.messages?.length) continue;

      const msg = await gmail.users.messages.get({
        userId: 'me', id: res.data.messages[0].id!,
        format: 'full',
      });

      const headers = msg.data.payload?.headers || [];
      const from = headers.find(h => h.name?.toLowerCase() === 'from')?.value || '';
      const subject = headers.find(h => h.name?.toLowerCase() === 'subject')?.value || '';

      let body = '';
      const parts = msg.data.payload?.parts || [];
      for (const part of parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          body = Buffer.from(part.body.data, 'base64url').toString('utf-8');
          break;
        }
      }
      if (!body) {
        for (const part of parts) {
          if (part.mimeType === 'text/html' && part.body?.data) {
            const html = Buffer.from(part.body.data, 'base64url').toString('utf-8');
            body = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            break;
          }
        }
      }
      if (!body && msg.data.payload?.body?.data) {
        body = Buffer.from(msg.data.payload.body.data, 'base64url').toString('utf-8');
      }

      const aiDraft = await draftReplyWithAI(sent.body, body, sent.to.split('@')[1]?.split('.')[0] || 'vendor');

      sent.reply = {
        from, subject, body,
        received_at: new Date().toISOString(),
        ai_response_draft: aiDraft,
        ai_response_status: 'drafted',
      };
      sent.status = 'replied';
      found++;
    } catch {
      /* per-email error, continue checking others */
    }
  }

  return { found, emails: state.sent_emails };
}

export async function checkRepliesTool(_input: Record<string, never>): Promise<{
  found: number;
  emails: SentEmail[];
  suggestions: unknown[];
}> {
  if (isDemoMode()) {
    const demoSent = state.sent_emails.find(e => !e.reply);
    if (demoSent) {
      demoSent.reply = {
        from: `startups@${demoSent.to.split('@')[1] || 'vendor.com'}`,
        subject: `Re: ${demoSent.subject}`,
        body: `Hi! Thanks for reaching out. We'd love to welcome you to our startup program. You're eligible for credits worth up to $${(Math.random() * 50000 + 5000).toFixed(0)}. Please reply with your company details and we'll get you set up right away.\n\nBest,\nStartup Programs Team`,
        received_at: new Date().toISOString(),
        ai_response_draft: `Thank you so much for the quick response! We're thrilled to join your startup program. Here are our details:\n\n- Company: ${state.profile?.name || 'Our Startup'}\n- Stage: ${state.profile?.stage || 'seed'}\n- Team: ${state.profile?.team_size || 5} people\n\nPlease let us know the next steps to activate our credits.\n\nBest regards,\n${state.profile?.founder_name || 'The Team'}`,
        ai_response_status: 'drafted',
      };
      demoSent.status = 'replied';
    }
    return {
      found: demoSent ? 1 : 0,
      emails: state.sent_emails,
      suggestions: [
        { label: '📤 Send AI reply', sub: '', primary: true },
        { label: '✏️ Edit reply first', sub: '' },
      ],
    };
  }

  const result = await checkRepliesForAllSentEmails();
  return {
    ...result,
    suggestions: result.found > 0
      ? [{ label: `📤 Send ${result.found} AI replies`, sub: '', primary: true }, { label: '✏️ Review each', sub: '' }]
      : [{ label: '📊 Show dashboard', sub: '' }],
  };
}

export async function sendReplyTool(input: {
  email_id: string;
  custom_body?: string;
}): Promise<{ sent: boolean; message: string; suggestions: unknown[] }> {
  const email = state.sent_emails.find(e => e.id === input.email_id);
  if (!email?.reply) throw new Error(`No reply found for email ${input.email_id}`);

  const body = input.custom_body || email.reply.ai_response_draft || '';
  if (!body) throw new Error('No reply body to send');

  const { sendEmailTool } = await import('./send-email.js');
  await sendEmailTool({
    to: email.reply.from,
    subject: `Re: ${email.subject}`,
    body,
    program_id: email.program_id,
    thread_id: email.gmail_thread_id,
  });

  email.reply.ai_response_status = 'sent';

  return {
    sent: true,
    message: `Reply sent to ${email.reply.from}`,
    suggestions: [
      { label: '📬 Check more replies', sub: '', primary: true },
      { label: '📊 Show dashboard', sub: '' },
    ],
  };
}

export function startReplyPolling(intervalMs: number = 24 * 60 * 60 * 1000): void {
  if (state.reply_poll_active) return;
  state.reply_poll_active = true;
  console.log(`[Replies] Background poll every ${Math.round(intervalMs / 3600000)} hours`);
  setInterval(async () => {
    try {
      const result = await checkRepliesForAllSentEmails();
      if (result.found > 0) console.log(`[Replies] Found ${result.found} new replies`);
    } catch (err) {
      console.warn('[Replies] Poll error:', err instanceof Error ? err.message : String(err));
    }
  }, intervalMs);
}

export const checkRepliesSchema = z.object({});

export const sendReplySchema = z.object({
  email_id: z.string(),
  custom_body: z.string().optional(),
});
