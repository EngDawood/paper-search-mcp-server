import { getText, qs } from "../lib/http";
import { decodeEntities, stripTags } from "../lib/text";
import { paper, type Paper, type Source } from "../types";

const BASE = "https://eprint.iacr.org";

/** IACR ePrint has no JSON API; parse the search results HTML. */
export function parseIacrHtml(html: string): Paper[] {
  const blocks = html.split('<div class="mb-4">').slice(1);
  const out: Paper[] = [];
  for (const b of blocks) {
    const id = /class="paperlink" href="\/(\d{4}\/\d+)"/.exec(b)?.[1];
    if (!id) continue;
    const title = stripTags(/<strong>([\s\S]*?)<\/strong>/.exec(b)?.[1]);
    const authors = decodeEntities(/<span class="fst-italic">([\s\S]*?)<\/span>/.exec(b)?.[1] ?? "")
      .split(/,\s*|\s+and\s+/)
      .map((a) => a.trim())
      .filter(Boolean);
    const abstract = stripTags(/class="mb-0 mt-1 search-abstract">([\s\S]*?)<\/p>/.exec(b)?.[1]);
    const updated = /Last updated:\s*([\d-]+)/.exec(b)?.[1] ?? "";
    const category = stripTags(/badge category[^"]*">([\s\S]*?)<\/small>/.exec(b)?.[1]);
    out.push(
      paper({
        paper_id: id,
        title,
        authors,
        abstract,
        published_date: updated,
        pdf_url: `${BASE}/${id}.pdf`,
        url: `${BASE}/${id}`,
        source: "iacr",
        categories: category ? [category] : [],
      }),
    );
  }
  return out;
}

export const iacr: Source = {
  id: "iacr",
  name: "IACR ePrint",
  description: "Cryptology ePrint Archive. Abstracts in search results are truncated.",
  async search(query, opts) {
    const html = await getText(`${BASE}/search?${qs({ q: query })}`);
    let papers = parseIacrHtml(html);
    if (opts.year) papers = papers.filter((p) => p.paper_id.startsWith(opts.year!.slice(0, 4)));
    return papers.slice(0, opts.maxResults);
  },
};
