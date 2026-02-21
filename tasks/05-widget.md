# Task 05 — React Widget (mcp-use hooks)

## What this creates
- `resources/hunterAI-dashboard/widget.tsx`

## Why this matters for the hackathon
Widget-Model Interaction is worth 20pt. Judges are looking for heavy use of:
- `useCallTool()` — widget calls MCP tools directly
- `sendFollowUpMessage()` — widget triggers model responses
- `state()` / `setState()` — widget maintains persistent state

DON'T build a passive display. Build a fully interactive control panel that talks
back to the model.

---

## Create resources/hunterAI-dashboard/widget.tsx

```tsx
import React, { useEffect, useState } from 'react';
import { useCallTool, sendFollowUpMessage, state as mcpState, setState as setMcpState } from 'mcp-use/widget';
import type { Opportunity, SentEmail, Subscription, CompanyProfile } from '../../src/types.js';

// ─── Types for widget state ───────────────────────────────────
interface DashboardState {
  opportunities: Opportunity[];
  sent_emails: SentEmail[];
  subscriptions: Subscription[];
  profile: CompanyProfile | null;
  total_potential_value: number;
  loading: boolean;
  activeTab: 'opportunities' | 'applied' | 'replies';
}

// ─── Main Widget ──────────────────────────────────────────────
export default function HunterAIDashboard() {
  const [dash, setDash] = useState<DashboardState>({
    opportunities: mcpState('opportunities') ?? [],
    sent_emails: mcpState('sent_emails') ?? [],
    subscriptions: mcpState('subscriptions') ?? [],
    profile: mcpState('profile') ?? null,
    total_potential_value: mcpState('total_potential_value') ?? 0,
    loading: false,
    activeTab: 'opportunities',
  });

  // ─── Tool calls from widget ─────────────────────────────────
  const handleRefresh = async () => {
    setDash(d => ({ ...d, loading: true }));
    const result = await useCallTool('show_dashboard', {});
    const data = result as Partial<DashboardState>;
    setMcpState('opportunities', data.opportunities ?? []);
    setMcpState('sent_emails', data.sent_emails ?? []);
    setDash(d => ({
      ...d, loading: false,
      opportunities: data.opportunities ?? d.opportunities,
      sent_emails: data.sent_emails ?? d.sent_emails,
      total_potential_value: data.total_potential_value ?? d.total_potential_value,
    }));
  };

  const handleApplyAll = async () => {
    const easy = dash.opportunities.filter(o => o.effort === 'low').slice(0, 5);
    if (!easy.length) { sendFollowUpMessage('No easy opportunities found. Try reviewing medium-effort ones?'); return; }
    setDash(d => ({ ...d, loading: true }));
    sendFollowUpMessage(`Apply to these ${easy.length} programs right now, starting with ${easy[0].program.name}`);
  };

  const handleApplyOne = async (opp: Opportunity) => {
    if (opp.program.type === 'incubator_portal') {
      sendFollowUpMessage(`Tell me more about accessing ${opp.program.name} — I need manual portal access instructions`);
      return;
    }
    const result = await useCallTool('draft_email', { opportunity_id: opp.id });
    setMcpState('last_draft', result);
    sendFollowUpMessage(`Show me the draft email for ${opp.program.name} and ask if I want to send it`);
  };

  const handleCheckReplies = async () => {
    setDash(d => ({ ...d, loading: true }));
    const result = await useCallTool('check_replies', { demo_mode: true });
    const data = result as { found: number; emails: SentEmail[] };
    setMcpState('sent_emails', data.emails);
    setDash(d => ({ ...d, loading: false, sent_emails: data.emails }));
    if (data.found > 0) sendFollowUpMessage(`Found ${data.found} new replies! Show me the AI-drafted responses`);
  };

  const handleSendReply = async (emailId: string) => {
    await useCallTool('send_reply', { email_id: emailId, demo_mode: true });
    sendFollowUpMessage(`Sent reply to ${emailId}. Check for more replies or move on to next application?`);
  };

  // Load on mount
  useEffect(() => { handleRefresh(); }, []);

  // ─── Styles ──────────────────────────────────────────────────
  const card = { background: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', border: '1px solid #f0f0f0' };
  const badge = (color: string) => ({ background: color, color: '#fff', borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 600 });
  const btn = (primary?: boolean) => ({
    background: primary ? '#1a1a2e' : '#f5f5f5', color: primary ? '#fff' : '#333',
    border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer',
    fontSize: 13, fontWeight: 500, marginRight: 8,
  });
  const effortColor = { low: '#22c55e', medium: '#f59e0b', high: '#ef4444' };

  // ─── Render ───────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: '-apple-system,BlinkMacSystemFont,sans-serif', maxWidth: 680, margin: '0 auto', padding: 20, background: '#fafafa', minHeight: 400 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>🎯 HunterAI</h2>
          {dash.profile && <p style={{ margin: '4px 0 0', fontSize: 13, color: '#666' }}>{dash.profile.name} · {dash.profile.stage} · {dash.profile.incubators.join(', ')}</p>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#1a1a2e' }}>
            ${(dash.total_potential_value / 1000).toFixed(0)}K
          </div>
          <div style={{ fontSize: 11, color: '#888' }}>potential credits</div>
        </div>
      </div>

      {/* Action bar */}
      <div style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button style={btn(true)} onClick={handleApplyAll} disabled={dash.loading}>
          🚀 Apply to easy ones ({dash.opportunities.filter(o=>o.effort==='low').length})
        </button>
        <button style={btn()} onClick={handleCheckReplies} disabled={dash.loading}>
          📬 Check replies ({dash.sent_emails.filter(e=>e.reply).length})
        </button>
        <button style={btn()} onClick={handleRefresh} disabled={dash.loading}>
          {dash.loading ? '⏳' : '🔄'} Refresh
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {(['opportunities','applied','replies'] as const).map(tab => (
          <button key={tab} onClick={() => setDash(d => ({...d, activeTab: tab}))}
            style={{ ...btn(dash.activeTab === tab), padding: '6px 14px', fontSize: 12 }}>
            {tab === 'opportunities' ? `💡 Opportunities (${dash.opportunities.length})` :
             tab === 'applied' ? `📨 Applied (${dash.sent_emails.length})` :
             `💬 Replies (${dash.sent_emails.filter(e=>e.reply).length})`}
          </button>
        ))}
      </div>

      {/* Opportunities tab */}
      {dash.activeTab === 'opportunities' && (
        <div>
          {dash.opportunities.length === 0 ? (
            <div style={{ ...card, textAlign: 'center', color: '#888', padding: 40 }}>
              No opportunities found yet.<br/>
              <button style={{...btn(true), marginTop: 12}} onClick={() => sendFollowUpMessage('Find opportunities for my startup')}>Find Opportunities</button>
            </div>
          ) : dash.opportunities.slice(0, 12).map(opp => (
            <div key={opp.id} style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: 15 }}>{opp.program.name}</span>
                    <span style={badge(opp.program.type === 'diversity_grant' ? '#8b5cf6' : opp.program.type === 'government_grant' ? '#0ea5e9' : '#1a1a2e')}>
                      {opp.program.type.replace('_', ' ')}
                    </span>
                    {!opp.program.verified && <span style={badge('#f59e0b')}>⚠️ unverified</span>}
                  </div>
                  <div style={{ fontSize: 13, color: '#555', marginBottom: 6 }}>{opp.reasoning}</div>
                  <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#888' }}>
                    <span>💰 ${opp.potential_value.toLocaleString()}</span>
                    <span>⚡ <span style={{ color: effortColor[opp.effort] }}>{opp.effort} effort</span></span>
                    {opp.program.currency !== 'USD' && <span>({opp.program.currency})</span>}
                  </div>
                </div>
                <button style={btn(true)} onClick={() => handleApplyOne(opp)}>
                  {opp.program.type === 'incubator_portal' ? '🔗 Portal' : '📨 Apply'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Applied tab */}
      {dash.activeTab === 'applied' && (
        <div>
          {dash.sent_emails.length === 0 ? (
            <div style={{ ...card, textAlign: 'center', color: '#888', padding: 40 }}>
              No applications sent yet.
            </div>
          ) : dash.sent_emails.map(email => (
            <div key={email.id} style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{email.to}</div>
                  <div style={{ fontSize: 13, color: '#666' }}>{email.subject}</div>
                  <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                    Sent {new Date(email.sent_at).toLocaleDateString()} · 
                    <span style={{ color: email.status === 'replied' ? '#22c55e' : '#888' }}> {email.status}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Replies tab */}
      {dash.activeTab === 'replies' && (
        <div>
          {dash.sent_emails.filter(e => e.reply).length === 0 ? (
            <div style={{ ...card, textAlign: 'center', color: '#888', padding: 40 }}>
              No replies yet.
              <br/>
              <button style={{...btn(), marginTop: 12}} onClick={handleCheckReplies}>Check Now</button>
            </div>
          ) : dash.sent_emails.filter(e => e.reply).map(email => (
            <div key={email.id} style={card}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Reply from {email.reply!.from}</div>
              <div style={{ fontSize: 13, color: '#555', marginBottom: 8 }}>
                {email.reply!.body.slice(0, 200)}...
              </div>
              {email.reply!.ai_response_draft && (
                <div style={{ background: '#f0fdf4', borderRadius: 8, padding: 12, marginBottom: 8, fontSize: 13 }}>
                  <strong>AI Draft:</strong> {email.reply!.ai_response_draft.slice(0, 150)}...
                </div>
              )}
              <button style={btn(true)} onClick={() => handleSendReply(email.id)}>
                📤 Send AI Reply
              </button>
              <button style={btn()} onClick={() => sendFollowUpMessage(`Edit the reply to ${email.reply!.from} — I want to customize it`)}>
                ✏️ Edit First
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

## Verify
```bash
npm run build
# Expected: TypeScript OK, widget.tsx compiles
```
