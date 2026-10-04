import { getJson, qs } from "../lib/http";
import { clean, parseYear, stripTags } from "../lib/text";
import { paper, type Source } from "../types";

export const zbmath: Source = {
  id: "zbmath",
  name: "zbMATH Open",
  description: "Mathematics literature database (4M+ documents) with MSC classifications.",
  async search(query, opts) {
    const { from, to } = parseYear(opts.year);
    const yr = from || to ? ` py:${from ?? 1800}-${to ?? 3000}` : "";
    const data = await getJson(
      `https://api.zbmath.org/v1/document/_search?${qs({ search_string: `${query}${yr}`, results_per_page: Math.max(opts.maxResults, 1) })}`,
    );
    return (data?.result ?? []).map((d: any) => {
      const doi = (d.links ?? []).find((l: any) => l.type === "doi")?.identifier ?? "";
      const title = d.title?.title ?? d.title?.original ?? "";
      return paper({
        paper_id: d.identifier ?? String(d.id),
        title: clean(title),
        authors: (d.contributors?.authors ?? []).map((a: any) => a.name),
        abstract: stripTags(d.editorial_contributions?.[0]?.text),
        doi,
        published_date: d.year ? String(d.year) : "",
        url: `https://zbmath.org/?q=an:${d.identifier ?? d.id}`,
        source: "zbmath",
        venue: d.source?.series?.[0]?.title ?? undefined,
        categories: (d.msc ?? []).map((m: any) => m.code),
        keywords: d.keywords,
      });
    });
  },
};
