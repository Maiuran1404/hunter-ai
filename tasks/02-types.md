# Task 02 — TypeScript Types + State

## What this creates
- `src/types.ts` — all shared interfaces
- `src/state.ts` — isDemoMode(), saveTokens(), loadTokens()

## DON'T
- Don't use `any` type
- Don't add fields to AppState without updating resetState()

---

## Create src/types.ts
```typescript
export interface Subscription {
  id: string;
  vendor: string;
  normalized_name: string;
  monthly_cost: number;
  account_email?: string;
  category: 'infrastructure'|'productivity'|'design'|'analytics'|'other';
  confidence: number;
  source: 'csv'|'pdf'|'manual'|'demo';
}

export interface CompanyProfile {
  name: string;
  website?: string;
  stage: 'pre-seed'|'seed'|'series-a'|'growth';
  team_size: number;
  monthly_arr: number;
  incubators: string[];
  geography: string;
  tech_stack: string[];
  contact_email?: string;
  founder_name?: string;
  founder_identities?: Array<
    'black'|'latino'|'asian'|'indigenous'|'middle-eastern'|
    'muslim'|'jewish'|'sikh'|'woman'|'nonbinary'|'lgbtq'|
    'disabled'|'veteran'|'first-gen-immigrant'
  >;
}

export type ProgramType =
  | 'startup_program' | 'incubator_credit' | 'negotiation'
  | 'diversity_grant' | 'government_grant' | 'incubator_portal';

export interface DiscountProgram {
  id: string;
  name: string;
  vendor: string;
  type: ProgramType;
  potential_value: number;
  currency: string;
  verified: boolean;
  last_verified?: string;
  eligibility: {
    requires_incubator?: boolean;
    incubators?: string[];
    geographies?: string[];
    max_arr?: number;
    max_team_size?: number;
    requires_vendors?: string[];
    requires_identities?: CompanyProfile['founder_identities'];
    requires_any_identity?: boolean;
  };
  application_url: string;
  application_type: 'form'|'email'|'manual'|'incubator_portal';
  sales_email?: string;
  notes?: string;
}

export interface Opportunity {
  id: string;
  program: DiscountProgram;
  potential_value: number;
  confidence: number;
  effort: 'low'|'medium'|'high';
  reasoning: string;
  matched_subscription?: string;
}

export interface EmailDraft {
  to: string; subject: string; body: string;
  vendor: string; estimated_savings: number;
}

export interface SentEmail {
  id: string;
  gmail_message_id?: string;
  gmail_thread_id?: string;
  program_id: string;
  to: string; subject: string; body: string;
  sent_at: string;
  status: 'sent'|'failed'|'replied';
  reply?: EmailReply;
}

export interface EmailReply {
  from: string; subject: string; body: string; received_at: string;
  ai_response_draft?: string;
  ai_response_status: 'pending'|'drafted'|'sent'|'skipped';
}

export interface FormFillResult {
  program_id: string;
  status: 'success'|'needs_review'|'failed';
  screenshot_path?: string | null;
  fields_filled: string[];
  message: string;
  requires_confirmation: boolean;
}

export interface GmailTokens {
  access_token?: string; refresh_token?: string; expiry_date?: number;
}

export interface AppState {
  subscriptions: Subscription[];
  profile: CompanyProfile | null;
  opportunities: Opportunity[];
  sent_emails: SentEmail[];
  gmail_tokens: GmailTokens;
  reply_poll_active: boolean;
}
```

## Create src/state.ts
```typescript
import type { AppState, GmailTokens } from './types.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';

const TOKENS_PATH = '.tokens.json';

function loadTokens(): GmailTokens {
  try {
    if (existsSync(TOKENS_PATH)) return JSON.parse(readFileSync(TOKENS_PATH, 'utf8'));
  } catch { /* corrupted */ }
  return {};
}

export function saveTokens(tokens: GmailTokens): void {
  try { writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2)); }
  catch { console.warn('[tokens] Could not persist tokens'); }
}

export const state: AppState = {
  subscriptions: [], profile: null, opportunities: [],
  sent_emails: [], gmail_tokens: loadTokens(), reply_poll_active: false,
};

export function isDemoMode(inputFlag?: boolean): boolean {
  return inputFlag === true || process.env.DEMO_MODE === 'true';
}

export function resetState(): void {
  state.subscriptions = []; state.profile = null;
  state.opportunities = []; state.sent_emails = [];
}
```

## Verify
```bash
npm run build
# Expected: TypeScript OK, no errors
```
