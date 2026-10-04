import { getJson } from "../lib/http";
import { clean, extractDoi } from "../lib/text";
import { paper, type Paper, type Source } from "../types";

const API = "https://api.biorxiv.org/details";
const PAGE = 100;

type Server = "biorxiv" | "medrxiv";

function toPaper(server: Server, r: any): Paper {
  const v = r.version || "1";
  const base = `https://www.${server}.org/content/${r.doi}v${v}`;
  return paper({
    paper_id: r.doi,
    title: clean(r.title),
    authors: String(r.authors ?? "").split(";").map((a) => a.trim()).filter(Boolean),
    abstract: clean(r.abstract),
    doi: r.doi,
    published_date: r.date ?? "",
    pdf_url: `${base}.full.pdf`,
    url: base,
    source: server,
    categories: r.category ? [r.category] : [],
    extra: { version: v, published_doi: r.published && r.published !== "NA" ? r.published : undefined },
  });
}

/**
 * bioRxiv/medRxiv have no keyword search API. Strategy (same as openags):
 *  - DOI in query -> direct lookup
 *  - otherwise scan the most recent `days` of postings and match every query term
 *    against title + abstract + category, newest first.
 */
export async function searchRxiv(server: Server, query: string, maxResults: number, days = 30, maxPages = 8): Promise<Paper[]> {
  const doi = extractDoi(query);
  if (doi) {
    const data = await getJson(`${API}/${server}/${doi}/na/json`);
    const coll: any[] = data?.collection ?? [];
    return coll.length ? [toPaper(server, coll[coll.length - 1])] : [];
  }
  const end = new Date();
  const start = new Date(end.getTime() - days * 86_400_000);
  const range = `${start.toISOString().slice(0, 10)}/${end.toISOString().slice(0, 10)}`;
  const first = await getJson(`${API}/${server}/${range}/0`);
  const total = Number(first?.messages?.[0]?.total ?? 0);
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = (r: any) => {
    const hay = `${r.title} ${r.abstract} ${r.category}`.toLowerCase();
    return terms.every((t) => hay.includes(t));
  };
  const out: Paper[] = [];
  const seen = new Set<string>();
  const take = (rows: any[]) => {
    for (const r of [...rows].reverse()) {
      if (out.length >= maxResults) return;
      if (!seen.has(r.doi) && matches(r)) {
        seen.add(r.doi);
        out.push(toPaper(server, r));
      }
    }
  };
  if (total <= PAGE) {
    take(first?.collection ?? []);
    return out;
  }
  // Walk backwards from the newest page.
  let cursor = Math.floor((total - 1) / PAGE) * PAGE;
  for (let i = 0; i < maxPages && cursor >= 0 && out.length < maxResults; i++, cursor -= PAGE) {
    const page = cursor === 0 ? first : await getJson(`${API}/${server}/${range}/${cursor}`);
    take(page?.collection ?? []);
  }
  return out;
}

export const biorxiv: Source = {
  id: "biorxiv",
  name: "bioRxiv",
  description: "Biology preprints. Keyword match over recent postings (default last 30 days) or DOI lookup.",
  search: (q, o) => searchRxiv("biorxiv", q, o.maxResults),
};

export const medrxiv: Source = {
  id: "medrxiv",
  name: "medRxiv",
  description: "Health-science preprints. Keyword match over recent postings (default last 30 days) or DOI lookup.",
  search: (q, o) => searchRxiv("medrxiv", q, o.maxResults),
};
