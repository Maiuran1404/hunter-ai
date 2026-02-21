import { z } from 'zod';
import { state, isDemoMode, logActivity, mergeSubscriptions } from '../state.js';
import { randomUUID } from 'crypto';
import type { Subscription } from '../types.js';

// ── Tech signature database ─────────────────────────────────
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
  // ── Infrastructure / Hosting ──
  { vendor: 'AWS', normalized_name: 'aws', category: 'infrastructure',
    scripts: [/\.amazonaws\.com/i],
    html: [/cloudfront\.net/i, /s3\.amazonaws\.com/i, /\.aws\./i],
    headers: ['amazons3', 'cloudfront', 'amazonwebservices'],
    estimated_monthly_cost: 500 },
  { vendor: 'Google Cloud', normalized_name: 'google-cloud', category: 'infrastructure',
    html: [/googleapis\.com/i, /storage\.googleapis\.com/i, /\.run\.app/i, /appspot\.com/i],
    headers: ['gse', 'google'],
    estimated_monthly_cost: 400 },
  { vendor: 'Azure', normalized_name: 'azure', category: 'infrastructure',
    html: [/\.azure\.com/i, /\.azurewebsites\.net/i, /\.blob\.core\.windows\.net/i, /\.azureedge\.net/i],
    headers: ['microsoft-azure'],
    estimated_monthly_cost: 400 },
  { vendor: 'Vercel', normalized_name: 'vercel', category: 'infrastructure',
    html: [/vercel\.app/i, /vercel\.com/i, /_next\//i, /v0\.dev/i],
    headers: ['vercel'],
    estimated_monthly_cost: 20 },
  { vendor: 'Netlify', normalized_name: 'netlify', category: 'infrastructure',
    html: [/netlify\.app/i, /netlify\.com/i, /netlify-identity/i],
    headers: ['netlify'],
    estimated_monthly_cost: 20 },
  { vendor: 'Heroku', normalized_name: 'heroku', category: 'infrastructure',
    html: [/herokuapp\.com/i, /heroku/i],
    estimated_monthly_cost: 25 },
  { vendor: 'Cloudflare', normalized_name: 'cloudflare', category: 'infrastructure',
    scripts: [/cdnjs\.cloudflare\.com/i, /cloudflareinsights\.com/i],
    html: [/cloudflare/i],
    headers: ['cloudflare'],
    estimated_monthly_cost: 20 },
  { vendor: 'DigitalOcean', normalized_name: 'digitalocean', category: 'infrastructure',
    html: [/digitalocean\.com/i, /\.digitaloceanspaces\.com/i],
    estimated_monthly_cost: 50 },
  { vendor: 'Fastly', normalized_name: 'fastly', category: 'infrastructure',
    headers: ['fastly'],
    estimated_monthly_cost: 50 },
  { vendor: 'Render', normalized_name: 'render', category: 'infrastructure',
    html: [/\.onrender\.com/i],
    estimated_monthly_cost: 20 },
  { vendor: 'Railway', normalized_name: 'railway', category: 'infrastructure',
    html: [/\.up\.railway\.app/i],
    estimated_monthly_cost: 20 },
  { vendor: 'Supabase', normalized_name: 'supabase', category: 'infrastructure',
    scripts: [/supabase/i],
    html: [/supabase\.co/i, /supabase\.com/i],
    estimated_monthly_cost: 25 },
  { vendor: 'Firebase', normalized_name: 'firebase', category: 'infrastructure',
    scripts: [/firebase/i, /firebaseapp\.com/i],
    html: [/firebaseio\.com/i, /firebase\.google\.com/i],
    estimated_monthly_cost: 25 },
  { vendor: 'MongoDB', normalized_name: 'mongodb', category: 'infrastructure',
    html: [/mongodb\.com/i, /\.mongodb\.net/i],
    estimated_monthly_cost: 50 },

  // ── Analytics ──
  { vendor: 'Google Analytics', normalized_name: 'google-analytics', category: 'analytics',
    scripts: [/google-analytics\.com/i, /googletagmanager\.com/i, /gtag/i],
    html: [/UA-\d{4,10}/i, /G-[A-Z0-9]{8,12}/i, /GTM-[A-Z0-9]{4,8}/i],
    estimated_monthly_cost: 0 },
  { vendor: 'Segment', normalized_name: 'segment', category: 'analytics',
    scripts: [/cdn\.segment\.com/i, /segment\.io/i],
    html: [/analytics\.js/i, /segment/i],
    estimated_monthly_cost: 120 },
  { vendor: 'Mixpanel', normalized_name: 'mixpanel', category: 'analytics',
    scripts: [/mixpanel\.com/i, /cdn\.mxpnl\.com/i],
    estimated_monthly_cost: 25 },
  { vendor: 'Amplitude', normalized_name: 'amplitude', category: 'analytics',
    scripts: [/amplitude\.com/i, /cdn\.amplitude\.com/i],
    estimated_monthly_cost: 50 },
  { vendor: 'Hotjar', normalized_name: 'hotjar', category: 'analytics',
    scripts: [/hotjar\.com/i, /static\.hotjar\.com/i],
    estimated_monthly_cost: 40 },
  { vendor: 'PostHog', normalized_name: 'posthog', category: 'analytics',
    scripts: [/posthog\.com/i, /app\.posthog\.com/i],
    html: [/posthog/i],
    estimated_monthly_cost: 0 },
  { vendor: 'Plausible', normalized_name: 'plausible', category: 'analytics',
    scripts: [/plausible\.io/i],
    estimated_monthly_cost: 10 },
  { vendor: 'Heap', normalized_name: 'heap', category: 'analytics',
    scripts: [/heap\.io/i, /heapanalytics\.com/i, /cdn\.heapanalytics\.com/i],
    estimated_monthly_cost: 50 },
  { vendor: 'Datadog', normalized_name: 'datadog', category: 'analytics',
    scripts: [/datadoghq\.com/i, /dd-rum/i, /datadog/i],
    estimated_monthly_cost: 100 },

  // ── Customer Support / CRM ──
  { vendor: 'Intercom', normalized_name: 'intercom', category: 'productivity',
    scripts: [/intercom\.io/i, /widget\.intercom\.io/i, /intercomcdn\.com/i],
    html: [/intercom-app-id/i],
    estimated_monthly_cost: 74 },
  { vendor: 'Zendesk', normalized_name: 'zendesk', category: 'productivity',
    scripts: [/zdassets\.com/i, /zendesk\.com/i],
    html: [/zendesk/i],
    estimated_monthly_cost: 50 },
  { vendor: 'HubSpot', normalized_name: 'hubspot', category: 'productivity',
    scripts: [/hubspot\.com/i, /hs-scripts\.com/i, /hsforms\.com/i, /hbspt/i],
    html: [/hubspot/i, /hs-script-loader/i],
    estimated_monthly_cost: 50 },
  { vendor: 'Drift', normalized_name: 'drift', category: 'productivity',
    scripts: [/drift\.com/i, /js\.driftt\.com/i],
    estimated_monthly_cost: 50 },
  { vendor: 'Crisp', normalized_name: 'crisp', category: 'productivity',
    scripts: [/crisp\.chat/i, /client\.crisp\.chat/i],
    estimated_monthly_cost: 25 },
  { vendor: 'Freshdesk', normalized_name: 'freshdesk', category: 'productivity',
    scripts: [/freshdesk\.com/i, /freshworks\.com/i],
    html: [/freshdesk/i, /freshworks/i],
    estimated_monthly_cost: 15 },
  { vendor: 'Salesforce', normalized_name: 'salesforce', category: 'productivity',
    scripts: [/force\.com/i, /salesforce\.com/i, /pardot\.com/i],
    html: [/salesforce/i],
    estimated_monthly_cost: 150 },

  // ── Payments ──
  { vendor: 'Stripe', normalized_name: 'stripe', category: 'infrastructure',
    scripts: [/js\.stripe\.com/i, /stripe\.com/i],
    html: [/stripe/i],
    estimated_monthly_cost: 100 },
  { vendor: 'PayPal', normalized_name: 'paypal', category: 'infrastructure',
    scripts: [/paypal\.com/i, /paypalobjects\.com/i],
    estimated_monthly_cost: 50 },
  { vendor: 'Braintree', normalized_name: 'braintree', category: 'infrastructure',
    scripts: [/braintree/i, /braintreegateway\.com/i],
    estimated_monthly_cost: 50 },

  // ── Email / Marketing ──
  { vendor: 'SendGrid', normalized_name: 'sendgrid', category: 'productivity',
    html: [/sendgrid\.net/i, /sendgrid\.com/i],
    estimated_monthly_cost: 20 },
  { vendor: 'Mailchimp', normalized_name: 'mailchimp', category: 'productivity',
    scripts: [/mailchimp\.com/i, /chimpstatic\.com/i, /list-manage\.com/i],
    html: [/mailchimp/i, /mc\.us\d+\.list-manage/i],
    estimated_monthly_cost: 20 },
  { vendor: 'Customer.io', normalized_name: 'customer-io', category: 'productivity',
    scripts: [/customer\.io/i, /customerioforms/i],
    estimated_monthly_cost: 100 },

  // ── Dev Tools / Monitoring ──
  { vendor: 'Sentry', normalized_name: 'sentry', category: 'infrastructure',
    scripts: [/sentry\.io/i, /browser\.sentry-cdn\.com/i, /sentry/i],
    estimated_monthly_cost: 26 },
  { vendor: 'GitHub', normalized_name: 'github', category: 'productivity',
    html: [/github\.com/i, /github\.io/i],
    estimated_monthly_cost: 20 },
  { vendor: 'LaunchDarkly', normalized_name: 'launchdarkly', category: 'infrastructure',
    scripts: [/launchdarkly\.com/i],
    estimated_monthly_cost: 75 },
  { vendor: 'LogRocket', normalized_name: 'logrocket', category: 'analytics',
    scripts: [/logrocket\.com/i, /cdn\.lr-ingest\.io/i],
    estimated_monthly_cost: 100 },
  { vendor: 'FullStory', normalized_name: 'fullstory', category: 'analytics',
    scripts: [/fullstory\.com/i, /edge\.fullstory\.com/i],
    estimated_monthly_cost: 100 },
  { vendor: 'New Relic', normalized_name: 'new-relic', category: 'analytics',
    scripts: [/newrelic\.com/i, /nr-data\.net/i, /bam\.nr-data\.net/i],
    estimated_monthly_cost: 50 },

  // ── CMS / Frameworks ──
  { vendor: 'WordPress', normalized_name: 'wordpress', category: 'infrastructure',
    html: [/wp-content/i, /wp-includes/i, /wp-json/i, /wordpress/i],
    estimated_monthly_cost: 25 },
  { vendor: 'Shopify', normalized_name: 'shopify', category: 'infrastructure',
    scripts: [/cdn\.shopify\.com/i, /shopify\.com/i],
    html: [/shopify/i, /myshopify\.com/i],
    estimated_monthly_cost: 79 },
  { vendor: 'Webflow', normalized_name: 'webflow', category: 'infrastructure',
    scripts: [/webflow\.com/i],
    html: [/webflow/i, /wf-/i],
    estimated_monthly_cost: 30 },
  { vendor: 'Contentful', normalized_name: 'contentful', category: 'infrastructure',
    scripts: [/contentful\.com/i],
    html: [/contentful/i, /ctfassets\.net/i],
    estimated_monthly_cost: 50 },
  { vendor: 'Sanity', normalized_name: 'sanity', category: 'infrastructure',
    scripts: [/sanity\.io/i],
    html: [/cdn\.sanity\.io/i],
    estimated_monthly_cost: 15 },

  // ── Auth ──
  { vendor: 'Auth0', normalized_name: 'auth0', category: 'infrastructure',
    scripts: [/auth0\.com/i, /cdn\.auth0\.com/i],
    html: [/auth0/i],
    estimated_monthly_cost: 23 },
  { vendor: 'Clerk', normalized_name: 'clerk', category: 'infrastructure',
    scripts: [/clerk\.com/i, /clerk\.dev/i],
    html: [/clerk/i],
    estimated_monthly_cost: 25 },

  // ── AI / ML ──
  { vendor: 'Anthropic', normalized_name: 'anthropic', category: 'infrastructure',
    html: [/anthropic\.com/i, /claude/i],
    estimated_monthly_cost: 100 },
  { vendor: 'OpenAI', normalized_name: 'openai', category: 'infrastructure',
    scripts: [/openai\.com/i],
    html: [/openai/i, /chatgpt/i],
    estimated_monthly_cost: 100 },

  // ── Communication ──
  { vendor: 'Twilio', normalized_name: 'twilio', category: 'infrastructure',
    scripts: [/twilio\.com/i],
    html: [/twilio/i],
    estimated_monthly_cost: 50 },
  { vendor: 'Slack', normalized_name: 'slack', category: 'productivity',
    html: [/slack\.com\/oauth/i, /hooks\.slack\.com/i],
    estimated_monthly_cost: 50 },
];

