import { getJson, qs } from "../lib/http";
import { clean, parseYear } from "../lib/text";
import { paper, type Source } from "../types";

const FL = "bibcode,title,author,abstract,doi,pubdate,pub,citation_count,keyword,esources,identifier";

export const ads: Source = {
  id: "ads",
  name: "NASA ADS",
  description:
    "NASA Astrophysics Data System: astronomy, astrophysics and physics literature with citations. Supports ADS syntax (author:, title:, year:). Requires ADS_API_KEY.",
  async search(query, opts, env) {
    if (!env.ADS_API_KEY) throw new Error("NASA ADS requires ADS_API_KEY (wrangler secret put ADS_API_KEY).");
    const { from, to } = parseYear(opts.year);
    const q = from || to ? `(${query}) year:${from ?? 1000}-${to ?? 3000}` : query;
    const data = await getJson(`https://api.adsabs.harvard.edu/v1/search/query?${qs({ q, fl: FL, rows: Math.min(opts.maxResults, 200) })}`, {
      headers: { Authorization: `Bearer ${env.ADS_API_KEY}` },
    });
    return (data?.response?.docs ?? []).map((d: any) => {
      const arxivId = (d.identifier ?? []).find((i: string) => /^arXiv:/i.test(i))?.replace(/^arXiv:/i, "");
      const es: string[] = d.esources ?? [];
      const gateway = `https://ui.adsabs.harvard.edu/link_gateway/${d.bibcode}`;
      return paper({
        paper_id: d.bibcode,
        title: clean((d.title ?? [])[0]),
        authors: d.author ?? [],
        abstract: clean(d.abstract),
        doi: (d.doi ?? [])[0] ?? "",
        published_date: String(d.pubdate ?? "").replace(/-00/g, ""),
        pdf_url: arxivId ? `https://arxiv.org/pdf/${arxivId}` : es.includes("PUB_PDF") && es.includes("ADS_PDF") ? `${gateway}/ADS_PDF` : "",
        url: `https://ui.adsabs.harvard.edu/abs/${d.bibcode}`,
        source: "ads",
        citations: d.citation_count,
        venue: d.pub,
        keywords: d.keyword,
        extra: arxivId ? { arxiv_id: arxivId } : undefined,
      });
    });
  },
};
