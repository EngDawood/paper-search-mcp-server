import { getJson, qs } from "../lib/http";
import { clean, parseYear, stripTags } from "../lib/text";
import { paper, type Env, type Paper, type Source } from "../types";

const API = "https://api.crossref.org/works";

export function crossrefToPaper(w: any): Paper {
  const dp = (w.published ?? w["published-print"] ?? w["published-online"] ?? w.issued)?.["date-parts"]?.[0] ?? [];
  const pdf = (w.link ?? []).find((l: any) => l["content-type"] === "application/pdf")?.URL ?? "";
  return paper({
    paper_id: w.DOI,
    title: clean((w.title ?? [])[0]),
    authors: (w.author ?? []).map((a: any) => clean(`${a.given ?? ""} ${a.family ?? a.name ?? ""}`)).filter(Boolean),
    abstract: stripTags(w.abstract),
    doi: w.DOI,
    published_date: dp.map((n: number) => String(n).padStart(2, "0")).join("-"),
    pdf_url: pdf,
    url: w.URL ?? `https://doi.org/${w.DOI}`,
    source: "crossref",
    citations: w["is-referenced-by-count"],
    venue: (w["container-title"] ?? [])[0] || w.publisher || undefined,
    categories: w.subject,
    extra: { type: w.type, publisher: w.publisher, issn: w.ISSN },
  });
}

export async function getCrossrefWork(doi: string, env: Env): Promise<Paper | null> {
  const data = await getJson(`${API}/${encodeURIComponent(doi)}?${qs({ mailto: env.CONTACT_EMAIL })}`);
  return data?.message ? crossrefToPaper(data.message) : null;
}

export async function searchCrossref(
  query: string,
  opts: { maxResults: number; year?: string; filter?: string; sort?: string; order?: string },
  env: Env,
): Promise<Paper[]> {
  const { from, to } = parseYear(opts.year);
  const filters = [opts.filter, from && `from-pub-date:${from}`, to && `until-pub-date:${to}-12-31`].filter(Boolean).join(",");
  const data = await getJson(
    `${API}?${qs({ query, rows: opts.maxResults, filter: filters, sort: opts.sort, order: opts.order, mailto: env.CONTACT_EMAIL })}`,
  );
  return (data?.message?.items ?? []).map(crossrefToPaper);
}

export const crossref: Source = {
  id: "crossref",
  name: "Crossref",
  description: "DOI registry metadata for 160M+ works across all publishers and disciplines.",
  search: (q, o, env) => searchCrossref(q, o, env),
};
