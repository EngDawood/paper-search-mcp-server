import { getText, qs } from "../lib/http";
import { asArray, clean, parseYear } from "../lib/text";
import { parseXml, textOf } from "../lib/xml";
import { paper, type Paper, type Source } from "../types";

const API = "https://export.arxiv.org/api/query";
const FIELD_RE = /\b(ti|au|abs|co|jr|cat|rn|id|all):/;

export interface ArxivQuery {
  query?: string;
  title?: string;
  author?: string;
  abstract?: string;
  category?: string;
  idList?: string[];
  maxResults: number;
  start?: number;
  sortBy?: "relevance" | "lastUpdatedDate" | "submittedDate";
  sortOrder?: "ascending" | "descending";
  year?: string;
}

export function buildArxivQuery(q: ArxivQuery): string {
  const parts: string[] = [];
  if (q.query) parts.push(FIELD_RE.test(q.query) ? q.query : `all:${quoteTerm(q.query)}`);
  if (q.title) parts.push(`ti:${quoteTerm(q.title)}`);
  if (q.author) parts.push(`au:${quoteTerm(q.author)}`);
  if (q.abstract) parts.push(`abs:${quoteTerm(q.abstract)}`);
  if (q.category) parts.push(`cat:${q.category}`);
  const { from, to } = parseYear(q.year);
  if (from || to) parts.push(`submittedDate:[${from ?? 1991}01010000 TO ${to ?? 2999}12312359]`);
  return parts.map((p) => (parts.length > 1 ? `(${p})` : p)).join(" AND ");
}

function quoteTerm(s: string): string {
  const t = s.trim();
  return /\s/.test(t) && !/^".*"$/.test(t) ? `"${t}"` : t;
}

export function normalizeArxivId(id: string): string {
  return id
    .trim()
    .replace(/^arxiv:/i, "")
    .replace(/^https?:\/\/(export\.)?arxiv\.org\/(abs|pdf)\//, "")
    .replace(/\.pdf$/, "");
}

export async function queryArxiv(q: ArxivQuery): Promise<{ total: number; papers: Paper[] }> {
  const params = q.idList?.length
    ? { id_list: q.idList.map(normalizeArxivId).join(","), max_results: q.maxResults }
    : {
        search_query: buildArxivQuery(q),
        start: q.start ?? 0,
        max_results: q.maxResults,
        sortBy: q.sortBy ?? "relevance",
        sortOrder: q.sortOrder ?? "descending",
      };
  // arXiv asks for <= 1 request / 3 s; on 429 wait once and give up quickly.
  const xml = await getText(`${API}?${qs(params)}`, { timeoutMs: 25_000, retries: 1 });
  const feed = parseXml(xml).feed ?? {};
  const papers = asArray(feed.entry)
    .filter((e: any) => e?.id && e?.title && !String(e.title).startsWith("Error"))
    .map(parseEntry);
  return { total: Number(textOf(feed.totalResults)) || papers.length, papers };
}

function parseEntry(e: any): Paper {
  const absUrl = textOf(e.id);
  const id = absUrl.replace(/^https?:\/\/arxiv\.org\/abs\//, "");
  const links = asArray(e.link);
  const pdf = links.find((l: any) => l["@_title"] === "pdf")?.["@_href"] ?? `https://arxiv.org/pdf/${id}`;
  return paper({
    paper_id: id,
    title: clean(textOf(e.title)),
    authors: asArray(e.author).map((a: any) => clean(textOf(a.name))),
    abstract: clean(textOf(e.summary)),
    doi: clean(textOf(e.doi)),
    published_date: textOf(e.published),
    pdf_url: pdf.replace(/^http:/, "https:"),
    url: absUrl.replace(/^http:/, "https:"),
    source: "arxiv",
    categories: asArray(e.category).map((c: any) => c["@_term"]).filter(Boolean),
    venue: clean(textOf(e.journal_ref)) || undefined,
    extra: {
      updated: textOf(e.updated),
      primary_category: e.primary_category?.["@_term"],
      comment: clean(textOf(e.comment)) || undefined,
    },
  });
}

export const arxiv: Source = {
  id: "arxiv",
  name: "arXiv",
  description: "Preprints in physics, math, CS, q-bio, q-fin, stats, EE, econ. Supports field prefixes ti:, au:, abs:, cat:.",
  async search(query, opts) {
    return (await queryArxiv({ query, maxResults: opts.maxResults, year: opts.year })).papers;
  },
};
