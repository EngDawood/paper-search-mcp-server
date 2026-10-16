# Arabic sources (src/arabic)

Moved here from [arabic-scholar-mcp](https://github.com/EngDawood/arabic-scholar-mcp) on 2026-10-16. Most of these notes
were learned from live testing. Do not undo them without new evidence.

## Layout

| Path | Role |
|---|---|
| `src/arabic/index.ts` | Exports `registerArabicTools`, `searchArabic` (to `Paper[]`), `findArabicPdf`, `mandumahCitation`, `arabicSourceIds` |
| `src/arabic/register.ts` | The 7 tools and when each registers |
| `src/arabic/services/firecrawl.ts`, `exa.ts` | REST clients (`POST /v1/scrape`, `POST /search`, `POST /contents`) through `src/lib/http.ts` |
| `src/arabic/services/scholar-client.ts` | Mandumah search, record and citation pages |
| `src/arabic/services/google-scholar.ts` | Google Scholar direct scrape and HTML parser |
| `src/arabic/services/unified-search.ts` | `search_arabic_papers`: every platform in parallel, Google Scholar direct-then-Exa |
| `src/arabic/services/pdf-finder.ts`, `pdf-extractor.ts` | Exa search (`searchWithDomains`); PDF links from ASJP/SHAMAA pages |
| `src/arabic/services/exa-result-cleaner.ts` | Keeps only paper pages, cleans titles and snippets, parses authors, ranks |
| `src/arabic/parsers/` | Mandumah `search-parser.ts` (HTML first, markdown fallback), `record-parser.ts`, `citation-parser.ts` |
| `src/arabic/constants.ts` | URLs, filters, sort mapping, `OPEN_ACCESS_REPOSITORIES` registry |
| `test/arabic/` | Ported tests plus `fixtures/` (trimmed real pages) |

Keys: `FIRECRAWL_API_KEY` (Mandumah, Google Scholar direct), `EXA_API_KEY` (open-access sites, `get_pdf_url`, fallbacks).

## Mandumah and Exa quirks

- **Date filter**: Mandumah ignores `publishDatefrom` / `publishDateto` unless `daterange[]=publishDate` is also in the URL.
- **Sort**: newest first is `sort=year`, oldest first is `sort=year asc`. `year desc` does nothing.
- **Search results are parsed from raw HTML**: Firecrawl's markdown drops the spaces around `<span class="highlight">` terms. The HTML also carries abstract, publisher, issue, pages and the PDF link. `parseSearchPage` uses HTML and falls back to markdown. The total count still comes from the markdown (`من **N**`).
- **Author names** can end with a death date ("، ت. 2021 م."); the parser strips it.
- **Exa**: never pass `category` together with `includeDomains`. Exa then ignores the domains and returns its own `exa.ai/library` entries. Results are also filtered by hostname in `searchWithDomains`.
- Unified search skips the " PDF" query suffix; `find`-style PDF lookups can add it.
- **Exa results are post-processed** in `exa-result-cleaner.ts`: only real paper pages are kept, titles and snippets are cleaned of site chrome, authors are parsed from page text where possible, results are ranked by overlap with the query. Exa is asked for 2x the results and 1500 characters of text. ASJP pages sometimes have all spaces stripped; those snippets are dropped.
- Record pages: similar items and keywords are parsed from markdown (`عناصر مشابهة`, `كلمات المؤلف المفتاحية`).
- Firecrawl `success:false` is not retried (the old SDK path retried it); HTTP 429/5xx are retried by `http.ts`.

## Google Scholar

Owner's decision (2026-10-16, decisions.md #26): scrape it directly, fall back to Exa.

- Scraped through Firecrawl (`rawHtml`), not plain `fetch`: Google blocks datacenter egress such as Cloudflare's.
- URL: `scholar.google.com/scholar?q=...&hl=ar|en&num=N&as_ylo=&as_yhi=`. `hl=ar` when the query has Arabic letters. `num` max 20.
- Parser (`parseGoogleScholarHtml`): blocks are `div.gs_r.gs_or.gs_scl` (`data-cid` = cluster id); title `h3.gs_rt` minus the `gs_ct*` type labels ([PDF], [HTML], [BOOK], [CITATION]); byline `div.gs_a` is "authors - venue, year - host"; snippet `div.gs_rs`; PDF `div.gs_or_ggsm a`; citations from the `cites=` link ("Cited by N" / Arabic label). Matched terms are wrapped in `<b>`, so inline tags are removed without adding spaces. Total from `#gs_ab_md` (Arabic-Indic digits handled).
- A captcha or block page throws, and so does a page with no result list. Then Exa is used (`includeDomains: scholar.google.com`, citation pages only). Exa is also used when the scrape returns 0 results. With Firecrawl only, the error is reported.
- Google sometimes serves a reduced page (one live English query returned 1 result). That is not detected as a failure.
- Each result carries `extra.via` = `direct` or `exa`; the outcome carries `fallback_reason`.
- Fixtures: `test/arabic/fixtures/google-scholar-{ar,en}.html` (trimmed real pages, October 2026). When the markup changes, save a new page and update them.

## Open-access registry

Registry: `OPEN_ACCESS_REPOSITORIES` in `src/arabic/constants.ts`. Mandumah is separate.

| Key | Site | In `all`? |
|---|---|---|
| `asjp`, `shamaa`, `researchgate`, `academia`, `google_scholar` | core set | yes |
| `ekb` | Egyptian Knowledge Bank journals (`*.journals.ekb.eg`, about 500k articles) | no, name it |
| `ajsrp`, `najsp`, `pal_ea` | OJS journal sites | no |
| `doaj`, `emarefa` | DOAJ article records, eMarefa | no |
| `theses_dz` | Algerian theses and articles | no |
| `kauj` | King Abdulaziz University journals (Digital Commons, mostly English) | no |
| `democraticac` | Democratic Arab Center research articles | no |
| `acm`, `sciencedirect` | English-only, abstract level | no |

`all` stays at the core set on purpose: every extra source is one more Exa call per query, and Exa quota is limited.
With only `FIRECRAWL_API_KEY`, `all` means Mandumah plus Google Scholar.

### Sites tested and rejected (do not re-add without new evidence)

Tested with live Exa queries in Arabic and English (October 2026). A site is only worth adding if Exa returns individual papers or theses that are on topic.
- Not scholarly or not individual papers: `alukah.net`, `mbrf.ae`, `mdrscenter.com`, `expertsgulf.com`, `almaany.com`, `refseek.com`, `portal.issn.org`, `wikiyetim.org`, `dohainstitute.org`.
- University or association site pages: `uqu.edu.sa`, `education.ksu.edu.sa`, `taibahu.edu.sa`, `mri.alexu.edu.eg`, `rb.iu.edu.sa`, `eaps-eg.com`, `uobaghdad.edu.iq`, `ahrq.gov`.
- Low yield or unreliable: `platform.almanhal.com` (paywalled), `zendy.io`, `dspace.wku.edu.sd` (503s), `journal.abmmc.edu.qa`.
- Duplicates of existing keys: `acm.org` (use `dl.acm.org`), `mandumah.com` (`mandumah_exa`), `aijli.`/`egjsw.`/`armin.`/`sjrc.journals.ekb.eg` (covered by `ekb`), `shamaa.org` (`shamaa`), UI pages such as ASJP advanced search and ResearchGate questions.
- Not tested: `jcoart.uobaghdad.edu.iq`. `democraticac.de` is included but is a think tank, not peer reviewed.

### Adding a site

1. Probe it: Exa search with `includeDomains: ["<domain>"]` in Arabic and English, read 10 results. Only add sites that return individual, on-topic papers.
2. Add an entry to `OPEN_ACCESS_REPOSITORIES` with `core: false`. The tool schema, descriptions and `getSourceFromUrl` derive from it.
3. Add a rule to `PAPER_URL_RULES` in `exa-result-cleaner.ts` so only paper pages pass, and the URL shapes to `test/arabic/constants/sources.test.ts`.
4. If the page text has an author block, add a branch to `extractAuthors` and a test with a trimmed real page.
5. `npm run typecheck && npm test`, then run the real search once and read the output.
6. Update the table above.

### Per-source parsing notes

- **eMarefa**: metadata is `### label` blocks and the abstract follows `### رقم السجل`. Authors from `### المؤلف`, `### المؤلف الرئيسي`, `### المؤلفون المشاركون`, returned as one entry (names cannot be split reliably).
- **Algerian theses**: the abstract starts after "Résumé:" and the title line repeats; both are removed.
- **DOAJ / NAJSP / ScienceDirect / ACM**: site suffixes stripped from titles. DOAJ has a "Read online" label. ScienceDirect snippet is the abstract or nothing.
- **NAJSP**: author lines have the affiliation glued to the name, so `authors` stays empty.
- `list_arabic_tools` text is built from the registry.

### EKB

- Searched with Exa `userLocation: "EG"` (the `location` field on its registry entry); every other source with no location; an explicit `user_location` overrides all. Live A/B tests showed location changes ranking, not reach or on-topic rate. The schema has no default for `user_location` on purpose.
- Page text often has spaces stripped; the cleaner falls back to the keyword list. Authors from the `**المؤلف**` bullet block.
- `article_N.html` and `article_N.html?lang=ar` are one article (`urlKey`).
- Direct EKB search (`journals.ekb.eg/?adv`) through Firecrawl returned the empty search page; unproven. F5 bot protection.

## Testing

- Parsers are tested against real page formats. When markup changes, save a real page, add a trimmed fixture, and assert every field you rely on.
- Firecrawl is not reachable from the dev sandbox directly; use a Firecrawl MCP tool to fetch a live page.
- Verify behavior against the deployed server too. `mandumah_search` JSON has `searchUrl`, the exact URL the running code built.
