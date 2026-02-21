import React, { useEffect, useState, useCallback } from 'react';
import { useWidget, McpUseProvider, type WidgetMetadata } from 'mcp-use/react';
import type { Opportunity, SentEmail, Subscription, CompanyProfile, EmailDraft } from '../../src/types.js';

export const widgetMetadata: WidgetMetadata = {
  description: 'HunterAI Dashboard — find and apply for startup credits, programs, and grants',
  exposeAsTool: false,
  metadata: {
    prefersBorder: false,
    invoking: 'Loading HunterAI dashboard...',
    invoked: 'HunterAI dashboard loaded',
  },
};

// ─── Types ────────────────────────────────────────────────
interface WidgetState {
  opportunities: Opportunity[];
  sent_emails: SentEmail[];
  subscriptions: Subscription[];
  profile: CompanyProfile | null;
  total_potential_value: number;
}

type TabKey = 'opportunities' | 'applied' | 'replies' | 'subscriptions' | 'digest';

interface LocalState {
  loading: boolean;
  applyingId: string | null;
  showAllOpps: boolean;
  expandedReply: string | null;
  activeTab: TabKey;
  draftEmail: (EmailDraft & { opportunity: Opportunity }) | null;
  sendingEmail: boolean;
}

// ─── Palette (black & white only) ────────────────────────
const C = {
  black:   '#000000',
  g900:    '#111111',
  g800:    '#222222',
  g700:    '#333333',
  g600:    '#555555',
  g500:    '#777777',
  g400:    '#999999',
  g300:    '#bbb',
  g200:    '#ddd',
  g150:    '#e8e8e8',
  g100:    '#f2f2f2',
  g50:     '#f9f9f9',
  white:   '#ffffff',
} as const;

const typeLabels: Record<string, string> = {
  startup_program: 'Startup Program', diversity_grant: 'Diversity Grant',
  government_grant: 'Gov Grant', incubator_credit: 'Incubator', incubator_portal: 'Portal', negotiation: 'Negotiation',
};
const effortConfig: Record<string, { dots: number; text: string }> = {
  low: { dots: 1, text: 'Easy' }, medium: { dots: 2, text: 'Medium' }, high: { dots: 3, text: 'Hard' },
};

