export async function fetchState() {
  const res = await fetch('/api/state');
  return res.json();
}

export async function resetState() {
  const res = await fetch('/api/state', { method: 'DELETE' });
  return res.json();
}

export async function analyzeStatement(file: File) {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch('/api/analyze-statement', { method: 'POST', body: fd });
  return res.json();
}

export async function findOpportunities() {
  const res = await fetch('/api/find-opportunities', { method: 'POST' });
  return res.json();
}

export async function scanWebsite(url: string) {
  const res = await fetch('/api/scan-website', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  return res.json();
}

export async function draftEmail(opportunityId: string) {
  const res = await fetch('/api/draft-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ opportunity_id: opportunityId }),
  });
  return res.json();
}

export async function sendEmail(data: { to: string; subject: string; body: string; program_id: string; thread_id?: string }) {
  const res = await fetch('/api/send-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function checkReplies() {
  const res = await fetch('/api/check-replies', { method: 'POST' });
  return res.json();
}

export async function sendReply(emailId: string, customBody?: string) {
  const res = await fetch('/api/send-reply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email_id: emailId, custom_body: customBody }),
  });
  return res.json();
}

export async function saveProfile(profile: Record<string, unknown>) {
  const res = await fetch('/api/save-profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile),
  });
  return res.json();
}

export async function getGmailStatus() {
  const res = await fetch('/api/gmail/status');
  return res.json();
}
