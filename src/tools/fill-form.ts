import { z } from 'zod';
import { chromium } from 'playwright';
import { state, isDemoMode } from '../state.js';
import { randomUUID } from 'crypto';
import { writeFileSync, mkdirSync, unlinkSync } from 'fs';
import type { FormFillResult, CompanyProfile } from '../types.js';

const SCREENSHOT_DIR = '/tmp/hunterAI-screenshots';

function scheduleCleanup(path: string) {
  setTimeout(() => {
    try { unlinkSync(path); } catch { /* already deleted */ }
  }, 60_000);
}

function getFieldValue(fieldName: string, profile: CompanyProfile): string {
  const lower = fieldName.toLowerCase();
  if (lower.includes('company') || lower.includes('organization') || lower.includes('startup')) return profile.name;
  if (lower.includes('website') || lower.includes('url')) return profile.website || '';
  if (lower.includes('email')) return profile.contact_email || '';
  if (lower.includes('name') && lower.includes('found')) return profile.founder_name || '';
  if (lower.includes('team') || lower.includes('employees') || lower.includes('size')) return String(profile.team_size);
  if (lower.includes('stage') || lower.includes('funding')) return profile.stage;
  if (lower.includes('revenue') || lower.includes('arr') || lower.includes('mrr')) return String(profile.monthly_arr);
  if (lower.includes('stack') || lower.includes('tech')) return (profile.tech_stack ?? []).join(', ');
  if (lower.includes('incubator') || lower.includes('accelerator')) return (profile.incubators ?? []).join(', ');
  if (lower.includes('location') || lower.includes('country') || lower.includes('geo')) return profile.geography;
  return '';
}

export async function fillFormTool(input: {
  url: string;
  program_id: string;
  submit?: boolean;
  demo_mode?: boolean;
}): Promise<FormFillResult> {
  if (isDemoMode(input.demo_mode)) {
    return {
      program_id: input.program_id,
      status: 'needs_review',
      screenshot_path: null,
      fields_filled: ['company_name', 'email', 'website', 'team_size', 'stage'],
      message: 'Demo mode: simulated form fill. 5 fields would be populated.',
      requires_confirmation: true,
    };
  }

  if (!state.profile) {
    return {
      program_id: input.program_id,
      status: 'failed',
      screenshot_path: null,
      fields_filled: [],
      message: 'No company profile saved. Call save_company_profile first.',
      requires_confirmation: false,
    };
  }

  let browser;
  try {
    mkdirSync(SCREENSHOT_DIR, { recursive: true });
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(input.url, { waitUntil: 'networkidle', timeout: 30000 });

    const filled: string[] = [];
    const inputs = await page.locator('input[type="text"], input[type="email"], input[type="url"], input[type="number"], textarea, select').all();

    for (const el of inputs) {
      const label = await el.evaluate((node) => {
        const id = node.id;
        if (id) {
          const lbl = document.querySelector(`label[for="${id}"]`);
          if (lbl) return lbl.textContent?.trim() || '';
        }
        const parent = node.closest('label');
        if (parent) return parent.textContent?.trim() || '';
        return node.getAttribute('placeholder') || node.getAttribute('name') || node.getAttribute('aria-label') || '';
      });

      const value = getFieldValue(label, state.profile);
      if (value) {
        const tag = await el.evaluate(node => node.tagName.toLowerCase());
        if (tag === 'select') {
          await el.selectOption({ label: value }).catch(() => {});
        } else {
          await el.fill(value);
        }
        filled.push(label || 'unknown_field');
      }
    }

    const screenshotId = randomUUID().slice(0, 8);
    const screenshotPath = `${SCREENSHOT_DIR}/${screenshotId}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true });
    scheduleCleanup(screenshotPath);

    if (input.submit && filled.length > 0) {
      const submitBtn = page.locator('button[type="submit"], input[type="submit"]').first();
      if (await submitBtn.isVisible()) {
        await submitBtn.click();
        await page.waitForTimeout(2000);
      }
      return {
        program_id: input.program_id,
        status: 'success',
        screenshot_path: screenshotPath,
        fields_filled: filled,
        message: `Submitted form with ${filled.length} fields filled.`,
        requires_confirmation: false,
      };
    }

    return {
      program_id: input.program_id,
      status: 'needs_review',
      screenshot_path: screenshotPath,
      fields_filled: filled,
      message: `Filled ${filled.length} fields. Screenshot saved for review. Set submit=true to submit.`,
      requires_confirmation: true,
    };
  } catch (err) {
    return {
      program_id: input.program_id,
      status: 'failed',
      screenshot_path: null,
      fields_filled: [],
      message: `Form fill error: ${err instanceof Error ? err.message : String(err)}`,
      requires_confirmation: false,
    };
  } finally {
    if (browser) await browser.close();
  }
}

export const fillFormSchema = z.object({
  url: z.string(),
  program_id: z.string(),
  submit: z.boolean().optional().default(false),
  demo_mode: z.boolean().optional(),
});
