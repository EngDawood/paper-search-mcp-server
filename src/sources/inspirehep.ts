import { getJson, qs } from "../lib/http";
import { clean, parseYear } from "../lib/text";
import { paper, type Source } from "../types";

const FIELDS = "titles,authors.full_name,abstracts,dois,arxiv_eprints,earliest_date,citation_count,publication_info,documents,keywords";

export const inspirehep: Source = {
  id: "inspirehep",
  name: "INSPIRE-HEP",
  description: "High-energy physics literature with citation counts. Supports INSPIRE query syntax (t, a, date).",
  async search(query, opts) {
    const { from, to } = parseYear(opts.year);
    const q = from || to ? `${query} and date ${from ?? ""}--${to ?? ""}` : query;
    const data = await getJson(`https://inspirehep.net/api/literature?${qs({ q, size: opts.maxResults, sort: "mostrecent", fields: FIELDS })}`);
    return (data?.hits?.hits ?? []).map((h: any) => {
      const m = h.metadata ?? {};
      const arxivId = m.arxiv_eprints?.[0]?.value;
      return paper({
        paper_id: String(h.id),
        title: clean(m.titles?.[0]?.title),
        authors: (m.authors ?? []).map((a: any) => a.full_name),
        abstract: clean(m.abstracts?.[0]?.value),
        doi: m.dois?.[0]?.value ?? "",
        published_date: m.earliest_date ?? "",
        pdf_url: arxivId ? `https://arxiv.org/pdf/${arxivId}` : (m.documents ?? []).find((d: any) => d.url)?.url ?? "",
        url: `https://inspirehep.net/literature/${h.id}`,
        source: "inspirehep",
        citations: m.citation_count,
        venue: m.publication_info?.[0]?.journal_title,
        keywords: (m.keywords ?? []).map((k: any) => k.value),
        extra: arxivId ? { arxiv_id: arxivId } : undefined,
      });
    });
  },
};
