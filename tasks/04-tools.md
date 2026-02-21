# Task 04 — Core Tools

## What this creates
- `src/tools/analyze-statement.ts`
- `src/tools/find-opportunities.ts`
- `src/tools/draft-email.ts`
- `src/tools/save-profile.ts`

## DON'T
- Don't import demo data inline — all demo data lives in the tool
- Don't use `any` type
- Don't duplicate isDemoMode check — `import { isDemoMode } from '../state.js'`
- Every tool response MUST include a `suggestions` array

---

## src/tools/analyze-statement.ts
```typescript
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { state, isDemoMode } from '../state.js';
import { randomUUID } from 'crypto';
import type { Subscription } from '../types.js';

const anthropic = new Anthropic();

export async function analyzeStatementTool(input: {
  pdf_base64?: string;
  filename?: string;
  demo_mode?: boolean;
}) {
  if (isDemoMode(input.demo_mode)) {
    const demo: Subscription[] = [
      { id: randomUUID(), vendor: 'AWS', normalized_name: 'aws', monthly_cost: 2400, category: 'infrastructure', confidence: 0.95, source: 'demo' },
      { id: randomUUID(), vendor: 'Anthropic', normalized_name: 'anthropic', monthly_cost: 1800, category: 'infrastructure', confidence: 0.95, source: 'demo' },
      { id: randomUUID(), vendor: 'Vercel', normalized_name: 'vercel', monthly_cost: 200, category: 'infrastructure', confidence: 0.9, source: 'demo' },
      { id: randomUUID(), vendor: 'Linear', normalized_name: 'linear', monthly_cost: 80, category: 'productivity', confidence: 0.9, source: 'demo' },
      { id: randomUUID(), vendor: 'GitHub', normalized_name: 'github', monthly_cost: 100, category: 'productivity', confidence: 0.9, source: 'demo' },
      { id: randomUUID(), vendor: 'Figma', normalized_name: 'figma', monthly_cost: 150, category: 'design', confidence: 0.85, source: 'demo' },
    ];
    state.subscriptions = demo;
    const total = demo.reduce((s, x) => s + x.monthly_cost, 0);
    return {
      found: demo.length, total_monthly: total,
      subscriptions: demo,
      suggestions: [
        { label: '🔍 Find all credits I qualify for', sub: `${demo.length} subs to match`, primary: true },
        { label: '📊 Show dashboard', sub: '' },
      ]
    };
  }

  if (!input.pdf_base64) throw new Error('No PDF data provided');
  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001', max_tokens: 1500,
    messages: [{ role: 'user', content: [
      { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: input.pdf_base64 } },
      { type: 'text', text: 'List all recurring software subscriptions. Return JSON array: [{vendor,monthly_cost,account_email?}]. Only JSON, no explanation.' }
    ]}]
  });
  const text = msg.content[0].type === 'text' ? msg.content[0].text : '[]';
  const raw = JSON.parse(text.replace(/```json|```/g, '').trim());
  const subs: Subscription[] = raw.map((r: {vendor: string; monthly_cost: number; account_email?: string}) => ({
    id: randomUUID(), vendor: r.vendor,
    normalized_name: r.vendor.toLowerCase().replace(/[^a-z0-9]/g, '-'),
    monthly_cost: r.monthly_cost, account_email: r.account_email,
    category: 'other' as const, confidence: 0.85, source: 'pdf' as const,
  }));
  state.subscriptions = subs;
  return {
    found: subs.length, total_monthly: subs.reduce((s, x) => s + x.monthly_cost, 0),
    subscriptions: subs,
    suggestions: [
      { label: '🔍 Find credits I qualify for', sub: '', primary: true },
    ]
  };
}

export const analyzeStatementSchema = z.object({
  pdf_base64: z.string().optional(),
  filename: z.string().optional(),
  demo_mode: z.boolean().optional(),
});
```

## src/tools/find-opportunities.ts
```typescript
import { z } from 'zod';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { state, isDemoMode } from '../state.js';
import { randomUUID } from 'crypto';
import type { DiscountProgram, Opportunity } from '../types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadPrograms(): DiscountProgram[] {
  return JSON.parse(readFileSync(join(__dirname, '../../src/data/programs.json'), 'utf8'));
}

function meetsEligibility(p: DiscountProgram, profile: NonNullable<typeof state.profile>): boolean {
  const e = p.eligibility;
  if (e.max_arr && profile.monthly_arr * 12 > e.max_arr) return false;
  if (e.max_team_size && profile.team_size > e.max_team_size) return false;
  if (e.geographies?.length && !e.geographies.includes(profile.geography)) return false;
  if (e.requires_incubator && !profile.incubators.length) return false;
  if (e.incubators?.length && !e.incubators.some(i => profile.incubators.includes(i))) return false;
  if (e.requires_vendors?.length && !e.requires_vendors.some(v =>
    state.subscriptions.some(s => s.normalized_name.includes(v.toLowerCase())))) return false;
  if (e.requires_identities?.length && profile.founder_identities) {
    const match = e.requires_any_identity !== false
      ? e.requires_identities.some(id => profile.founder_identities!.includes(id))
      : e.requires_identities.every(id => profile.founder_identities!.includes(id));
    if (!match) return false;
  } else if (e.requires_identities?.length && !profile.founder_identities?.length) return false;
  return true;
}

export async function findOpportunitiesTool(input: { demo_mode?: boolean }) {
  if (!state.profile) throw new Error('No company profile. Call save_company_profile first.');
  const programs = loadPrograms();
  const opps: Opportunity[] = [];

  for (const p of programs) {
    if (!meetsEligibility(p, state.profile)) continue;
    const matchedSub = state.subscriptions.find(s =>
      s.normalized_name.includes(p.vendor.toLowerCase()) ||
      p.vendor.toLowerCase().includes(s.normalized_name)
    );
    const effort: 'low'|'medium'|'high' =
      p.application_type === 'form' ? 'low' :
      p.application_type === 'email' ? 'low' :
      p.type === 'negotiation' ? 'high' : 'medium';

    opps.push({
      id: randomUUID(), program: p,
      potential_value: p.potential_value, confidence: matchedSub ? 0.9 : 0.75,
      effort,
      reasoning: matchedSub
        ? `You use ${matchedSub.vendor} ($${matchedSub.monthly_cost}/mo) — qualify for their startup program`
        : `Profile matches ${p.name} eligibility`,
      matched_subscription: matchedSub?.vendor,
    });
  }

  opps.sort((a, b) => b.potential_value - a.potential_value);
  state.opportunities = opps;
  const totalValue = opps.reduce((s, o) => s + o.potential_value, 0);
  const portalCount = opps.filter(o => o.program.type === 'incubator_portal').length;

  return {
    found: opps.length, total_potential_value: totalValue,
    opportunities: opps,
    portal_count: portalCount,
    suggestions: [
      { label: `🚀 Apply to all ${opps.filter(o=>o.effort==='low').length} easy ones`, sub: 'form + email apps', primary: true },
      { label: '🇳🇴 Focus Norwegian grants', sub: `${opps.filter(o=>o.program.type==='government_grant').length} programs` },
      { label: '📋 Review each opportunity', sub: '' },
      portalCount > 0 ? { label: `🔗 ${portalCount} portal programs`, sub: 'need manual access' } : null,
    ].filter(Boolean),
  };
}

export const findOpportunitiesSchema = z.object({
  demo_mode: z.boolean().optional(),
});
```

