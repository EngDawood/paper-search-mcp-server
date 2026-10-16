/**
 * Google Scholar, scraped directly through Firecrawl (owner's choice, docs/decisions.md #26).
 * The caller falls back to Exa when this throws or finds nothing.
 */
import { decodeEntities } from "../../lib/text";
import type { UnifiedSearchResult } from "../types";
import { scrapeUrl } from "./firecrawl";

const SCHOLAR_URL = "https://scholar.google.com/scholar";

export interface GoogleScholarOptions {
  maxResults: number;
  yearFrom?: string;
  yearTo?: string;
}

export interface GoogleScholarResponse {
  total?: number;
  results: UnifiedSearchResult[];
  searchUrl: string;
}

/** Arabic interface for Arabic queries so Scholar ranks Arabic papers first. */
export function buildGoogleScholarUrl(query: string, opts: GoogleScholarOptions): string {
  const p = new URLSearchParams({ q: query, hl: /[؀-ۿ]/.test(query) ? "ar" : "en" });
  if (opts.yearFrom) p.set("as_ylo", opts.yearFrom);
  if (opts.yearTo) p.set("as_yhi", opts.yearTo);
  // Scholar returns 10 results per page; num goes up to 20.
  p.set("num", String(Math.min(Math.max(opts.maxResults, 1), 20)));
  return `${SCHOLAR_URL}?${p}`;
}

// Inline tags (Scholar wraps matched terms in <b>) vanish without a space; block tags and <br> become one.
const text = (html: string) =>
  decodeEntities(html.replace(/<br\s*\/?>|<\/?(div|p|h\d|li)\b[^>]*>/gi, " ").replace(/<[^>]+>/g, ""))
    .replace(/[ ‏‎]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Western digits from Arabic-Indic ones, and drop thousands separators. */
const toNumber = (s: string) => Number(s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[,٬.\s]/g, ""));

/** "A Author, B Author… - Journal, 2024 - host" -> authors, venue, year. */
export function parseByline(line: string): { authors: string[]; venue?: string; year?: string } {
  const [authorPart = "", middle = ""] = line.split(/\s+-\s+/);
  const authors = authorPart
    .split(/[,،]/)
    .map((a) => a.replace(/…/g, "").trim())
    .filter(Boolean);
  const year = /\b(19|20)\d{2}\b/.exec(middle)?.[0];
  const venue = middle
    .replace(/,?\s*\b(19|20)\d{2}\b\s*$/, "")
    .replace(/…/g, "")
    .trim();
  return { authors, venue: venue && venue !== year ? venue : undefined, year };
}

/** Parse a results page. Throws when Google served a block or captcha page instead. */
export function parseGoogleScholarHtml(html: string): { total?: number; results: UnifiedSearchResult[] } {
  if (/gs_captcha|id="recaptcha"|unusual traffic|sorry\/index/i.test(html)) {
    throw new Error("Google Scholar served a captcha or block page");
  }
  const starts = [...html.matchAll(/<div[^>]*class="gs_r gs_or gs_scl[^"]*"/g)].map((m) => m.index!);
  if (!starts.length) {
    if (/gs_res_ccl_mid|id="gs_res_ccl"/.test(html)) return { total: 0, results: [] };
    throw new Error("Google Scholar page had no result list (layout changed or blocked)");
  }

  const results: UnifiedSearchResult[] = [];
  for (let i = 0; i < starts.length; i++) {
    const block = html.slice(starts[i], starts[i + 1] ?? html.length);
    const h3 = /<h3[^>]*class="gs_rt"[^>]*>([\s\S]*?)<\/h3>/.exec(block)?.[1] ?? "";
    // Drop the [PDF] / [HTML] / [BOOK] / [CITATION] type labels (nested spans, sometimes doubled).
    const title = text(h3.replace(/<span[^>]*class="gs_ct[^"]*"[^>]*>[^<]*<\/span>/g, "")).replace(/^(\[[^\]]{2,12}\]\s*)+/, "");
    if (!title) continue;
    const href = /<a[^>]*href="([^"]+)"/.exec(h3)?.[1];
    const cid = /data-cid="([^"]+)"/.exec(block)?.[1];
    const url = href
      ? decodeEntities(href)
      : cid
        ? `https://scholar.google.com/scholar?q=info:${cid}:scholar.google.com/`
        : "";
    if (!url) continue;
    const byline = text(/<div class="gs_a">([\s\S]*?)<\/div>/.exec(block)?.[1] ?? "");
    const { authors, venue, year } = parseByline(byline);
    const snippet = text(/<div class="gs_rs">([\s\S]*?)<\/div>/.exec(block)?.[1] ?? "");
    const pdf = /<div class="gs_or_ggsm"[^>]*>\s*<a href="([^"]+)"/.exec(block)?.[1];
    const cited = /<a[^>]*href="[^"]*[?&]cites=\d+[^"]*"[^>]*>([^<]*)<\/a>/.exec(block)?.[1];
    const citedCount = cited ? /[\d٠-٩][\d٠-٩,٬]*/.exec(cited)?.[0] : undefined;
    results.push({
      title,
      authors,
      url,
      source: "Google Scholar",
      journal: venue,
      year,
      snippet: snippet || undefined,
      pdfUrl: pdf ? decodeEntities(pdf) : undefined,
      citations: citedCount ? toNumber(citedCount) : undefined,
      clusterId: cid,
    });
  }

  const header = text(/<div id="gs_ab_md"[^>]*>([\s\S]*?)<\/div>/.exec(html)?.[1] ?? "");
  const totalStr = /([\d٠-٩][\d٠-٩,٬.]*)/.exec(header)?.[1];
  return { total: totalStr ? toNumber(totalStr) : undefined, results };
}

export async function searchGoogleScholar(query: string, opts: GoogleScholarOptions, firecrawlKey: string): Promise<GoogleScholarResponse> {
  const searchUrl = buildGoogleScholarUrl(query, opts);
  const scrape = await scrapeUrl(firecrawlKey, searchUrl, { formats: ["rawHtml"], waitFor: 1000 });
  if (!scrape.success || !scrape.rawHtml) throw new Error(`Firecrawl scrape failed: ${scrape.error ?? "empty page"}`);
  const { total, results } = parseGoogleScholarHtml(scrape.rawHtml);
  return { total, results: results.slice(0, opts.maxResults), searchUrl };
}
