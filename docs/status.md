# Status

Last updated: 2026-10-05.

## Deployment

- URL: https://paper-search-mcp.engdawood.com and https://www.paper-search-mcp.engdawood.com (custom domains in `wrangler.jsonc` `routes`).
- `*.workers.dev` returns 404: with `routes` set, wrangler disables workers.dev unless `"workers_dev": true` is added.
- Deploys from `main`; a push to `main` seemed to deploy automatically (Workers Builds). Not confirmed in the dashboard.
- Access: token holders (`Authorization: Bearer` or `X-API-Key`) get all tools, no limit. No token: 30 req/min per IP via `ANON_LIMITER`, no `read_paper`. Wrong token: 401.
- Edge cache is now active (it needs a custom domain).
- Last live smoke test (2026-10-04, phase 1 + OpenAlex, old URL): 27/31 pass. Phase 2 code is merged but not live-tested (needs the token and phase 2 keys).

## Usage log

Dataset `paper_search_usage` (binding `USAGE`). Columns: `blob1` tool, `blob2` tier, `blob3` ok/error, `blob4` country,
`blob5` query, `blob6` args JSON, `blob7` error, `double1` ms, `double2` results. Query with the SQL API
(needs an API token with Account Analytics Read):

```bash
curl "https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/analytics_engine/sql" \
  -H "Authorization: Bearer <API_TOKEN>" \
  -d "SELECT blob1 AS tool, count() AS calls, avg(double1) AS avg_ms FROM paper_search_usage
      WHERE timestamp > NOW() - INTERVAL '7' DAY GROUP BY tool ORDER BY calls DESC"
```

Use `SUM(_sample_interval)` instead of `count()` for exact counts at high volume.

## Secrets and vars

| Name | Set | Effect |
|---|---|---|
| `OPENALEX_API_KEY` | yes | OpenAlex source and 3 tools |
| `SEMANTIC_SCHOLAR_API_KEY` | no | Semantic Scholar tools hit 429 without it (citation tools now fall back to OpenAlex) |
| `CORE_API_KEY` | no | CORE source (phase 2) |
| `IEEE_API_KEY` | no | IEEE Xplore source (phase 2) |
| `SPRINGER_API_KEY` | no | Springer Nature source (phase 2) |
| `ADS_API_KEY` | no | NASA ADS source (phase 2) |
| `NCBI_API_KEY` | no | Optional, higher PubMed limits |
| `MCP_AUTH_TOKEN` | yes | Full access for token holders; others get the anonymous tier |
| `CONTACT_EMAIL` (var) | `dawood.engdawood.com` | Enables Unpaywall, polite pools. Value has no `@`, so Unpaywall will reject it; owner to confirm the address. |

## Open issues

- Semantic Scholar 429 without a key (owner action: add key).
- DBLP and IACR blocked from Cloudflare egress IPs. No code fix; possible workaround is a proxy, not planned.
- `CONTACT_EMAIL` looks malformed (see above).
- `read_paper` cannot fetch PDFs behind bot challenges (IACR, bioRxiv, many publishers).

## Roadmap

- Phase 2 (free keys): merged to `main` via PR #2 (CORE, IEEE, Springer, ADS, OpenAlex fallback). Keys not set yet, so those tools are hidden; live check pending.
- Ideas: citation verification tool (inspired by tfscharff/doi-mcp), BibTeX export.
- Phase 3 (paid or institutional): Scopus, Web of Science, ScienceDirect.

## History

- 2026-10-04: Phase 1 built (18 free sources, 27 tools); PR #1 merged; OpenAlex added; deployed and live-tested.
- 2026-10-05: Phase 2 (CORE, IEEE, Springer, ADS, OpenAlex citation fallback) merged via PR #2. Owner moved the Worker to custom domains, set `MCP_AUTH_TOKEN` and `CONTACT_EMAIL`. Merged feature branches deleted.
