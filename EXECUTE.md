# HunterAI — Ralph Loop Build Orchestrator

You are building **HunterAI** for the Manufact MCP Apps Hackathon at Y Combinator.
Execute all 12 tasks autonomously. Never stop to ask for permission.

## HOW THE LOOP WORKS

For EACH task N (01 through 12):
```
1. Read tasks/NN-*.md  ← get the full spec for this task
2. Implement exactly as specified
3. Run the verification command(s) from that task file
4. Fix errors (max 3 attempts per error, then log and continue)
5. Print: "✅ TASK N complete: [name]"
6. Move immediately to the next task
```

Never read ahead. Never read multiple task files at once. One task at a time.

## GLOBAL RULES (apply to every file you write)

- **mcp-use SDK only** — `import from 'mcp-use'`, not raw `@modelcontextprotocol/sdk`
- **ESM only** — `import` not `require()`. Local imports need `.js` extension
- **HunterAI branding everywhere** — never write "CreditsOS" anywhere
- **No `any` type** — use interfaces from `types.ts`
- **`isDemoMode()`** — import from `../state.js`, never duplicate inline
- **No JS comments in JSON** — programs.json must be clean JSON

## START

```bash
# First: read the project overview
cat CLAUDE.md

# Then execute tasks in order
cat tasks/01-setup.md    # read → implement → verify → ✅
cat tasks/02-types.md    # read → implement → verify → ✅
cat tasks/03-programs.md
cat tasks/04-tools.md
cat tasks/05-widget.md
cat tasks/06-server.md
cat tasks/07-email.md
cat tasks/08-forms.md
cat tasks/09-replies.md
cat tasks/10-verify.md
cat tasks/11-puzzle.md
cat tasks/12-auth.md
```

## ERROR RECOVERY

- Build fails → read error, fix, rebuild (max 3 attempts)
- After 3 failures → print `⚠️ TASK N skipped: [error]` and continue
- Missing dep → `pnpm add <package>` and retry

## FINAL CHECK

After task 12, run:
```bash
grep -r "creditsOS\|CreditsOS" src/ widget/ 2>/dev/null && echo "❌ branding issue" || echo "✅ branding clean"
npm run build
npx @mcp-use/cli deploy --dry-run
```

Print the final summary table from tasks/10-verify.md.
