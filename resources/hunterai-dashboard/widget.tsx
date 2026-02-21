import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useWidget, McpUseProvider, type WidgetMetadata } from 'mcp-use/react';
import type { Opportunity, SentEmail, Subscription, CompanyProfile, EmailDraft } from '../../src/types.js';

export const widgetMetadata: WidgetMetadata = {
  description: 'HunterAI Dashboard — find and apply for startup credits, programs, and grants',
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

type JourneyPhase = 'welcome' | 'discover' | 'opportunities' | 'tracking' | 'replies';

interface LocalState {
  loading: boolean;
  applyingId: string | null;
  showAllOpps: boolean;
  expandedReply: string | null;
  activeView: 'opportunities' | 'applied' | 'replies' | 'subscriptions';
  draftEmail: (EmailDraft & { opportunity: Opportunity }) | null;
  sendingEmail: boolean;
  showFullDashboard: boolean;
}

// ─── Dark mode palette ───────────────────────────────────
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
    cardHover:   isDark ? '#2d2d2d' : '#fafafa',
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
    activeView: 'opportunities', draftEmail: null, sendingEmail: false, showFullDashboard: false,
  });

  // Dark mode detection
  const isDark = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  }, []);
  const C = useMemo(() => makePalette(isDark), [isDark]);

  // State
  const opps = mcpState?.opportunities ?? [];
  const emails = mcpState?.sent_emails ?? [];
  const subs = mcpState?.subscriptions ?? [];
  const profile = mcpState?.profile ?? null;
  const totalValue = mcpState?.total_potential_value ?? 0;
  const replies = emails.filter(e => e.reply);
  const easyOpps = opps.filter(o => o.effort === 'low');
  const mediumOpps = opps.filter(o => o.effort === 'medium');
  const hardOpps = opps.filter(o => o.effort === 'high');

  // Spend context
  const totalMonthlySpend = subs.reduce((s, x) => s + x.monthly_cost, 0);
  const directMatchOpps = opps.filter(o => o.matched_subscription);
  const directMatchValue = directMatchOpps.reduce((s, o) => s + o.potential_value, 0);

  // Journey phase
  const journeyPhase: JourneyPhase = (() => {
    if (!profile) return 'welcome';
    if (opps.length === 0) return 'discover';
    if (emails.length === 0) return 'opportunities';
    if (replies.length === 0) return 'tracking';
    return 'replies';
  })();

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

  // ─── Shared components ────────────────────────────────
  const Wordmark = ({ subtitle }: { subtitle?: string }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: C.primary, letterSpacing: '-0.02em' }}>HunterAI</span>
        {subtitle && <span style={{ fontSize: 12, color: C.tertiary, fontWeight: 400 }}>{subtitle}</span>}
      </div>
      <button onClick={handleRefresh} disabled={local.loading} style={{
        background: 'none', border: 'none', padding: '4px 6px', cursor: 'pointer', fontSize: 14, color: C.tertiary,
        opacity: local.loading ? 0.4 : 0.7, lineHeight: 1,
      }}>
        {local.loading ? '\u23f3' : '\u21bb'}
      </button>
    </div>
  );

  const ActionCard = ({ primary, title, desc, action, onClick, disabled }: {
    primary?: boolean; title: string; desc: string; action: string; onClick: () => void; disabled?: boolean;
  }) => (
    <button onClick={onClick} disabled={disabled} style={{
      flex: 1, minWidth: 0, padding: '18px 16px', textAlign: 'left' as const,
      background: primary ? C.accentSoft : C.cardBg,
      border: `1px solid ${primary ? C.accent : C.cardBorder}`,
      borderLeft: primary ? `3px solid ${C.accent}` : `1px solid ${C.cardBorder}`,
      borderRadius: 10, cursor: disabled ? 'default' : 'pointer',
      opacity: disabled ? 0.5 : 1, transition: 'background 0.15s',
      display: 'flex', flexDirection: 'column' as const, gap: 6,
    }}>
      <span style={{ fontSize: 14, fontWeight: 600, color: C.primary, lineHeight: 1.3 }}>{title}</span>
      <span style={{ fontSize: 12, color: C.secondary, lineHeight: 1.4 }}>{desc}</span>
      <span style={{
        fontSize: 12, fontWeight: 500, color: primary ? C.accentText : C.secondary,
        marginTop: 4,
      }}>
        {action} &rarr;
      </span>
    </button>
  );

  const WideCard = ({ title, desc, onClick, disabled }: {
    title: string; desc: string; onClick: () => void; disabled?: boolean;
  }) => (
    <button onClick={onClick} disabled={disabled} style={{
      width: '100%', padding: '14px 16px', textAlign: 'left' as const,
      background: C.cardBg, border: `1px solid ${C.cardBorder}`, borderRadius: 10,
      cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
    }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.primary }}>{title}</div>
        <div style={{ fontSize: 12, color: C.secondary, marginTop: 2 }}>{desc}</div>
      </div>
      <span style={{ fontSize: 12, color: C.tertiary, flexShrink: 0 }}>&rarr;</span>
    </button>
  );

  const PrimaryBtn = ({ children, onClick, disabled, full }: {
    children: React.ReactNode; onClick: () => void; disabled?: boolean; full?: boolean;
  }) => (
    <button onClick={onClick} disabled={disabled} style={{
      padding: '10px 18px', border: 'none', borderRadius: 8,
      background: C.btnPrimary, color: C.btnPriTx, fontSize: 13, fontWeight: 600,
      cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1,
      width: full ? '100%' : 'auto', whiteSpace: 'nowrap' as const,
    }}>
      {children}
    </button>
  );

  const SecondaryBtn = ({ children, onClick, disabled }: {
    children: React.ReactNode; onClick: () => void; disabled?: boolean;
  }) => (
    <button onClick={onClick} disabled={disabled} style={{
      padding: '10px 18px', border: `1px solid ${C.btnSecBor}`, borderRadius: 8,
      background: C.btnSecBg, color: C.btnSecTx, fontSize: 13, fontWeight: 500,
      cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1,
      whiteSpace: 'nowrap' as const,
    }}>
      {children}
    </button>
  );

  // ─── Draft email overlay ──────────────────────────────
  const DraftOverlay = () => {
    if (!local.draftEmail) return null;
    const draft = local.draftEmail;
    return (
      <div style={{
        padding: '20px', background: C.surface, borderRadius: 12, marginBottom: 16,
        border: `1px solid ${C.border}`,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.primary }}>Review email</span>
            <span style={{ fontSize: 12, color: C.tertiary, marginLeft: 8 }}>{draft.opportunity.program.name}</span>
          </div>
          <button onClick={handleDismissDraft} style={{
            background: 'none', border: 'none', fontSize: 18, color: C.tertiary, cursor: 'pointer', lineHeight: 1, padding: '0 4px',
          }}>&times;</button>
        </div>
        <div style={{ background: C.elevated, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', marginBottom: 14 }}>
          <div style={{ padding: '10px 14px', borderBottom: `1px solid ${C.borderSub}`, display: 'flex', gap: 8 }}>
            <span style={{ fontSize: 11, color: C.tertiary, minWidth: 44 }}>To</span>
            <span style={{ fontSize: 13, color: C.primary }}>{draft.to}</span>
          </div>
          <div style={{ padding: '10px 14px', borderBottom: `1px solid ${C.borderSub}`, display: 'flex', gap: 8 }}>
            <span style={{ fontSize: 11, color: C.tertiary, minWidth: 44 }}>Subject</span>
            <span style={{ fontSize: 13, color: C.primary }}>{draft.subject}</span>
          </div>
          <div style={{ padding: '12px 14px', fontSize: 13, color: C.secondary, lineHeight: 1.6, whiteSpace: 'pre-wrap' as const, maxHeight: 180, overflowY: 'auto' as const }}>
            {draft.body}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <PrimaryBtn onClick={handleSendDraft} disabled={local.sendingEmail} full>
            {local.sendingEmail ? 'Sending...' : 'Send email'}
          </PrimaryBtn>
          <SecondaryBtn onClick={() => {
            const d = local.draftEmail!;
            sendFollowUpMessage(`I want to edit this email draft for ${d.opportunity.program.name} before sending. Current draft: To: ${d.to}, Subject: ${d.subject}`);
          }} disabled={local.sendingEmail}>Edit</SecondaryBtn>
          <SecondaryBtn onClick={handleDismissDraft} disabled={local.sendingEmail}>Cancel</SecondaryBtn>
        </div>
      </div>
    );
  };

  // ─── Opp card (compact) ────────────────────────────────
  const OppCard = ({ opp }: { opp: Opportunity }) => {
    const isSent = emails.some(e => e.program_id === opp.program.id);
    const c = effortConfig[opp.effort] ?? effortConfig.medium;
    return (
      <div style={{
        padding: '12px 14px', borderBottom: `1px solid ${C.borderSub}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.primary }}>{opp.program.name}</span>
            {opp.program.verified && <span style={{ fontSize: 9, color: C.accent }}>&#10003;</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const }}>
            <span style={{ fontSize: 11, color: C.secondary, background: C.surface, padding: '1px 6px', borderRadius: 3 }}>
              {typeLabels[opp.program.type] ?? 'Program'}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
              {[1, 2, 3].map(i => (
                <span key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: i <= c.dots ? C.secondary : C.muted }} />
              ))}
              <span style={{ fontSize: 11, color: C.tertiary, marginLeft: 2 }}>{c.text}</span>
            </span>
            <span style={{ fontSize: 11, color: C.tertiary }}>{opp.program.vendor}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: C.primary, fontFeatureSettings: '"tnum"' }}>
            {fmtCurrency(opp.potential_value, opp.program.currency)}
          </span>
          <button
            onClick={() => !isSent && handleApplyOne(opp)}
            disabled={isSent || local.applyingId !== null}
            style={{
              padding: '5px 12px', border: isSent ? 'none' : `1px solid ${C.btnSecBor}`, borderRadius: 6,
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
  };

  const OppGroup = ({ label, items }: { label: string; items: Opportunity[] }) => {
    if (!items.length) return null;
    const shown = local.showAllOpps ? items : items.slice(0, 5);
    return (
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: C.tertiary, textTransform: 'uppercase' as const, letterSpacing: '0.06em', padding: '8px 2px' }}>
          {label} ({items.length})
        </div>
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', background: C.elevated }}>
          {shown.map(opp => <OppCard key={opp.id} opp={opp} />)}
        </div>
        {!local.showAllOpps && items.length > 5 && (
          <button
            onClick={() => setLocal(l => ({ ...l, showAllOpps: true }))}
            style={{
              marginTop: 4, width: '100%', padding: '8px', background: 'transparent',
              border: 'none', fontSize: 12, color: C.tertiary, cursor: 'pointer', fontWeight: 500,
            }}
          >
            Show {items.length - 5} more
          </button>
        )}
      </div>
    );
  };

  // ─── Loading ───────────────────────────────────────────
  if (isPending) return (
    <div style={{ fontFamily: FONT, maxWidth: 540, margin: '0 auto', padding: '48px 24px', textAlign: 'center' }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: C.primary, marginBottom: 8 }}>HunterAI</div>
      <div style={{ fontSize: 13, color: C.tertiary }}>Loading...</div>
    </div>
  );

  // ═══════════════════════════════════════════════════════
  // WELCOME — No profile set
  // ═══════════════════════════════════════════════════════
  if (journeyPhase === 'welcome') return (
    <div style={{ fontFamily: FONT, maxWidth: 540, margin: '0 auto', padding: '24px 20px' }}>
      <Wordmark />
      <div style={{ marginTop: 16, marginBottom: 8 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: C.primary, lineHeight: 1.3, letterSpacing: '-0.02em' }}>
          Find credits your startup is missing
        </div>
        <div style={{ fontSize: 13, color: C.secondary, marginTop: 8, lineHeight: 1.5, maxWidth: 400 }}>
          Startups leave $50K-$500K in free credits on the table. Tell us about yours and we'll match you with 66+ programs.
        </div>
      </div>

      <div style={{ fontSize: 13, color: C.tertiary, marginTop: 24, marginBottom: 12, fontWeight: 500 }}>
        What do you want to start with?
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
        <ActionCard
          primary
          title="Set up my profile"
          desc="Get matched with credits, grants, and startup programs."
          action="Get started"
          onClick={() => sendFollowUpMessage('Help me set up my company profile for HunterAI')}
          disabled={local.loading}
        />
        <ActionCard
          title="Try with demo data"
          desc="See HunterAI in action with a sample startup."
          action="Launch demo"
          onClick={() => sendFollowUpMessage('Show me HunterAI with demo data so I can see how it works')}
          disabled={local.loading}
        />
      </div>

      <WideCard
        title="What can HunterAI do?"
        desc="Learn about credits, grants, and how applications work."
        onClick={() => sendFollowUpMessage('What can HunterAI do? Tell me about the startup credits and grants you can help me find and apply for.')}
        disabled={local.loading}
      />
    </div>
  );

  // ═══════════════════════════════════════════════════════
  // DISCOVER — Profile set, no opportunities
  // ═══════════════════════════════════════════════════════
  if (journeyPhase === 'discover') return (
    <div style={{ fontFamily: FONT, maxWidth: 540, margin: '0 auto', padding: '24px 20px' }}>
      <Wordmark subtitle={profile ? `${profile.name}${profile.stage ? ` \u00b7 ${profile.stage}` : ''}` : undefined} />

      {/* Progress steps */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, margin: '16px 0 24px', padding: '0 4px' }}>
        {[{ label: 'Profile', done: true }, { label: 'Discover', done: false }, { label: 'Apply', done: false }].map((step, i) => (
          <React.Fragment key={step.label}>
            {i > 0 && <div style={{ flex: 1, height: 1, background: step.done ? C.accent : C.border, margin: '0 8px' }} />}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: step.done ? C.accent : 'transparent', border: step.done ? 'none' : `1.5px solid ${C.border}`,
                fontSize: 10, fontWeight: 600, color: step.done ? '#fff' : C.tertiary,
              }}>
                {step.done ? '\u2713' : i + 1}
              </div>
              <span style={{ fontSize: 12, fontWeight: step.done ? 600 : 400, color: step.done ? C.primary : C.tertiary }}>
                {step.label}
              </span>
            </div>
          </React.Fragment>
        ))}
      </div>

      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: C.primary, lineHeight: 1.3, letterSpacing: '-0.01em' }}>
          Let's find your credits
        </div>
        <div style={{ fontSize: 13, color: C.secondary, marginTop: 6, lineHeight: 1.5 }}>
          How should we discover what tools you're paying for?
        </div>
      </div>

      <div style={{ fontSize: 13, color: C.tertiary, marginTop: 20, marginBottom: 10, fontWeight: 500 }}>
        Choose an approach
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
        <ActionCard
          primary
          title="Scan my website"
          desc="Auto-detect your tech stack and match credits."
          action="Enter URL"
          onClick={() => sendFollowUpMessage('Scan my website to detect my tech stack and find credits. Ask me for my URL.')}
          disabled={local.loading}
        />
        <ActionCard
          title="Upload a statement"
          desc="Import a bank statement or connect Puzzle.io."
          action="Import data"
          onClick={() => sendFollowUpMessage('Analyze my bank statement or connect Puzzle to detect subscriptions')}
          disabled={local.loading}
        />
      </div>

      <WideCard
        title="Skip to all 66 programs"
        desc="Browse every credit, grant, and startup program we track."
        onClick={() => sendFollowUpMessage('Find all opportunities for my startup right now')}
        disabled={local.loading}
      />
    </div>
  );

  // ═══════════════════════════════════════════════════════
  // FULL DASHBOARD — Opportunities found (or applied/replies)
  // ═══════════════════════════════════════════════════════
  const pipelineSteps = [
    { key: 'opportunities' as const, label: 'Opportunities', value: opps.length, done: opps.length > 0 },
    { key: 'applied' as const, label: 'Applied', value: emails.length, done: emails.length > 0 },
    { key: 'replies' as const, label: 'Replies', value: replies.length, done: replies.length > 0 },
    ...(subs.length > 0 ? [{ key: 'subscriptions' as const, label: 'Subscriptions', value: subs.length, done: true }] : []),
  ];

  return (
    <div style={{ fontFamily: FONT, maxWidth: 540, margin: '0 auto', padding: '24px 20px' }}>
      <Wordmark subtitle={profile ? `${profile.name}${profile.stage ? ` \u00b7 ${profile.stage}` : ''}` : undefined} />

      {/* Draft email overlay */}
      <DraftOverlay />

      {/* Savings hero */}
      {!local.draftEmail && (
        <div style={{ margin: '16px 0 20px' }}>
          <div style={{ fontSize: 34, fontWeight: 700, color: C.primary, letterSpacing: '-0.03em', lineHeight: 1, fontFeatureSettings: '"tnum"' }}>
            {totalValue > 0 ? `$${(totalValue / 1000).toFixed(totalValue % 1000 === 0 ? 0 : 1)}K` : '$0'}
          </div>
          <div style={{ fontSize: 13, color: C.secondary, marginTop: 4 }}>total credits available</div>

          {/* Spend vs savings context */}
          {subs.length > 0 && opps.length > 0 && (
            <div style={{
              marginTop: 14, padding: '12px 14px', background: C.surface,
              border: `1px solid ${C.border}`, borderRadius: 8,
              display: 'flex', gap: 0,
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: C.tertiary, textTransform: 'uppercase' as const, letterSpacing: '0.05em', fontWeight: 500 }}>Your spend</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.primary, fontFeatureSettings: '"tnum"', marginTop: 2 }}>
                  {totalMonthlySpend.toLocaleString()}/mo
                </div>
                <div style={{ fontSize: 11, color: C.tertiary, marginTop: 1 }}>
                  across {subs.length} tools
                </div>
              </div>
              <div style={{ width: 1, background: C.border, margin: '0 14px' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: C.tertiary, textTransform: 'uppercase' as const, letterSpacing: '0.05em', fontWeight: 500 }}>Direct matches</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.accentText, fontFeatureSettings: '"tnum"', marginTop: 2 }}>
                  {fmtCurrency(directMatchValue)}
                </div>
                <div style={{ fontSize: 11, color: C.tertiary, marginTop: 1 }}>
                  {directMatchOpps.length} credits for tools you use
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Pipeline nav (merged counters + tab selector) */}
      {!local.draftEmail && (
        <div style={{ display: 'flex', gap: 0, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden', marginBottom: 20 }}>
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
                  <div style={{ fontSize: 11, color: active ? C.primary : C.tertiary, marginTop: 1, textTransform: 'uppercase' as const, letterSpacing: '0.05em', fontWeight: active ? 600 : 400 }}>
                    {step.label}
                  </div>
                </button>
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* ── Next step CTA (contextual) ─────────────────── */}
      {!local.draftEmail && (() => {
        if (journeyPhase === 'opportunities' && easyOpps.length > 0) return (
          <div style={{
            display: 'flex', gap: 10, marginBottom: 20,
          }}>
            <ActionCard
              primary
              title={`${easyOpps.length} easy applications ready`}
              desc={directMatchOpps.length > 0 ? `${directMatchOpps.length} match tools you already pay for.` : "We'll draft personalized emails. You review before sending."}
              action="Start applying"
              onClick={handleApplyAll}
              disabled={local.loading}
            />
            <ActionCard
              title="Browse all programs"
              desc={`${opps.length} opportunities across ${new Set(opps.map(o => o.program.vendor)).size} vendors.`}
              action="View list"
              onClick={() => setLocal(l => ({ ...l, activeView: 'opportunities', showFullDashboard: true }))}
              disabled={local.loading}
            />
          </div>
        );
        if (journeyPhase === 'tracking') return (
          <div style={{
            padding: '14px 16px', background: C.surface, borderRadius: 10, marginBottom: 20,
            border: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.primary }}>
                {emails.length} {emails.length === 1 ? 'application' : 'applications'} sent
              </div>
              <div style={{ fontSize: 12, color: C.secondary, marginTop: 2 }}>Check if any programs have responded.</div>
            </div>
            <PrimaryBtn onClick={handleCheckReplies} disabled={local.loading}>Check replies</PrimaryBtn>
          </div>
        );
        if (journeyPhase === 'replies') return (
          <div style={{
            padding: '14px 16px', background: C.accentSoft, borderRadius: 10, marginBottom: 20,
            borderLeft: `3px solid ${C.accent}`,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.primary }}>
              {replies.length} {replies.length === 1 ? 'reply' : 'replies'} waiting for review
            </div>
            <div style={{ fontSize: 12, color: C.secondary, marginTop: 2 }}>AI-drafted responses ready. Review and send.</div>
            <button onClick={() => setLocal(l => ({ ...l, activeView: 'replies' }))} style={{
              marginTop: 10, padding: '8px 16px', border: 'none', borderRadius: 8,
              background: C.btnPrimary, color: C.btnPriTx, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>
              View replies
            </button>
          </div>
        );
        return null;
      })()}

      {/* ── Opportunities view ────────────────────────── */}
      {local.activeView === 'opportunities' && !local.draftEmail && (
        opps.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 20px' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.primary, marginBottom: 6 }}>No opportunities yet</div>
            <div style={{ fontSize: 13, color: C.secondary, marginBottom: 14 }}>Run a search to discover matching programs.</div>
            <PrimaryBtn onClick={() => sendFollowUpMessage('Find opportunities for my startup')}>Find opportunities</PrimaryBtn>
          </div>
        ) : (
          (local.showFullDashboard || journeyPhase !== 'opportunities') && (
            <>
              <OppGroup label="Easy to apply" items={easyOpps} />
              <OppGroup label="Medium effort" items={mediumOpps} />
              <OppGroup label="Requires more effort" items={hardOpps} />
            </>
          )
        )
      )}

      {/* ── Applied view ─────────────────────────────── */}
      {local.activeView === 'applied' && !local.draftEmail && (
        emails.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 20px' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.primary, marginBottom: 6 }}>No applications sent yet</div>
            <div style={{ fontSize: 13, color: C.secondary }}>Find opportunities and apply with one click.</div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: C.tertiary, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>
                Sent ({emails.length})
              </span>
              <button onClick={handleCheckReplies} disabled={local.loading} style={{
                fontSize: 12, color: C.accentText, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500,
              }}>
                Check for replies
              </button>
            </div>
            <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', background: C.elevated }}>
              {emails.map((email, i) => {
                const replied = email.status === 'replied';
                return (
                  <div key={email.id} style={{ padding: '12px 14px', borderBottom: i < emails.length - 1 ? `1px solid ${C.borderSub}` : 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.primary }}>{email.subject}</div>
                        <div style={{ fontSize: 12, color: C.tertiary, marginTop: 2 }}>{email.to}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <span style={{ fontSize: 11, color: C.tertiary }}>{timeAgo(email.sent_at)}</span>
                        <span style={{
                          fontSize: 10, fontWeight: 500, borderRadius: 4, padding: '2px 6px',
                          background: replied ? C.accent : C.surface,
                          color: replied ? '#fff' : C.tertiary,
                        }}>
                          {replied ? 'Replied' : email.status === 'failed' ? 'Failed' : 'Sent'}
                        </span>
                      </div>
                    </div>
                    {replied && email.reply && (
                      <div style={{
                        marginTop: 8, padding: '8px 10px', borderRadius: 6, background: C.surface,
                        border: `1px solid ${C.border}`, fontSize: 12, color: C.secondary, lineHeight: 1.5,
                      }}>
                        {email.reply.body.slice(0, 140)}{email.reply.body.length > 140 ? '...' : ''}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )
      )}

      {/* ── Subscriptions view ───────────────────────── */}
      {local.activeView === 'subscriptions' && !local.draftEmail && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: C.tertiary, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>
              Detected ({subs.length})
            </span>
            <span style={{ fontSize: 12, color: C.secondary, fontWeight: 500, fontFeatureSettings: '"tnum"' }}>
              {totalMonthlySpend.toLocaleString()}/mo
            </span>
          </div>
          <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', background: C.elevated }}>
            {subs.map((sub, i) => {
              const matchedOpp = opps.find(o => o.matched_subscription?.toLowerCase() === sub.vendor.toLowerCase());
              return (
                <div key={sub.id} style={{
                  padding: '12px 14px', borderBottom: i < subs.length - 1 ? `1px solid ${C.borderSub}` : 'none',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.primary }}>{sub.vendor}</div>
                    <div style={{ fontSize: 11, color: C.tertiary }}>{sub.category}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    <span style={{ fontSize: 13, color: C.secondary, fontFeatureSettings: '"tnum"' }}>
                      {sub.monthly_cost.toLocaleString()}/mo
                    </span>
                    {matchedOpp && (
                      <span style={{
                        fontSize: 11, fontWeight: 500, color: C.accentText, background: C.accentSoft,
                        padding: '2px 6px', borderRadius: 4,
                      }}>
                        {fmtCurrency(matchedOpp.potential_value)} credit
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Replies view ─────────────────────────────── */}
      {local.activeView === 'replies' && !local.draftEmail && (
        replies.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 20px' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.primary, marginBottom: 6 }}>No replies yet</div>
            <div style={{ fontSize: 13, color: C.secondary, marginBottom: 14 }}>Replies from program contacts will appear here.</div>
            <SecondaryBtn onClick={handleCheckReplies} disabled={local.loading}>Check now</SecondaryBtn>
          </div>
        ) : (
          <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', background: C.elevated }}>
            {replies.map((email, i) => {
              const r = email.reply!;
              const expanded = local.expandedReply === email.id;
              return (
                <div key={email.id} style={{ padding: '14px', borderBottom: i < replies.length - 1 ? `1px solid ${C.borderSub}` : 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
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
                    style={{ fontSize: 13, color: C.secondary, lineHeight: 1.6, marginBottom: 10, cursor: r.body.length > 200 ? 'pointer' : 'default' }}
                  >
                    {expanded ? r.body : `${r.body.slice(0, 200)}${r.body.length > 200 ? '...' : ''}`}
                    {r.body.length > 200 && <span style={{ color: C.accentText, fontWeight: 500, marginLeft: 4, fontSize: 12 }}>{expanded ? 'less' : 'more'}</span>}
                  </div>
                  {r.ai_response_draft && (
                    <div style={{
                      background: C.surface, borderRadius: 6, padding: '10px 12px', marginBottom: 10,
                      fontSize: 12, color: C.secondary, lineHeight: 1.5, borderLeft: `2px solid ${C.accent}`,
                    }}>
                      <div style={{ fontWeight: 600, color: C.primary, fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: '0.04em', marginBottom: 4 }}>AI Draft</div>
                      {expanded ? r.ai_response_draft : `${r.ai_response_draft.slice(0, 150)}${r.ai_response_draft.length > 150 ? '...' : ''}`}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <PrimaryBtn onClick={() => handleSendReply(email.id)}>Send reply</PrimaryBtn>
                    <SecondaryBtn onClick={() => sendFollowUpMessage(`Edit the reply to ${r.from} \u2014 I want to customize it`)}>Edit first</SecondaryBtn>
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
