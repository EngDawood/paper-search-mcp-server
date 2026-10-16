import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { arabicSourceIds, findArabicPdf, mandumahCitation, searchArabic } from "../arabic";
import { dedupe, searchMany, type SourceOutcome } from "../lib/aggregate";
import { getText } from "../lib/http";
import { findOpenAccessPdf, type OaResult } from "../lib/resolve";
import { extractDoi } from "../lib/text";
import { normalizeArxivId } from "../sources/arxiv";
import { searchCrossref } from "../sources/crossref";
import type { Env, Paper } from "../types";

const READ_ONLY = { readOnlyHint: true, openWorldHint: true, idempotentHint: true } as const;

type Run = (fn: () => Promise<unknown>) => Promise<{ content: { type: "text"; text: string }[]; isError?: boolean }>;

/** "ar" when most letters are Arabic, "en" when Latin, "mixed" otherwise. */
export function detectLanguage(s: string): "ar" | "en" | "mixed" | "other" {
  const ar = (s.match(/[؀-ۿݐ-ݿ]/g) ?? []).length;
  const la = (s.match(/[A-Za-z]/g) ?? []).length;
  if (!ar && !la) return "other";
  if (ar / (ar + la) > 0.8) return "ar";
  if (la / (ar + la) > 0.8) return "en";
  return "mixed";
}

/** Word-overlap similarity of two titles (0..1), used to accept a title-to-DOI match. */
export function titleSimilarity(a: string, b: string): number {
  const words = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .replace(/[ً-ْـ]/g, "")
        .split(/[^\p{L}\p{N}]+/u)
        .filter((w) => w.length > 2),
    );
  const A = words(a);
  const B = words(b);
  if (!A.size || !B.size) return 0;
  let hit = 0;
  for (const w of A) if (B.has(w)) hit++;
  return hit / Math.max(A.size, B.size);
}

/** Same 25 s budget searchMany gives each international source; Firecrawl retries could otherwise take minutes. */
const ARABIC_TIMEOUT_MS = 25_000;

function withTimeout(p: Promise<{ papers: Paper[]; outcomes: SourceOutcome[] }>, source: string, ms = ARABIC_TIMEOUT_MS) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const t0 = Date.now();
  const timeout = new Promise<{ papers: Paper[]; outcomes: SourceOutcome[] }>((resolve) => {
    timer = setTimeout(() => resolve({ papers: [], outcomes: [{ source, count: 0, error: `timed out after ${ms}ms`, ms: Date.now() - t0 }] }), ms);
  });
  return Promise.race([p.finally(() => clearTimeout(timer)), timeout]);
}

const CSL_STYLES = { apa: "apa", mla: "modern-language-association", chicago: "chicago-author-date", harvard: "harvard-cite-them-right" } as const;
type Style = keyof typeof CSL_STYLES | "bibtex";

/** Formatted citation through DOI content negotiation (Crossref, DataCite and mEDRA all answer it). */
export async function doiCitation(doi: string, style: Style): Promise<string> {
  const accept = style === "bibtex" ? "application/x-bibtex" : `text/x-bibliography; style=${CSL_STYLES[style]}; locale=en-US`;
  const text = await getText(`https://doi.org/${encodeURI(doi)}`, { headers: { Accept: accept }, cacheTtl: 86_400 });
  if (/^\s*<(!doctype|html)/i.test(text)) throw new Error(`doi.org returned HTML for ${doi} (DOI not found or no metadata)`);
  return text.trim();
}

const MANDUMAH_RE = /^\d{4,}$|mandumah\.com\/Record\/\d+/i;

