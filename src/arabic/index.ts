/**
 * Arabic scholarly search: Mandumah (Firecrawl) and open-access repositories (Exa).
 * Self-contained module; see register.ts for the tools and the functions below for the
 * cross-source tools.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { parseYear } from "../lib/text";
import { paper, type Paper } from "../types";
import {
  CORE_OPEN_ACCESS_KEYS,
  OPEN_ACCESS_KEYS,
  OPEN_ACCESS_REPOSITORIES,
  SCHOLAR_RECORD_URL,
  UNIFIED_SEARCH_PLATFORMS,
} from "./constants";
import { registerTools } from "./register";
import { searchWithDomains } from "./services/pdf-finder";
import { getPdfUrl } from "./services/pdf-extractor";
import { getScholarCitation } from "./services/scholar-client";
import { searchArabicPapers } from "./services/unified-search";
import { ResponseFormat, type ScholarSearchResult, type UnifiedSearchResult } from "./types";
import { extractRecordId } from "./utils/url-builder";

export interface ArabicEnv {
  FIRECRAWL_API_KEY?: string;
  EXA_API_KEY?: string;
}

export function registerArabicTools(server: McpServer, env: ArabicEnv): void {
  registerTools(server, {
    firecrawlKey: env.FIRECRAWL_API_KEY,
    exaApiKey: env.EXA_API_KEY,
    hasFirecrawl: !!env.FIRECRAWL_API_KEY,
  });
}

/** Source ids searchArabic accepts with the keys that are set */
export function arabicSourceIds(env: ArabicEnv): string[] {
  const ids: string[] = [];
  if (env.FIRECRAWL_API_KEY) ids.push("mandumah");
  if (env.EXA_API_KEY) ids.push("mandumah_exa", ...OPEN_ACCESS_KEYS);
  // Google Scholar is scraped directly with Firecrawl alone
  else if (env.FIRECRAWL_API_KEY) ids.push("google_scholar");
  return ids;
}

interface Outcome {
  source: string;
  count: number;
  error?: string;
  ms: number;
  /** Google Scholar: "direct" (Firecrawl scrape) or "exa" (fallback) */
  via?: string;
  fallback_reason?: string;
}

/** Error strings from searchArabicPapers start with a label; map each back to its source id */
function errorLabels(): Array<[label: string, source: string]> {
  return [
    ["Mandumah (Firecrawl): ", "mandumah"],
    ["Mandumah (Exa): ", "mandumah_exa"],
    ...Object.entries(OPEN_ACCESS_REPOSITORIES).map(([k, v]): [string, string] => [`${v.name}: `, k]),
  ];
}

function toPaper(r: UnifiedSearchResult, source: string, raw?: ScholarSearchResult): Paper {
  const isMandumah = source === "mandumah" || source === "mandumah_exa";
  const extra: Record<string, unknown> = { arabic_source: source };
  if (raw?.publisher) extra.publisher = raw.publisher;
  if (raw?.issue) extra.issue = raw.issue;
  if (raw?.volume) extra.volume = raw.volume;
  if (raw?.pages) extra.pages = raw.pages;
  if (r.language) extra.language = r.language;
  if (r.contentType) extra.content_type = r.contentType;
  if (r.peerReviewed !== undefined) extra.peer_reviewed = r.peerReviewed;
  if (r.id) extra.record_id = r.id;
  if (r.clusterId) extra.scholar_cluster_id = r.clusterId;
  return paper({
    paper_id: r.id ?? r.url,
    title: r.title,
    authors: r.authors ?? [],
    abstract: r.abstract ?? r.snippet ?? "",
    published_date: r.year ?? "",
    pdf_url: raw?.downloadUrl ?? r.pdfUrl ?? (r.isPdfDirect ? r.url : ""),
    citations: r.citations,
    url: r.url,
    source: isMandumah ? "mandumah" : source,
    venue: r.journal,
    extra,
  });
}

