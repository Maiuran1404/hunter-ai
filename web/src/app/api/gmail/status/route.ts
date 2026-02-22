import { NextResponse } from 'next/server';
import { getState } from '@/lib/state';
import { getGmailAuthUrl } from '@/lib/gmail';

export async function GET() {
  const state = getState();
  const connected = !!state.gmail_tokens.refresh_token;
  return NextResponse.json({
    connected,
    auth_url: connected ? null : getGmailAuthUrl(),
  });
}
