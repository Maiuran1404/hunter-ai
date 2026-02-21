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

  if (isDemoMode(input.demo_mode)) {
    return {
      to: opp.program.sales_email || `startups@${opp.program.vendor.toLowerCase()}.com`,
      subject: `Startup Program Application — ${profile.name}`,
      body: `Hi ${opp.program.vendor} team,\n\nI'm ${profile.founder_name || 'the founder'} of ${profile.name}, an Antler-backed ${profile.stage} startup.\n\nWe're currently using ${opp.program.vendor} and would love to apply for your startup program. We have ${profile.team_size || 'a small'} people${profile.incubators?.length ? ` and ${profile.incubators.join(', ')} backing` : ''}.\n\nWould you be able to connect us with your startup credits program?\n\nBest,\n${profile.founder_name || 'The Team'}\n${profile.contact_email || ''}`,
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
Incubators: ${(profile.incubators ?? []).join(', ') || 'none'}
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
