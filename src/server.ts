import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CfWorkerJsonSchemaValidator } from "@modelcontextprotocol/sdk/validation/cfworker-provider.js";
import { z } from "zod";
import { searchMany } from "./lib/aggregate";
import { europePmcFullText } from "./lib/fulltext";
import { fetchPdf, pdfToText } from "./lib/pdf";
import { findOpenAccessPdf, pdfUrlFor } from "./lib/resolve";
import { extractDoi } from "./lib/text";
import { activeSources, defaultSources, SOURCE_MAP } from "./sources";
import { queryArxiv } from "./sources/arxiv";
import { searchRxiv } from "./sources/biorxiv";
import { getCrossrefWork, searchCrossref } from "./sources/crossref";
import { getOpenAlexRelations, getOpenAlexWork, searchOpenAlex } from "./sources/openalex";
import { getS2Paper, getS2Relations } from "./sources/semantic";
import { searchSpringer } from "./sources/springer";
import type { Env } from "./types";

export const VERSION = "0.1.0";

const READ_ONLY = { readOnlyHint: true, openWorldHint: true, idempotentHint: true } as const;

const maxResults = (def = 10, max = 50) =>
  z.number().int().min(1).max(max).default(def).describe(`Maximum results to return (1-${max}).`);
const yearArg = z
  .string()
  .regex(/^\s*(\d{4})?\s*-?\s*(\d{4})?\s*$/)
  .optional()
  .describe('Publication year filter: "2023", "2019-2023", "2020-" or "-2015".');