// ── Detection engine ─────────────────────────────────────────
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

  // Extract all script src values
  const scriptSrcs: string[] = [];
  const scriptRegex = /<script[^>]+src=["']([^"']+)["']/gi;
  let match;
  while ((match = scriptRegex.exec(html)) !== null) {
    scriptSrcs.push(match[1]);
  }

  // Combine all header values for matching
  const headerStr = Object.entries(responseHeaders)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n')
    .toLowerCase();

  for (const sig of TECH_SIGNATURES) {
    if (seen.has(sig.normalized_name)) continue;

    let detected = false;
    let source = '';

    // Check script sources
    if (sig.scripts) {
      for (const pattern of sig.scripts) {
        if (scriptSrcs.some(src => pattern.test(src))) {
          detected = true;
          source = 'script tag';
          break;
        }
      }
    }

    // Check HTML content
    if (!detected && sig.html) {
      for (const pattern of sig.html) {
        if (pattern.test(html)) {
          detected = true;
          source = 'page content';
          break;
        }
      }
    }

    // Check response headers
    if (!detected && sig.headers) {
      for (const h of sig.headers) {
        if (headerStr.includes(h.toLowerCase())) {
          detected = true;
          source = 'http header';
          break;
        }
      }
    }

    if (detected) {
      seen.add(sig.normalized_name);
      found.push({
        vendor: sig.vendor,
        normalized_name: sig.normalized_name,
        category: sig.category,
        estimated_monthly_cost: sig.estimated_monthly_cost,
        detection_source: source,
        confidence: source === 'script tag' ? 0.95 : source === 'http header' ? 0.9 : 0.8,
      });
    }
  }

  return found;
}

