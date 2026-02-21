# Task 03 — Programs Knowledge Base

## What this creates
- `src/data/programs.json` — 66 verified startup programs

## Source
The full programs data is in the original task file you were given.
Read it now: the JSON content starts after `## Create src/data/programs.json` in the
uploaded `03-programs-kb.md` file (check `/mnt/user-data/uploads/03-programs-kb.md` if available,
or reconstruct from the CLAUDE.md programs table and your knowledge of these programs).

## JSON rules (CRITICAL — violations break everything)
- ZERO `//` comments inside JSON — crashes JSON.parse silently
- No trailing commas
- `verified: false` entries MUST have `⚠️` in notes
- `incubator_portal` entries MUST have notes explaining how to access
- `diversity_grant` entries MUST have `eligibility.requires_identities` populated

## Required distribution
```
startup_program:   34 programs
diversity_grant:   16 programs  
incubator_credit:  7 programs
incubator_portal:  5 programs
government_grant:  3 programs (Innovasjon Norge, NO geography)
negotiation:       1 program
Total:            66 programs
```

## Key programs to include (non-exhaustive)
- aws-activate-founders ($10K), aws-activate-portfolio ($100K, requires incubator)
- google-for-startups ($200K), microsoft-founders-hub ($150K)
- anthropic-startup-program, vercel-startup-program, stripe-atlas
- github-enterprise-incubator, digitalocean-hatch
- antler-disrupt (incubator_portal, $650K), antler-full ($4M), yc-deals (incubator_portal)
- google-black-founders-fund (diversity_grant), amber-grant (diversity_grant, women)
- innovasjon-norge-etablerertilskudd (500K NOK, government_grant, NO only)
- innovasjon-norge-innovasjonskontrakter (1.4M NOK), forskningsradet-bip (6M NOK)

## Verify
```bash
node scripts/validate-programs.mjs
# Expected: ✅ programs.json valid — 66 programs
#           diversity_grant: 16
#           incubator_portal: 5
#           government_grant: 3
```

If validate fails:
- `unexpected token /` → remove ALL `//` comments from JSON
- `missing field` → add the field to that entry
- `diversity_grant missing eligibility.requires_identities` → add the array
