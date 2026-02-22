import { NextRequest, NextResponse } from 'next/server';
import { getState, logActivity } from '@/lib/state';
import type { CompanyProfile } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const input = await request.json();
    const state = getState();

    const defaults: CompanyProfile = {
      name: '', stage: 'pre-seed', team_size: 1, monthly_arr: 0,
      incubators: [], geography: '', tech_stack: [],
    };
    const existing = state.profile || defaults;
    state.profile = { ...defaults, ...existing, ...input } as CompanyProfile;
    logActivity('profile_saved', `Profile saved for ${state.profile.name || 'company'}`, { name: state.profile.name });

    return NextResponse.json({ saved: true, profile: state.profile });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