/** Search for the cross-source tools. `platforms` defaults to the core set plus Mandumah. */
export async function searchArabic(
  query: string,
  opts: { maxResults: number; year?: string; platforms?: string[] },
  env: ArabicEnv,
): Promise<{ papers: Paper[]; outcomes: Outcome[] }> {
  const valid = new Set(arabicSourceIds(env));
  const requested = opts.platforms?.length ? opts.platforms : ["all"];
  const platforms = requested.filter((p) => p === "all" || valid.has(p));
  if (!platforms.length) return { papers: [], outcomes: [] };

  const { from, to } = parseYear(opts.year);
  const timings = new Map<string, number>();
  let raw: ScholarSearchResult[] = [];
  const response = await searchArabicPapers(
    {
      query: query.slice(0, 500),
      platforms,
      date_from: from ? String(from) : undefined,
      date_to: to ? String(to) : undefined,
      max_results_per_source: Math.min(Math.max(opts.maxResults, 1), 20),
      response_format: ResponseFormat.JSON,
    },
    !!env.FIRECRAWL_API_KEY,
    env.EXA_API_KEY,
    env.FIRECRAWL_API_KEY,
    { onTiming: (s, ms) => timings.set(s, ms), onMandumahRaw: (r) => (raw = r) },
  );

  const rawById = new Map(raw.map((r) => [r.id, r]));
  const papers: Paper[] = [];
  const counts = new Map<string, number>();
  const via = new Map<string, { via?: string; fallback_reason?: string }>();
  for (const g of response.resultGroups) {
    const items = g.results.slice(0, opts.maxResults);
    counts.set(g.source, items.length);
    if (g.metadata?.via) via.set(g.source, { via: g.metadata.via, ...(g.metadata.fallbackReason ? { fallback_reason: g.metadata.fallbackReason } : {}) });
    for (const r of items) {
      const p = toPaper(r, g.source, r.id ? rawById.get(r.id) : undefined);
      if (g.metadata?.via) p.extra = { ...p.extra, via: g.metadata.via };
      papers.push(p);
    }
  }

  const errors = new Map<string, string>();
  for (const e of response.errors ?? []) {
    const hit = errorLabels().find(([label]) => e.startsWith(label));
    if (hit) errors.set(hit[1], e.slice(hit[0].length));
  }
  const outcomes: Outcome[] = response.searchedPlatforms.map((source) => ({
    source,
    count: counts.get(source) ?? 0,
    ...(errors.has(source) ? { error: errors.get(source) } : {}),
    ms: timings.get(source) ?? 0,
    ...via.get(source),
  }));
  return { papers, outcomes };
}

const PDF_SITES = ["asjp", "shamaa"] as const;

/** Find a direct PDF from an ASJP/SHAMAA page (url) or by searching those sites (title). */
export async function findArabicPdf(
  input: { url?: string; title?: string; authors?: string[] },
  env: ArabicEnv,
): Promise<{ pdf_url: string | null; source?: string; landing_url?: string }> {
  const key = env.EXA_API_KEY;
  if (!key) return { pdf_url: null };

  if (input.url) {
    const r = await getPdfUrl(input.url, key);
    return { pdf_url: r.pdfUrl, source: r.source, landing_url: input.url };
  }
  if (!input.title) return { pdf_url: null };

  const domains = PDF_SITES.map((k) => OPEN_ACCESS_REPOSITORIES[k].domain);
  const hits = await searchWithDomains(input.title, input.authors, domains, 5, key, undefined, true);
  for (const hit of hits.slice(0, 3)) {
    const r = await getPdfUrl(hit.url, key);
    if (r.pdfUrl) return { pdf_url: r.pdfUrl, source: r.source, landing_url: hit.url };
  }
  return { pdf_url: null, landing_url: hits[0]?.url };
}

/** APA and MLA citations for a Mandumah record id or URL. Needs FIRECRAWL_API_KEY. */
export async function mandumahCitation(
  idOrUrl: string,
  env: ArabicEnv,
): Promise<{ apa?: string; mla?: string; record_url: string }> {
  if (!env.FIRECRAWL_API_KEY) throw new Error("FIRECRAWL_API_KEY is not configured");
  const c = await getScholarCitation(idOrUrl, "all", env.FIRECRAWL_API_KEY);
  return { apa: c.apa, mla: c.mla, record_url: `${SCHOLAR_RECORD_URL}/${extractRecordId(idOrUrl)}` };
}

export { CORE_OPEN_ACCESS_KEYS, UNIFIED_SEARCH_PLATFORMS };