function json(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function fail(err: unknown) {
  return { isError: true, content: [{ type: "text" as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }] };
}

async function run(fn: () => Promise<unknown>) {
  try {
    return json(await fn());
  } catch (err) {
    return fail(err);
  }
}

/** `anonymous`: request had no token while MCP_AUTH_TOKEN is set. Hides token-only tools. */
export function createServer(env: Env, { anonymous = false }: { anonymous?: boolean } = {}): McpServer {
  /**
   * Semantic Scholar without a key is often rate-limited. When OpenAlex is configured and the
   * id is one OpenAlex understands (DOI or W-id), retry there. Results then carry source "openalex".
   */
  async function withOpenAlexFallback<T>(primary: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
    try {
      return await primary();
    } catch (err) {
      if (!env.OPENALEX_API_KEY) throw err;
      try {
        return await fallback();
      } catch (err2) {
        const m = (e: unknown) => (e instanceof Error ? e.message : String(e));
        throw new Error(`Semantic Scholar: ${m(err)} | OpenAlex fallback: ${m(err2)}`);
      }
    }
  }

  const SOURCES = activeSources(env);
  const DEFAULT_SOURCES = defaultSources(env);
  const server = new McpServer(
    { name: "paper-search-mcp-server", version: VERSION },
    {
      jsonSchemaValidator: new CfWorkerJsonSchemaValidator(),
      instructions:
        `Search academic papers across ${SOURCES.length} sources. Start with search_papers for broad discovery, ` +
        "use search_<source> for source-specific syntax, get_paper_details / get_citing_papers for citation graphs, " +
        "find_open_access_pdf to locate a legal PDF" +
        (anonymous ? "." : ", and read_paper to extract full text (paginate with offset)."),
    },
  );

  server.registerTool(
    "list_sources",
    { title: "List sources", description: "List all searchable sources with their ids and coverage.", annotations: READ_ONLY },
    async () => json(SOURCES.map(({ id, name, description }) => ({ id, name, description, tool: `search_${id}` }))),
  );

  server.registerTool(
    "search_papers",
    {
      title: "Search papers (multi-source)",
      description:
        `Search several sources in parallel and return de-duplicated results (merged by DOI / arXiv id / title). ` +
        `Default sources: ${DEFAULT_SOURCES.join(", ")}. Available: ${SOURCES.map((s) => s.id).join(", ")}.`,
      inputSchema: {
        query: z.string().min(1).describe("Search query."),
        sources: z
          .array(z.enum(SOURCES.map((s) => s.id) as [string, ...string[]]))
          .optional()
          .describe("Source ids to query; omit for the defaults. Use 'all' via list_sources ids."),
        max_results_per_source: maxResults(5, 25),
        year: yearArg,
      },
      annotations: READ_ONLY,
    },
    async ({ query, sources, max_results_per_source, year }) =>
      run(async () => {
        const ids = sources?.length ? [...new Set(sources)] : DEFAULT_SOURCES;
        const { papers, outcomes } = await searchMany(query, ids, max_results_per_source, env, year);
        return { query, total: papers.length, sources: outcomes, papers };
      }),
  );

  // One search_<id> tool per generic source. arXiv, Crossref and bio/medRxiv get richer tools below.
  for (const src of SOURCES) {
    if (["arxiv", "crossref", "biorxiv", "medrxiv", "openalex", "springer"].includes(src.id)) continue;
    server.registerTool(
      `search_${src.id}`,
      {
        title: `Search ${src.name}`,
        description: src.description,
        inputSchema: { query: z.string().min(1).describe("Search query."), max_results: maxResults(), year: yearArg },
        annotations: READ_ONLY,
      },
      async ({ query, max_results, year }) => run(() => src.search(query, { maxResults: max_results, year }, env)),
    );
  }

  server.registerTool(
    "search_arxiv",
    {
      title: "Search arXiv",
      description:
        "Search arXiv. `query` accepts arXiv syntax (ti:, au:, abs:, cat:, AND/OR/ANDNOT); plain text searches all fields. " +
        "Optional field filters are ANDed together.",
      inputSchema: {
        query: z.string().optional().describe("Free text or arXiv query syntax."),
        title: z.string().optional(),
        author: z.string().optional(),
        abstract: z.string().optional(),
        category: z.string().optional().describe("e.g. cs.CL, hep-th, q-bio.NC"),
        year: yearArg,
        max_results: maxResults(10, 100),
        start: z.number().int().min(0).default(0).describe("Offset for pagination."),
        sort_by: z.enum(["relevance", "lastUpdatedDate", "submittedDate"]).default("relevance"),
        sort_order: z.enum(["descending", "ascending"]).default("descending"),
      },
      annotations: READ_ONLY,
    },
    async (a) =>
      run(async () => {
        if (!a.query && !a.title && !a.author && !a.abstract && !a.category) throw new Error("Provide query or at least one field filter.");
        return queryArxiv({ ...a, maxResults: a.max_results, sortBy: a.sort_by, sortOrder: a.sort_order });
      }),
  );

  server.registerTool(
    "get_arxiv_papers",
    {
      title: "Get arXiv papers by id",
      description: "Fetch full arXiv metadata for one or more ids (e.g. 1706.03762, 2401.01234v2, hep-th/9901001).",
      inputSchema: { ids: z.array(z.string().min(1)).min(1).max(50) },
      annotations: READ_ONLY,
    },
    async ({ ids }) => run(async () => (await queryArxiv({ idList: ids, maxResults: ids.length })).papers),
  );

  server.registerTool(
    "search_crossref",
    {
      title: "Search Crossref",
      description: "Search Crossref DOI metadata (160M+ works). Supports Crossref filters and sorting.",
      inputSchema: {
        query: z.string().min(1),
        max_results: maxResults(10, 100),
        year: yearArg,
        filter: z.string().optional().describe("Crossref filter, e.g. type:journal-article,has-abstract:true"),
        sort: z.enum(["relevance", "published", "is-referenced-by-count", "updated"]).optional(),
        order: z.enum(["desc", "asc"]).optional(),
      },
      annotations: READ_ONLY,
    },
    async ({ query, max_results, ...rest }) => run(() => searchCrossref(query, { maxResults: max_results, ...rest }, env)),
  );

  for (const server_ of ["biorxiv", "medrxiv"] as const) {
    const src = SOURCE_MAP.get(server_)!;
    server.registerTool(
      `search_${server_}`,
      {
        title: `Search ${src.name}`,
        description: `${src.description} All query words must appear in title/abstract/category.`,
        inputSchema: {
          query: z.string().min(1).describe("Keywords, a category (e.g. neuroscience) or a DOI."),
          max_results: maxResults(),
          days: z.number().int().min(1).max(365).default(30).describe("How many recent days to scan."),
        },
        annotations: READ_ONLY,
      },
      async ({ query, max_results, days }) => run(() => searchRxiv(server_, query, max_results, days)),
    );
  }

  if (env.OPENALEX_API_KEY) {
    server.registerTool(
      "search_openalex",
      {
        title: "Search OpenAlex",
        description: SOURCE_MAP.get("openalex")!.description + " Supports OpenAlex filters and sorting.",
        inputSchema: {
          query: z.string().min(1),
          max_results: maxResults(10, 100),
          year: yearArg,
          filter: z.string().optional().describe("OpenAlex filter, e.g. is_oa:true,type:article,authorships.institutions.country_code:sa"),
          sort: z.enum(["relevance_score:desc", "cited_by_count:desc", "publication_date:desc"]).optional(),
        },
        annotations: READ_ONLY,
      },
      async ({ query, max_results, ...rest }) => run(() => searchOpenAlex(query, { maxResults: max_results, ...rest }, env)),
    );

    const oaId = z.string().min(1).describe("OpenAlex work id (W2741809807), DOI, or openalex.org / doi.org URL.");

    server.registerTool(
      "get_openalex_work",
      { title: "Get OpenAlex work", description: "Full OpenAlex record for one work.", inputSchema: { id: oaId }, annotations: READ_ONLY },
      async ({ id }) => run(() => getOpenAlexWork(id, env)),
    );

    server.registerTool(
      "get_openalex_citations",
      {
        title: "OpenAlex citation graph",
        description:
          "Works that cite the given work (direction=citing) or works it references (direction=references), most-cited first. " +
          "Good fallback when Semantic Scholar is rate-limited.",
        inputSchema: { id: oaId, direction: z.enum(["citing", "references"]).default("citing"), max_results: maxResults(20, 100) },
        annotations: READ_ONLY,
      },
      async ({ id, direction, max_results }) =>
        run(() => getOpenAlexRelations(id, direction === "citing" ? "cites" : "cited_by", max_results, env)),
    );
  }

  if (env.SPRINGER_API_KEY) {
    server.registerTool(
      "search_springer",
      {
        title: "Search Springer Nature",
        description: SOURCE_MAP.get("springer")!.description + " Supports Springer query syntax (title:, name:, journal:).",
        inputSchema: {
          query: z.string().min(1),
          max_results: maxResults(10, 50),
          year: yearArg,
          open_access_only: z.boolean().default(false).describe("Only return open-access records (these include PDF links)."),
        },
        annotations: READ_ONLY,
      },
      async ({ query, max_results, year, open_access_only }) =>
        run(() => searchSpringer(query, { maxResults: max_results, year, openAccessOnly: open_access_only }, env)),
    );
  }

  server.registerTool(
    "get_paper_by_doi",
    {
      title: "Get paper by DOI",
      description: "Resolve a DOI to full Crossref metadata (title, authors, venue, abstract when deposited, citation count).",
      inputSchema: { doi: z.string().min(1).describe("DOI or doi.org URL.") },
      annotations: READ_ONLY,
    },
    async ({ doi }) =>
      run(async () => {
        const d = extractDoi(doi);
        if (!d) throw new Error("Not a valid DOI.");
        return getCrossrefWork(d, env);
      }),
  );

  const paperIdArg = z
    .string()
    .min(1)
    .describe("Semantic Scholar id, DOI, arXiv id, or prefixed id (DOI:, ARXIV:, PMID:, CorpusId:, URL:).");

  server.registerTool(
    "get_paper_details",
    {
      title: "Get paper details",
      description: "Semantic Scholar record for a paper: abstract, venue, citation/reference counts, open-access PDF. Falls back to OpenAlex when configured.",
      inputSchema: { paper_id: paperIdArg },
      annotations: READ_ONLY,
    },
    async ({ paper_id }) => run(() => withOpenAlexFallback(() => getS2Paper(paper_id, env), () => getOpenAlexWork(paper_id, env))),
  );

  server.registerTool(
    "get_citing_papers",
    {
      title: "Get citing papers",
      description: "Papers that cite the given paper (forward citations), via Semantic Scholar, falling back to OpenAlex when configured.",
      inputSchema: { paper_id: paperIdArg, max_results: maxResults(20, 100) },
      annotations: READ_ONLY,
    },
    async ({ paper_id, max_results }) =>
      run(() =>
        withOpenAlexFallback(
          () => getS2Relations(paper_id, "citations", max_results, env),
          () => getOpenAlexRelations(paper_id, "cites", max_results, env),
        ),
      ),
  );

  server.registerTool(
    "get_referenced_papers",
    {
      title: "Get referenced papers",
      description: "Papers referenced by the given paper (its bibliography), via Semantic Scholar, falling back to OpenAlex when configured.",
      inputSchema: { paper_id: paperIdArg, max_results: maxResults(20, 100) },
      annotations: READ_ONLY,
    },
    async ({ paper_id, max_results }) =>
      run(() =>
        withOpenAlexFallback(
          () => getS2Relations(paper_id, "references", max_results, env),
          () => getOpenAlexRelations(paper_id, "cited_by", max_results, env),
        ),
      ),
  );

  server.registerTool(
    "find_open_access_pdf",
    {
      title: "Find open-access PDF",
      description:
        "Find legal open-access PDF links for a DOI using Semantic Scholar, Europe PMC, arXiv and (if CONTACT_EMAIL is configured) Unpaywall.",
      inputSchema: { doi: z.string().min(1) },
      annotations: READ_ONLY,
    },
    async ({ doi }) => run(() => findOpenAccessPdf(doi, env)),
  );

  // PDF parsing is CPU-heavy, so read_paper is for token holders only.
  if (!anonymous) server.registerTool(
    "read_paper",
    {
      title: "Read paper full text",
      description:
        "Download a PDF and return its extracted text, paginated by characters. Give either pdf_url, or source + paper_id " +
        "(arxiv, pmc, europepmc, biorxiv, medrxiv, openreview, eric, semantic, iacr*), or a DOI (an open-access copy is looked up). *Some hosts (IACR, publisher sites) serve bot challenges and cannot be read.",
      inputSchema: {
        source: z.string().optional().describe("Source id the paper_id belongs to."),
        paper_id: z.string().optional(),
        doi: z.string().optional(),
        pdf_url: z.string().url().optional(),
        offset: z.number().int().min(0).default(0).describe("Character offset to start from (for pagination)."),
        max_chars: z.number().int().min(1000).max(200_000).default(40_000),
      },
      annotations: READ_ONLY,
    },
    async (a) =>
      run(async () => {
        let text: string | null = null;
        let from = "";
        let pages: number | undefined;
        // PMC open-access articles: structured full text, no PDF parsing needed.
        const pmcid = !a.pdf_url && /PMC\d+/i.exec(a.paper_id ?? "")?.[0];
        if (pmcid) {
          text = await europePmcFullText(pmcid.toUpperCase());
          if (text) from = `europepmc:fullTextXML:${pmcid.toUpperCase()}`;
        }
        if (!text) {
          let url = a.pdf_url;
          if (!url && a.source && a.paper_id) url = await pdfUrlFor(a.source, a.paper_id, env);
          if (!url && (a.doi || a.paper_id)) url = await pdfUrlFor("doi", a.doi ?? a.paper_id!, env);
          if (!url) throw new Error("Provide pdf_url, source + paper_id, or doi.");
          if (!/^https?:\/\//.test(url)) throw new Error("Only http(s) URLs are supported.");
          ({ pages, text } = await pdfToText(await fetchPdf(url)));
          from = url;
        }
        const chunk = text.slice(a.offset, a.offset + a.max_chars);
        const next = a.offset + chunk.length;
        return {
          from,
          pages,
          total_chars: text.length,
          offset: a.offset,
          next_offset: next < text.length ? next : null,
          text: chunk,
        };
      }),
  );

  return server;
}
