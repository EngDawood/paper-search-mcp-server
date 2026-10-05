# paper-search-mcp-server

MCP server for searching academic papers, written in TypeScript and running on Cloudflare Workers.
Live at https://paper-search-mcp.engdawood.com (also `www.`; MCP endpoint: `/mcp`). `/mcp` needs `Authorization: Bearer <MCP_AUTH_TOKEN>`; `/` and `/health` are open.
The old `*.workers.dev` URL is off (404) since custom-domain routes were added.

Read these when the task touches them:
- `docs/architecture.md`: request flow, file layout, how to add a source
- `docs/sources.md`: every source, its endpoint, quirks and last known live status
- `docs/decisions.md`: why things are the way they are (do not undo these without a reason)
- `docs/status.md`: what is deployed, which secrets are set, open issues, roadmap

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
- No Sci-Hub, no Google Scholar scraping.
- Keep the README tool count, source tables and `docs/` in sync when adding or removing tools or sources.
- Writing style for docs, commits and PR text: plain and brief, no em dashes.

## Git

- Default branch is `main`. Small changes go to `main` directly. Phase work goes on its own branch with a draft PR (phase 2 was `claude/phase-2-keyed-sources`, PR #2, merged).
- The owner also edits `wrangler.jsonc` directly (routes, vars). Pull before editing and keep their values.
- `wrangler dev` only loads secrets listed in `secrets.required` from `.dev.vars` (see docs/decisions.md #14).
- Pushing to `main` appears to trigger an automatic Cloudflare deploy (Workers Builds). Verify with `curl https://paper-search-mcp.engdawood.com/`.
- Commit trailers: `Co-Authored-By` and `Claude-Session` lines as provided by the session.
