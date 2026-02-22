import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getState } from '@/lib/state';

const anthropic = new Anthropic();

export async function POST(request: NextRequest) {
  try {
    const { opportunity_id } = await request.json();
    const state = getState();
    const opp = state.opportunities.find(o => o.id === opportunity_id);
    if (!opp) return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 });

    const profile = state.profile;
    if (!profile) return NextResponse.json({ error: 'No company profile' }, { status: 400 });

    let body: string;
    try {
      const msg = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: `Write a concise startup program application email.
Company: ${profile.name}, ${profile.stage}, ${profile.team_size} people
Founder: ${profile.founder_name || 'the team'}
Contact email: ${profile.contact_email || ''}
Incubators: ${(profile.incubators ?? []).join(', ') || 'none'}
ARR: $${profile.monthly_arr * 12}/yr
Program: ${opp.program.name} (${opp.program.vendor})
Reasoning: ${opp.reasoning}
Return ONLY the email body (no subject line). Under 120 words. Warm, professional.
Sign off with the founder's actual name "${profile.founder_name || profile.name}". NEVER use placeholders like [Your name], [Your Product], [Company], etc. — always use the real values provided above.`,
        }],
      });
      body = msg.content[0].type === 'text' ? msg.content[0].text : '';
    } catch {
      const founderName = profile.founder_name || 'The Team';
      const incubatorLine = profile.incubators?.length ? `We're backed by ${profile.incubators.join(' and ')}.` : '';
      body = `Hi ${opp.program.vendor} team,\n\nI'm ${founderName}, founder of ${profile.name}. We're a ${profile.stage}-stage startup with a team of ${profile.team_size || 'a few'} building in the ${opp.program.vendor} ecosystem.\n\n${incubatorLine}\n\nWe'd love to apply for ${opp.program.name}. ${opp.reasoning}\n\nCould you point us to the right application process?\n\nBest,\n${founderName}${profile.contact_email ? `\n${profile.contact_email}` : ''}`;
    }

    return NextResponse.json({
      to: opp.program.sales_email || `startups@${opp.program.vendor.toLowerCase()}.com`,
      subject: `Startup Program Application — ${profile.name}`,
      body,
      vendor: opp.program.vendor,
      estimated_savings: opp.potential_value,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
