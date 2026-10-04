import { getJson, qs } from "../lib/http";
import { clean, parseYear } from "../lib/text";
import { paper, type Source } from "../types";

const v = (x: any) => (x && typeof x === "object" && "value" in x ? x.value : x);

export const openreview: Source = {
  id: "openreview",
  name: "OpenReview",
  description: "ML conference submissions and reviews (ICLR, NeurIPS, ICML, ...).",
  async search(query, opts) {
    const { from, to } = parseYear(opts.year);
    const data = await getJson(
      `https://api2.openreview.net/notes/search?${qs({ term: query, content: "all", group: "all", source: "forum", limit: Math.min(opts.maxResults * (from || to ? 3 : 1), 1000) })}`,
    );
    return (data?.notes ?? [])
      .map((n: any) => {
        const c = n.content ?? {};
        const pdf = v(c.pdf);
        const ts = n.pdate ?? n.cdate ?? n.tcdate;
        return paper({
          paper_id: n.id,
          title: clean(v(c.title)),
          authors: v(c.authors) ?? [],
          abstract: clean(v(c.abstract)),
          published_date: ts ? new Date(ts).toISOString().slice(0, 10) : "",
          pdf_url: pdf ? (pdf.startsWith("/") ? `https://openreview.net${pdf}` : pdf) : "",
          url: `https://openreview.net/forum?id=${n.forum ?? n.id}`,
          source: "openreview",
          venue: v(c.venue),
          keywords: v(c.keywords),
        });
      })
      .filter((p: any) => {
        const y = Number(p.published_date.slice(0, 4));
        return p.title && (!from || y >= from) && (!to || y <= to);
      })
      .slice(0, opts.maxResults);
  },
};
