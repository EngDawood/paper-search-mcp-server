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

14. **`secrets.required` only lists `OPENALEX_API_KEY`.** Wrangler fails a deploy if a listed secret is unset, so optional keys must not be listed. Side effect: with the list present, `wrangler dev` loads only listed names from `.dev.vars`; test other keys with a temporary config copy (`wrangler dev -c`). Deploys keep existing secrets regardless.

15. **Keys in headers where the API allows it; cache off where it does not.** CORE, ADS and OpenAlex use Bearer headers. IEEE and Springer only accept the key in the URL, so those requests use `cacheTtl: 0` to keep keys out of cache keys.

16. **Citation tools fall back to OpenAlex** when Semantic Scholar errors and `OPENALEX_API_KEY` is set. Output shape is unchanged; the `source` field shows which service answered.

17. **Phase 2 adapters were verified with mocked responses and fake-key round trips only** (each API returned its auth error, proving the request shape and key placement). Real-key results still need a live check.

18. **Custom domains instead of workers.dev** (owner's change). `routes` with `custom_domain: true` for `paper-search-mcp.engdawood.com` and `www.`. This turns workers.dev off and makes the edge cache work. Add `"workers_dev": true` only if the old URL is needed again.

19. **`/mcp` is protected with `MCP_AUTH_TOKEN`** (owner's change). `/` and `/health` stay public. Clients send `Authorization: Bearer <token>`; the smoke script takes the token as its second argument.

22. **Semantic Scholar is a keyed source** (owner's choice). Without a key it was almost always 429, which wasted a slot in `search_papers` defaults and added ~3 s before the OpenAlex fallback. Now `search_semantic` and the S2 lookups appear only with `SEMANTIC_SCHOLAR_API_KEY`. The citation tools use OpenAlex directly when only its key is set, and are hidden when neither key is set. Numbered 22 because open PRs add #20 and #21.

23. **D1 usage analytics, and `AsyncLocalStorage` from `node:async_hooks`.** `src/analytics` logs every tool call (`invocations`, `queries`, `query_results`, `source_calls`, `clients`) to the optional `DB` binding; without it everything no-ops. Upstream fetches in `src/lib/http.ts` must be tied to the tool call that caused them, and tools run concurrently inside one request, so a global "current invocation" would mix them up. `AsyncLocalStorage` is the only way to do that without threading a parameter through every source adapter. It is allowed despite the "no Node-only APIs" rule because `nodejs_compat` is already enabled and it is a supported Workers API (no fs, no child_process). Only `src/analytics` uses it, `http.ts` calls the dependency-free `analytics/context.ts` hook, and a local `.d.ts` types it so `@types/node` is not needed. Writes go through `ctx.waitUntil` and `db.batch`, and failures are swallowed so analytics can never change a tool result. Data is kept forever. Tests use the built-in `node:sqlite` as a fake D1 (test code only).

24. **Arabic Scholar merged into this server** (owner's choice, 2026-10-16). The 7 Arabic tools moved to `src/arabic` with their names and output kept (`list_tools` became `list_arabic_tools`). The Firecrawl and Exa SDKs, `agents`, express and the Node/stdio mode were dropped; both APIs are called with `fetch` through `src/lib/http.ts`, so they get the same retry, timeout and analytics as every other source. SOURCE retried "scrape failed" bodies too; now only HTTP 429/5xx are retried. Keys come only from secrets (the old server also took them from query params and headers). Arabic tools stay separate, and `search_all` combines both sides.

25. **`dedupe` title keys are Unicode-aware.** The old `[^a-z0-9]` key erased Arabic titles, so every Arabic paper without a DOI merged into one. Tashkeel and tatweel are dropped so the same title with and without diacritics still merges.

26. **Several Exa / Firecrawl keys, and client-supplied keys** (owner's choice, 2026-10-20). `EXA_API_KEY` and `FIRECRAWL_API_KEY` may hold a comma-separated list. `withKeys` in `src/lib/keys.ts` starts at a random key and moves on at HTTP 401/402/429; with a list, 429 skips the same-key retry (`failFast` in `http.ts`). No state is kept about spent keys. Clients can send `X-Exa-Api-Key` / `X-Firecrawl-Api-Key`; `envWithClientKeys` swaps them into the env for that request only, replacing (never adding to) the server keys, so a client's failures never burn the owner's quota. This partly reverses #24 (keys from headers); query-string keys stay unsupported because URLs get logged. Analytics never records headers other than user-agent and protocol version.
