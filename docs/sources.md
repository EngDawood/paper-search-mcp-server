# Sources

Live status is from the smoke test against the deployed Worker on 2026-10-04.

## Free (no key)

| id | Endpoint | Notes | Live |
|---|---|---|---|
| arxiv | `export.arxiv.org/api/query` (Atom XML) | 1 req / 3 s policy; 429s are slow (about 15 s). `id_list` requests must not send sort params. Plain text is wrapped as `all:"..."`; field prefixes pass through. | pass |
| pubmed | NCBI E-utilities esearch + efetch (XML) | `NCBI_API_KEY` raises 3 to 10 req/s. PDF link only when a PMCID exists. | pass |
| pmc | E-utilities esearch + esummary, `open access[filter]` | No abstracts in esummary. | pass |
| europepmc | `ebi.ac.uk/europepmc/webservices/rest/search` (`resultType=core`) | `europepmc.org/...?pdf=render` serves a Cloudflare challenge; use `fullTextXML` for text. | pass |
| biorxiv / medrxiv | `api.biorxiv.org/details/{server}/{from}/{to}/{cursor}` | No keyword API. Scans the newest postings backwards (default 30 days, max 8 pages of 100) and matches all terms. DOI in the query does a direct lookup. PDFs on biorxiv.org are often 429/challenged. | pass |
| crossref | `api.crossref.org/works` | `mailto` from `CONTACT_EMAIL` for the polite pool. Abstracts are JATS. | pass |
| semantic | `api.semanticscholar.org/graph/v1` | Without a key, shared global limit; usually 429. Retries twice. Also used for citations, references, details. | fail (429, no key) |
| dblp | `dblp.org/search/publ/api` | Anubis bot challenge for datacenter IPs, including mirrors. Not in `search_papers` defaults. | fail (bot challenge) |
| openreview | `api2.openreview.net/notes/search` | Values are wrapped as `{ value }` in API v2. | pass |
| hal | `api.archives-ouvertes.fr/search/` | | pass |
| zenodo | `zenodo.org/api/records`, `type=publication` | | pass |
| openaire | `api.openaire.eu/graph/v1/researchProducts` | The old `/search/publications` endpoint timed out. Slow (40 s timeout). | pass |
| doaj | `doaj.org/api/search/articles/{query}` | | pass |
| iacr | `eprint.iacr.org/search?q=` (HTML parse) | Returned empty from Cloudflare edge; likely a challenge page. Now raises an error if the page has neither results nor "No results". PDFs are behind a Cloudflare challenge. | empty |
| zbmath | `api.zbmath.org/v1/document/_search` | | pass |
| eric | `api.ies.ed.gov/eric/` | PDF at `files.eric.ed.gov/fulltext/{id}.pdf` when `e_fulltextauth` is set. | pass |
| inspirehep | `inspirehep.net/api/literature` | | pass |

## Keyed

| id | Secret | Endpoint | Notes | Live |
|---|---|---|---|---|
| openalex | `OPENALEX_API_KEY` | `api.openalex.org/works` | Without a key the shared IP budget is exhausted (429). Key sent as `Authorization: Bearer`. Abstracts come as an inverted index. Adds `search_openalex`, `get_openalex_work`, `get_openalex_citations`. | pass |

## Lookup only

| Service | Used by | Notes |
|---|---|---|
| Unpaywall `api.unpaywall.org/v2/{doi}` | `find_open_access_pdf` | Needs `CONTACT_EMAIL`; rejects example.com addresses. Skipped when unset. |

## Rejected or deferred

- Google Scholar, Sci-Hub: excluded on purpose.
- CORE, IEEE Xplore, Springer Nature, NASA ADS: need free keys; phase 2.
- Scopus, Web of Science, ScienceDirect: paid or institutional; phase 3.
- ChemRxiv public API: 403 from datacenter IPs.
- CiteSeerX, SSRN: unreliable or scraping-only.