## src/tools/draft-email.ts
```typescript
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { state, isDemoMode } from '../state.js';
import type { EmailDraft } from '../types.js';

const anthropic = new Anthropic();

export async function draftEmailTool(input: {
  opportunity_id: string;
  demo_mode?: boolean;
}): Promise<EmailDraft & { suggestions: unknown[] }> {
  const opp = state.opportunities.find(o => o.id === input.opportunity_id);
  if (!opp) throw new Error(`Opportunity ${input.opportunity_id} not found`);
  const profile = state.profile;
  if (!profile) throw new Error('No company profile');

  if (isDemoMode(input.demo_mode) || !process.env.ANTHROPIC_API_KEY?.startsWith('sk-ant-api')) {
    return {
      to: opp.program.sales_email || `startups@${opp.program.vendor.toLowerCase()}.com`,
      subject: `Startup Program Application — ${profile.name}`,
      body: `Hi ${opp.program.vendor} team,\n\nI'm ${profile.founder_name || 'the founder'} of ${profile.name}, an Antler-backed ${profile.stage} startup.\n\nWe're currently using ${opp.program.vendor} and would love to apply for your startup program. We have ${profile.team_size} people and ${profile.incubators.join(', ')} backing.\n\nWould you be able to connect us with your startup credits program?\n\nBest,\n${profile.founder_name || 'The Team'}\n${profile.contact_email || ''}`,
      vendor: opp.program.vendor,
      estimated_savings: opp.potential_value,
      suggestions: [
        { label: '📨 Send this email', sub: '', primary: true },
        { label: '✏️ Edit before sending', sub: '' },
      ]
    };
  }

  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001', max_tokens: 500,
    messages: [{ role: 'user', content: `Write a concise startup program application email.
Company: ${profile.name}, ${profile.stage}, ${profile.team_size} people
Incubators: ${profile.incubators.join(', ')}
ARR: $${profile.monthly_arr * 12}/yr
Program: ${opp.program.name} (${opp.program.vendor})
Reasoning: ${opp.reasoning}
Return ONLY the email body (no subject line). Under 120 words. Warm, professional.` }]
  });

  const body = msg.content[0].type === 'text' ? msg.content[0].text : '';
  return {
    to: opp.program.sales_email || `startups@${opp.program.vendor.toLowerCase()}.com`,
    subject: `Startup Program Application — ${profile.name}`,
    body, vendor: opp.program.vendor, estimated_savings: opp.potential_value,
    suggestions: [
      { label: '📨 Send this email', sub: '', primary: true },
      { label: '✏️ Edit before sending', sub: '' },
    ]
  };
}

export const draftEmailSchema = z.object({
  opportunity_id: z.string(),
  demo_mode: z.boolean().optional(),
});
```

## src/tools/save-profile.ts
```typescript
import { z } from 'zod';
import { state } from '../state.js';
import type { CompanyProfile } from '../types.js';

export async function saveProfileTool(input: Partial<CompanyProfile> & { demo_mode?: boolean }) {
  const { demo_mode, ...profileData } = input;
  const existing = state.profile || {};
  state.profile = { ...existing, ...profileData } as CompanyProfile;
  return {
    saved: true, profile: state.profile,
    suggestions: [
      { label: '🔍 Find opportunities now', sub: '', primary: true },
      { label: '📊 Show dashboard', sub: '' },
    ]
  };
}

export const saveProfileSchema = z.object({
  name: z.string().optional(),
  website: z.string().optional(),
  stage: z.enum(['pre-seed','seed','series-a','growth']).optional(),
  team_size: z.number().optional(),
  monthly_arr: z.number().optional(),
  incubators: z.array(z.string()).optional(),
  geography: z.string().optional(),
  tech_stack: z.array(z.string()).optional(),
  contact_email: z.string().optional(),
  founder_name: z.string().optional(),
  founder_identities: z.array(z.string()).optional(),
  demo_mode: z.boolean().optional(),
});
```

## Verify
```bash
npm run build
# Expected: TypeScript OK
```
