import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { getState, logActivity } from '@/lib/state';
import type { DiscountProgram, Opportunity } from '@/lib/types';

let cachedPrograms: DiscountProgram[] | null = null;
function loadPrograms(): DiscountProgram[] {
  if (!cachedPrograms) {
    const p = path.join(process.cwd(), 'src/data/programs.json');
    cachedPrograms = JSON.parse(readFileSync(p, 'utf8'));
  }
  return cachedPrograms!;
}

export async function POST() {
  try {
    const state = getState();

    if (!state.profile) {
      const techStack = state.subscriptions.map(s => s.vendor);
      state.profile = {
        name: 'My Startup', stage: 'seed', team_size: 5, monthly_arr: 0,
        incubators: [], geography: '', tech_stack: techStack,
      };
    }

    const programs = loadPrograms();
    const profile = state.profile;
    const opps: Opportunity[] = [];

    for (const p of programs) {
      const e = p.eligibility;
      if (e.max_arr && profile.monthly_arr > 0 && profile.monthly_arr * 12 > e.max_arr) continue;
      if (e.max_team_size && profile.team_size > 0 && profile.team_size > e.max_team_size) continue;
      if (e.geographies?.length && profile.geography && !e.geographies.includes(profile.geography)) continue;
      if (e.requires_incubator && !profile.incubators?.length) continue;
      if (e.incubators?.length && !e.incubators.some(i => (profile.incubators ?? []).includes(i))) continue;
      if (e.requires_vendors?.length && !e.requires_vendors.some(v =>
        state.subscriptions.some(s => s.normalized_name.includes(v.toLowerCase())))) continue;
      if (e.requires_identities?.length && profile.founder_identities) {
        const match = e.requires_any_identity !== false
          ? e.requires_identities.some(id => profile.founder_identities!.includes(id))
          : e.requires_identities.every(id => profile.founder_identities!.includes(id));
        if (!match) continue;
      } else if (e.requires_identities?.length && !profile.founder_identities?.length) continue;

      const vendorLower = p.vendor.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const matchedSub = state.subscriptions.find(s =>
        s.normalized_name === vendorLower ||
        s.normalized_name.includes(vendorLower) ||
        vendorLower.includes(s.normalized_name)
      );

      const effort: 'low' | 'medium' | 'high' =
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
    const totalValue = opps.reduce((s, o) => s + o.potential_value, 0);
    logActivity('opportunity_found', `Found ${opps.length} opportunities worth $${totalValue.toLocaleString()}`, { count: opps.length });

    return NextResponse.json({
      found: opps.length,
      total_potential_value: totalValue,
      opportunities: opps,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
