import { NextRequest, NextResponse } from 'next/server';
import { handleGmailCallback } from '@/lib/gmail';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  if (!code) {
    return new NextResponse('Missing code parameter', { status: 400 });
  }

  try {
    await handleGmailCallback(code);
    return new NextResponse(`<!DOCTYPE html>
<html>
<head><title>HunterAI — Gmail Connected</title>
<style>
  body { font-family: -apple-system,BlinkMacSystemFont,sans-serif; display:flex; align-items:center; justify-content:center; height:100vh; margin:0; background:#1a1a1e; color:#e4e4e6; }
  .card { background:#242428; border-radius:16px; padding:48px; text-align:center; box-shadow:0 4px 24px rgba(0,0,0,0.3); max-width:380px; border: 1px solid #38383f; }
  h1 { margin:0 0 8px; font-size:28px; } p { color:#8a8a92; margin:0 0 12px; }
  .check { font-size:48px; margin-bottom:16px; color: #22c55e; }
</style>
<script>setTimeout(() => window.close(), 3000);</script>
</head>
<body>
  <div class="card">
    <div class="check">&#10003;</div>
    <h1>Gmail Connected</h1>
    <p>Your Gmail account is now linked to HunterAI.</p>
    <p>This window will close automatically...</p>
  </div>
</body>
</html>`, {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    });
  } catch (err) {
    return new NextResponse(`Gmail auth failed: ${err instanceof Error ? err.message : String(err)}`, { status: 500 });
  }
}
