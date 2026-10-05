# Architecture

## Request flow

```
client --POST /mcp--> src/index.ts (CORS, token check, anonymous rate limit)
                        -> new McpServer + WebStandardStreamableHTTPServerTransport per request (stateless, JSON)
                        -> src/server.ts tool handler
                        -> src/sources/<source>.ts -> src/lib/http.ts (Cache API, timeout, retry) -> upstream API
```

- Stateless: no session ids, no Durable Objects. `GET /mcp` returns 405.
- `/` returns server info and active sources. `/health` returns `{ ok, version }`.
- Tool results are JSON text (`content[0].text`). Errors return `isError: true` with a message; they never throw out of the handler.

## Files

| Path | Role |
|---|---|
| `src/index.ts` | Worker entry: routing, CORS, `MCP_AUTH_TOKEN` check, `ANON_LIMITER` for anonymous requests |
| `src/server.ts` | `createServer(env)`: registers all tools with zod schemas |
| `src/types.ts` | `Env`, `Paper`, `Source`, `paper()` helper |
| `src/sources/index.ts` | `SOURCES` (free), `KEYED_SOURCES`, `activeSources(env)`, `defaultSources(env)` |
| `src/sources/*.ts` | One adapter per source; each maps upstream JSON/XML/HTML to `Paper` |
| `src/lib/http.ts` | `request/getJson/getText`: User-Agent, timeout, retry on 429/5xx, edge cache for GETs |
| `src/lib/aggregate.ts` | `searchMany` (parallel, per-source timeout) and `dedupe` (DOI, arXiv id, title) |
| `src/lib/resolve.ts` | `pdfUrlFor(source, id)`, `findOpenAccessPdf(doi)` |
| `src/lib/pdf.ts` | Fetch PDF (40 MB cap, `%PDF-` check) and extract text with `unpdf` |
| `src/lib/fulltext.ts` | Europe PMC `fullTextXML` (JATS) to plain text |
| `src/lib/text.ts`, `src/lib/xml.ts` | Entity decoding, tag stripping, DOI and year parsing; fast-xml-parser wrapper |
| `test/unit.test.ts` | Offline tests for parsers and helpers |
| `test/keyed.test.ts` | Keyed adapters against mocked `fetch` responses |
| `scripts/smoke.mjs` | Live test of every tool against a running server |

## Paper shape

Every adapter returns `Paper`: `paper_id, title, authors[], abstract, doi, published_date, pdf_url, url, source`,
plus optional `categories, keywords, citations, venue, extra`. Build it with `paper({...})` so defaults are filled.

## Adding a free source

1. Create `src/sources/<id>.ts` exporting a `Source` (`id, name, description, search(query, {maxResults, year}, env)`).
2. Add it to `SOURCES` in `src/sources/index.ts`. A generic `search_<id>` tool is registered automatically.
3. Support `year` via `parseYear` where the API allows it.
4. Add a smoke case in `scripts/smoke.mjs` and a parser test if the response needs non-trivial parsing.
5. Update README tables, `docs/sources.md`, and tool counts.

## Adding a keyed source

Same as above, but add it to `KEYED_SOURCES` with `enabled: (env) => !!env.<KEY>` and `inDefaults`, add the key to `Env` in
`src/types.ts`, register any extra tools inside `if (env.<KEY>)` in `server.ts`, and list the key in
`wrangler.jsonc` (`secrets.required` if it should always be set, otherwise the comment block). Send keys in
headers, not query strings, so they stay out of cache keys and logs. If the API only takes the key in the URL,
pass `cacheTtl: 0`. Add a mocked-fetch test in `test/keyed.test.ts`. To try it in `wrangler dev`, see decision 14.

## Runtime limits to keep in mind

- Bundle must stay under 3 MB gzip (Free) / 10 MB (Paid). Currently about 870 KiB, mostly `unpdf`.
- `limits.cpu_ms = 60000` in `wrangler.jsonc` needs the Paid plan; PDF parsing is the CPU-heavy part.
- Subrequests per invocation: 50 on Free. `search_papers` with many sources plus bioRxiv paging can approach this.
- The Cache API is a no-op on `*.workers.dev` and only works on a custom domain. The live Worker uses custom domains, so caching is active.