// ─── Utilities ────────────────────────────────────────────
function fmtCurrency(v: number, cur?: string) {
  if (cur && cur !== 'USD') return `${cur} ${v.toLocaleString()}`;
  return v >= 1000 ? `$${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}K` : `$${v.toLocaleString()}`;
}
function timeAgo(ds: string) {
  const days = Math.floor((Date.now() - new Date(ds).getTime()) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(ds).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Shared font ──────────────────────────────────────────
const FONT = '-apple-system, BlinkMacSystemFont, "Inter", "SF Pro Display", system-ui, sans-serif';

// ─── Main Widget ──────────────────────────────────────────
function HunterAIDashboardInner() {
  const { state: mcpState, setState: setMcpState, callTool, sendFollowUpMessage, isPending } =
    useWidget<Record<string, unknown>, WidgetState>();

  const [local, setLocal] = useState<LocalState>({
    loading: false, applyingId: null, showAllOpps: false, expandedReply: null, activeTab: 'opportunities', draftEmail: null, sendingEmail: false,
  });

  const opps = mcpState?.opportunities ?? [];
  const emails = mcpState?.sent_emails ?? [];
  const subs = mcpState?.subscriptions ?? [];
  const profile = mcpState?.profile ?? null;
  const totalValue = mcpState?.total_potential_value ?? 0;
  const replies = emails.filter(e => e.reply);
  const easyOpps = opps.filter(o => o.effort === 'low');
  const mediumOpps = opps.filter(o => o.effort === 'medium');
  const hardOpps = opps.filter(o => o.effort === 'high');

  // ─── Tool handlers ──────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    setLocal(l => ({ ...l, loading: true }));
    try {
      const r = await callTool('show_dashboard', {});
      const d = r.structuredContent as Partial<WidgetState> | undefined;
      if (d) await setMcpState(p => ({
        ...(p ?? {} as WidgetState),
        opportunities: d.opportunities ?? p?.opportunities ?? [],
        sent_emails: d.sent_emails ?? p?.sent_emails ?? [],
        total_potential_value: d.total_potential_value ?? p?.total_potential_value ?? 0,
        subscriptions: d.subscriptions ?? p?.subscriptions ?? [],
        profile: d.profile ?? p?.profile ?? null,
      }));
    } catch {}
    setLocal(l => ({ ...l, loading: false }));
  }, [callTool, setMcpState]);

  const handleApplyAll = useCallback(async () => {
    const easy = opps.filter(o => o.effort === 'low').slice(0, 5);
    if (!easy.length) { await sendFollowUpMessage('No easy opportunities. Try medium-effort ones?'); return; }
    setLocal(l => ({ ...l, loading: true }));
    const first = easy[0];
    try {
      const r = await callTool('draft_email', { opportunity_id: first.id });
      const draft = r.structuredContent as EmailDraft | undefined;
      if (draft) {
        setLocal(l => ({ ...l, draftEmail: { ...draft, opportunity: first }, loading: false }));
      } else {
        setLocal(l => ({ ...l, loading: false }));
        await sendFollowUpMessage(`Apply to these ${easy.length} programs, starting with ${first.program.name}`);
      }
    } catch {
      setLocal(l => ({ ...l, loading: false }));
      await sendFollowUpMessage(`Apply to these ${easy.length} programs, starting with ${first.program.name}`);
    }
  }, [opps, callTool, sendFollowUpMessage]);

  const handleApplyOne = useCallback(async (opp: Opportunity) => {
    if (opp.program.type === 'incubator_portal') {
      await sendFollowUpMessage(`Tell me more about accessing ${opp.program.name}`); return;
    }
    setLocal(l => ({ ...l, applyingId: opp.id }));
    try {
      const r = await callTool('draft_email', { opportunity_id: opp.id });
      const draft = r.structuredContent as EmailDraft | undefined;
      if (draft) {
        setLocal(l => ({ ...l, draftEmail: { ...draft, opportunity: opp }, applyingId: null }));
      } else {
        setLocal(l => ({ ...l, applyingId: null }));
        await sendFollowUpMessage(`Draft an application email for ${opp.program.name} and show it to me`);
      }
    } catch {
      setLocal(l => ({ ...l, applyingId: null }));
      await sendFollowUpMessage(`Draft an application email for ${opp.program.name}`);
    }
  }, [callTool, sendFollowUpMessage]);

  const handleSendDraft = useCallback(async () => {
    const draft = local.draftEmail;
    if (!draft) return;
    setLocal(l => ({ ...l, sendingEmail: true }));
    try {
      const r = await callTool('send_email', {
        to: draft.to,
        subject: draft.subject,
        body: draft.body,
        program_id: draft.opportunity.program.id,
      });
      const result = r.structuredContent as { sent: boolean; email: SentEmail } | undefined;
      if (result?.email) {
        await setMcpState(p => ({
          ...(p ?? {} as WidgetState),
          sent_emails: [...(p?.sent_emails ?? []), result.email],
        }));
      }
      setLocal(l => ({ ...l, draftEmail: null, sendingEmail: false }));
      await sendFollowUpMessage(`Email sent to ${draft.to} for ${draft.opportunity.program.name}! Ready to apply to the next one?`);
    } catch {
      setLocal(l => ({ ...l, sendingEmail: false }));
      await sendFollowUpMessage(`Could not send email. Make sure Gmail is connected at /auth/gmail`);
    }
  }, [local.draftEmail, callTool, setMcpState, sendFollowUpMessage]);

  const handleDismissDraft = useCallback(() => {
    setLocal(l => ({ ...l, draftEmail: null }));
  }, []);

  const handleCheckReplies = useCallback(async () => {
    setLocal(l => ({ ...l, loading: true }));
    try {
      const r = await callTool('check_replies', {});
      const d = r.structuredContent as { found: number; emails: SentEmail[] } | undefined;
      if (d) {
        await setMcpState(p => ({ ...(p ?? {} as WidgetState), sent_emails: d.emails }));
        if (d.found > 0) await sendFollowUpMessage(`Found ${d.found} new replies! Show AI-drafted responses`);
      }
    } catch {}
    setLocal(l => ({ ...l, loading: false }));
  }, [callTool, sendFollowUpMessage, setMcpState]);

  const handleSendReply = useCallback(async (id: string) => {
    await callTool('send_reply', { email_id: id });
    await sendFollowUpMessage(`Sent reply. Check for more or move to next application?`);
  }, [callTool, sendFollowUpMessage]);

  useEffect(() => { handleRefresh(); }, [handleRefresh]);

  // ─── Determine next step ─────────────────────────────────
  type Step = { msg: string; action: string; handler: () => void };
  const nextStep: Step | null = (() => {
    if (!profile) return { msg: 'Set up your company profile to get matched', action: 'Set up profile', handler: () => sendFollowUpMessage('Help me set up my company profile for HunterAI') };
    if (opps.length === 0) return { msg: 'Search for credits and grants that match your startup', action: 'Find opportunities', handler: () => sendFollowUpMessage('Find opportunities for my startup') };
    if (emails.length === 0 && easyOpps.length > 0) return { msg: `${easyOpps.length} easy applications ready to send`, action: `Apply to ${easyOpps.length} easy ${easyOpps.length === 1 ? 'one' : 'ones'}`, handler: handleApplyAll };
    if (emails.length > 0 && replies.length === 0) return { msg: `${emails.length} applications sent. Check for replies`, action: 'Check replies', handler: handleCheckReplies };
    if (replies.length > 0) return { msg: `${replies.length} ${replies.length === 1 ? 'reply' : 'replies'} waiting for review`, action: 'View replies', handler: () => setLocal(l => ({ ...l, activeTab: 'replies' })) };
    return null;
  })();

  // ─── Loading ────────────────────────────────────────────
  if (isPending) return (
    <div style={{ fontFamily: FONT, maxWidth: 640, margin: '0 auto', padding: '48px 24px', textAlign: 'center' }}>
      <span style={{ fontSize: 14, fontWeight: 600, color: C.black }}>HunterAI</span>
      <div style={{ color: C.g400, fontSize: 13, marginTop: 16 }}>Loading...</div>
    </div>
  );

  // ─── Pipeline steps ─────────────────────────────────────
  const steps = [
    { label: 'Found', value: opps.length, done: opps.length > 0 },
    { label: 'Applied', value: emails.length, done: emails.length > 0 },
    { label: 'Replies', value: replies.length, done: replies.length > 0 },
  ];

  // ─── Tabs ───────────────────────────────────────────────
  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: 'opportunities', label: 'Opportunities', count: opps.length },
    { key: 'applied', label: 'Applied', count: emails.length },
    { key: 'replies', label: 'Replies', count: replies.length },
    { key: 'subscriptions', label: 'Subscriptions', count: subs.length },
    { key: 'digest', label: 'Digest' },
  ];

  // ─── Render helpers ─────────────────────────────────────
  const EffortBadge = ({ effort }: { effort: string }) => {
    const c = effortConfig[effort] ?? effortConfig.medium;
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
        {[1, 2, 3].map(i => (
          <span key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: i <= c.dots ? C.g600 : C.g200 }} />
        ))}
        <span style={{ fontSize: 11, color: C.g500, fontWeight: 500, marginLeft: 2 }}>{c.text}</span>
      </span>
    );
  };

  const OppCard = ({ opp }: { opp: Opportunity }) => {
    const isSent = emails.some(e => e.program_id === opp.program.id);
    return (
      <div style={{
        padding: '14px 16px', borderBottom: `1px solid ${C.g150}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.black }}>{opp.program.name}</span>
            {opp.program.verified && <span style={{ fontSize: 10, color: C.g400 }}>Verified</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const }}>
            <span style={{ fontSize: 11, color: C.g500, background: C.g100, padding: '1px 6px', borderRadius: 3 }}>
              {typeLabels[opp.program.type] ?? 'Program'}
            </span>
            <EffortBadge effort={opp.effort} />
            <span style={{ fontSize: 12, color: C.g500 }}>{opp.program.vendor}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: C.black, fontFeatureSettings: '"tnum"' }}>
            {fmtCurrency(opp.potential_value, opp.program.currency)}
          </span>
          <button
            onClick={() => !isSent && handleApplyOne(opp)}
            disabled={isSent || local.applyingId !== null}
            style={{
              padding: '6px 14px', border: `1px solid ${isSent ? C.g100 : C.g200}`, borderRadius: 6,
              background: isSent ? C.g100 : C.white, fontSize: 12, fontWeight: 500,
              color: isSent ? C.g400 : C.black,
              cursor: isSent ? 'default' : 'pointer',
              opacity: local.applyingId === opp.id ? 0.5 : 1,
              whiteSpace: 'nowrap' as const,
            }}
          >
            {isSent ? 'Sent' : local.applyingId === opp.id ? 'Drafting...' : opp.program.type === 'incubator_portal' ? 'View' : 'Apply'}
          </button>
        </div>
      </div>
    );
  };

  const OppGroup = ({ label, items }: { label: string; items: Opportunity[] }) => {
    if (!items.length) return null;
    const shown = local.showAllOpps ? items : items.slice(0, 5);
    return (
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: C.g400, textTransform: 'uppercase' as const, letterSpacing: '0.06em', padding: '8px 16px' }}>
          {label} ({items.length})
        </div>
        <div style={{ border: `1px solid ${C.g200}`, borderRadius: 8, overflow: 'hidden', background: C.white }}>
          {shown.map(opp => <OppCard key={opp.id} opp={opp} />)}
        </div>
        {!local.showAllOpps && items.length > 5 && (
          <button
            onClick={() => setLocal(l => ({ ...l, showAllOpps: true }))}
            style={{
              marginTop: 4, width: '100%', padding: '8px', background: 'transparent',
              border: 'none', fontSize: 12, color: C.g400, cursor: 'pointer', fontWeight: 500,
            }}
          >
            Show {items.length - 5} more
          </button>
        )}
      </div>
    );
  };

  return (
    <div style={{ fontFamily: FONT, maxWidth: 640, margin: '0 auto', background: C.white, borderRadius: 10, border: `1px solid ${C.g200}`, overflow: 'hidden' }}>

      {/* ── Header ──────────────────────────────────────── */}
      <div style={{ padding: '20px 20px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.black, letterSpacing: '-0.01em' }}>HunterAI</span>
            {profile && <span style={{ fontSize: 12, color: C.g400 }}>{profile.name}{profile.stage ? ` \u00b7 ${profile.stage}` : ''}</span>}
          </div>
          <button onClick={handleRefresh} disabled={local.loading} style={{
            background: 'none', border: `1px solid ${C.g200}`, borderRadius: 6, padding: '4px 8px',
            cursor: 'pointer', fontSize: 13, color: C.g400, lineHeight: 1,
          }}>
            {local.loading ? '\u23f3' : '\u21bb'}
          </button>
        </div>

        {/* Big savings number */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 36, fontWeight: 600, color: C.black, letterSpacing: '-0.03em', lineHeight: 1, fontFeatureSettings: '"tnum"' }}>
            {totalValue > 0 ? `$${(totalValue / 1000).toFixed(totalValue % 1000 === 0 ? 0 : 1)}K` : '$0'}
          </div>
          <div style={{ fontSize: 13, color: C.g400, marginTop: 4 }}>potential savings found</div>
        </div>

        {/* Pipeline steps */}
        <div style={{ display: 'flex', gap: 0, borderTop: `1px solid ${C.g200}`, borderBottom: `1px solid ${C.g200}` }}>
          {steps.map((step, i) => (
            <React.Fragment key={step.label}>
              {i > 0 && <div style={{ width: 1, background: C.g200 }} />}
              <button
                onClick={() => setLocal(l => ({ ...l, activeTab: tabs[i].key }))}
                style={{
                  flex: 1, padding: '14px 0', background: 'none', border: 'none', cursor: 'pointer',
                  textAlign: 'center' as const,
                }}
              >
                <div style={{ fontSize: 18, fontWeight: 600, color: step.done ? C.black : C.g300, fontFeatureSettings: '"tnum"' }}>
                  {step.value}
                </div>
                <div style={{ fontSize: 11, color: C.g400, marginTop: 1, textTransform: 'uppercase' as const, letterSpacing: '0.05em', fontWeight: 500 }}>
                  {step.label}
                </div>
              </button>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ── Next step banner ─────────────────────────────── */}
      {nextStep && (
        <div style={{ padding: '12px 20px', background: C.g50, borderBottom: `1px solid ${C.g200}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, color: C.g600 }}>{nextStep.msg}</span>
          <button onClick={nextStep.handler} disabled={local.loading} style={{
            padding: '6px 14px', border: 'none', borderRadius: 6, background: C.black,
            color: C.white, fontSize: 12, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' as const,
            flexShrink: 0,
          }}>
            {nextStep.action}
          </button>
        </div>
      )}

      {/* ── Tab bar ──────────────────────────────────────── */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${C.g200}`, padding: '0 20px', overflowX: 'auto' as const }}>
        {tabs.map(tab => {
          const active = local.activeTab === tab.key;
          return (
            <button key={tab.key} onClick={() => setLocal(l => ({ ...l, activeTab: tab.key }))} style={{
              padding: '10px 12px', background: 'none', border: 'none',
              borderBottom: active ? '2px solid black' : '2px solid transparent',
              fontSize: 13, fontWeight: active ? 600 : 400, color: active ? C.black : C.g400,
              cursor: 'pointer', whiteSpace: 'nowrap' as const, marginBottom: -1,
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span style={{
                  fontSize: 10, fontWeight: 500, background: active ? C.black : C.g200,
                  color: active ? C.white : C.g500, borderRadius: 8, padding: '1px 5px',
                  fontFeatureSettings: '"tnum"',
                }}>{tab.count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Draft Email Preview ─────────────────────────── */}
      {local.draftEmail && (
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.g200}`, background: C.g50 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.black }}>Draft Email</span>
              <span style={{ fontSize: 12, color: C.g400, marginLeft: 8 }}>{local.draftEmail.opportunity.program.name}</span>
            </div>
            <button onClick={handleDismissDraft} style={{
              background: 'none', border: 'none', fontSize: 18, color: C.g400, cursor: 'pointer', lineHeight: 1, padding: '0 4px',
            }}>{'\u00d7'}</button>
          </div>
          <div style={{ background: C.white, border: `1px solid ${C.g200}`, borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', borderBottom: `1px solid ${C.g150}`, display: 'flex', gap: 8 }}>
              <span style={{ fontSize: 11, color: C.g400, minWidth: 44 }}>To</span>
              <span style={{ fontSize: 13, color: C.black }}>{local.draftEmail.to}</span>
            </div>
            <div style={{ padding: '10px 14px', borderBottom: `1px solid ${C.g150}`, display: 'flex', gap: 8 }}>
              <span style={{ fontSize: 11, color: C.g400, minWidth: 44 }}>Subject</span>
              <span style={{ fontSize: 13, color: C.black }}>{local.draftEmail.subject}</span>
            </div>
            <div style={{ padding: '12px 14px', fontSize: 13, color: C.g600, lineHeight: 1.6, whiteSpace: 'pre-wrap' as const }}>
              {local.draftEmail.body}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={handleSendDraft} disabled={local.sendingEmail} style={{
              flex: 1, padding: '10px 14px', border: 'none', borderRadius: 6, background: C.black,
              color: C.white, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              opacity: local.sendingEmail ? 0.6 : 1,
            }}>
              {local.sendingEmail ? 'Sending...' : 'Send Email'}
            </button>
            <button onClick={() => {
              const d = local.draftEmail!;
              sendFollowUpMessage(`I want to edit this email draft for ${d.opportunity.program.name} before sending. Current draft: To: ${d.to}, Subject: ${d.subject}`);
            }} disabled={local.sendingEmail} style={{
              padding: '10px 14px', border: `1px solid ${C.g200}`, borderRadius: 6,
              background: C.white, color: C.g600, fontSize: 13, fontWeight: 500, cursor: 'pointer',
            }}>Edit</button>
            <button onClick={handleDismissDraft} disabled={local.sendingEmail} style={{
              padding: '10px 14px', border: `1px solid ${C.g200}`, borderRadius: 6,
              background: C.white, color: C.g400, fontSize: 13, fontWeight: 500, cursor: 'pointer',
            }}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── Content area ─────────────────────────────────── */}
      <div style={{ padding: '16px 20px 20px' }}>

        {/* ── Opportunities ────────────────────────────────── */}
        {local.activeTab === 'opportunities' && (
          opps.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.black, marginBottom: 6 }}>
                {!profile ? 'Set up your profile' : 'No opportunities yet'}
              </div>
              <div style={{ fontSize: 13, color: C.g400, marginBottom: 16, maxWidth: 260, margin: '0 auto 16px' }}>
                {!profile ? 'Tell HunterAI about your startup to find matching credits and grants.' : 'Run a search to discover programs for your startup.'}
              </div>
              <button onClick={() => sendFollowUpMessage(!profile ? 'Help me set up my company profile for HunterAI' : 'Find opportunities for my startup')} style={{
                padding: '8px 16px', border: 'none', borderRadius: 6, background: C.black,
                color: C.white, fontSize: 13, fontWeight: 500, cursor: 'pointer',
              }}>
                {!profile ? 'Set up profile' : 'Find opportunities'}
              </button>
            </div>
          ) : (
            <>
              {/* Quick apply bar when there are easy opps */}
              {easyOpps.length > 0 && emails.length === 0 && (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', background: C.g50, borderRadius: 8, marginBottom: 16,
                  border: `1px solid ${C.g200}`,
                }}>
                  <span style={{ fontSize: 13, color: C.g600 }}>
                    {easyOpps.length} easy {easyOpps.length === 1 ? 'application' : 'applications'} ready
                  </span>
                  <button onClick={handleApplyAll} disabled={local.loading} style={{
                    padding: '6px 14px', border: 'none', borderRadius: 6, background: C.black,
                    color: C.white, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                  }}>
                    Apply to all
                  </button>
                </div>
              )}
              <OppGroup label="Easy to apply" items={easyOpps} />
              <OppGroup label="Medium effort" items={mediumOpps} />
              <OppGroup label="Requires more effort" items={hardOpps} />
            </>
          )
        )}

        {/* ── Applied ──────────────────────────────────────── */}
        {local.activeTab === 'applied' && (
          emails.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.black, marginBottom: 6 }}>No applications sent yet</div>
              <div style={{ fontSize: 13, color: C.g400, maxWidth: 240, margin: '0 auto' }}>
                Find opportunities first, then apply with one click.
              </div>
            </div>
          ) : (
            <div style={{ border: `1px solid ${C.g200}`, borderRadius: 8, overflow: 'hidden' }}>
              {emails.map((email, i) => {
                const replied = email.status === 'replied';
                return (
                  <div key={email.id} style={{ padding: '14px 16px', borderBottom: i < emails.length - 1 ? `1px solid ${C.g150}` : 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.black }}>{email.subject}</div>
                        <div style={{ fontSize: 12, color: C.g400, marginTop: 2 }}>{email.to}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <span style={{ fontSize: 11, color: C.g400 }}>{timeAgo(email.sent_at)}</span>
                        <span style={{
                          fontSize: 10, fontWeight: 500, borderRadius: 4, padding: '2px 6px',
                          background: replied ? C.black : C.g100, color: replied ? C.white : C.g500,
                        }}>
                          {replied ? 'Replied' : email.status === 'failed' ? 'Failed' : 'Sent'}
                        </span>
                      </div>
                    </div>
                    {replied && email.reply && (
                      <div style={{
                        marginTop: 8, padding: '8px 10px', borderRadius: 6, background: C.g50,
                        border: `1px solid ${C.g200}`, fontSize: 12, color: C.g600, lineHeight: 1.5,
                      }}>
                        {email.reply.body.slice(0, 140)}{email.reply.body.length > 140 ? '...' : ''}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* ── Replies ──────────────────────────────────────── */}
        {local.activeTab === 'replies' && (
          replies.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.black, marginBottom: 6 }}>No replies yet</div>
              <div style={{ fontSize: 13, color: C.g400, marginBottom: 16, maxWidth: 240, margin: '0 auto 16px' }}>
                Replies from program contacts will appear here.
              </div>
              <button onClick={handleCheckReplies} disabled={local.loading} style={{
                padding: '6px 14px', border: `1px solid ${C.g200}`, borderRadius: 6,
                background: C.white, color: C.g600, fontSize: 12, fontWeight: 500, cursor: 'pointer',
              }}>
                Check now
              </button>
            </div>
          ) : (
            <div style={{ border: `1px solid ${C.g200}`, borderRadius: 8, overflow: 'hidden' }}>
              {replies.map((email, i) => {
                const r = email.reply!;
                const expanded = local.expandedReply === email.id;
                return (
                  <div key={email.id} style={{ padding: '14px 16px', borderBottom: i < replies.length - 1 ? `1px solid ${C.g150}` : 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.black }}>
                          {r.from}
                        </div>
                        <div style={{ fontSize: 11, color: C.g400, marginTop: 1 }}>{timeAgo(r.received_at)}</div>
                      </div>
                      <span style={{
                        fontSize: 10, fontWeight: 500, borderRadius: 4, padding: '2px 6px',
                        background: r.ai_response_status === 'sent' ? C.black : C.g100,
                        color: r.ai_response_status === 'sent' ? C.white : C.g500,
                      }}>
                        {r.ai_response_status}
                      </span>
                    </div>
                    <div
                      onClick={() => r.body.length > 200 && setLocal(l => ({ ...l, expandedReply: expanded ? null : email.id }))}
                      style={{ fontSize: 13, color: C.g600, lineHeight: 1.6, marginBottom: 10, cursor: r.body.length > 200 ? 'pointer' : 'default' }}
                    >
                      {expanded ? r.body : `${r.body.slice(0, 200)}${r.body.length > 200 ? '...' : ''}`}
                      {r.body.length > 200 && <span style={{ color: C.black, fontWeight: 500, marginLeft: 4, fontSize: 12 }}>{expanded ? 'less' : 'more'}</span>}
                    </div>
                    {r.ai_response_draft && (
                      <div style={{
                        background: C.g50, borderRadius: 6, padding: '10px 12px', marginBottom: 10,
                        fontSize: 12, color: C.g600, lineHeight: 1.5, borderLeft: `2px solid ${C.black}`,
                      }}>
                        <div style={{ fontWeight: 600, color: C.black, fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: '0.04em', marginBottom: 4 }}>AI Draft</div>
                        {expanded ? r.ai_response_draft : `${r.ai_response_draft.slice(0, 150)}${r.ai_response_draft.length > 150 ? '...' : ''}`}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => handleSendReply(email.id)} style={{
                        padding: '6px 12px', border: 'none', borderRadius: 6, background: C.black,
                        color: C.white, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                      }}>Send reply</button>
                      <button onClick={() => sendFollowUpMessage(`Edit the reply to ${r.from} — I want to customize it`)} style={{
                        padding: '6px 12px', border: `1px solid ${C.g200}`, borderRadius: 6,
                        background: C.white, color: C.g600, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                      }}>Edit first</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* ── Subscriptions ─────────────────────────────────── */}
        {local.activeTab === 'subscriptions' && (
          subs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.black, marginBottom: 6 }}>No subscriptions detected</div>
              <div style={{ fontSize: 13, color: C.g400, marginBottom: 16, maxWidth: 280, margin: '0 auto 16px' }}>
                Scan your website to detect tools, import a bank statement, or connect Puzzle.
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' as const }}>
                <button onClick={() => sendFollowUpMessage('Scan my website to detect my tech stack and find credits. Ask me for my URL.')} style={{
                  padding: '8px 16px', border: 'none', borderRadius: 6, background: C.black,
                  color: C.white, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                }}>Scan website</button>
                <button onClick={() => sendFollowUpMessage('Analyze my bank statement or connect Puzzle to detect subscriptions')} style={{
                  padding: '8px 16px', border: `1px solid ${C.g200}`, borderRadius: 6, background: C.white,
                  color: C.g600, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                }}>Import statement</button>
              </div>
            </div>
          ) : (
            <>
              <div style={{
                padding: '14px 16px', background: C.black, borderRadius: 8, marginBottom: 12,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontSize: 11, color: C.g400, fontWeight: 500, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Monthly SaaS spend</div>
                  <div style={{ fontSize: 22, fontWeight: 600, color: C.white, marginTop: 2, fontFeatureSettings: '"tnum"' }}>
                    ${subs.reduce((a, b) => a + b.monthly_cost, 0).toLocaleString()}<span style={{ fontSize: 12, color: C.g400 }}>/mo</span>
                  </div>
                </div>
                <span style={{ fontSize: 11, color: C.g400 }}>{subs.length} tools</span>
              </div>
              <div style={{ border: `1px solid ${C.g200}`, borderRadius: 8, overflow: 'hidden' }}>
                {(() => {
                  const max = Math.max(...subs.map(s => s.monthly_cost));
                  return subs.sort((a, b) => b.monthly_cost - a.monthly_cost).map((sub, i) => (
                    <div key={sub.id} style={{ padding: '12px 16px', borderBottom: i < subs.length - 1 ? `1px solid ${C.g150}` : 'none' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <div>
                          <span style={{ fontSize: 13, fontWeight: 600, color: C.black }}>{sub.vendor}</span>
                          <span style={{ fontSize: 11, color: C.g400, marginLeft: 8 }}>{sub.category}</span>
                          {sub.source === 'website' && <span style={{ fontSize: 9, color: C.g400, marginLeft: 6, background: C.g100, padding: '1px 4px', borderRadius: 3 }}>web</span>}
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 600, color: C.black, fontFeatureSettings: '"tnum"' }}>
                          ${sub.monthly_cost}<span style={{ fontSize: 11, fontWeight: 400, color: C.g400 }}>/mo</span>
                        </span>
                      </div>
                      <div style={{ height: 2, background: C.g100, borderRadius: 1, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${(sub.monthly_cost / max) * 100}%`, background: C.g600, borderRadius: 1 }} />
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </>
          )
        )}

        {/* ── Digest ───────────────────────────────────────── */}
        {local.activeTab === 'digest' && (
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.black, marginBottom: 4 }}>Daily Digest</div>
            <div style={{ fontSize: 13, color: C.g400, marginBottom: 16, lineHeight: 1.6 }}>
              Generate a summary of your activity or schedule daily reports to your inbox.
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              <button onClick={async () => {
                setLocal(l => ({ ...l, loading: true }));
                try { await callTool('daily_digest', { send_email: false }); } catch {}
                setLocal(l => ({ ...l, loading: false }));
              }} disabled={local.loading} style={{
                padding: '8px 14px', border: 'none', borderRadius: 6, background: C.black,
                color: C.white, fontSize: 12, fontWeight: 500, cursor: 'pointer',
              }}>Generate digest</button>
              <button onClick={async () => {
                setLocal(l => ({ ...l, loading: true }));
                try { await callTool('daily_digest', { send_email: true }); } catch {}
                setLocal(l => ({ ...l, loading: false }));
              }} disabled={local.loading} style={{
                padding: '8px 14px', border: `1px solid ${C.g200}`, borderRadius: 6,
                background: C.white, color: C.g600, fontSize: 12, fontWeight: 500, cursor: 'pointer',
              }}>Generate &amp; email</button>
            </div>
            <div style={{ borderTop: `1px solid ${C.g200}`, paddingTop: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.g400, marginBottom: 10, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Auto-Schedule</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={async () => { try { await callTool('configure_digest', { enabled: true }); } catch {} }} disabled={local.loading} style={{
                  padding: '6px 12px', border: `1px solid ${C.g200}`, borderRadius: 6,
                  background: C.white, color: C.g600, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                }}>Enable daily 9 AM UTC</button>
                <button onClick={async () => { try { await callTool('configure_digest', { enabled: false }); } catch {} }} disabled={local.loading} style={{
                  padding: '6px 12px', border: `1px solid ${C.g200}`, borderRadius: 6,
                  background: C.white, color: C.g300, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                }}>Disable</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Error Boundary ───────────────────────────────────────
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) return (
      <div style={{ padding: 32, textAlign: 'center', fontFamily: FONT }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#000', marginBottom: 8 }}>Something went wrong</div>
        <div style={{ fontSize: 13, color: '#777' }}>{this.state.error.message}</div>
      </div>
    );
    return this.props.children;
  }
}

export default function HunterAIDashboard() {
  return <McpUseProvider><ErrorBoundary><HunterAIDashboardInner /></ErrorBoundary></McpUseProvider>;
}
