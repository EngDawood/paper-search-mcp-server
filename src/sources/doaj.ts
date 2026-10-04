import { getJson, qs } from "../lib/http";
import { clean, parseYear } from "../lib/text";
import { paper, type Source } from "../types";

export const doaj: Source = {
  id: "doaj",
  name: "DOAJ",
  description: "Directory of Open Access Journals: peer-reviewed open-access articles.",
  async search(query, opts) {
    const { from, to } = parseYear(opts.year);
    const q = from || to ? `(${query}) AND bibjson.year:[${from ?? "*"} TO ${to ?? "*"}]` : query;
    const data = await getJson(`https://doaj.org/api/search/articles/${encodeURIComponent(q)}?${qs({ pageSize: opts.maxResults })}`);
    return (data?.results ?? []).map((r: any) => {
      const b = r.bibjson ?? {};
      const doi = (b.identifier ?? []).find((i: any) => i.type?.toLowerCase() === "doi")?.id ?? "";
      const link = (b.link ?? []).find((l: any) => l.type === "fulltext");
      return paper({
        paper_id: r.id,
        title: clean(b.title),
        authors: (b.author ?? []).map((a: any) => a.name),
        abstract: clean(b.abstract),
        doi,
        published_date: [b.year, b.month].filter(Boolean).join("-"),
        pdf_url: link?.content_type?.toLowerCase() === "pdf" ? link.url : "",
        url: link?.url ?? (doi ? `https://doi.org/${doi}` : `https://doaj.org/article/${r.id}`),
        source: "doaj",
        venue: b.journal?.title,
        keywords: b.keywords,
      });
    });
  },
};
