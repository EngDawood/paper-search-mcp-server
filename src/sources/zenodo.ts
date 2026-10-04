import { getJson, qs } from "../lib/http";
import { clean, parseYear, stripTags } from "../lib/text";
import { paper, type Source } from "../types";

export const zenodo: Source = {
  id: "zenodo",
  name: "Zenodo",
  description: "CERN open repository: papers, preprints, datasets, software. Elasticsearch query syntax.",
  async search(query, opts) {
    const { from, to } = parseYear(opts.year);
    const q = from || to ? `(${query}) AND publication_date:[${from ?? "*"} TO ${to ? `${to}-12-31` : "*"}]` : query;
    const data = await getJson(`https://zenodo.org/api/records?${qs({ q, size: opts.maxResults, sort: "bestmatch", type: "publication" })}`);
    return (data?.hits?.hits ?? []).map((r: any) => {
      const m = r.metadata ?? {};
      const pdf = (r.files ?? []).find((f: any) => /\.pdf$/i.test(f.key))?.links?.self ?? "";
      return paper({
        paper_id: String(r.id),
        title: clean(m.title),
        authors: (m.creators ?? []).map((c: any) => c.name),
        abstract: stripTags(m.description),
        doi: r.doi ?? m.doi ?? "",
        published_date: m.publication_date ?? "",
        pdf_url: pdf,
        url: r.links?.self_html ?? `https://zenodo.org/records/${r.id}`,
        source: "zenodo",
        keywords: m.keywords,
        venue: m.journal?.title,
        extra: { resource_type: m.resource_type?.title, access: m.access_right },
      });
    });
  },
};
