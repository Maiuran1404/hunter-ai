import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useWidget, McpUseProvider, type WidgetMetadata } from 'mcp-use/react';
import type { Opportunity, SentEmail, Subscription, CompanyProfile, EmailDraft } from '../../src/types.js';

export const widgetMetadata: WidgetMetadata = {
  description: 'HunterAI — find and apply for startup credits, programs, and grants',
  exposeAsTool: false,
  metadata: {
    prefersBorder: false,
    invoking: 'Loading HunterAI...',
    invoked: 'HunterAI',
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

interface LocalState {
  loading: boolean;
  applyingId: string | null;
  showAllOpps: boolean;
  expandedReply: string | null;
  activeView: 'opportunities' | 'applied' | 'replies';
  draftEmail: (EmailDraft & { opportunity: Opportunity }) | null;
  sendingEmail: boolean;
  showOppList: boolean;
}

// ─── Palette ──────────────────────────────────────────────
function makePalette(isDark: boolean) {
  return {
    bg:          isDark ? '#1a1a1a' : '#ffffff',
    surface:     isDark ? '#242424' : '#f7f7f8',
    elevated:    isDark ? '#2d2d2d' : '#ffffff',
    border:      isDark ? '#333333' : '#e5e5e5',
    borderSub:   isDark ? '#2a2a2a' : '#f0f0f0',
    primary:     isDark ? '#f0f0f0' : '#111111',
    secondary:   isDark ? '#999999' : '#666666',
    tertiary:    isDark ? '#666666' : '#999999',
    muted:       isDark ? '#444444' : '#cccccc',
    accent:      '#22c55e',
    accentSoft:  isDark ? 'rgba(34,197,94,0.12)' : 'rgba(34,197,94,0.06)',
    accentText:  isDark ? '#4ade80' : '#16a34a',
    btnPrimary:  isDark ? '#f0f0f0' : '#111111',
    btnPriTx:    isDark ? '#111111' : '#ffffff',
    btnSecBg:    isDark ? '#2d2d2d' : '#ffffff',
    btnSecTx:    isDark ? '#cccccc' : '#555555',
    btnSecBor:   isDark ? '#444444' : '#e0e0e0',
    cardBg:      isDark ? '#242424' : '#ffffff',
    cardBorder:  isDark ? '#333333' : '#e8e8e8',
  } as const;
}

const FONT = '-apple-system, BlinkMacSystemFont, "Inter", "SF Pro Display", system-ui, sans-serif';

// ─── Utilities ───────────────────────────────────────────
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

const effortConfig: Record<string, { dots: number; text: string }> = {
  low: { dots: 1, text: 'Easy' }, medium: { dots: 2, text: 'Medium' }, high: { dots: 3, text: 'Hard' },
};
const typeLabels: Record<string, string> = {
  startup_program: 'Startup Program', diversity_grant: 'Diversity Grant',
  government_grant: 'Gov Grant', incubator_credit: 'Incubator', incubator_portal: 'Portal', negotiation: 'Negotiation',
};

// ─── Main Widget ─────────────────────────────────────────
function HunterAIDashboardInner() {
  const { state: mcpState, setState: setMcpState, callTool, sendFollowUpMessage, isPending } =
    useWidget<Record<string, unknown>, WidgetState>();

  const [local, setLocal] = useState<LocalState>({
    loading: false, applyingId: null, showAllOpps: false, expandedReply: null,
    activeView: 'opportunities', draftEmail: null, sendingEmail: false, showOppList: false,
  });

  const isDark = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  }, []);
  const C = useMemo(() => makePalette(isDark), [isDark]);

  const opps = mcpState?.opportunities ?? [];
  const emails = mcpState?.sent_emails ?? [];
  const subs = mcpState?.subscriptions ?? [];
  const profile = mcpState?.profile ?? null;
  const totalValue = mcpState?.total_potential_value ?? 0;
  const replies = emails.filter(e => e.reply);
  const easyOpps = opps.filter(o => o.effort === 'low');
  const mediumOpps = opps.filter(o => o.effort === 'medium');
  const hardOpps = opps.filter(o => o.effort === 'high');

  // Has the user done anything yet?
  const hasData = opps.length > 0 || subs.length > 0;

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
    if (!easy.length) { await sendFollowUpMessage('No easy opportunities found. Can you try medium-effort ones?'); return; }
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
        to: draft.to, subject: draft.subject, body: draft.body, program_id: draft.opportunity.program.id,
      });
      const result = r.structuredContent as { sent: boolean; email: SentEmail } | undefined;
      if (result?.email) {
        await setMcpState(p => ({ ...(p ?? {} as WidgetState), sent_emails: [...(p?.sent_emails ?? []), result.email] }));
      }
      setLocal(l => ({ ...l, draftEmail: null, sendingEmail: false }));
      await sendFollowUpMessage(`Email sent to ${draft.to} for ${draft.opportunity.program.name}! Ready to apply to the next one?`);
    } catch {
      setLocal(l => ({ ...l, sendingEmail: false }));
      await sendFollowUpMessage('Could not send email. Make sure Gmail is connected at /auth/gmail');
    }
  }, [local.draftEmail, callTool, setMcpState, sendFollowUpMessage]);

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
    await sendFollowUpMessage('Sent reply. Check for more or move to next application?');
  }, [callTool, sendFollowUpMessage]);

  useEffect(() => { handleRefresh(); }, [handleRefresh]);

  // ─── Loading ───────────────────────────────────────────
  if (isPending) return (
    <div style={{ fontFamily: FONT, maxWidth: 520, margin: '0 auto', padding: '48px 24px', textAlign: 'center' }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: C.primary }}>HunterAI</div>
      <div style={{ fontSize: 13, color: C.tertiary, marginTop: 8 }}>Loading...</div>
    </div>
  );

  // ═══════════════════════════════════════════════════════
  // WELCOME — No data yet. Two clear CTAs.
  // ═══════════════════════════════════════════════════════
  if (!hasData) return (
    <div style={{ fontFamily: FONT, maxWidth: 520, margin: '0 auto', padding: '28px 24px' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.primary, letterSpacing: '-0.02em', marginBottom: 12 }}>
          HunterAI
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, color: C.primary, lineHeight: 1.3, letterSpacing: '-0.02em' }}>
          Find startup credits, grants &amp; discounts you're leaving on the table.
        </div>
      </div>

      {/* Two CTAs */}
      <div style={{ display: 'flex', gap: 12 }}>
        {/* Scan website — primary */}
        <button
          onClick={() => sendFollowUpMessage('I want to scan my website to find credits and discounts. Ask me for my website URL. After scanning, automatically save my profile and find all matching credit opportunities, then refresh the dashboard.')}
          disabled={local.loading}
          style={{
            flex: 1, padding: '20px 18px', textAlign: 'left' as const,
            background: C.accentSoft,
            border: `1px solid ${C.accent}`,
            borderRadius: 12, cursor: 'pointer',
            display: 'flex', flexDirection: 'column' as const, gap: 8,
          }}
        >
          <span style={{ fontSize: 20 }}>&#127760;</span>
          <span style={{ fontSize: 15, fontWeight: 600, color: C.primary, lineHeight: 1.3 }}>
            Scan my website
          </span>
          <span style={{ fontSize: 12, color: C.secondary, lineHeight: 1.4 }}>
            Auto-detect your tech stack and find matching credits
          </span>
        </button>

        {/* Upload statement — secondary */}
        <button
          onClick={() => sendFollowUpMessage('I want to upload my bank statement to find software subscriptions and credits. Ask me to upload my bank statement PDF. After analyzing it, automatically save my profile and find all matching credit opportunities, then refresh the dashboard.')}
          disabled={local.loading}
          style={{
            flex: 1, padding: '20px 18px', textAlign: 'left' as const,
            background: C.cardBg,
            border: `1px solid ${C.cardBorder}`,
            borderRadius: 12, cursor: 'pointer',
            display: 'flex', flexDirection: 'column' as const, gap: 8,
          }}
        >
          <span style={{ fontSize: 20 }}>&#128196;</span>
          <span style={{ fontSize: 15, fontWeight: 600, color: C.primary, lineHeight: 1.3 }}>
            Upload bank statement
          </span>
          <span style={{ fontSize: 12, color: C.secondary, lineHeight: 1.4 }}>
            PDF or CSV to detect your SaaS subscriptions
          </span>
        </button>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════
  // DASHBOARD — Has data (opportunities / subscriptions)
  // ═══════════════════════════════════════════════════════
  const pipelineSteps = [
    { key: 'opportunities' as const, label: 'Found', value: opps.length, done: opps.length > 0 },
    { key: 'applied' as const, label: 'Applied', value: emails.length, done: emails.length > 0 },
    { key: 'replies' as const, label: 'Replies', value: replies.length, done: replies.length > 0 },
  ];

  // What should the user do next?
  const nextAction = (() => {
    if (opps.length > 0 && emails.length === 0 && easyOpps.length > 0)
      return { msg: `${easyOpps.length} easy applications ready`, action: 'Start applying', handler: handleApplyAll };
    if (emails.length > 0 && replies.length === 0)
      return { msg: `${emails.length} sent. Check for replies?`, action: 'Check replies', handler: handleCheckReplies };
    if (replies.length > 0)
      return { msg: `${replies.length} replies waiting`, action: 'View replies', handler: () => setLocal(l => ({ ...l, activeView: 'replies' })) };
    return null;
  })();

  return (
    <div style={{ fontFamily: FONT, maxWidth: 520, margin: '0 auto', padding: '24px 20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: C.primary, letterSpacing: '-0.02em' }}>HunterAI</span>
          {profile && <span style={{ fontSize: 12, color: C.tertiary }}>{profile.name}</span>}
        </div>
        <button onClick={handleRefresh} disabled={local.loading} style={{
          background: 'none', border: 'none', padding: '4px 6px', cursor: 'pointer', fontSize: 14,
          color: C.tertiary, opacity: local.loading ? 0.4 : 0.7, lineHeight: 1,
        }}>
          {local.loading ? '\u23f3' : '\u21bb'}
        </button>
      </div>

      {/* Draft email overlay */}
      {local.draftEmail && (
        <div style={{ padding: '18px', background: C.surface, borderRadius: 12, marginBottom: 16, border: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <span style={{ fontSize: 14, fontWeight: 600, color: C.primary }}>Review email</span>
              <span style={{ fontSize: 12, color: C.tertiary, marginLeft: 8 }}>{local.draftEmail.opportunity.program.name}</span>
            </div>
            <button onClick={() => setLocal(l => ({ ...l, draftEmail: null }))} style={{
              background: 'none', border: 'none', fontSize: 18, color: C.tertiary, cursor: 'pointer', lineHeight: 1,
            }}>&times;</button>
          </div>
          <div style={{ background: C.elevated, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', marginBottom: 12 }}>
            <div style={{ padding: '8px 12px', borderBottom: `1px solid ${C.borderSub}`, display: 'flex', gap: 8 }}>
              <span style={{ fontSize: 11, color: C.tertiary, minWidth: 40 }}>To</span>
              <span style={{ fontSize: 13, color: C.primary }}>{local.draftEmail.to}</span>
            </div>
            <div style={{ padding: '8px 12px', borderBottom: `1px solid ${C.borderSub}`, display: 'flex', gap: 8 }}>
              <span style={{ fontSize: 11, color: C.tertiary, minWidth: 40 }}>Subj</span>
              <span style={{ fontSize: 13, color: C.primary }}>{local.draftEmail.subject}</span>
            </div>
            <div style={{ padding: '10px 12px', fontSize: 13, color: C.secondary, lineHeight: 1.6, whiteSpace: 'pre-wrap' as const, maxHeight: 160, overflowY: 'auto' as const }}>
              {local.draftEmail.body}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleSendDraft} disabled={local.sendingEmail} style={{
              flex: 1, padding: '10px', border: 'none', borderRadius: 8,
              background: C.btnPrimary, color: C.btnPriTx, fontSize: 13, fontWeight: 600,
              cursor: 'pointer', opacity: local.sendingEmail ? 0.5 : 1,
            }}>
              {local.sendingEmail ? 'Sending...' : 'Send email'}
            </button>
            <button onClick={() => {
              const d = local.draftEmail!;
              sendFollowUpMessage(`Edit this email draft for ${d.opportunity.program.name} before sending. To: ${d.to}, Subject: ${d.subject}`);
            }} disabled={local.sendingEmail} style={{
              padding: '10px 16px', border: `1px solid ${C.btnSecBor}`, borderRadius: 8,
              background: C.btnSecBg, color: C.btnSecTx, fontSize: 13, fontWeight: 500, cursor: 'pointer',
            }}>Edit</button>
            <button onClick={() => setLocal(l => ({ ...l, draftEmail: null }))} disabled={local.sendingEmail} style={{
              padding: '10px 16px', border: `1px solid ${C.btnSecBor}`, borderRadius: 8,
              background: C.btnSecBg, color: C.btnSecTx, fontSize: 13, fontWeight: 500, cursor: 'pointer',
            }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Savings hero */}
      {!local.draftEmail && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 36, fontWeight: 700, color: C.primary, letterSpacing: '-0.03em', lineHeight: 1, fontFeatureSettings: '"tnum"' }}>
            {totalValue > 0 ? `$${(totalValue / 1000).toFixed(totalValue % 1000 === 0 ? 0 : 1)}K` : '$0'}
          </div>
          <div style={{ fontSize: 13, color: C.secondary, marginTop: 4 }}>potential savings found</div>
        </div>
      )}

      {/* Pipeline nav */}
      {!local.draftEmail && (
        <div style={{ display: 'flex', border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden', marginBottom: 20 }}>
          {pipelineSteps.map((step, i) => {
            const active = local.activeView === step.key;
            return (
              <React.Fragment key={step.key}>
                {i > 0 && <div style={{ width: 1, background: C.border }} />}
                <button
                  onClick={() => setLocal(l => ({ ...l, activeView: step.key }))}
                  style={{
                    flex: 1, padding: '12px 0', background: active ? C.surface : 'transparent',
                    border: 'none', cursor: 'pointer', textAlign: 'center' as const,
                  }}
                >
                  <div style={{ fontSize: 18, fontWeight: 700, color: step.done ? C.primary : C.muted, fontFeatureSettings: '"tnum"' }}>
                    {step.value}
                  </div>
                  <div style={{ fontSize: 10, color: active ? C.primary : C.tertiary, textTransform: 'uppercase' as const, letterSpacing: '0.06em', fontWeight: active ? 600 : 400, marginTop: 2 }}>
                    {step.label}
                  </div>
                </button>
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* Next step CTA */}
      {!local.draftEmail && nextAction && (
        <div style={{
          padding: '14px 16px', background: C.accentSoft, borderRadius: 10, marginBottom: 20,
          borderLeft: `3px solid ${C.accent}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: C.primary }}>{nextAction.msg}</span>
          <button onClick={nextAction.handler} disabled={local.loading} style={{
            padding: '8px 16px', border: 'none', borderRadius: 8,
            background: C.btnPrimary, color: C.btnPriTx, fontSize: 12, fontWeight: 600,
            cursor: 'pointer', whiteSpace: 'nowrap' as const, flexShrink: 0,
          }}>
            {nextAction.action}
          </button>
        </div>
      )}

      {/* ── Opportunities view ────────────────────────── */}
      {local.activeView === 'opportunities' && !local.draftEmail && (
        opps.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 16px' }}>
            <div style={{ fontSize: 13, color: C.secondary }}>No opportunities found yet.</div>
            <button onClick={() => sendFollowUpMessage('Find all matching credit opportunities for my startup and refresh the dashboard')} style={{
              marginTop: 10, padding: '8px 16px', border: 'none', borderRadius: 8,
              background: C.btnPrimary, color: C.btnPriTx, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>Find opportunities</button>
          </div>
        ) : (
          <>
            {[
              { label: 'Easy to apply', items: easyOpps },
              { label: 'Medium effort', items: mediumOpps },
              { label: 'Requires more effort', items: hardOpps },
            ].map(group => {
              if (!group.items.length) return null;
              const shown = local.showAllOpps ? group.items : group.items.slice(0, 5);
              return (
                <div key={group.label} style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.tertiary, textTransform: 'uppercase' as const, letterSpacing: '0.06em', padding: '6px 2px' }}>
                    {group.label} ({group.items.length})
                  </div>
                  <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', background: C.elevated }}>
                    {shown.map(opp => {
                      const isSent = emails.some(e => e.program_id === opp.program.id);
                      const ec = effortConfig[opp.effort] ?? effortConfig.medium;
                      return (
                        <div key={opp.id} style={{
                          padding: '10px 12px', borderBottom: `1px solid ${C.borderSub}`,
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
                        }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                              <span style={{ fontSize: 13, fontWeight: 600, color: C.primary }}>{opp.program.name}</span>
                              {opp.program.verified && <span style={{ fontSize: 9, color: C.accent }}>&#10003;</span>}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const }}>
                              <span style={{ fontSize: 11, color: C.secondary, background: C.surface, padding: '1px 5px', borderRadius: 3 }}>
                                {typeLabels[opp.program.type] ?? 'Program'}
                              </span>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                {[1, 2, 3].map(i => (
                                  <span key={i} style={{ width: 3, height: 3, borderRadius: '50%', background: i <= ec.dots ? C.secondary : C.muted }} />
                                ))}
                                <span style={{ fontSize: 10, color: C.tertiary, marginLeft: 2 }}>{ec.text}</span>
                              </span>
                              <span style={{ fontSize: 10, color: C.tertiary }}>{opp.program.vendor}</span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                            <span style={{ fontSize: 14, fontWeight: 600, color: C.primary, fontFeatureSettings: '"tnum"' }}>
                              {fmtCurrency(opp.potential_value, opp.program.currency)}
                            </span>
                            <button
                              onClick={() => !isSent && handleApplyOne(opp)}
                              disabled={isSent || local.applyingId !== null}
                              style={{
                                padding: '4px 10px', border: isSent ? 'none' : `1px solid ${C.btnSecBor}`, borderRadius: 6,
                                background: isSent ? C.surface : C.btnSecBg, fontSize: 12, fontWeight: 500,
                                color: isSent ? C.tertiary : C.primary, cursor: isSent ? 'default' : 'pointer',
                                opacity: local.applyingId === opp.id ? 0.5 : 1, whiteSpace: 'nowrap' as const,
                              }}
                            >
                              {isSent ? 'Sent' : local.applyingId === opp.id ? '...' : opp.program.type === 'incubator_portal' ? 'View' : 'Apply'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {!local.showAllOpps && group.items.length > 5 && (
                    <button onClick={() => setLocal(l => ({ ...l, showAllOpps: true }))} style={{
                      marginTop: 4, width: '100%', padding: '6px', background: 'transparent',
                      border: 'none', fontSize: 12, color: C.tertiary, cursor: 'pointer', fontWeight: 500,
                    }}>
                      Show {group.items.length - 5} more
                    </button>
                  )}
                </div>
              );
            })}
          </>
        )
      )}

      {/* ── Applied view ─────────────────────────────── */}
      {local.activeView === 'applied' && !local.draftEmail && (
        emails.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 16px' }}>
            <div style={{ fontSize: 13, color: C.secondary }}>No applications sent yet.</div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: C.tertiary, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>
                Sent ({emails.length})
              </span>
              <button onClick={handleCheckReplies} disabled={local.loading} style={{
                fontSize: 12, color: C.accentText, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500,
              }}>
                Check replies
              </button>
            </div>
            <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', background: C.elevated }}>
              {emails.map((email, i) => {
                const replied = email.status === 'replied';
                return (
                  <div key={email.id} style={{ padding: '10px 12px', borderBottom: i < emails.length - 1 ? `1px solid ${C.borderSub}` : 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.primary }}>{email.subject}</div>
                        <div style={{ fontSize: 11, color: C.tertiary, marginTop: 2 }}>{email.to}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <span style={{ fontSize: 11, color: C.tertiary }}>{timeAgo(email.sent_at)}</span>
                        <span style={{
                          fontSize: 10, fontWeight: 500, borderRadius: 4, padding: '2px 6px',
                          background: replied ? C.accent : C.surface, color: replied ? '#fff' : C.tertiary,
                        }}>
                          {replied ? 'Replied' : email.status === 'failed' ? 'Failed' : 'Sent'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )
      )}

      {/* ── Replies view ─────────────────────────────── */}
      {local.activeView === 'replies' && !local.draftEmail && (
        replies.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 16px' }}>
            <div style={{ fontSize: 13, color: C.secondary }}>No replies yet.</div>
            <button onClick={handleCheckReplies} disabled={local.loading} style={{
              marginTop: 10, padding: '8px 16px', border: `1px solid ${C.btnSecBor}`, borderRadius: 8,
              background: C.btnSecBg, color: C.btnSecTx, fontSize: 12, fontWeight: 500, cursor: 'pointer',
            }}>Check now</button>
          </div>
        ) : (
          <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', background: C.elevated }}>
            {replies.map((email, i) => {
              const r = email.reply!;
              const expanded = local.expandedReply === email.id;
              return (
                <div key={email.id} style={{ padding: '12px', borderBottom: i < replies.length - 1 ? `1px solid ${C.borderSub}` : 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.primary }}>{r.from}</div>
                      <div style={{ fontSize: 11, color: C.tertiary, marginTop: 1 }}>{timeAgo(r.received_at)}</div>
                    </div>
                    <span style={{
                      fontSize: 10, fontWeight: 500, borderRadius: 4, padding: '2px 6px',
                      background: r.ai_response_status === 'sent' ? C.accent : C.surface,
                      color: r.ai_response_status === 'sent' ? '#fff' : C.tertiary,
                    }}>
                      {r.ai_response_status}
                    </span>
                  </div>
                  <div
                    onClick={() => r.body.length > 200 && setLocal(l => ({ ...l, expandedReply: expanded ? null : email.id }))}
                    style={{ fontSize: 13, color: C.secondary, lineHeight: 1.5, marginBottom: 8, cursor: r.body.length > 200 ? 'pointer' : 'default' }}
                  >
                    {expanded ? r.body : `${r.body.slice(0, 200)}${r.body.length > 200 ? '...' : ''}`}
                  </div>
                  {r.ai_response_draft && (
                    <div style={{
                      background: C.surface, borderRadius: 6, padding: '8px 10px', marginBottom: 8,
                      fontSize: 12, color: C.secondary, lineHeight: 1.5, borderLeft: `2px solid ${C.accent}`,
                    }}>
                      <div style={{ fontWeight: 600, color: C.primary, fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: '0.04em', marginBottom: 3 }}>AI Draft</div>
                      {expanded ? r.ai_response_draft : `${r.ai_response_draft.slice(0, 150)}${r.ai_response_draft.length > 150 ? '...' : ''}`}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => handleSendReply(email.id)} style={{
                      padding: '6px 12px', border: 'none', borderRadius: 6,
                      background: C.btnPrimary, color: C.btnPriTx, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}>Send reply</button>
                    <button onClick={() => sendFollowUpMessage(`Edit the reply to ${r.from} \u2014 I want to customize it`)} style={{
                      padding: '6px 12px', border: `1px solid ${C.btnSecBor}`, borderRadius: 6,
                      background: C.btnSecBg, color: C.btnSecTx, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                    }}>Edit first</button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
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
        <div style={{ fontSize: 14, fontWeight: 600, color: '#111', marginBottom: 8 }}>Something went wrong</div>
        <div style={{ fontSize: 13, color: '#777' }}>{this.state.error.message}</div>
      </div>
    );
    return this.props.children;
  }
}

export default function HunterAIDashboard() {
  return <McpUseProvider><ErrorBoundary><HunterAIDashboardInner /></ErrorBoundary></McpUseProvider>;
}
