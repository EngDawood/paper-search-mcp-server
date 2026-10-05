import { getJson, qs } from "../lib/http";
import { clean, parseYear } from "../lib/text";
import { paper, type Source } from "../types";

// Trailing slash matters: /works without it 301-redirects through a Cloudflare page.
const API = "https://api.core.ac.uk/v3/search/works/";

export const core: Source = {
  id: "core",
  name: "CORE",
  description: "Aggregator of 300M+ open-access papers from repositories and journals, many with full-text PDFs. Requires CORE_API_KEY.",
  async search(query, opts, env) {
    if (!env.CORE_API_KEY) throw new Error("CORE requires CORE_API_KEY (wrangler secret put CORE_API_KEY).");
    const { from, to } = parseYear(opts.year);
    const q = from || to ? `(${query}) AND yearPublished>=${from ?? 1000} AND yearPublished<=${to ?? 3000}` : query;
    const data = await getJson(`${API}?${qs({ q, limit: Math.min(opts.maxResults, 100) })}`, {
      headers: { Authorization: `Bearer ${env.CORE_API_KEY}` },
      timeoutMs: 30_000,
    });
    return (data?.results ?? []).map((r: any) => {
      const links: any[] = r.links ?? [];
      return paper({
        paper_id: String(r.id),
        title: clean(r.title),
        authors: (r.authors ?? []).map((a: any) => a.name).filter(Boolean),
        abstract: clean(r.abstract),
        doi: r.doi ?? "",
        published_date: r.publishedDate?.slice(0, 10) ?? (r.yearPublished ? String(r.yearPublished) : ""),
        pdf_url: r.downloadUrl ?? links.find((l) => l.type === "download")?.url ?? "",
        url: links.find((l) => l.type === "display")?.url ?? `https://core.ac.uk/works/${r.id}`,
        source: "core",
        citations: r.citationCount ?? undefined,
        venue: r.journals?.[0]?.title ?? r.publisher ?? undefined,
        extra: { document_type: r.documentType, language: r.language?.name },
      });
    });
  },
};
