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
