import { getJson, qs } from "../lib/http";
import { clean, parseYear } from "../lib/text";
import { paper, type Source } from "../types";

export const ieee: Source = {
  id: "ieee",
  name: "IEEE Xplore",
  description: "IEEE journals, conferences and standards (metadata and abstracts). Requires IEEE_API_KEY.",
  async search(query, opts, env) {
    if (!env.IEEE_API_KEY) throw new Error("IEEE Xplore requires IEEE_API_KEY (wrangler secret put IEEE_API_KEY).");
    const { from, to } = parseYear(opts.year);
    const url = `https://ieeexploreapi.ieee.org/api/v1/search/articles?${qs({
      querytext: query,
      max_records: Math.min(opts.maxResults, 200),
      start_year: from,
      end_year: to,
      format: "json",
      apikey: env.IEEE_API_KEY,
    })}`;
    // The key is in the URL, so skip the edge cache to keep it out of cache keys.
    const data = await getJson(url, { cacheTtl: 0 });
    return (data?.articles ?? []).map((a: any) =>
      paper({
        paper_id: String(a.article_number),
        title: clean(a.title),
        authors: (a.authors?.authors ?? []).map((x: any) => x.full_name).filter(Boolean),
        abstract: clean(a.abstract),
        doi: a.doi ?? "",
        published_date: a.publication_date ?? (a.publication_year ? String(a.publication_year) : ""),
        pdf_url: a.access_type === "OPEN_ACCESS" ? a.pdf_url ?? "" : "",
        url: a.html_url ?? a.abstract_url ?? `https://ieeexplore.ieee.org/document/${a.article_number}`,
        source: "ieee",
        citations: a.citing_paper_count,
        venue: a.publication_title,
        keywords: [...(a.index_terms?.author_terms?.terms ?? []), ...(a.index_terms?.ieee_terms?.terms ?? [])],
        extra: { access_type: a.access_type, content_type: a.content_type },
      }),
    );
  },
};
