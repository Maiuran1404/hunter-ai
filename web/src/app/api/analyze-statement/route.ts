import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { randomUUID } from 'crypto';
import { getState, mergeSubscriptions, logActivity, ensureProfileFromSubscriptions } from '@/lib/state';
import type { Subscription } from '@/lib/types';

const anthropic = new Anthropic();

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');

    const maxSize = 10 * 1024 * 1024;
    if (base64.length > maxSize) {
      return NextResponse.json({ error: 'PDF too large (max 10MB)' }, { status: 400 });
    }

    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
          { type: 'text', text: 'List all recurring software subscriptions. Return JSON array: [{vendor,monthly_cost,account_email?}]. Only JSON, no explanation.' },
        ],
      }],
    });

    const text = msg.content[0].type === 'text' ? msg.content[0].text : '[]';
    let raw: Array<{ vendor: string; monthly_cost: number; account_email?: string }>;
    try {
      raw = JSON.parse(text.replace(/```json|```/g, '').trim());
    } catch {
      return NextResponse.json({ error: 'Failed to parse AI response. The statement may not contain recognizable subscriptions.' }, { status: 422 });
    }

    const subs: Subscription[] = raw.map(r => ({
      id: randomUUID(),
      vendor: r.vendor,
      normalized_name: r.vendor.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      monthly_cost: r.monthly_cost,
      account_email: r.account_email,
      category: 'other' as const,
      confidence: 0.85,
      source: 'pdf' as const,
    }));

    mergeSubscriptions(subs);
    ensureProfileFromSubscriptions();
    logActivity('statement_analyzed', `Analyzed statement: found ${subs.length} subscriptions`, { count: subs.length });

    return NextResponse.json({
      found: subs.length,
      total_monthly: subs.reduce((s, x) => s + x.monthly_cost, 0),
      subscriptions: subs,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
