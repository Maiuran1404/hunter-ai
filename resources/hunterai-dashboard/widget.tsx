import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
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
  activeView: 'welcome' | 'website' | 'statement';
  websiteUrl: string;
  scanning: boolean;
  scanError: string | null;
}

// ─── Dark Palette ─────────────────────────────────────────
const C = {
  bg:         '#1a1a1e',
  surface:    '#242428',
  elevated:   '#2e2e34',
  border:     '#38383f',
  borderSub:  '#2a2a30',
  primary:    '#e4e4e6',
  secondary:  '#8a8a92',
  tertiary:   '#5a5a64',
  muted:      '#404048',
  accent:     '#22c55e',
  accentSoft: 'rgba(34,197,94,0.10)',
  accentGlow: 'rgba(34,197,94,0.35)',
  accentText: '#4ade80',
  btnPrimary: '#e4e4e6',
  btnPriTx:   '#1a1a1e',
  btnSecBg:   '#2e2e34',
  btnSecTx:   '#b0b0b4',
  btnSecBor:  '#48484f',
  cardBg:     '#28282e',
  cardBorder: '#38383f',
  row:        '#333338',
} as const;

const FONT = '-apple-system, BlinkMacSystemFont, "Inter", "SF Pro Display", system-ui, sans-serif';
const MONO = '"SF Mono", "Fira Code", "JetBrains Mono", "Consolas", monospace';

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

