import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import Anthropic from '@anthropic-ai/sdk';
import { getState, logActivity } from '@/lib/state';
import { createOAuth2Client } from '@/lib/gmail';

const anthropic = new Anthropic();

async function draftReplyWithAI(originalBody: string, replyBody: string, vendor: string): Promise<string> {
  const state = getState();
  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `You're replying to a vendor (${vendor}) about a startup credits program.
Company: ${state.profile?.name || 'our startup'}
Founder: ${state.profile?.founder_name || 'the team'}
Original email: ${originalBody.slice(0, 300)}
Their reply: ${replyBody.slice(0, 500)}
Write a warm, professional response under 150 words. Be grateful, express interest, ask about next steps. Sign off with "${state.profile?.founder_name || 'The Team'}". NEVER use placeholders like [Your name]. Return ONLY the reply body.`,
      }],
    });
    return msg.content[0].type === 'text' ? msg.content[0].text : '';
  } catch {
    const founderName = state.profile?.founder_name || 'The Team';
    return `Thank you for getting back to us, ${vendor} team! We'd love to proceed with the startup program. Could you share the next steps? We're happy to provide any additional information needed.\n\nBest regards,\n${founderName}`;
  }
}

export async function POST() {
  try {
    const state = getState();

    if (!state.gmail_tokens.refresh_token) {
      return NextResponse.json({ found: 0, emails: state.sent_emails });
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

        const msg = await gmail.users.messages.get({ userId: 'me', id: res.data.messages[0].id!, format: 'full' });
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
        logActivity('reply_received', `Reply received from ${from} for "${subject}"`, { from, subject, email_id: sent.id });
        found++;
      } catch { /* per-email error, continue */ }
    }

    return NextResponse.json({ found, emails: state.sent_emails });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
