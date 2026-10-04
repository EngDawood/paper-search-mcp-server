import { getJson, qs } from "../lib/http";
import { clean } from "../lib/text";
import { paper, type Env, type Paper, type Source } from "../types";

const API = "https://api.semanticscholar.org/graph/v1";
export const S2_FIELDS =
  "paperId,externalIds,title,abstract,year,publicationDate,authors,venue,citationCount,referenceCount,openAccessPdf,fieldsOfStudy,url";

function headers(env: Env) {
  return env.SEMANTIC_SCHOLAR_API_KEY ? { "x-api-key": env.SEMANTIC_SCHOLAR_API_KEY } : undefined;
}

export function s2ToPaper(p: any): Paper {
  const ext = p.externalIds ?? {};
  return paper({
    paper_id: p.paperId,
    title: clean(p.title),
    authors: (p.authors ?? []).map((a: any) => a.name),
    abstract: clean(p.abstract),
    doi: ext.DOI ?? "",
    published_date: p.publicationDate ?? (p.year ? String(p.year) : ""),
    pdf_url: p.openAccessPdf?.url ?? (ext.ArXiv ? `https://arxiv.org/pdf/${ext.ArXiv}` : ""),
    url: p.url ?? `https://www.semanticscholar.org/paper/${p.paperId}`,
    source: "semantic",
    citations: p.citationCount,
    venue: p.venue || undefined,
    categories: p.fieldsOfStudy ?? undefined,
    extra: { arxiv_id: ext.ArXiv, pmid: ext.PubMed, reference_count: p.referenceCount },
  });
}

/** Accepts S2 id, DOI, arXiv id, PMID, or prefixed ids (DOI:, ARXIV:, PMID:, CorpusId:, URL:). */
export function s2Id(id: string): string {
  const t = id.trim();
  if (/^(DOI|ARXIV|PMID|PMCID|CorpusId|MAG|ACL|URL):/i.test(t)) return t;
  if (/^10\.\d{4,}\//.test(t)) return `DOI:${t}`;
  if (/^\d{4}\.\d{4,5}(v\d+)?$/.test(t) || /^[a-z-]+(\.[A-Z]{2})?\/\d{7}$/.test(t)) return `ARXIV:${t}`;
  if (/^https?:\/\//.test(t)) return `URL:${t}`;
  return t;
}

export async function getS2Paper(id: string, env: Env): Promise<Paper> {
  return s2ToPaper(await getJson(`${API}/paper/${encodeURIComponent(s2Id(id))}?fields=${S2_FIELDS}`, { headers: headers(env), retries: 2 }));
}

export async function getS2Relations(
  id: string,
  kind: "citations" | "references",
  limit: number,
  env: Env,
): Promise<Paper[]> {
  const fields = S2_FIELDS.split(",").filter((f) => f !== "referenceCount").join(",");
  const data = await getJson(`${API}/paper/${encodeURIComponent(s2Id(id))}/${kind}?${qs({ fields, limit })}`, {
    headers: headers(env),
    retries: 2,
  });
  const key = kind === "citations" ? "citingPaper" : "citedPaper";
  return (data?.data ?? []).map((d: any) => d[key]).filter((p: any) => p?.paperId).map(s2ToPaper);
}

export const semantic: Source = {
  id: "semantic",
  name: "Semantic Scholar",
  description: "AI-powered index of 200M+ papers with citation counts and open-access PDFs. Year filter like 2019 or 2016-2020.",
  async search(query, opts, env) {
    const data = await getJson(
      `${API}/paper/search?${qs({ query, limit: Math.min(opts.maxResults, 100), fields: S2_FIELDS, year: opts.year })}`,
      { headers: headers(env), retries: 2 },
    );
    return (data?.data ?? []).map(s2ToPaper);
  },
};
