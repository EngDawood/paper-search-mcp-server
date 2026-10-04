import { getJson, qs } from "../lib/http";
import { clean, parseYear } from "../lib/text";
import { paper, type Source } from "../types";

export const eric: Source = {
  id: "eric",
  name: "ERIC",
  description: "US Dept. of Education research database (1.9M+ records), many with full-text PDFs.",
  async search(query, opts) {
    const { from, to } = parseYear(opts.year);
    const search = from || to ? `${query} publicationdateyear:[${from ?? 1900} TO ${to ?? 3000}]` : query;
    const data = await getJson(`https://api.ies.ed.gov/eric/?${qs({ search, format: "json", rows: opts.maxResults })}`);
    return (data?.response?.docs ?? []).map((d: any) =>
      paper({
        paper_id: d.id,
        title: clean(d.title),
        authors: d.author ?? [],
        abstract: clean(d.description),
        published_date: d.publicationdateyear ? String(d.publicationdateyear) : "",
        pdf_url: d.e_fulltextauth === 1 || d.e_fulltextauth === "T" ? `https://files.eric.ed.gov/fulltext/${d.id}.pdf` : "",
        url: `https://eric.ed.gov/?id=${d.id}`,
        source: "eric",
        venue: d.source,
        keywords: d.subject,
        extra: { peer_reviewed: d.peerreviewed },
      }),
    );
  },
};
