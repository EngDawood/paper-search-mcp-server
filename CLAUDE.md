# paper-search-mcp-server

MCP server for searching academic papers, written in TypeScript and running on Cloudflare Workers.
International sources plus Arabic sources (Mandumah, ASJP, SHAMAA, EKB, Google Scholar...), merged in from
arabic-scholar-mcp on 2026-10-16 (that repo is now superseded by this one).
Live at https://paper-search-mcp.engdawood.com (also `www.`; MCP endpoint: `/mcp`). `/mcp` needs `Authorization: Bearer <MCP_AUTH_TOKEN>`; `/` and `/health` are open.
The old `*.workers.dev` URL is off (404) since custom-domain routes were added.

Read these when the task touches them:
- `docs/architecture.md`: request flow, file layout, how to add a source
- `docs/sources.md`: every source, its endpoint, quirks and last known live status
- `docs/decisions.md`: why things are the way they are (do not undo these without a reason)
- `docs/status.md`: what is deployed, which secrets are set, open issues, roadmap
- `docs/arabic.md`: the Arabic module, Mandumah/Exa/Google Scholar quirks, how to add an Arabic site

## Layout in one glance

- `src/server.ts` registers everything: international tools, then `registerArabicTools` (`src/arabic`), then
  `registerCrossTools` (`src/cross`: `search_all`, `search_google_scholar`, `find_pdf_anywhere`, `cite_paper`),
  then `usage_stats` (only with `DB` and `MCP_AUTH_TOKEN`).
- `src/analytics` wraps every tool via `instrumentServer` and logs to D1 (`DB` binding, database
  `arabic-scholar-analytics`). Upstream calls are recorded by a hook in `src/lib/http.ts`, so all HTTP must go through
  `request()/getJson/getText`; a direct `fetch` is invisible to analytics.
- Tool count: 28 with no keys, 46 with every key. Count with `Object.keys(server._registeredTools)` in a throwaway test.

## Commands

```bash
npm run typecheck        # tsc --noEmit
npm test                 # vitest unit tests (no network)
npm run dev              # wrangler dev on :8787
npm run smoke            # call every tool against localhost:8787
npm run smoke -- https://paper-search-mcp.engdawood.com <token>   # live test (ask the owner for the token)
npx wrangler deploy --dry-run --outdir dist   # check bundle size (limit 3 MB gzip on Free)
```

Run `npm run typecheck && npm test` before every commit.

## Rules

- Native TypeScript for Workers only. No Python, no Node-only APIs (fs, child_process). No `agents` package.
- Never put secret values in `wrangler.jsonc` or commits. Secrets go in `wrangler secret put`.
- Every free source must work with no API key. Keyed sources go in `KEYED_SOURCES` in `src/sources/index.ts` and their tools register only when the key is set.
- Never copy code from the reference repos. Use them for endpoints and approach only, and credit them in the README Acknowledgements.
- No Sci-Hub. Google Scholar is scraped only through Firecrawl, with Exa as the fallback (owner's call, decision 26). No plain-fetch Google scraping.
- Arabic parsers are tested against trimmed real pages in `test/arabic/fixtures`; keep every field assertion when changing them.
- Schema changes to D1 go in a new `migrations/000N_*.sql` (never edit applied ones; `0001` belongs to the old Arabic server). Apply with `npx wrangler d1 migrations apply arabic-scholar-analytics --remote` before merging to `main`.
- Keep the README tool count, source tables and `docs/` in sync when adding or removing tools or sources.
- Writing style for docs, commits and PR text: plain and brief, no em dashes.

## Git

- Default branch is `main`. Small changes go to `main` directly. Phase work goes on its own branch with a draft PR (phase 2 was `claude/phase-2-keyed-sources`, PR #2, merged).
- The owner also edits `wrangler.jsonc` directly (routes, vars). Pull before editing and keep their values.
- `wrangler dev` only loads secrets listed in `secrets.required` from `.dev.vars` (see docs/decisions.md #14).
- Local end-to-end check: `npx wrangler d1 migrations apply arabic-scholar-analytics --local`, put `OPENALEX_API_KEY=dummy` in `.dev.vars`, `npx wrangler dev`, then POST JSON-RPC to `localhost:8787/mcp` and read rows with `npx wrangler d1 execute arabic-scholar-analytics --local --command "SELECT ..."`.
- Pushing to `main` appears to trigger an automatic Cloudflare deploy (Workers Builds). Verify with `curl https://paper-search-mcp.engdawood.com/`.
- Commit trailers: `Co-Authored-By` and `Claude-Session` lines as provided by the session.
