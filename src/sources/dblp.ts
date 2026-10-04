import { getJson, qs } from "../lib/http";
import { asArray, clean, decodeEntities, parseYear } from "../lib/text";
import { paper, type Source } from "../types";

export const dblp: Source = {
  id: "dblp",
  name: "DBLP",
  description: "Computer science bibliography: conferences and journals.",
  async search(query, opts) {
    const { from, to } = parseYear(opts.year);
    const data = await getJson(`https://dblp.org/search/publ/api?${qs({ q: query, format: "json", h: from || to ? Math.min(opts.maxResults * 4, 1000) : opts.maxResults })}`);
    return asArray<any>(data?.result?.hits?.hit)
      .map((h) => h.info)
      .filter((i) => {
        const y = Number(i.year);
        return (!from || y >= from) && (!to || y <= to);
      })
      .slice(0, opts.maxResults)
      .map((i) => {
        const ee = asArray<string>(i.ee).find(Boolean) ?? "";
        return paper({
          paper_id: i.key,
          title: decodeEntities(clean(i.title)).replace(/\.$/, ""),
          authors: asArray<any>(i.authors?.author).map((a) => decodeEntities(typeof a === "string" ? a : a.text)),
          doi: i.doi ?? "",
          published_date: i.year ?? "",
          pdf_url: /\.pdf($|\?)/i.test(ee) || /arxiv\.org\/abs/.test(ee) ? ee.replace("/abs/", "/pdf/") : "",
          url: ee || i.url,
          source: "dblp",
          venue: i.venue ? asArray(i.venue).join(", ") : undefined,
          extra: { type: i.type, dblp_url: i.url },
        });
      });
  },
};
