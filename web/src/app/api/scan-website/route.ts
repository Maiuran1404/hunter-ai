import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { mergeSubscriptions, logActivity } from '@/lib/state';
import type { Subscription } from '@/lib/types';

interface TechSignature {
  vendor: string;
  normalized_name: string;
  category: Subscription['category'];
  scripts?: RegExp[];
  html?: RegExp[];
  headers?: string[];
  estimated_monthly_cost: number;
}

const TECH_SIGNATURES: TechSignature[] = [
  { vendor: 'AWS', normalized_name: 'aws', category: 'infrastructure', scripts: [/\.amazonaws\.com/i], html: [/cloudfront\.net/i, /s3\.amazonaws\.com/i, /\.aws\./i], headers: ['amazons3', 'cloudfront', 'amazonwebservices'], estimated_monthly_cost: 500 },
  { vendor: 'Google Cloud', normalized_name: 'google-cloud', category: 'infrastructure', html: [/googleapis\.com/i, /storage\.googleapis\.com/i, /\.run\.app/i, /appspot\.com/i], headers: ['gse', 'google'], estimated_monthly_cost: 400 },
  { vendor: 'Azure', normalized_name: 'azure', category: 'infrastructure', html: [/\.azure\.com/i, /\.azurewebsites\.net/i, /\.blob\.core\.windows\.net/i, /\.azureedge\.net/i], headers: ['microsoft-azure'], estimated_monthly_cost: 400 },
  { vendor: 'Vercel', normalized_name: 'vercel', category: 'infrastructure', html: [/vercel\.app/i, /vercel\.com/i, /_next\//i, /v0\.dev/i], headers: ['vercel'], estimated_monthly_cost: 20 },
  { vendor: 'Netlify', normalized_name: 'netlify', category: 'infrastructure', html: [/netlify\.app/i, /netlify\.com/i, /netlify-identity/i], headers: ['netlify'], estimated_monthly_cost: 20 },
  { vendor: 'Heroku', normalized_name: 'heroku', category: 'infrastructure', html: [/herokuapp\.com/i, /heroku/i], estimated_monthly_cost: 25 },
  { vendor: 'Cloudflare', normalized_name: 'cloudflare', category: 'infrastructure', scripts: [/cdnjs\.cloudflare\.com/i, /cloudflareinsights\.com/i], html: [/cloudflare/i], headers: ['cloudflare'], estimated_monthly_cost: 20 },
  { vendor: 'DigitalOcean', normalized_name: 'digitalocean', category: 'infrastructure', html: [/digitalocean\.com/i, /\.digitaloceanspaces\.com/i], estimated_monthly_cost: 50 },
  { vendor: 'Supabase', normalized_name: 'supabase', category: 'infrastructure', scripts: [/supabase/i], html: [/supabase\.co/i, /supabase\.com/i], estimated_monthly_cost: 25 },
  { vendor: 'Firebase', normalized_name: 'firebase', category: 'infrastructure', scripts: [/firebase/i, /firebaseapp\.com/i], html: [/firebaseio\.com/i, /firebase\.google\.com/i], estimated_monthly_cost: 25 },
  { vendor: 'MongoDB', normalized_name: 'mongodb', category: 'infrastructure', html: [/mongodb\.com/i, /\.mongodb\.net/i], estimated_monthly_cost: 50 },
  { vendor: 'Google Analytics', normalized_name: 'google-analytics', category: 'analytics', scripts: [/google-analytics\.com/i, /googletagmanager\.com/i, /gtag/i], html: [/UA-\d{4,10}/i, /G-[A-Z0-9]{8,12}/i, /GTM-[A-Z0-9]{4,8}/i], estimated_monthly_cost: 0 },
  { vendor: 'Segment', normalized_name: 'segment', category: 'analytics', scripts: [/cdn\.segment\.com/i, /segment\.io/i], html: [/analytics\.js/i, /segment/i], estimated_monthly_cost: 120 },
  { vendor: 'Mixpanel', normalized_name: 'mixpanel', category: 'analytics', scripts: [/mixpanel\.com/i, /cdn\.mxpnl\.com/i], estimated_monthly_cost: 25 },
  { vendor: 'Amplitude', normalized_name: 'amplitude', category: 'analytics', scripts: [/amplitude\.com/i, /cdn\.amplitude\.com/i], estimated_monthly_cost: 50 },
  { vendor: 'Hotjar', normalized_name: 'hotjar', category: 'analytics', scripts: [/hotjar\.com/i, /static\.hotjar\.com/i], estimated_monthly_cost: 40 },
  { vendor: 'PostHog', normalized_name: 'posthog', category: 'analytics', scripts: [/posthog\.com/i, /app\.posthog\.com/i], html: [/posthog/i], estimated_monthly_cost: 0 },
  { vendor: 'Datadog', normalized_name: 'datadog', category: 'analytics', scripts: [/datadoghq\.com/i, /dd-rum/i, /datadog/i], estimated_monthly_cost: 100 },
  { vendor: 'Intercom', normalized_name: 'intercom', category: 'productivity', scripts: [/intercom\.io/i, /widget\.intercom\.io/i, /intercomcdn\.com/i], html: [/intercom-app-id/i], estimated_monthly_cost: 74 },
  { vendor: 'Zendesk', normalized_name: 'zendesk', category: 'productivity', scripts: [/zdassets\.com/i, /zendesk\.com/i], html: [/zendesk/i], estimated_monthly_cost: 50 },
  { vendor: 'HubSpot', normalized_name: 'hubspot', category: 'productivity', scripts: [/hubspot\.com/i, /hs-scripts\.com/i, /hsforms\.com/i, /hbspt/i], html: [/hubspot/i, /hs-script-loader/i], estimated_monthly_cost: 50 },
  { vendor: 'Crisp', normalized_name: 'crisp', category: 'productivity', scripts: [/crisp\.chat/i, /client\.crisp\.chat/i], estimated_monthly_cost: 25 },
  { vendor: 'Salesforce', normalized_name: 'salesforce', category: 'productivity', scripts: [/force\.com/i, /salesforce\.com/i, /pardot\.com/i], html: [/salesforce/i], estimated_monthly_cost: 150 },
  { vendor: 'Stripe', normalized_name: 'stripe', category: 'infrastructure', scripts: [/js\.stripe\.com/i, /stripe\.com/i], html: [/stripe/i], estimated_monthly_cost: 100 },
  { vendor: 'SendGrid', normalized_name: 'sendgrid', category: 'productivity', html: [/sendgrid\.net/i, /sendgrid\.com/i], estimated_monthly_cost: 20 },
  { vendor: 'Mailchimp', normalized_name: 'mailchimp', category: 'productivity', scripts: [/mailchimp\.com/i, /chimpstatic\.com/i, /list-manage\.com/i], html: [/mailchimp/i, /mc\.us\d+\.list-manage/i], estimated_monthly_cost: 20 },
  { vendor: 'Sentry', normalized_name: 'sentry', category: 'infrastructure', scripts: [/sentry\.io/i, /browser\.sentry-cdn\.com/i, /sentry/i], estimated_monthly_cost: 26 },
  { vendor: 'GitHub', normalized_name: 'github', category: 'productivity', html: [/github\.com/i, /github\.io/i], estimated_monthly_cost: 20 },
  { vendor: 'LaunchDarkly', normalized_name: 'launchdarkly', category: 'infrastructure', scripts: [/launchdarkly\.com/i], estimated_monthly_cost: 75 },
  { vendor: 'Auth0', normalized_name: 'auth0', category: 'infrastructure', scripts: [/auth0\.com/i, /cdn\.auth0\.com/i], html: [/auth0/i], estimated_monthly_cost: 23 },
  { vendor: 'Clerk', normalized_name: 'clerk', category: 'infrastructure', scripts: [/clerk\.com/i, /clerk\.dev/i], html: [/clerk/i], estimated_monthly_cost: 25 },
  { vendor: 'Anthropic', normalized_name: 'anthropic', category: 'infrastructure', html: [/anthropic\.com/i, /claude/i], estimated_monthly_cost: 100 },
  { vendor: 'OpenAI', normalized_name: 'openai', category: 'infrastructure', scripts: [/openai\.com/i], html: [/openai/i, /chatgpt/i], estimated_monthly_cost: 100 },
  { vendor: 'Twilio', normalized_name: 'twilio', category: 'infrastructure', scripts: [/twilio\.com/i], html: [/twilio/i], estimated_monthly_cost: 50 },
  { vendor: 'Shopify', normalized_name: 'shopify', category: 'infrastructure', scripts: [/cdn\.shopify\.com/i, /shopify\.com/i], html: [/shopify/i, /myshopify\.com/i], estimated_monthly_cost: 79 },
  { vendor: 'Webflow', normalized_name: 'webflow', category: 'infrastructure', scripts: [/webflow\.com/i], html: [/webflow/i, /wf-/i], estimated_monthly_cost: 30 },
  { vendor: 'WordPress', normalized_name: 'wordpress', category: 'infrastructure', html: [/wp-content/i, /wp-includes/i, /wp-json/i, /wordpress/i], estimated_monthly_cost: 25 },
];

interface DetectedTech {
  vendor: string;
  normalized_name: string;
  category: Subscription['category'];
  estimated_monthly_cost: number;
  detection_source: string;
  confidence: number;
}

function detectTechFromHtml(html: string, responseHeaders: Record<string, string> = {}): DetectedTech[] {
  const found: DetectedTech[] = [];
  const seen = new Set<string>();

  const scriptSrcs: string[] = [];
  const scriptRegex = /<script[^>]+src=["']([^"']+)["']/gi;
  let match;
  while ((match = scriptRegex.exec(html)) !== null) {
    scriptSrcs.push(match[1]);
  }

  const headerStr = Object.entries(responseHeaders).map(([k, v]) => `${k}: ${v}`).join('\n').toLowerCase();

  for (const sig of TECH_SIGNATURES) {
    if (seen.has(sig.normalized_name)) continue;
    let detected = false;
    let source = '';

    if (sig.scripts) {
      for (const pattern of sig.scripts) {
        if (scriptSrcs.some(src => pattern.test(src))) { detected = true; source = 'script tag'; break; }
      }
    }
    if (!detected && sig.html) {
      for (const pattern of sig.html) {
        if (pattern.test(html)) { detected = true; source = 'page content'; break; }
      }
    }
    if (!detected && sig.headers) {
      for (const h of sig.headers) {
        if (headerStr.includes(h.toLowerCase())) { detected = true; source = 'http header'; break; }
      }
    }
    if (detected) {
      seen.add(sig.normalized_name);
      found.push({
        vendor: sig.vendor, normalized_name: sig.normalized_name, category: sig.category,
        estimated_monthly_cost: sig.estimated_monthly_cost, detection_source: source,
        confidence: source === 'script tag' ? 0.95 : source === 'http header' ? 0.9 : 0.8,
      });
    }
  }
  return found;
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();
    if (!url) return NextResponse.json({ error: 'No URL provided' }, { status: 400 });

    let normalized = url.trim();
    if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
      normalized = `https://${normalized}`;
    }
    let urlObj: URL;
    try { urlObj = new URL(normalized); } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }

    let html: string;
    const headers: Record<string, string> = {};
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(urlObj.toString(), {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HunterAI/1.0)', 'Accept': 'text/html,application/xhtml+xml' },
      redirect: 'follow',
    });
    clearTimeout(timeout);

    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    response.headers.forEach((value, key) => { headers[key.toLowerCase()] = value; });
    html = await response.text();
    if (html.length > 500000) html = html.slice(0, 500000);

    const detections = detectTechFromHtml(html, headers);

    if (detections.length === 0) {
      return NextResponse.json({
        url: urlObj.hostname, technologies_found: 0, detections: [], subscriptions: [],
        message: `No known SaaS tools detected on ${urlObj.hostname}. Try uploading a bank statement instead.`,
      });
    }

    const subs: Subscription[] = detections.map(d => ({
      id: randomUUID(), vendor: d.vendor, normalized_name: d.normalized_name,
      monthly_cost: d.estimated_monthly_cost, category: d.category,
      confidence: d.confidence, source: 'website' as const,
    }));

    mergeSubscriptions(subs);
    logActivity('website_scanned', `Scanned ${urlObj.hostname}: found ${detections.length} technologies`, { count: detections.length, url: urlObj.hostname });

    return NextResponse.json({
      url: urlObj.hostname, technologies_found: detections.length, detections, subscriptions: subs,
      estimated_monthly_spend: subs.reduce((s, x) => s + x.monthly_cost, 0),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('AbortError') || msg.includes('abort')) {
      return NextResponse.json({ error: 'Website took too long to respond (>15s)' }, { status: 504 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
