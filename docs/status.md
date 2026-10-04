# Status

Last updated: 2026-10-04.

## Deployment

- URL: https://paper-search-mcp-server.engdawood.workers.dev
- Deploys from `main`; a push to `main` seemed to deploy automatically (Workers Builds). Not confirmed in the dashboard.
- Auth: none (`MCP_AUTH_TOKEN` not set).
- Live smoke test: 27/31 pass, 30 tools, 19 sources.

## Secrets and vars

| Name | Set | Effect |
|---|---|---|
| `OPENALEX_API_KEY` | yes | OpenAlex source and 3 tools |
| `SEMANTIC_SCHOLAR_API_KEY` | no | Semantic Scholar tools hit 429 without it |
| `NCBI_API_KEY` | no | Optional, higher PubMed limits |
| `MCP_AUTH_TOKEN` | no | Optional, protects `/mcp` |
| `CONTACT_EMAIL` (var) | empty | Enables Unpaywall, polite pools |

## Open issues

- Semantic Scholar 429 without a key (owner action: add key).
- DBLP and IACR blocked from Cloudflare egress IPs. No code fix; possible workaround is a proxy, not planned.
- GitHub default branch may still be `claude/determined-babbage-ehx4gj`; owner should set it to `main`.
- `read_paper` cannot fetch PDFs behind bot challenges (IACR, bioRxiv, many publishers).

## Roadmap

- Phase 2 (free keys): CORE, IEEE Xplore, Springer Nature, NASA ADS. OpenAlex is done.
- Ideas: citation verification tool (inspired by tfscharff/doi-mcp), BibTeX export, OpenAlex fallback for citation tools when Semantic Scholar is rate-limited.
- Phase 3 (paid or institutional): Scopus, Web of Science, ScienceDirect.

## History

- 2026-10-04: Phase 1 built (18 free sources, 27 tools); PR #1 merged; OpenAlex added; deployed and live-tested.