// ── Main tool ────────────────────────────────────────────────
export async function scanWebsiteTool(input: {
  url: string;
  demo_mode?: boolean;
}) {
  if (isDemoMode(input.demo_mode)) {
    const demoDetections: DetectedTech[] = [
      { vendor: 'Vercel', normalized_name: 'vercel', category: 'infrastructure', estimated_monthly_cost: 20, detection_source: 'http header', confidence: 0.95 },
      { vendor: 'Stripe', normalized_name: 'stripe', category: 'infrastructure', estimated_monthly_cost: 100, detection_source: 'script tag', confidence: 0.95 },
      { vendor: 'Intercom', normalized_name: 'intercom', category: 'productivity', estimated_monthly_cost: 74, detection_source: 'script tag', confidence: 0.95 },
      { vendor: 'Segment', normalized_name: 'segment', category: 'analytics', estimated_monthly_cost: 120, detection_source: 'script tag', confidence: 0.95 },
      { vendor: 'Sentry', normalized_name: 'sentry', category: 'infrastructure', estimated_monthly_cost: 26, detection_source: 'script tag', confidence: 0.95 },
      { vendor: 'HubSpot', normalized_name: 'hubspot', category: 'productivity', estimated_monthly_cost: 50, detection_source: 'script tag', confidence: 0.9 },
      { vendor: 'Auth0', normalized_name: 'auth0', category: 'infrastructure', estimated_monthly_cost: 23, detection_source: 'page content', confidence: 0.8 },
      { vendor: 'Google Analytics', normalized_name: 'google-analytics', category: 'analytics', estimated_monthly_cost: 0, detection_source: 'script tag', confidence: 0.95 },
    ];

    const subs = demoDetections.map(d => toSubscription(d));
    mergeSubscriptions(subs);
    logActivity('website_scanned', `Scanned website (demo): found ${subs.length} technologies`, { count: subs.length, url: 'demo.example.com' });

    return {
      url: 'demo.example.com',
      technologies_found: demoDetections.length,
      detections: demoDetections,
      subscriptions: subs,
      estimated_monthly_spend: subs.reduce((s, x) => s + x.monthly_cost, 0),
      suggestions: [
        { label: 'Find credits for detected tools', sub: `${subs.length} tools to match`, primary: true },
        { label: 'Show dashboard', sub: '' },
      ],
    };
  }

  // Validate URL
  let urlObj: URL;
  try {
    let normalized = input.url.trim();
    if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
      normalized = `https://${normalized}`;
    }
    urlObj = new URL(normalized);
  } catch {
    throw new Error('Invalid URL. Please provide a valid website URL (e.g., example.com or https://example.com)');
  }

  // Fetch the website
  let html: string;
  let headers: Record<string, string> = {};
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const response = await fetch(urlObj.toString(), {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HunterAI/1.0; +https://hunterai.app)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Collect response headers
    response.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    html = await response.text();
    // Limit HTML to first 500KB to avoid memory issues
    if (html.length > 500000) html = html.slice(0, 500000);
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Website ${urlObj.hostname} took too long to respond (>15s). Please check the URL and try again.`);
    }
    throw new Error(`Could not fetch ${urlObj.hostname}: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Detect technologies
  const detections = detectTechFromHtml(html, headers);

  if (detections.length === 0) {
    return {
      url: urlObj.hostname,
      technologies_found: 0,
      detections: [],
      subscriptions: [],
      estimated_monthly_spend: 0,
      message: `No known SaaS tools detected on ${urlObj.hostname}. The site may use self-hosted tools, or the tech stack may not be detectable from the public-facing page. Try uploading a bank statement instead for more accurate results.`,
      suggestions: [
        { label: 'Upload bank statement instead', sub: 'More accurate', primary: true },
        { label: 'Try a different URL', sub: '' },
      ],
    };
  }

  // Convert to subscriptions and merge into state
  const subs = detections.map(d => toSubscription(d));
  mergeSubscriptions(subs);
  logActivity('website_scanned', `Scanned ${urlObj.hostname}: found ${detections.length} technologies`, {
    count: detections.length,
    url: urlObj.hostname,
    vendors: detections.map(d => d.vendor),
  });

  const totalEstimated = subs.reduce((s, x) => s + x.monthly_cost, 0);

  return {
    url: urlObj.hostname,
    technologies_found: detections.length,
    detections,
    subscriptions: subs,
    estimated_monthly_spend: totalEstimated,
    suggestions: [
      { label: 'Find credits for detected tools', sub: `${detections.length} tools to match`, primary: true },
      { label: 'Show dashboard', sub: '' },
    ],
  };
}

function toSubscription(d: DetectedTech): Subscription {
  return {
    id: randomUUID(),
    vendor: d.vendor,
    normalized_name: d.normalized_name,
    monthly_cost: d.estimated_monthly_cost,
    category: d.category,
    confidence: d.confidence,
    source: 'website',
  };
}

export const scanWebsiteSchema = z.object({
  url: z.string().describe('The website URL to scan for tech stack detection (e.g., example.com or https://example.com)'),
  demo_mode: z.boolean().optional().describe('Run in demo mode with sample data'),
});
