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
  gmail_connected: boolean;
  gmail_auth_url: string | null;
}

interface LocalState {
  loading: boolean;
  applyingId: string | null;
  showAllOpps: boolean;
  draftEmail: (EmailDraft & { opportunity: Opportunity }) | null;
  sendingEmail: boolean;
  gmailPolling: boolean;
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

const CATEGORY_COLORS: Record<string, string> = {
  infrastructure: '#3b82f6',
  productivity: '#8b5cf6',
  design: '#ec4899',
  analytics: '#f59e0b',
  other: '#6b7280',
};

// ─── Utilities ───────────────────────────────────────────
function fmtCurrency(v: number, cur?: string) {
  if (cur && cur !== 'USD') return `${cur} ${v.toLocaleString()}`;
  return v >= 1000 ? `$${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}K` : `$${v.toLocaleString()}`;
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
    loading: false, applyingId: null, showAllOpps: false,
    draftEmail: null, sendingEmail: false, gmailPolling: false,
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
  const gmailConnected = mcpState?.gmail_connected ?? false;
  const gmailAuthUrl = mcpState?.gmail_auth_url ?? null;
  const easyOpps = opps.filter(o => o.effort === 'low');
  const mediumOpps = opps.filter(o => o.effort === 'medium');
  const hardOpps = opps.filter(o => o.effort === 'high');
  const hasData = opps.length > 0 || subs.length > 0;

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
        gmail_connected: d.gmail_connected ?? p?.gmail_connected ?? false,
        gmail_auth_url: d.gmail_auth_url ?? p?.gmail_auth_url ?? null,
      }));
    } catch {}
    setLocal(l => ({ ...l, loading: false }));
  }, [callTool, setMcpState]);

  const handleApplyOne = useCallback(async (opp: Opportunity) => {
    if (opp.program.type === 'incubator_portal') {
      await sendFollowUpMessage(`Tell me more about accessing ${opp.program.name}`);
      return;
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

  const handleApplyAll = useCallback(async () => {
    const easy = opps.filter(o => o.effort === 'low').slice(0, 5);
    if (!easy.length) return;
    await handleApplyOne(easy[0]);
  }, [opps, handleApplyOne]);

  const handleConnectGmail = useCallback(() => {
    setLocal(l => ({ ...l, gmailPolling: true }));
  }, []);

  const handleSendDraft = useCallback(async () => {
    const draft = local.draftEmail;
    if (!draft || !gmailConnected) return;
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
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setLocal(l => ({ ...l, sendingEmail: false }));
      if (msg.toLowerCase().includes('gmail not connected')) {
        await setMcpState(p => ({ ...(p ?? {} as WidgetState), gmail_connected: false }));
      } else {
        await sendFollowUpMessage(`Could not send email: ${msg}`);
      }
    }
  }, [local.draftEmail, gmailConnected, callTool, setMcpState, sendFollowUpMessage]);

  useEffect(() => {
    if (!local.gmailPolling) return;
    const startTime = Date.now();
    const interval = setInterval(async () => {
      if (Date.now() - startTime > 300000) {
        setLocal(l => ({ ...l, gmailPolling: false }));
        clearInterval(interval);
        return;
      }
      try {
        const r = await callTool('get_gmail_status', {});
        const status = r.structuredContent as { connected: boolean; auth_url: string | null } | undefined;
        if (status?.connected) {
          clearInterval(interval);
          setLocal(l => ({ ...l, gmailPolling: false }));
          await setMcpState(p => ({ ...(p ?? {} as WidgetState), gmail_connected: true, gmail_auth_url: null }));
        }
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [local.gmailPolling, callTool, setMcpState]);

  useEffect(() => { handleRefresh(); }, [handleRefresh]);

  const wrap: React.CSSProperties = { fontFamily: FONT, maxWidth: 520, margin: '0 auto', padding: '28px 24px' };
  const hdr: React.CSSProperties = { fontSize: 15, fontWeight: 700, color: C.primary, letterSpacing: '-0.02em' };

  /* ═══ LOADING ═══ */
  if (isPending) return (
    <div style={{ ...wrap, padding: '48px 24px', textAlign: 'center' }}>
      <div style={hdr}>HunterAI</div>
      <div style={{ fontSize: 13, color: C.tertiary, marginTop: 8 }}>Loading...</div>
    </div>
  );

  /* ═══ STEP 1 — WELCOME ═══ */
  if (!hasData && !local.draftEmail) return (
    <div style={wrap}>
      <div style={{ marginBottom: 24 }}>
        <div style={hdr}>HunterAI</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: C.primary, lineHeight: 1.3, letterSpacing: '-0.02em', marginTop: 12 }}>
          Find startup credits &amp; grants you're missing out on.
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <button
          onClick={() => sendFollowUpMessage('I want to scan my website to find credits and discounts. Ask me for my website URL. After scanning, automatically save my profile and find all matching credit opportunities, then refresh the dashboard.')}
          disabled={local.loading}
          style={{ flex: 1, padding: '20px 18px', textAlign: 'left', background: C.accentSoft, border: `1px solid ${C.accent}`, borderRadius: 12, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8 }}
        >
          <span style={{ fontSize: 20 }}>&#127760;</span>
          <span style={{ fontSize: 15, fontWeight: 600, color: C.primary, lineHeight: 1.3 }}>Scan my website</span>
          <span style={{ fontSize: 12, color: C.secondary, lineHeight: 1.4 }}>Auto-detect your tech stack and find matching credits</span>
        </button>
        <button
          onClick={() => sendFollowUpMessage('I want to upload my bank statement to find software subscriptions and credits. Ask me to upload my bank statement PDF. After analyzing it, automatically save my profile and find all matching credit opportunities, then refresh the dashboard.')}
          disabled={local.loading}
          style={{ flex: 1, padding: '20px 18px', textAlign: 'left', background: C.cardBg, border: `1px solid ${C.cardBorder}`, borderRadius: 12, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8 }}
        >
          <span style={{ fontSize: 20 }}>&#128196;</span>
          <span style={{ fontSize: 15, fontWeight: 600, color: C.primary, lineHeight: 1.3 }}>Upload bank statement</span>
          <span style={{ fontSize: 12, color: C.secondary, lineHeight: 1.4 }}>PDF or CSV to detect your SaaS subscriptions</span>
        </button>
      </div>
    </div>
  );

  /* ═══ STEP 3a — GMAIL CONNECT ═══ */
  if (local.draftEmail && !gmailConnected) return (
    <div style={wrap}>
      <button onClick={() => setLocal(l => ({ ...l, draftEmail: null, gmailPolling: false }))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: C.secondary }}>
        <span style={{ fontSize: 16 }}>&larr;</span> Back to opportunities
      </button>
      <div style={{ textAlign: 'center', padding: '24px 0' }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, margin: '0 auto 20px', background: C.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>&#9993;</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: C.primary, marginBottom: 6, letterSpacing: '-0.02em' }}>Connect Gmail to apply</div>
        <div style={{ fontSize: 13, color: C.secondary, lineHeight: 1.5, maxWidth: 320, margin: '0 auto 24px' }}>
          We'll send an application email from your Gmail to <strong style={{ color: C.primary }}>{local.draftEmail.opportunity.program.name}</strong>
        </div>
        {gmailAuthUrl && !local.gmailPolling && (
          <a href={gmailAuthUrl} target="_blank" rel="noopener noreferrer" onClick={handleConnectGmail} style={{ display: 'inline-block', padding: '12px 32px', borderRadius: 10, background: C.btnPrimary, color: C.btnPriTx, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
            Connect Gmail
          </a>
        )}
        {local.gmailPolling && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 32, height: 32, border: `3px solid ${C.border}`, borderTopColor: C.accent, borderRadius: '50%', animation: 'hunterSpin 0.8s linear infinite' }} />
            <div style={{ fontSize: 13, color: C.tertiary }}>Waiting for authorization...</div>
          </div>
        )}
        {!gmailAuthUrl && !local.gmailPolling && (
          <div style={{ fontSize: 13, color: C.tertiary }}>Gmail auth URL not available. Try refreshing.</div>
        )}
      </div>
      <style>{`@keyframes hunterSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  /* ═══ STEP 3b — EMAIL DRAFT ═══ */
  if (local.draftEmail && gmailConnected) return (
    <div style={wrap}>
      <button onClick={() => setLocal(l => ({ ...l, draftEmail: null }))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: C.secondary }}>
        <span style={{ fontSize: 16 }}>&larr;</span> Back to opportunities
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: C.primary }}>Review application</span>
        <span style={{ fontSize: 12, color: C.tertiary }}>{local.draftEmail.opportunity.program.name}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: C.accentText, marginLeft: 'auto', fontFeatureSettings: '"tnum"' }}>{fmtCurrency(local.draftEmail.opportunity.potential_value)}</span>
      </div>
      <div style={{ background: C.elevated, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ padding: '10px 14px', borderBottom: `1px solid ${C.borderSub}`, display: 'flex', gap: 8 }}>
          <span style={{ fontSize: 11, color: C.tertiary, minWidth: 36 }}>To</span>
          <span style={{ fontSize: 13, color: C.primary, fontWeight: 500 }}>{local.draftEmail.to}</span>
        </div>
        <div style={{ padding: '10px 14px', borderBottom: `1px solid ${C.borderSub}`, display: 'flex', gap: 8 }}>
          <span style={{ fontSize: 11, color: C.tertiary, minWidth: 36 }}>Subj</span>
          <span style={{ fontSize: 13, color: C.primary, fontWeight: 500 }}>{local.draftEmail.subject}</span>
        </div>
        <div style={{ padding: '12px 14px', fontSize: 13, color: C.secondary, lineHeight: 1.65, whiteSpace: 'pre-wrap', maxHeight: 200, overflowY: 'auto' }}>{local.draftEmail.body}</div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={handleSendDraft} disabled={local.sendingEmail} style={{ flex: 1, padding: '12px', border: 'none', borderRadius: 10, background: C.accent, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: local.sendingEmail ? 0.6 : 1 }}>
          {local.sendingEmail ? 'Sending...' : 'Send application'}
        </button>
        <button onClick={() => { const d = local.draftEmail!; sendFollowUpMessage(`Edit this email draft for ${d.opportunity.program.name} before sending. To: ${d.to}, Subject: ${d.subject}`); }} disabled={local.sendingEmail} style={{ padding: '12px 18px', border: `1px solid ${C.btnSecBor}`, borderRadius: 10, background: C.btnSecBg, color: C.btnSecTx, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
          Edit
        </button>
      </div>
    </div>
  );

  /* ═══ STEP 2 — DASHBOARD ═══ */
  const totalMonthlySpend = subs.reduce((s, x) => s + x.monthly_cost, 0);
  const catTotals: Record<string, number> = {};
  for (const sub of subs) { catTotals[sub.category] = (catTotals[sub.category] ?? 0) + sub.monthly_cost; }
  const catEntries = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  let cumOffset = 0;
  const segments = catEntries.map(([cat, amount]) => {
    const pct = totalMonthlySpend > 0 ? amount / totalMonthlySpend : 0;
    const dash = pct * circumference;
    const offset = cumOffset;
    cumOffset += dash;
    return { cat, amount, pct, dash, offset, color: CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.other };
  });
  const appliedCount = emails.length;
  const sentForOpp = (opp: Opportunity) => emails.some(e => e.program_id === opp.program.id);

  return (
    <div style={{ fontFamily: FONT, maxWidth: 520, margin: '0 auto', padding: '24px 20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={hdr}>HunterAI</span>
          {profile && <span style={{ fontSize: 12, color: C.tertiary }}>{profile.name}</span>}
        </div>
        <button onClick={handleRefresh} disabled={local.loading} style={{ background: 'none', border: 'none', padding: '4px 6px', cursor: 'pointer', fontSize: 14, color: C.tertiary, opacity: local.loading ? 0.4 : 0.7, lineHeight: 1 }}>
          {local.loading ? '\u23f3' : '\u21bb'}
        </button>
      </div>

      {/* Expense donut chart */}
      {subs.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: 16, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, marginBottom: 20 }}>
          <div style={{ position: 'relative', flexShrink: 0, width: 120, height: 120 }}>
            <svg width="120" height="120" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r={radius} fill="none" stroke={C.border} strokeWidth="14" />
              {segments.map(seg => (
                <circle key={seg.cat} cx="60" cy="60" r={radius} fill="none" stroke={seg.color} strokeWidth="14" strokeDasharray={`${seg.dash} ${circumference - seg.dash}`} strokeDashoffset={-seg.offset} strokeLinecap="butt" transform="rotate(-90 60 60)" style={{ transition: 'stroke-dasharray 0.5s ease' }} />
              ))}
            </svg>
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.primary, fontFeatureSettings: '"tnum"', lineHeight: 1 }}>
                ${totalMonthlySpend >= 1000 ? `${(totalMonthlySpend / 1000).toFixed(1)}K` : totalMonthlySpend.toLocaleString()}
              </div>
              <div style={{ fontSize: 9, color: C.tertiary, marginTop: 2 }}>/month</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.tertiary, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Software spend</div>
            {segments.map(seg => (
              <div key={seg.cat} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: seg.color, flexShrink: 0 }} />
                <div style={{ flex: 1, fontSize: 12, fontWeight: 500, color: C.primary, textTransform: 'capitalize', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{seg.cat}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.primary, fontFeatureSettings: '"tnum"', flexShrink: 0 }}>${seg.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Savings summary */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: C.primary, letterSpacing: '-0.03em', lineHeight: 1, fontFeatureSettings: '"tnum"' }}>
            {totalValue > 0 ? `$${(totalValue / 1000).toFixed(totalValue % 1000 === 0 ? 0 : 1)}K` : '$0'}
          </div>
          <div style={{ fontSize: 12, color: C.secondary, marginTop: 4 }}>credits available</div>
        </div>
        <div style={{ display: 'flex', gap: 20 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: C.primary, fontFeatureSettings: '"tnum"' }}>{opps.length}</div>
            <div style={{ fontSize: 10, color: C.tertiary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Found</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: appliedCount > 0 ? C.accentText : C.muted, fontFeatureSettings: '"tnum"' }}>{appliedCount}</div>
            <div style={{ fontSize: 10, color: C.tertiary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Applied</div>
          </div>
        </div>
      </div>

      {/* Find credits CTA */}
      {subs.length > 0 && opps.length === 0 && (
        <button onClick={async () => { setLocal(l => ({ ...l, loading: true })); await sendFollowUpMessage('Find all matching credit opportunities for these subscriptions and refresh the dashboard'); }} disabled={local.loading} style={{ width: '100%', padding: '14px 16px', marginBottom: 20, background: C.accentSoft, border: `1px solid ${C.accent}`, borderRadius: 10, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: C.accentText }}>{local.loading ? 'Searching...' : 'Find credits for these tools'}</span>
          {!local.loading && <span style={{ fontSize: 16, color: C.accentText }}>&rarr;</span>}
        </button>
      )}

      {/* Apply all easy CTA */}
      {easyOpps.length > 0 && appliedCount === 0 && (
        <div style={{ padding: '12px 16px', background: C.accentSoft, borderRadius: 10, marginBottom: 20, borderLeft: `3px solid ${C.accent}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: C.primary }}>{easyOpps.length} easy application{easyOpps.length !== 1 ? 's' : ''} ready to send</span>
          <button onClick={handleApplyAll} disabled={local.loading || local.applyingId !== null} style={{ padding: '8px 16px', border: 'none', borderRadius: 8, background: C.btnPrimary, color: C.btnPriTx, fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>Start applying</button>
        </div>
      )}

      {/* Opportunities list */}
      {opps.length > 0 && [
        { label: 'Easy to apply', items: easyOpps },
        { label: 'Medium effort', items: mediumOpps },
        { label: 'Requires more effort', items: hardOpps },
      ].map(group => {
        if (!group.items.length) return null;
        const shown = local.showAllOpps ? group.items : group.items.slice(0, 5);
        return (
          <div key={group.label} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.tertiary, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '6px 2px' }}>{group.label} ({group.items.length})</div>
            <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', background: C.elevated }}>
              {shown.map(opp => {
                const isSent = sentForOpp(opp);
                const ec = effortConfig[opp.effort] ?? effortConfig.medium;
                return (
                  <div key={opp.id} style={{ padding: '10px 12px', borderBottom: `1px solid ${C.borderSub}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: C.primary }}>{opp.program.name}</span>
                        {opp.program.verified && <span style={{ fontSize: 9, color: C.accent }}>&#10003;</span>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, color: C.secondary, background: C.surface, padding: '1px 5px', borderRadius: 3 }}>{typeLabels[opp.program.type] ?? 'Program'}</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                          {[1, 2, 3].map(i => (<span key={i} style={{ width: 3, height: 3, borderRadius: '50%', background: i <= ec.dots ? C.secondary : C.muted }} />))}
                          <span style={{ fontSize: 10, color: C.tertiary, marginLeft: 2 }}>{ec.text}</span>
                        </span>
                        <span style={{ fontSize: 10, color: C.tertiary }}>{opp.program.vendor}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: C.primary, fontFeatureSettings: '"tnum"' }}>{fmtCurrency(opp.potential_value, opp.program.currency)}</span>
                      <button onClick={() => !isSent && handleApplyOne(opp)} disabled={isSent || local.applyingId !== null} style={{ padding: '4px 10px', border: isSent ? 'none' : `1px solid ${C.btnSecBor}`, borderRadius: 6, background: isSent ? C.accentSoft : C.btnSecBg, fontSize: 12, fontWeight: 500, color: isSent ? C.accentText : C.primary, cursor: isSent ? 'default' : 'pointer', opacity: local.applyingId === opp.id ? 0.5 : 1, whiteSpace: 'nowrap' }}>
                        {isSent ? 'Sent' : local.applyingId === opp.id ? '...' : opp.program.type === 'incubator_portal' ? 'View' : 'Apply'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            {!local.showAllOpps && group.items.length > 5 && (
              <button onClick={() => setLocal(l => ({ ...l, showAllOpps: true }))} style={{ marginTop: 4, width: '100%', padding: '6px', background: 'transparent', border: 'none', fontSize: 12, color: C.tertiary, cursor: 'pointer', fontWeight: 500 }}>Show {group.items.length - 5} more</button>
            )}
          </div>
        );
      })}
    </div>
  );
}

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
