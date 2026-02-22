import { google } from 'googleapis';
import { getState, saveTokens } from './state';

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
  const state = getState();
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
  const state = getState();
  state.gmail_tokens = {
    access_token: tokens.access_token ?? undefined,
    refresh_token: tokens.refresh_token ?? undefined,
    expiry_date: tokens.expiry_date ?? undefined,
  };
  saveTokens(state.gmail_tokens);
}
