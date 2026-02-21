import { z } from 'zod';
import { state } from '../state.js';
import type { CompanyProfile } from '../types.js';

export async function saveProfileTool(input: Record<string, unknown> & { demo_mode?: boolean }) {
  const { demo_mode, ...profileData } = input;
  const defaults: CompanyProfile = {
    name: '',
    stage: 'pre-seed',
    team_size: 1,
    monthly_arr: 0,
    incubators: [],
    geography: '',
    tech_stack: [],
  };
  const existing = state.profile || defaults;
  state.profile = { ...defaults, ...existing, ...profileData } as CompanyProfile;
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
