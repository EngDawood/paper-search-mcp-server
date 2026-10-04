import { getJson, qs } from "../lib/http";
import { clean, extractDoi, parseYear } from "../lib/text";
import { paper, type Env, type Paper, type Source } from "../types";

const API = "https://api.openalex.org";

function headers(env: Env) {
  if (!env.OPENALEX_API_KEY) throw new Error("OpenAlex requires OPENALEX_API_KEY (wrangler secret put OPENALEX_API_KEY).");
  // Bearer header keeps the key out of URLs, logs and cache keys.
  return { Authorization: `Bearer ${env.OPENALEX_API_KEY}` };
}

/** OpenAlex stores abstracts as an inverted index: { word: [positions] }. */
export function invertedIndexToText(idx: Record<string, number[]> | null | undefined): string {
  if (!idx) return "";
  const words: string[] = [];
  for (const [word, positions] of Object.entries(idx)) for (const p of positions) words[p] = word;
  return words.filter(Boolean).join(" ");
}

export function openalexToPaper(w: any): Paper {
  const id = String(w.id ?? "").replace("https://openalex.org/", "");
  const doi = (w.doi ?? "").replace(/^https?:\/\/doi\.org\//, "");
  return paper({
    paper_id: id,
    title: clean(w.display_name ?? w.title),
    authors: (w.authorships ?? []).map((a: any) => a.author?.display_name).filter(Boolean),
    abstract: invertedIndexToText(w.abstract_inverted_index),
    doi,
    published_date: w.publication_date ?? (w.publication_year ? String(w.publication_year) : ""),
    pdf_url: w.best_oa_location?.pdf_url ?? w.primary_location?.pdf_url ?? "",
    url: w.primary_location?.landing_page_url ?? (doi ? `https://doi.org/${doi}` : `https://openalex.org/${id}`),
    source: "openalex",
    citations: w.cited_by_count,
    venue: w.primary_location?.source?.display_name ?? undefined,
    categories: (w.topics ?? []).slice(0, 3).map((t: any) => t.display_name),
    extra: { type: w.type, is_oa: w.open_access?.is_oa, oa_status: w.open_access?.oa_status },
  });
}

/** Accepts an OpenAlex id (W123), DOI, or openalex.org / doi.org URL. */
export function openalexId(id: string): string {
  const t = id.trim().replace("https://openalex.org/", "");
  if (/^W\d+$/i.test(t)) return t.toUpperCase();
  const doi = extractDoi(t);
  if (doi) return `doi:${doi}`;
  return t;
}

export async function getOpenAlexWork(id: string, env: Env): Promise<Paper> {
  return openalexToPaper(await getJson(`${API}/works/${encodeURIComponent(openalexId(id))}`, { headers: headers(env) }));
}

export async function searchOpenAlex(
  query: string,
  opts: { maxResults: number; year?: string; filter?: string; sort?: string },
  env: Env,
): Promise<Paper[]> {
  const { from, to } = parseYear(opts.year);
  const year = from || to ? `publication_year:${from ?? ""}-${to ?? ""}` : undefined;
  const filter = [opts.filter, year].filter(Boolean).join(",");
  const data = await getJson(
    `${API}/works?${qs({ search: query || undefined, filter, sort: opts.sort, per_page: Math.min(opts.maxResults, 200) })}`,
    { headers: headers(env) },
  );
  return (data?.results ?? []).map(openalexToPaper);
}

/** Works citing (`cites`) or cited by (`cited_by`) the given work. */
export async function getOpenAlexRelations(id: string, kind: "cites" | "cited_by", limit: number, env: Env): Promise<Paper[]> {
  const work = await getOpenAlexWork(id, env);
  return searchOpenAlex("", { maxResults: limit, filter: `${kind}:${work.paper_id}`, sort: "cited_by_count:desc" }, env);
}

export const openalex: Source = {
  id: "openalex",
  name: "OpenAlex",
  description: "Open catalog of 250M+ works across all disciplines, with citation counts and OA links. Requires OPENALEX_API_KEY.",
  search: (q, o, env) => searchOpenAlex(q, o, env),
};
