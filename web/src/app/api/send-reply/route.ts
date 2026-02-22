import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getState, logActivity } from '@/lib/state';
import { createOAuth2Client } from '@/lib/gmail';

export async function POST(request: NextRequest) {
  try {
    const { email_id, custom_body } = await request.json();
    const state = getState();
    const email = state.sent_emails.find(e => e.id === email_id);
    if (!email?.reply) return NextResponse.json({ error: 'No reply found for this email' }, { status: 404 });

    const body = custom_body || email.reply.ai_response_draft || '';
    if (!body) return NextResponse.json({ error: 'No reply body to send' }, { status: 400 });

    const client = createOAuth2Client();
    const gmail = google.gmail({ version: 'v1', auth: client });
    const raw = Buffer.from(
      `To: ${email.reply.from}\r\nSubject: Re: ${email.subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body}`
    ).toString('base64url');
    await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw, threadId: email.gmail_thread_id || undefined },
    });

    email.reply.ai_response_status = 'sent';
    logActivity('reply_sent', `Reply sent to ${email.reply.from}`, { to: email.reply.from, email_id: email.id });

    return NextResponse.json({ sent: true, message: `Reply sent to ${email.reply.from}` });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