function fmtExact(v: number) {
  return `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const effortConfig: Record<string, { dots: number; text: string }> = {
  low: { dots: 1, text: 'Easy' }, medium: { dots: 2, text: 'Medium' }, high: { dots: 3, text: 'Hard' },
};
const typeLabels: Record<string, string> = {
  startup_program: 'Startup Program', diversity_grant: 'Diversity Grant',
  government_grant: 'Gov Grant', incubator_credit: 'Incubator', incubator_portal: 'Portal', negotiation: 'Negotiation',
};

// ─── Grain Texture Overlay ──────────────────────────────
function GrainOverlay() {
  return (
    <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', borderRadius: 'inherit', mixBlendMode: 'overlay', opacity: 0.055 }}>
      <filter id="hunterGrain">
        <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="4" stitchTiles="stitch" />
      </filter>
      <rect width="100%" height="100%" filter="url(#hunterGrain)" />
    </svg>
  );
}

// ─── Starburst Visualization ────────────────────────────
function Starburst({ size = 160 }: { size?: number }) {
  const center = size / 2;
  const innerR = size * 0.065;
  const baseR = size * 0.17;
  const maxR = size * 0.44;

  const lines = useMemo(() => {
    const result: { x1: number; y1: number; x2: number; y2: number; opacity: number }[] = [];
    const count = 220;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const pr = ((i * 7919 + 17) % 97) / 97;
      const variation =
        Math.abs(Math.sin(angle * 7)) * 0.28 +
        Math.abs(Math.sin(angle * 13 + 0.7)) * 0.22 +
        Math.abs(Math.sin(angle * 3 + 1.5)) * 0.25 +
        pr * 0.25;
      const clamped = Math.min(variation, 1);
      const outerR = baseR + (maxR - baseR) * clamped;
      const opacity = 0.15 + clamped * 0.85;
      result.push({
        x1: center + Math.cos(angle) * innerR,
        y1: center + Math.sin(angle) * innerR,
        x2: center + Math.cos(angle) * outerR,
        y2: center + Math.sin(angle) * outerR,
        opacity,
      });
    }
    return result;
  }, [size, center, innerR, baseR, maxR]);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block', margin: '0 auto' }}>
      <defs>
        <radialGradient id="hBurstGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.10" />
          <stop offset="55%" stopColor="#fff" stopOpacity="0.02" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx={center} cy={center} r={maxR * 0.85} fill="url(#hBurstGlow)" />
      {lines.map((l, i) => (
        <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="#fff" strokeWidth="0.65" opacity={l.opacity} />
      ))}
      <circle cx={center} cy={center} r={innerR + 2} fill={C.bg} />
      <circle cx={center} cy={center} r={innerR} fill="#111114" />
    </svg>
  );
}

// ─── Status Dot ─────────────────────────────────────────
function StatusDot({ active = true, size = 10 }: { active?: boolean; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: active ? C.accent : C.muted,
      boxShadow: active ? `0 0 6px ${C.accentGlow}` : 'none',
    }} />
  );
}

// ─── Shared Styles ──────────────────────────────────────
const KEYFRAMES = `@keyframes hunterSpin { to { transform: rotate(360deg); } } @keyframes hunterPulse { 0%,100% { opacity:0.5; } 50% { opacity:1; } }`;

const wrapStyle: React.CSSProperties = {
  fontFamily: FONT, maxWidth: 520, margin: '0 auto', padding: '24px 20px',
  background: C.bg, borderRadius: 16, position: 'relative', overflow: 'hidden',
  color: C.primary, boxShadow: '0 4px 32px rgba(0,0,0,0.5)',
};

const backBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
  marginBottom: 20, display: 'flex', alignItems: 'center', gap: 6,
  fontSize: 13, color: C.secondary,
};

const rowCardStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '12px 16px', background: C.row, borderRadius: 8, gap: 12,
};

// ─── Main Widget ─────────────────────────────────────────
function HunterAIDashboardInner() {
  const { state: mcpState, setState: setMcpState, callTool, sendFollowUpMessage, isPending } =
    useWidget<Record<string, unknown>, WidgetState>();

  const [local, setLocal] = useState<LocalState>({
    loading: false, applyingId: null, showAllOpps: false,
    draftEmail: null, sendingEmail: false, gmailPolling: false,
    activeView: 'welcome', websiteUrl: '', scanning: false, scanError: null,
  });

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

  // Use get_dashboard_data (returns object, not widget) to avoid duplicate widget rendering
  const refreshData = useCallback(async () => {
    setLocal(l => ({ ...l, loading: true }));
    try {
      const r = await callTool('get_dashboard_data', {});
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
      }
    } catch {
      setLocal(l => ({ ...l, applyingId: null }));
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
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setLocal(l => ({ ...l, sendingEmail: false }));
      if (msg.toLowerCase().includes('gmail not connected')) {
        await setMcpState(p => ({ ...(p ?? {} as WidgetState), gmail_connected: false }));
      }
    }
  }, [local.draftEmail, gmailConnected, callTool, setMcpState]);

  const handleScanWebsite = useCallback(async () => {
    const url = local.websiteUrl.trim();
    if (!url) return;
    setLocal(l => ({ ...l, scanning: true, scanError: null }));
    try {
      await callTool('scan_website', { url });
      await callTool('find_opportunities', {});
      await refreshData();
      setLocal(l => ({ ...l, scanning: false, activeView: 'welcome' }));
    } catch (err) {
      setLocal(l => ({ ...l, scanning: false, scanError: err instanceof Error ? err.message : String(err) }));
    }
  }, [local.websiteUrl, callTool, refreshData]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLocal(l => ({ ...l, scanning: true, scanError: null }));
    try {
      const buffer = await file.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
      await callTool('analyze_statement', { pdf_base64: base64, filename: file.name });
      await callTool('find_opportunities', {});
      await refreshData();
      setLocal(l => ({ ...l, scanning: false, activeView: 'welcome' }));
    } catch (err) {
      setLocal(l => ({ ...l, scanning: false, scanError: err instanceof Error ? err.message : String(err) }));
    }
  }, [callTool, refreshData]);

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

  // No auto-refresh on mount — initial data comes from show_dashboard props

  const Spinner = ({ label }: { label: string }) => (
    <div style={{ textAlign: 'center', padding: '28px 0' }}>
      <div style={{ width: 28, height: 28, border: `2px solid ${C.border}`, borderTopColor: C.accent, borderRadius: '50%', margin: '0 auto 12px', animation: 'hunterSpin 0.8s linear infinite' }} />
      <div style={{ fontSize: 13, color: C.tertiary }}>{label}</div>
    </div>
  );

  /* ═══ LOADING ═══ */
  if (isPending) return (
    <div style={{ ...wrapStyle, padding: '48px 20px', textAlign: 'center' }}>
      <style>{KEYFRAMES}</style>
      <GrainOverlay />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <Starburst size={80} />
        <div style={{ fontSize: 15, fontWeight: 700, color: C.primary, marginTop: 16, letterSpacing: '-0.02em' }}>HunterAI</div>
        <div style={{ fontSize: 13, color: C.tertiary, marginTop: 6, animation: 'hunterPulse 1.5s ease-in-out infinite' }}>Loading...</div>
      </div>
    </div>
  );

  /* ═══ WELCOME — Website URL Input ═══ */
  if (!hasData && !local.draftEmail && local.activeView === 'website') return (
    <div style={wrapStyle}>
      <style>{KEYFRAMES}</style>
      <GrainOverlay />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <button onClick={() => setLocal(l => ({ ...l, activeView: 'welcome', scanError: null }))} style={backBtnStyle}>
          <span style={{ fontSize: 16 }}>&larr;</span> Back
        </button>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.tertiary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>HunterAI</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: C.primary, lineHeight: 1.3, letterSpacing: '-0.02em', marginBottom: 4 }}>
          Enter your website URL
        </div>
        <div style={{ fontSize: 13, color: C.secondary, marginBottom: 20, lineHeight: 1.5 }}>
          We'll scan your site to detect your tech stack and find matching credits.
        </div>
        {local.scanning ? (
          <Spinner label="Scanning website..." />
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              placeholder="e.g. mycompany.com"
              value={local.websiteUrl}
              onChange={e => setLocal(l => ({ ...l, websiteUrl: e.target.value, scanError: null }))}
              onKeyDown={e => e.key === 'Enter' && !local.scanning && handleScanWebsite()}
              autoFocus
              style={{
                flex: 1, padding: '12px 14px', border: `1px solid ${C.border}`, borderRadius: 8,
                background: C.elevated, color: C.primary, fontSize: 14, fontFamily: FONT, outline: 'none',
              }}
            />
            <button
              onClick={handleScanWebsite}
              disabled={!local.websiteUrl.trim()}
              style={{
                padding: '12px 20px', border: 'none', borderRadius: 8,
                background: C.btnPrimary, color: C.btnPriTx, fontSize: 14, fontWeight: 600,
                cursor: 'pointer', opacity: !local.websiteUrl.trim() ? 0.4 : 1, whiteSpace: 'nowrap',
              }}
            >
              Scan
            </button>
          </div>
        )}
        {local.scanError && (
          <div style={{ marginTop: 10, fontSize: 12, color: '#ef4444', lineHeight: 1.4 }}>{local.scanError}</div>
        )}
      </div>
    </div>
  );

  /* ═══ WELCOME — Statement Upload ═══ */
  if (!hasData && !local.draftEmail && local.activeView === 'statement') return (
    <div style={wrapStyle}>
      <style>{KEYFRAMES}</style>
      <GrainOverlay />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <button onClick={() => setLocal(l => ({ ...l, activeView: 'welcome', scanError: null }))} style={backBtnStyle}>
          <span style={{ fontSize: 16 }}>&larr;</span> Back
        </button>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.tertiary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>HunterAI</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: C.primary, lineHeight: 1.3, letterSpacing: '-0.02em', marginBottom: 4 }}>
          Upload your bank statement
        </div>
        <div style={{ fontSize: 13, color: C.secondary, marginBottom: 20, lineHeight: 1.5 }}>
          We'll detect your SaaS subscriptions and find matching credits.
        </div>
        {local.scanning ? (
          <Spinner label="Analyzing statement..." />
        ) : (
          <label style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
            padding: '32px 20px', border: `2px dashed ${C.border}`, borderRadius: 10,
            cursor: 'pointer', background: C.surface,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10, background: C.elevated,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
            }}>&#128196;</div>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.primary }}>Choose a PDF or CSV file</span>
            <span style={{ fontSize: 12, color: C.tertiary }}>Click to browse your files</span>
            <input type="file" accept=".pdf,.csv" onChange={handleFileUpload} style={{ display: 'none' }} />
          </label>
        )}
        {local.scanError && (
          <div style={{ marginTop: 10, fontSize: 12, color: '#ef4444', lineHeight: 1.4 }}>{local.scanError}</div>
        )}
      </div>
    </div>
  );

  /* ═══ WELCOME — Default (Two CTAs) ═══ */
  if (!hasData && !local.draftEmail) return (
    <div style={wrapStyle}>
      <GrainOverlay />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ marginBottom: 28, textAlign: 'center' }}>
          <Starburst size={100} />
          <div style={{ fontSize: 13, fontWeight: 700, color: C.tertiary, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 16 }}>HunterAI</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.primary, lineHeight: 1.3, letterSpacing: '-0.02em', marginTop: 8 }}>
            Find startup credits &amp; grants you're missing out on.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => setLocal(l => ({ ...l, activeView: 'website', scanError: null }))}
            style={{
              flex: 1, padding: '18px 16px', textAlign: 'left',
              background: C.surface, border: `1px solid ${C.accent}33`,
              borderRadius: 10, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8,
            }}
          >
            <span style={{ fontSize: 18 }}>&#127760;</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.primary, lineHeight: 1.3 }}>Scan my website</span>
            <span style={{ fontSize: 11, color: C.secondary, lineHeight: 1.4 }}>Auto-detect tech stack and find matching credits</span>
          </button>
          <button
            onClick={() => setLocal(l => ({ ...l, activeView: 'statement', scanError: null }))}
            style={{
              flex: 1, padding: '18px 16px', textAlign: 'left',
              background: C.surface, border: `1px solid ${C.border}`,
              borderRadius: 10, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8,
            }}
          >
            <span style={{ fontSize: 18 }}>&#128196;</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.primary, lineHeight: 1.3 }}>Upload bank statement</span>
            <span style={{ fontSize: 11, color: C.secondary, lineHeight: 1.4 }}>PDF or CSV to detect your SaaS subscriptions</span>
          </button>
        </div>
      </div>
    </div>
  );

  /* ═══ GMAIL CONNECT ═══ */
  if (local.draftEmail && !gmailConnected) return (
    <div style={wrapStyle}>
      <style>{KEYFRAMES}</style>
      <GrainOverlay />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <button onClick={() => setLocal(l => ({ ...l, draftEmail: null, gmailPolling: false }))} style={backBtnStyle}>
          <span style={{ fontSize: 16 }}>&larr;</span> Back
        </button>
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14, margin: '0 auto 16px',
            background: C.surface, border: `1px solid ${C.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
          }}>&#9993;</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.primary, marginBottom: 6, letterSpacing: '-0.02em' }}>Connect Gmail to apply</div>
          <div style={{ fontSize: 13, color: C.secondary, lineHeight: 1.5, maxWidth: 320, margin: '0 auto 20px' }}>
            We'll send an application email from your Gmail to <strong style={{ color: C.primary }}>{local.draftEmail.opportunity.program.name}</strong>
          </div>
          {gmailAuthUrl && !local.gmailPolling && (
            <a href={gmailAuthUrl} target="_blank" rel="noopener noreferrer" onClick={handleConnectGmail}
              style={{
                display: 'inline-block', padding: '12px 32px', borderRadius: 8,
                background: C.btnPrimary, color: C.btnPriTx, fontSize: 14, fontWeight: 600, textDecoration: 'none',
              }}>
              Connect Gmail
            </a>
          )}
          {local.gmailPolling && <Spinner label="Waiting for authorization..." />}
          {!gmailAuthUrl && !local.gmailPolling && (
            <div style={{ fontSize: 13, color: C.tertiary }}>Gmail auth URL not available. Try refreshing.</div>
          )}
        </div>
      </div>
    </div>
  );

  /* ═══ EMAIL DRAFT ═══ */
  if (local.draftEmail && gmailConnected) return (
    <div style={wrapStyle}>
      <GrainOverlay />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <button onClick={() => setLocal(l => ({ ...l, draftEmail: null }))} style={backBtnStyle}>
          <span style={{ fontSize: 16 }}>&larr;</span> Back
        </button>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.primary }}>Review application</div>
            <div style={{ fontSize: 12, color: C.tertiary, marginTop: 2 }}>{local.draftEmail.opportunity.program.name}</div>
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: C.accentText, fontFamily: MONO }}>{fmtCurrency(local.draftEmail.opportunity.potential_value)}</span>
        </div>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', marginBottom: 14 }}>
          <div style={{ padding: '10px 14px', borderBottom: `1px solid ${C.borderSub}`, display: 'flex', gap: 8 }}>
            <span style={{ fontSize: 11, color: C.tertiary, minWidth: 34, fontFamily: MONO }}>To</span>
            <span style={{ fontSize: 13, color: C.primary, fontWeight: 500 }}>{local.draftEmail.to}</span>
          </div>
          <div style={{ padding: '10px 14px', borderBottom: `1px solid ${C.borderSub}`, display: 'flex', gap: 8 }}>
            <span style={{ fontSize: 11, color: C.tertiary, minWidth: 34, fontFamily: MONO }}>Subj</span>
            <span style={{ fontSize: 13, color: C.primary, fontWeight: 500 }}>{local.draftEmail.subject}</span>
          </div>
          <div style={{ padding: '12px 14px', fontSize: 13, color: C.secondary, lineHeight: 1.65, whiteSpace: 'pre-wrap', maxHeight: 200, overflowY: 'auto' }}>{local.draftEmail.body}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleSendDraft} disabled={local.sendingEmail}
            style={{
              flex: 1, padding: '12px', border: 'none', borderRadius: 8,
              background: C.accent, color: '#fff', fontSize: 14, fontWeight: 600,
              cursor: 'pointer', opacity: local.sendingEmail ? 0.5 : 1,
            }}>
            {local.sendingEmail ? 'Sending...' : 'Send application'}
          </button>
          <button
            onClick={() => { const d = local.draftEmail!; sendFollowUpMessage(`Edit this email draft for ${d.opportunity.program.name} before sending. To: ${d.to}, Subject: ${d.subject}`); }}
            disabled={local.sendingEmail}
            style={{
              padding: '12px 18px', border: `1px solid ${C.btnSecBor}`, borderRadius: 8,
              background: C.btnSecBg, color: C.btnSecTx, fontSize: 13, fontWeight: 500, cursor: 'pointer',
            }}>
            Edit
          </button>
        </div>
      </div>
    </div>
  );

  /* ═══ DASHBOARD ═══ */
  const totalMonthlySpend = subs.reduce((s, x) => s + x.monthly_cost, 0);
  const appliedCount = emails.length;
  const sentForOpp = (opp: Opportunity) => emails.some(e => e.program_id === opp.program.id);

  return (
    <div style={wrapStyle}>
      <style>{KEYFRAMES}</style>
      <GrainOverlay />
      <div style={{ position: 'relative', zIndex: 1 }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: C.primary, letterSpacing: '-0.02em' }}>HunterAI</span>
            {profile && <span style={{ fontSize: 12, color: C.tertiary }}>{profile.name}</span>}
          </div>
          <button onClick={refreshData} disabled={local.loading}
            style={{ background: 'none', border: 'none', padding: '4px 6px', cursor: 'pointer', fontSize: 14, color: C.tertiary, opacity: local.loading ? 0.3 : 0.7, lineHeight: 1 }}>
            {local.loading ? '\u23f3' : '\u21bb'}
          </button>
        </div>

        {/* Subscription spend section */}
        {subs.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 13, color: C.secondary, marginBottom: 4 }}>Total spent</div>
              <div style={{ fontSize: 32, fontWeight: 700, color: C.primary, letterSpacing: '-0.03em', fontFamily: MONO, fontFeatureSettings: '"tnum"' }}>
                {fmtExact(totalMonthlySpend)}
              </div>
              <div style={{ fontSize: 10, color: C.tertiary, marginBottom: 16 }}>/month</div>
              <Starburst size={150} />
            </div>

            {/* Stack Breakdown header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: C.primary }}>Stack Breakdown</span>
              {opps.length === 0 && (
                <button
                  onClick={async () => { setLocal(l => ({ ...l, loading: true })); try { await callTool('find_opportunities', {}); await refreshData(); } catch {} setLocal(l => ({ ...l, loading: false })); }}
                  disabled={local.loading}
                  style={{
                    padding: '5px 12px', border: `1px solid ${C.btnSecBor}`, borderRadius: 4,
                    background: C.btnSecBg, color: C.btnSecTx, fontSize: 11, fontWeight: 600,
                    cursor: 'pointer', whiteSpace: 'nowrap',
                  }}>
                  {local.loading ? '...' : 'Find credits'}
                </button>
              )}
            </div>

            {/* Subscription rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {subs.map((sub, i) => (
                <div key={i} style={rowCardStyle}>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 6, height: 6, borderRadius: 2, background: CATEGORY_COLORS[sub.category] ?? CATEGORY_COLORS.other, flexShrink: 0 }} />
                    <span style={{ fontSize: 14, fontWeight: 500, color: C.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {sub.vendor}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: C.primary, fontFamily: MONO, fontFeatureSettings: '"tnum"' }}>
                      {fmtExact(sub.monthly_cost)}
                    </span>
                    <StatusDot />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Credits summary */}
        {(totalValue > 0 || opps.length > 0) && (
          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            marginBottom: 20, padding: '14px 16px', background: C.surface, borderRadius: 10, border: `1px solid ${C.border}`,
          }}>
            <div>
              <div style={{ fontSize: 28, fontWeight: 700, color: C.accentText, letterSpacing: '-0.03em', lineHeight: 1, fontFamily: MONO, fontFeatureSettings: '"tnum"' }}>
                {totalValue > 0 ? `$${(totalValue / 1000).toFixed(totalValue % 1000 === 0 ? 0 : 1)}K` : '$0'}
              </div>
              <div style={{ fontSize: 12, color: C.secondary, marginTop: 4 }}>credits available</div>
            </div>
            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: C.primary, fontFamily: MONO }}>{opps.length}</div>
                <div style={{ fontSize: 9, color: C.tertiary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Found</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: appliedCount > 0 ? C.accentText : C.muted, fontFamily: MONO }}>{appliedCount}</div>
                <div style={{ fontSize: 9, color: C.tertiary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Applied</div>
              </div>
            </div>
          </div>
        )}

        {/* Find credits CTA */}
        {subs.length > 0 && opps.length === 0 && !totalValue && (
          <button
            onClick={async () => { setLocal(l => ({ ...l, loading: true })); try { await callTool('find_opportunities', {}); await refreshData(); } catch {} setLocal(l => ({ ...l, loading: false })); }}
            disabled={local.loading}
            style={{
              width: '100%', padding: '14px 16px', marginBottom: 16, background: C.accentSoft,
              border: `1px solid ${C.accent}`, borderRadius: 8, cursor: 'pointer',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.accentText }}>{local.loading ? 'Searching...' : 'Find credits for these tools'}</span>
            {!local.loading && <span style={{ fontSize: 16, color: C.accentText }}>&rarr;</span>}
          </button>
        )}

        {/* Apply all easy CTA */}
        {easyOpps.length > 0 && appliedCount === 0 && (
          <div style={{
            padding: '12px 16px', background: C.accentSoft, borderRadius: 8,
            marginBottom: 16, borderLeft: `3px solid ${C.accent}`,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
          }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: C.primary }}>{easyOpps.length} easy application{easyOpps.length !== 1 ? 's' : ''} ready</span>
            <button onClick={handleApplyAll} disabled={local.loading || local.applyingId !== null}
              style={{
                padding: '8px 16px', border: 'none', borderRadius: 6,
                background: C.btnPrimary, color: C.btnPriTx, fontSize: 12, fontWeight: 600,
                cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
              }}>
              Start applying
            </button>
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
            <div key={group.label} style={{ marginBottom: 14 }}>
              <div style={{
                fontSize: 11, fontWeight: 600, color: C.tertiary, textTransform: 'uppercase',
                letterSpacing: '0.06em', padding: '6px 2px',
              }}>
                {group.label} ({group.items.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {shown.map(opp => {
                  const isSent = sentForOpp(opp);
                  const ec = effortConfig[opp.effort] ?? effortConfig.medium;
                  return (
                    <div key={opp.id} style={{ ...rowCardStyle, padding: '10px 14px' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: C.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opp.program.name}</span>
                          {opp.program.verified && <span style={{ fontSize: 9, color: C.accent, flexShrink: 0 }}>&#10003;</span>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 10, color: C.secondary, background: C.elevated, padding: '1px 5px', borderRadius: 3 }}>
                            {typeLabels[opp.program.type] ?? 'Program'}
                          </span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                            {[1, 2, 3].map(i => (
                              <span key={i} style={{ width: 3, height: 3, borderRadius: '50%', background: i <= ec.dots ? C.secondary : C.muted }} />
                            ))}
                            <span style={{ fontSize: 9, color: C.tertiary, marginLeft: 2 }}>{ec.text}</span>
                          </span>
                          <span style={{ fontSize: 9, color: C.tertiary }}>{opp.program.vendor}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: C.primary, fontFamily: MONO, fontFeatureSettings: '"tnum"' }}>
                          {fmtCurrency(opp.potential_value, opp.program.currency)}
                        </span>
                        {isSent ? (
                          <StatusDot active={true} />
                        ) : (
                          <button
                            onClick={() => handleApplyOne(opp)}
                            disabled={local.applyingId !== null}
                            style={{
                              padding: '4px 10px', border: `1px solid ${C.btnSecBor}`, borderRadius: 6,
                              background: C.btnSecBg, color: C.btnSecTx, fontSize: 11, fontWeight: 500,
                              cursor: 'pointer', opacity: local.applyingId === opp.id ? 0.4 : 1, whiteSpace: 'nowrap',
                            }}>
                            {local.applyingId === opp.id ? '...' : opp.program.type === 'incubator_portal' ? 'View' : 'Apply'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {!local.showAllOpps && group.items.length > 5 && (
                <button onClick={() => setLocal(l => ({ ...l, showAllOpps: true }))}
                  style={{ marginTop: 4, width: '100%', padding: '6px', background: 'transparent', border: 'none', fontSize: 12, color: C.tertiary, cursor: 'pointer', fontWeight: 500 }}>
                  Show {group.items.length - 5} more
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) return (
      <div style={{ padding: 32, textAlign: 'center', fontFamily: FONT, background: C.bg, borderRadius: 16, color: C.primary }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Something went wrong</div>
        <div style={{ fontSize: 13, color: C.secondary }}>{this.state.error.message}</div>
      </div>
    );
    return this.props.children;
  }
}

export default function HunterAIDashboard() {
  return <McpUseProvider><ErrorBoundary><HunterAIDashboardInner /></ErrorBoundary></McpUseProvider>;
}
