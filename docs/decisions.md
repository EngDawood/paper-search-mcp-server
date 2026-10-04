# Decisions

Short log of choices and the reason for each. Add new entries at the bottom.

1. **TypeScript on Workers, written from scratch.** The owner wanted a native Worker, not a Python port. Reference repos (see README Acknowledgements) were used for endpoints and approach only.

2. **Stateless MCP via the SDK's `WebStandardStreamableHTTPServerTransport`.** The `agents` package was mid-migration to SDK v2 and pulls in Durable Objects. Stateless JSON mode needs no bindings and is enough for request/response tools.

3. **`CfWorkerJsonSchemaValidator` instead of Ajv.** Ajv compiles schemas with `new Function`, which Workers forbid.

4. **No-key sources first.** Phase 1 had to work with zero configuration. Optional keys (`NCBI_API_KEY`, `SEMANTIC_SCHOLAR_API_KEY`) only raise limits.

5. **Keyed sources are hidden until their key is set** (`KEYED_SOURCES`). Avoids tools that always fail and keeps the tool list honest.

6. **OpenAlex moved to keyed.** Its no-key budget is shared per IP and Cloudflare egress IPs exhaust it, so it fails without a key.

7. **DBLP kept but removed from `search_papers` defaults.** It serves a bot challenge to datacenter IPs; keeping it in defaults only adds an error to every combined search.

8. **Edge cache in `request()`** (1 h for API GETs, 24 h for PDFs). Reduces arXiv and Semantic Scholar rate-limit hits. Cache key is the URL only, which is why API keys go in headers.

9. **PMC full text from Europe PMC `fullTextXML`, not PDF.** The PDF render URL is behind a Cloudflare challenge, and XML is cheaper on CPU than PDF parsing.

10. **bioRxiv/medRxiv search scans recent postings.** Their API has no keyword search (same approach as openags).

11. **No file downloads.** Workers have no disk; `download_*` tools from the Python repos became `find_open_access_pdf` plus `read_paper` with character pagination.

12. **`main` was created after the fact.** The repo started empty, so the feature branch became the only branch. `main` got a single `.gitignore` commit and was merged in (no force push). The owner now wants work pushed to `main` directly.

13. **`OPENALEX_API_KEY` declared in `wrangler.jsonc` under `secrets.required`.** Documents the dependency and makes `wrangler dev` warn when it is missing. The value lives only in Cloudflare secrets.
