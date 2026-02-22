import { z } from 'zod';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { state, isDemoMode, logActivity } from '../state.js';
import { randomUUID } from 'crypto';
import type { DiscountProgram, Opportunity } from '../types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

let cachedPrograms: DiscountProgram[] | null = null;
function loadPrograms(): DiscountProgram[] {
  if (!cachedPrograms) {
    // Try multiple paths to work in both dev (src/tools/) and prod (dist/src/tools/)
    const candidates = [
      join(__dirname, '../data/programs.json'),       // dev: src/tools/../data/
      join(__dirname, '../../src/data/programs.json'), // dev fallback
      join(process.cwd(), 'src/data/programs.json'),  // prod: from project root
    ];
    let loaded = false;
    for (const p of candidates) {
      try {
        cachedPrograms = JSON.parse(readFileSync(p, 'utf8'));
        loaded = true;
        break;
      } catch { /* try next path */ }
    }
    if (!loaded) throw new Error('Could not find programs.json');
  }
  return cachedPrograms!;
}

function meetsEligibility(p: DiscountProgram, profile: NonNullable<typeof state.profile>): boolean {
  const e = p.eligibility;
  // When profile fields are empty/zero, skip those checks (permissive matching)
  if (e.max_arr && profile.monthly_arr > 0 && profile.monthly_arr * 12 > e.max_arr) return false;
  if (e.max_team_size && profile.team_size > 0 && profile.team_size > e.max_team_size) return false;
  if (e.geographies?.length && profile.geography && !e.geographies.includes(profile.geography)) return false;
  if (e.requires_incubator && !profile.incubators?.length) return false;
  if (e.incubators?.length && !e.incubators.some(i => (profile.incubators ?? []).includes(i))) return false;
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
  if (!state.profile && isDemoMode(input.demo_mode)) {
    // Auto-populate a demo profile so users can try the tool without setup
    state.profile = {
      name: 'Demo Startup', stage: 'seed', team_size: 5, monthly_arr: 1000,
      incubators: ['Antler'], geography: 'Norway', tech_stack: ['React', 'Node.js'],
      contact_email: 'founder@demo.com', founder_name: 'Demo Founder',
    };
  }
  if (!state.profile) {
    // Auto-create a permissive default profile from detected subscriptions
    // so find_opportunities works without requiring save_company_profile first
    const techStack = state.subscriptions.map(s => s.vendor);
    state.profile = {
      name: 'My Startup', stage: 'seed', team_size: 5, monthly_arr: 0,
      incubators: [], geography: '', tech_stack: techStack,
    };
  }
  const programs = loadPrograms();
  const opps: Opportunity[] = [];

  for (const p of programs) {
    if (!meetsEligibility(p, state.profile)) continue;
    const vendorLower = p.vendor.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const matchedSub = state.subscriptions.find(s =>
      s.normalized_name === vendorLower ||
      s.normalized_name.includes(vendorLower) ||
      vendorLower.includes(s.normalized_name)
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
      matched_monthly_cost: matchedSub?.monthly_cost,
    });
  }

  opps.sort((a, b) => b.potential_value - a.potential_value);
  state.opportunities = opps;
  logActivity('opportunity_found', `Found ${opps.length} opportunities worth $${opps.reduce((s, o) => s + o.potential_value, 0).toLocaleString()}`, { count: opps.length });
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
