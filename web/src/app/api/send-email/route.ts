import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { randomUUID } from 'crypto';
import { getState, logActivity } from '@/lib/state';
import { createOAuth2Client } from '@/lib/gmail';
import type { SentEmail } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const { to, subject, body, program_id, thread_id } = await request.json();
    const state = getState();
    const emailId = randomUUID();

    if (!state.gmail_tokens.refresh_token) {
      return NextResponse.json({ error: 'Gmail not connected. Please connect Gmail first.' }, { status: 401 });
    }

    const client = createOAuth2Client();
    const gmail = google.gmail({ version: 'v1', auth: client });
    const raw = Buffer.from(
      `To: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body}`
    ).toString('base64url');

    let messageId: string | undefined;
    let threadIdResult: string | undefined;

    try {
      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw, threadId: thread_id || undefined },
      });
      messageId = response.data.id ?? undefined;
      threadIdResult = response.data.threadId ?? undefined;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logActivity('email_failed', `Failed to send email to ${to}: ${msg}`, { to, program_id, error: msg });
      return NextResponse.json({ error: `Gmail send failed: ${msg}` }, { status: 500 });
    }

    const sent: SentEmail = {
      id: emailId,
      gmail_message_id: messageId,
      gmail_thread_id: threadIdResult || thread_id,
      program_id,
      to, subject, body,
      sent_at: new Date().toISOString(),
      status: 'sent',
    };
    state.sent_emails.push(sent);
    logActivity('email_sent', `Sent email to ${to} for program ${program_id}`, { to, program_id });

    return NextResponse.json({ sent: true, email: sent });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
