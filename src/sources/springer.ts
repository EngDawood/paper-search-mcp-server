import { getJson, qs } from "../lib/http";
import { clean, parseYear, stripTags } from "../lib/text";
import { paper, type Env, type Paper, type Source } from "../types";

function abstractText(a: unknown): string {
  if (typeof a === "string") return stripTags(a);
  if (a && typeof a === "object") return stripTags(Object.values(a as Record<string, unknown>).flat().join(" "));
  return "";
}

export async function searchSpringer(
  query: string,
  opts: { maxResults: number; year?: string; openAccessOnly?: boolean },
  env: Env,
): Promise<Paper[]> {
  if (!env.SPRINGER_API_KEY) throw new Error("Springer Nature requires SPRINGER_API_KEY (wrangler secret put SPRINGER_API_KEY).");
  const { from, to } = parseYear(opts.year);
  const parts = [query];
  if (from || to) parts.push(`datefrom:${from ?? 1800}-01-01 dateto:${to ?? 3000}-12-31`);
  if (opts.openAccessOnly) parts.push("openaccess:true");
  const url = `https://api.springernature.com/meta/v2/json?${qs({ q: parts.join(" "), p: Math.min(opts.maxResults, 50), api_key: env.SPRINGER_API_KEY })}`;
  // The key is in the URL, so skip the edge cache to keep it out of cache keys.
  const data = await getJson(url, { cacheTtl: 0 });
  return (data?.records ?? []).map((r: any) => {
    const urls: any[] = r.url ?? [];
    const oa = String(r.openaccess) === "true";
    return paper({
      paper_id: r.doi || r.identifier,
      title: clean(r.title),
      authors: (r.creators ?? []).map((c: any) => {
        const [last, first] = String(c.creator ?? "").split(/,\s*/);
        return first ? `${first} ${last}` : last;
      }),
      abstract: abstractText(r.abstract),
      doi: r.doi ?? "",
      published_date: r.publicationDate ?? "",
      pdf_url: oa ? urls.find((u) => u.format === "pdf")?.value ?? "" : "",
      url: urls.find((u) => u.format === "html")?.value ?? (r.doi ? `https://doi.org/${r.doi}` : ""),
      source: "springer",
      venue: r.publicationName,
      keywords: r.keyword,
      categories: (r.subjects ?? []).map((s: any) => (typeof s === "string" ? s : s.term)).filter(Boolean),
      extra: { open_access: oa, content_type: r.contentType, publisher: r.publisher },
    });
  });
}

export const springer: Source = {
  id: "springer",
  name: "Springer Nature",
  description: "Springer, Nature and BMC journals and books (metadata and abstracts). Requires SPRINGER_API_KEY.",
  search: (q, o, env) => searchSpringer(q, o, env),
};
