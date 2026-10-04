import { getJson, qs } from "../lib/http";
import { clean, parseYear, stripTags } from "../lib/text";
import { paper, type Source } from "../types";

export const openaire: Source = {
  id: "openaire",
  name: "OpenAIRE",
  description: "European open-science graph aggregating 200M+ publications from repositories and publishers.",
  async search(query, opts) {
    const { from, to } = parseYear(opts.year);
    const data = await getJson(
      `https://api.openaire.eu/graph/v1/researchProducts?${qs({
        search: query,
        type: "publication",
        pageSize: opts.maxResults,
        fromPublicationDate: from ? `${from}-01-01` : undefined,
        toPublicationDate: to ? `${to}-12-31` : undefined,
      })}`,
      { timeoutMs: 40_000 },
    );
    return (data?.results ?? []).map((r: any) => {
      const doi = (r.pids ?? []).find((p: any) => p.scheme === "doi")?.value ?? "";
      const urls: string[] = (r.instances ?? []).flatMap((i: any) => i.urls ?? []);
      return paper({
        paper_id: r.id,
        title: clean(r.mainTitle),
        authors: (r.authors ?? []).map((a: any) => a.fullName).filter(Boolean),
        abstract: stripTags((r.descriptions ?? [])[0]),
        doi,
        published_date: r.publicationDate ?? "",
        pdf_url: urls.find((u) => /\.pdf($|\?)/i.test(u)) ?? "",
        url: doi ? `https://doi.org/${doi}` : urls[0] ?? `https://explore.openaire.eu/search/publication?pid=${encodeURIComponent(r.id)}`,
        source: "openaire",
        venue: r.container?.name ?? r.publisher,
        keywords: (r.subjects ?? []).map((s: any) => s.subject?.value).filter(Boolean),
        extra: { access: r.bestAccessRight?.label, oa_color: r.openAccessColor },
      });
    });
  },
};
