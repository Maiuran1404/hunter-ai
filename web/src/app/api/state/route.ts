import { NextResponse } from 'next/server';
import { getState, resetState, ensureProfileFromSubscriptions } from '@/lib/state';
import { getGmailAuthUrl } from '@/lib/gmail';

export async function GET() {
  const state = getState();
  ensureProfileFromSubscriptions();
  const totalValue = state.opportunities.reduce((s, o) => s + o.potential_value, 0);
  const gmailConnected = !!state.gmail_tokens.refresh_token;
  return NextResponse.json({
    opportunities: state.opportunities,
    sent_emails: state.sent_emails,
    subscriptions: state.subscriptions,
    profile: state.profile,
    total_potential_value: totalValue,
    gmail_connected: gmailConnected,
    gmail_auth_url: gmailConnected ? null : getGmailAuthUrl(),
  });
}

export async function DELETE() {
  resetState();
  return NextResponse.json({ reset: true });
}