export function registerCrossTools(server: McpServer, env: Env, run: Run): void {
  const arabicIds = arabicSourceIds(env);
  const hasArabic = arabicIds.length > 0;
  const hasExa = !!env.EXA_API_KEY;

  server.registerTool(
    "search_all",
    {
      title: "Search everything (international + Arabic)",
      description:
        "One query across the international sources (search_papers defaults) and, when configured, the Arabic sources " +
        `(${hasArabic ? arabicIds.join(", ") : "none configured"}). Results are de-duplicated across both and each paper keeps ` +
        "`extra.found_in`. Use scope to limit to one side.",
      inputSchema: {
        query: z.string().min(1).max(500).describe("Search query, Arabic or English."),
        scope: z.enum(["all", "international", "arabic"]).default("all"),
        sources: z.array(z.string()).optional().describe("International source ids (see list_sources); omit for the defaults."),
        arabic_platforms: z.array(z.string()).optional().describe("Arabic platform keys (see list_arabic_tools); omit for the core set."),
        max_results_per_source: z.number().int().min(1).max(20).default(5),
        year: z
          .string()
          .regex(/^\s*(\d{4})?\s*-?\s*(\d{4})?\s*$/)
          .optional()
          .describe('Publication year filter: "2023", "2019-2023", "2020-" or "-2015".'),
      },
      annotations: READ_ONLY,
    },
    async ({ query, scope, sources, arabic_platforms, max_results_per_source, year }) =>
      run(async () => {
        const { defaultSources, SOURCE_MAP } = await import("../sources");
        const intlIds = (sources?.length ? [...new Set(sources)] : defaultSources(env)).filter((id) => SOURCE_MAP.has(id));
        const unknown = (sources ?? []).filter((id) => !SOURCE_MAP.has(id));
        const tasks: Promise<{ papers: Paper[]; outcomes: SourceOutcome[] }>[] = [];
        if (scope !== "arabic") tasks.push(searchMany(query, intlIds, max_results_per_source, env, year));
        if (scope !== "international" && hasArabic)
          tasks.push(withTimeout(searchArabic(query, { maxResults: max_results_per_source, year, platforms: arabic_platforms }, env), "arabic"));
        const parts = await Promise.all(tasks);
        const papers = dedupe(parts.flatMap((p) => p.papers));
        const outcomes = parts.flatMap((p) => p.outcomes);
        return {
          query,
          query_language: detectLanguage(query),
          scope,
          total: papers.length,
          sources: outcomes,
          ...(unknown.length ? { ignored_sources: unknown } : {}),
          ...(scope !== "international" && !hasArabic ? { note: "Arabic sources are not configured (FIRECRAWL_API_KEY / EXA_API_KEY)." } : {}),
          papers,
        };
      }),
  );

  server.registerTool(
    "find_pdf_anywhere",
    {
      title: "Find a PDF anywhere",
      description:
        "Find a legal PDF from a DOI, a title, or a landing page URL. DOI: open-access lookup (Unpaywall, Europe PMC, arXiv). " +
        `Title: resolves a DOI through Crossref first${hasExa ? ", and also searches ASJP and SHAMAA for Arabic papers" : ""}. ` +
        `${hasExa ? "URL: ASJP or SHAMAA article pages are read for their direct PDF link." : ""}`,
      inputSchema: {
        doi: z.string().optional(),
        title: z.string().optional(),
        authors: z.array(z.string()).optional().describe("Helps the title search."),
        url: z.string().url().optional().describe("Article landing page (ASJP, SHAMAA) or any URL containing a DOI."),
      },
      annotations: READ_ONLY,
    },
    async ({ doi, title, authors, url }) =>
      run(async () => {
        if (!doi && !title && !url) throw new Error("Provide doi, title or url.");
        const candidates: { via: string; pdf_url: string; landing_url?: string; detail?: string }[] = [];
        const errors: Record<string, string> = {};
        const note = (k: string, e: unknown) => (errors[k] = e instanceof Error ? e.message : String(e));
        let resolvedDoi = extractDoi(doi) || extractDoi(url);
        let matched: { title: string; similarity: number } | undefined;

        const jobs: Promise<void>[] = [];
        if (url && hasExa && /asjp\.cerist\.dz|shamaa\.org/i.test(url)) {
          jobs.push(
            findArabicPdf({ url }, env)
              .then((r) => {
                if (r.pdf_url) candidates.push({ via: r.source ?? "arabic", pdf_url: r.pdf_url, landing_url: r.landing_url ?? url });
              })
              .catch((e) => void note("arabic_url", e)),
          );
        }
        if (!resolvedDoi && title) {
          jobs.push(
            searchCrossref(title, { maxResults: 3 }, env)
              .then((hits) => {
                const best = hits
                  .map((p) => ({ p, s: titleSimilarity(title, p.title) }))
                  .sort((a, b) => b.s - a.s)[0];
                if (best && best.s >= 0.75 && best.p.doi) {
                  resolvedDoi = best.p.doi;
                  matched = { title: best.p.title, similarity: Math.round(best.s * 100) / 100 };
                }
              })
              .catch((e) => void note("crossref", e)),
          );
          if (hasExa && detectLanguage(title) !== "en") {
            jobs.push(
              findArabicPdf({ title, authors }, env)
                .then((r) => {
                  if (r.pdf_url) candidates.push({ via: r.source ?? "arabic", pdf_url: r.pdf_url, landing_url: r.landing_url });
                })
                .catch((e) => void note("arabic_title", e)),
            );
          }
        }
        await Promise.all(jobs);

        let oa: OaResult | undefined;
        if (resolvedDoi) {
          oa = await findOpenAccessPdf(resolvedDoi, env);
          candidates.push(...oa.candidates);
          Object.assign(errors, oa.errors);
        }
        return {
          doi: resolvedDoi || null,
          ...(matched ? { doi_matched_by_title: matched } : {}),
          pdf_url: candidates[0]?.pdf_url ?? null,
          candidates,
          ...(Object.keys(errors).length ? { errors } : {}),
        };
      }),
  );

  server.registerTool(
    "cite_paper",
    {
      title: "Cite a paper",
      description:
        "Formatted citations for a paper. DOI or arXiv id: APA, MLA, Chicago, Harvard and BibTeX through DOI content negotiation. " +
        `${env.FIRECRAWL_API_KEY ? "Mandumah record id or URL: APA and MLA from the Mandumah record page." : ""}`,
      inputSchema: {
        doi: z.string().optional(),
        arxiv_id: z.string().optional().describe("e.g. 1706.03762 (cited through its 10.48550 DataCite DOI)."),
        mandumah_id: z.string().optional().describe("Mandumah record id or search.mandumah.com/Record/<id> URL."),
        styles: z
          .array(z.enum(["apa", "mla", "chicago", "harvard", "bibtex"]))
          .min(1)
          .default(["apa", "mla", "bibtex"]),
      },
      annotations: READ_ONLY,
    },
    async ({ doi, arxiv_id, mandumah_id, styles }) =>
      run(async () => {
        if (mandumah_id) {
          if (!env.FIRECRAWL_API_KEY) throw new Error("Mandumah citations need FIRECRAWL_API_KEY.");
          if (!MANDUMAH_RE.test(mandumah_id.trim())) throw new Error("Not a Mandumah record id or URL.");
          const c = await mandumahCitation(mandumah_id.trim(), env);
          const citations: Record<string, string> = {};
          if (styles.includes("apa") && c.apa) citations.apa = c.apa;
          if (styles.includes("mla") && c.mla) citations.mla = c.mla;
          const unavailable = styles.filter((s) => !citations[s]);
          return { id: mandumah_id, record_url: c.record_url, citations, ...(unavailable.length ? { unavailable } : {}) };
        }
        const d = extractDoi(doi) || (arxiv_id ? `10.48550/arXiv.${normalizeArxivId(arxiv_id).replace(/v\d+$/, "")}` : "");
        if (!d) throw new Error("Provide a DOI, arxiv_id or mandumah_id.");
        const citations: Record<string, string> = {};
        const errors: Record<string, string> = {};
        await Promise.all(
          styles.map((s) =>
            doiCitation(d, s)
              .then((t) => void (citations[s] = t))
              .catch((e) => void (errors[s] = e instanceof Error ? e.message : String(e))),
          ),
        );
        if (!Object.keys(citations).length) throw new Error(`No citation available for ${d}: ${Object.values(errors)[0]}`);
        return { doi: d, citations, ...(Object.keys(errors).length ? { errors } : {}) };
      }),
  );
}
