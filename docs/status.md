# Status

Last updated: 2026-10-05.

## Deployment

- URL: https://paper-search-mcp.engdawood.com and https://www.paper-search-mcp.engdawood.com (custom domains in `wrangler.jsonc` `routes`).
- `*.workers.dev` returns 404: with `routes` set, wrangler disables workers.dev unless `"workers_dev": true` is added.
- Deploys from `main`; a push to `main` seemed to deploy automatically (Workers Builds). Not confirmed in the dashboard.
- Auth: bearer token required on `/mcp` (`MCP_AUTH_TOKEN` set).
- Edge cache is now active (it needs a custom domain).
- Last live smoke test (2026-10-04, phase 1 + OpenAlex, old URL): 27/31 pass. Phase 2 code is merged but not live-tested (needs the token and phase 2 keys).

## Secrets and vars

| Name | Set | Effect |
|---|---|---|
| `OPENALEX_API_KEY` | yes | OpenAlex source and 3 tools |
| `SEMANTIC_SCHOLAR_API_KEY` | no | Enables `search_semantic` and S2 lookups. Without it they are hidden and citation tools use OpenAlex |
| `CORE_API_KEY` | no | CORE source (phase 2) |
| `IEEE_API_KEY` | no | IEEE Xplore source (phase 2) |
| `SPRINGER_API_KEY` | no | Springer Nature source (phase 2) |
| `ADS_API_KEY` | no | NASA ADS source (phase 2) |
| `NCBI_API_KEY` | no | Optional, higher PubMed limits |
| `MCP_AUTH_TOKEN` | yes | Protects `/mcp` |
| `CONTACT_EMAIL` (var) | `dawood.engdawood.com` | Enables Unpaywall, polite pools. Value has no `@`, so Unpaywall will reject it; owner to confirm the address. |

## Open issues

- Semantic Scholar hidden until a key is added (owner action: add key).
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
