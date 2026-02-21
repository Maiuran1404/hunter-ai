import { z } from 'zod';
import { state, logActivity } from '../state.js';
import type { CompanyProfile } from '../types.js';

interface SaveProfileInput {
  name?: string;
  website?: string;
  stage?: 'pre-seed' | 'seed' | 'series-a' | 'growth';
  team_size?: number;
  monthly_arr?: number;
  incubators?: string[];
  geography?: string;
  tech_stack?: string[];
  contact_email?: string;
  founder_name?: string;
  founder_identities?: string[];
}

export async function saveProfileTool(input: SaveProfileInput) {
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
  state.profile = { ...defaults, ...existing, ...input } as CompanyProfile;
  logActivity('profile_saved', `Profile saved for ${state.profile.name || 'company'}`, { name: state.profile.name });
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
  website: z.string().optional().transform(v => {
    if (!v) return v;
    if (!/^https?:\/\//i.test(v)) return `https://${v}`;
    return v;
  }),
  stage: z.enum(['pre-seed','seed','series-a','growth']).optional(),
  team_size: z.number().int().min(1).optional(),
  monthly_arr: z.number().min(0).optional(),
  incubators: z.array(z.string()).optional(),
  geography: z.string().optional(),
  tech_stack: z.array(z.string()).optional(),
  contact_email: z.string().email().optional(),
  founder_name: z.string().optional(),
  founder_identities: z.array(z.string()).optional(),
});
