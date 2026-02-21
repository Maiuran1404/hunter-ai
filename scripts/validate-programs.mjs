import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const programs = JSON.parse(readFileSync(join(__dirname, '../src/data/programs.json'), 'utf8'));
const errors = [];
const ids = new Set();

for (const p of programs) {
  if (ids.has(p.id)) errors.push(`Duplicate id: "${p.id}"`);
  ids.add(p.id);
  for (const f of ['id','name','vendor','type','potential_value','currency','application_url','application_type']) {
    if (p[f] === undefined || p[f] === '') errors.push(`"${p.id}" missing: ${f}`);
  }
  if (p.verified === false && (!p.notes || !p.notes.includes('⚠️')))
    errors.push(`"${p.id}" verified:false needs ⚠️ in notes`);
  if (p.type === 'incubator_portal' && !p.notes)
    errors.push(`"${p.id}" incubator_portal needs notes`);
  if (p.type === 'diversity_grant' && !p.eligibility?.requires_identities?.length)
    errors.push(`"${p.id}" diversity_grant needs eligibility.requires_identities`);
}

if (errors.length) { errors.forEach(e => console.error('•', e)); process.exit(1); }
const byType = programs.reduce((a,p) => ({...a,[p.type]:(a[p.type]||0)+1}),{});
console.log(`✅ programs.json valid — ${programs.length} programs`);
Object.entries(byType).forEach(([t,n]) => console.log(`   ${t}: ${n}`));
