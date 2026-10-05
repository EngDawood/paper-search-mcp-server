# paper-search-mcp-server

An MCP server for searching academic papers, written in TypeScript and built to run on **Cloudflare Workers**.
Phase 1 covers **18 sources that need no API key**.

- Transport: MCP Streamable HTTP at `/mcp`, stateless, JSON responses. No Durable Objects, KV, or D1 needed.
- Bundle: about 870 KiB gzipped, under the 3 MB Free-plan limit.
- Full text: `read_paper` extracts PDF text with [`unpdf`](https://github.com/unjs/unpdf). For PMC open-access articles it uses Europe PMC's structured XML instead.

## Sources (no API key)

| id | Source | Coverage |
|---|---|---|
| `arxiv` | arXiv | Physics, math, CS, q-bio, stats preprints |
| `pubmed` | PubMed | Biomedical literature (MEDLINE) |
| `pmc` | PubMed Central | Open-access biomedical full text |
| `europepmc` | Europe PMC | Life-science abstracts, full texts, preprints |
| `biorxiv` | bioRxiv | Biology preprints (recent-window keyword match or DOI) |
| `medrxiv` | medRxiv | Health-science preprints (same strategy) |
| `crossref` | Crossref | DOI metadata, all disciplines |
| `dblp` | DBLP | Computer science bibliography |
| `openreview` | OpenReview | ML conference papers (ICLR, NeurIPS, ...) |
| `hal` | HAL | French open archive, multidisciplinary |
| `zenodo` | Zenodo | CERN open repository |
| `openaire` | OpenAIRE | European open-science graph |
| `doaj` | DOAJ | Open-access journal articles |
| `iacr` | IACR ePrint | Cryptology preprints |
| `zbmath` | zbMATH Open | Mathematics |
| `eric` | ERIC | Education research |
| `inspirehep` | INSPIRE-HEP | High-energy physics |

## Sources with an API key

| id | Source | Secret | Adds tools |
|---|---|---|---|
| `semantic` | Semantic Scholar (200M+ papers, citations, OA PDFs) | `SEMANTIC_SCHOLAR_API_KEY` (free at semanticscholar.org/product/api) | `search_semantic`; joins `search_papers` defaults; primary for the citation tools; extra `find_open_access_pdf` lookup |
| `openalex` | OpenAlex (250M+ works, all disciplines) | `OPENALEX_API_KEY` (free at openalex.org) | `search_openalex`, `get_openalex_work`, `get_openalex_citations`; joins `search_papers` defaults; fallback for the citation tools |
| `core` | CORE (300M+ open-access papers) | `CORE_API_KEY` (free at core.ac.uk/services/api) | `search_core`; joins `search_papers` defaults |
| `ieee` | IEEE Xplore | `IEEE_API_KEY` (free at developer.ieee.org) | `search_ieee` |
| `springer` | Springer Nature (Springer, Nature, BMC) | `SPRINGER_API_KEY` (free at dev.springernature.com) | `search_springer` (with `open_access_only`) |
| `ads` | NASA ADS (astronomy, astrophysics, physics) | `ADS_API_KEY` (free token in ADS settings) | `search_ads` |

These tools only appear when the secret is set. Semantic Scholar works without a key in theory, but the shared pool
is almost always rate-limited, so it is hidden until the key is set.

`get_paper_details`, `get_citing_papers` and `get_referenced_papers` need one of the two keys: with
`SEMANTIC_SCHOLAR_API_KEY` they use Semantic Scholar and retry on OpenAlex (results then have `source: "openalex"`);
with only `OPENALEX_API_KEY` they use OpenAlex directly; with neither they are hidden.

## Tools (23 without keys, up to 34 with all keys)

| Tool | Purpose |
|---|---|
| `list_sources` | List source ids and coverage |
| `search_papers` | Parallel multi-source search, de-duplicated by DOI / arXiv id / title |
| `search_<source>` | One per source (17 without keys). `search_arxiv` supports `title`, `author`, `category`, sort and paging. `search_crossref` supports filters and sort. `search_biorxiv`/`search_medrxiv` take `days`. |
| `get_arxiv_papers` | Metadata for arXiv ids |
| `get_paper_by_doi` | Crossref record for a DOI |
| `get_paper_details` | Paper record by DOI, arXiv id, PMID or S2/OpenAlex id (needs a Semantic Scholar or OpenAlex key) |
| `get_citing_papers` / `get_referenced_papers` | Citation graph via Semantic Scholar or OpenAlex (needs either key) |
| `find_open_access_pdf` | Legal OA PDF links (Europe PMC, arXiv, Unpaywall if `CONTACT_EMAIL` is set, Semantic Scholar if keyed) |
| `read_paper` | Full text from `pdf_url`, `source` + `paper_id`, or a DOI. Paginate with `offset` / `max_chars`. |

All search tools accept `year`: `"2023"`, `"2019-2023"`, `"2020-"` or `"-2015"`.

## Run locally

```bash
npm install
npm run dev                  # http://localhost:8787/mcp
npm run smoke                # calls every tool against the dev server
npm test                     # unit tests (parsers, dedupe, query builders)
npm run typecheck
```

## Deploy

```bash
npx wrangler login
npm run deploy
```

Optional configuration:

```bash
# wrangler.jsonc -> vars
CONTACT_EMAIL = "you@example.com"     # enables Unpaywall; polite pool for Crossref/NCBI

# secrets
npx wrangler secret put MCP_AUTH_TOKEN            # require Authorization: Bearer <token> on /mcp
npx wrangler secret put NCBI_API_KEY              # PubMed/PMC 3 -> 10 req/s
npx wrangler secret put SEMANTIC_SCHOLAR_API_KEY  # free key, avoids the shared 429 pool
npx wrangler secret put OPENALEX_API_KEY          # enables OpenAlex search and citation graph
npx wrangler secret put CORE_API_KEY              # enables CORE
npx wrangler secret put IEEE_API_KEY              # enables IEEE Xplore
npx wrangler secret put SPRINGER_API_KEY          # enables Springer Nature
npx wrangler secret put ADS_API_KEY               # enables NASA ADS
```

`wrangler.jsonc` sets `limits.cpu_ms = 60000` because PDF parsing is CPU-heavy, and that setting requires the **Workers Paid** plan.
On the Free plan, remove `limits`. Searches still work, but `read_paper` on large PDFs may hit the 10 ms CPU cap.

## Connect a client

Claude Code:

```bash
claude mcp add --transport http paper-search https://paper-search-mcp-server.<you>.workers.dev/mcp
# with auth: --header "Authorization: Bearer <token>"
```

Claude Desktop / others (via `mcp-remote`):

```json
{
  "mcpServers": {
    "paper-search": { "command": "npx", "args": ["mcp-remote", "https://paper-search-mcp-server.<you>.workers.dev/mcp"] }
  }
}
```

## Known limits

- **Semantic Scholar** is hidden until `SEMANTIC_SCHOLAR_API_KEY` is set (the keyless pool is almost always 429).
- **arXiv** asks for at most 1 request per 3 s. GET responses are cached for 1 h with the Workers Cache API. The cache only works on a custom domain; on `*.workers.dev` it does nothing. Adding custom-domain `routes` also turns `workers.dev` off unless you set `"workers_dev": true`.
- **DBLP** sometimes serves a bot challenge (Anubis) to datacenter IPs.
- **IACR PDFs, some publisher PDFs, and bioRxiv PDFs** can be behind Cloudflare/bot challenges, so `read_paper` cannot fetch them.
- **bioRxiv/medRxiv** have no keyword API, so search scans recent postings (default 30 days, up to 800 papers).

## Roadmap

- Phase 2 (free API keys): OpenAlex, CORE, IEEE Xplore, Springer Nature, NASA ADS (done).
- Phase 3 (paid or institutional): Scopus, Web of Science, ScienceDirect.

## Acknowledgements

This server is a fresh TypeScript implementation written for Cloudflare Workers. No code was copied verbatim.
The projects below were used as references for API endpoints, query patterns and source coverage. Thanks to their authors.

| Project | What it informed |
|---|---|
| [openags/paper-search-mcp](https://github.com/openags/paper-search-mcp) | Main reference: source list, endpoints, bioRxiv/medRxiv recent-window search, OpenReview and IACR handling |
| [adamamer20/paper-search-mcp-openai](https://github.com/adamamer20/paper-search-mcp-openai) | Fork of the above; Crossref and Semantic Scholar usage |
| [Dianel555/paper-search-mcp-nodejs](https://github.com/Dianel555/paper-search-mcp-nodejs) | Node/TypeScript structure for multi-source searchers |
| [prashalruchiranga/arxiv-mcp-server](https://github.com/prashalruchiranga/arxiv-mcp-server) | arXiv field search (title, author, category, dates) |
| [lecigarevolant/arxiv-mcp-server-gpt](https://github.com/lecigarevolant/arxiv-mcp-server-gpt) | arXiv lookup by id and full-text loading |
| [alexgenovese/mcp-arxiv](https://github.com/alexgenovese/mcp-arxiv) | arXiv Atom XML parsing in TypeScript |
| [tfscharff/doi-mcp](https://github.com/tfscharff/doi-mcp) | Idea and endpoints for zbMATH, ERIC and INSPIRE-HEP |
| [kyeshmz/academix-mcp](https://github.com/kyeshmz/academix-mcp) | Reference for an MCP server running on Cloudflare Workers |
