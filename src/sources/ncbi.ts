import { getJson, getText, qs } from "../lib/http";
import { asArray, clean, parseYear } from "../lib/text";
import { parseXml, textOf } from "../lib/xml";
import { paper, type Env, type Paper, type Source } from "../types";

const EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";

function common(env: Env) {
  return { tool: "paper-search-mcp-server", email: env.CONTACT_EMAIL, api_key: env.NCBI_API_KEY };
}

function dateRange(year?: string): Record<string, string> {
  const { from, to } = parseYear(year);
  return from || to ? { datetype: "pdat", mindate: `${from ?? 1800}`, maxdate: `${to ?? 3000}` } : {};
}

async function esearch(db: string, term: string, max: number, env: Env, extra: Record<string, string> = {}) {
  const data = await getJson(
    `${EUTILS}/esearch.fcgi?${qs({ db, term, retmax: max, retmode: "json", ...extra, ...common(env) })}`,
  );
  return (data?.esearchresult?.idlist ?? []) as string[];
}

export async function fetchPubmed(ids: string[], env: Env): Promise<Paper[]> {
  if (!ids.length) return [];
  const xml = await getText(
    `${EUTILS}/efetch.fcgi?${qs({ db: "pubmed", id: ids.join(","), retmode: "xml", ...common(env) })}`,
    { timeoutMs: 30_000 },
  );
  const root = parseXml(xml).PubmedArticleSet ?? {};
  return asArray(root.PubmedArticle).map((a: any) => {
    const cit = a.MedlineCitation ?? {};
    const art = cit.Article ?? {};
    const pmid = textOf(cit.PMID);
    const ids = asArray(a.PubmedData?.ArticleIdList?.ArticleId);
    const idOf = (t: string) => textOf(ids.find((i: any) => i["@_IdType"] === t));
    const pmcid = idOf("pmc");
    const abs = asArray(art.Abstract?.AbstractText)
      .map((t: any) => {
        const label = typeof t === "object" ? t["@_Label"] : undefined;
        const txt = clean(textOf(t));
        return label ? `${label}: ${txt}` : txt;
      })
      .join("\n");
    const pd = art.Journal?.JournalIssue?.PubDate ?? {};
    const date = [textOf(pd.Year) || textOf(pd.MedlineDate), textOf(pd.Month), textOf(pd.Day)].filter(Boolean).join(" ");
    return paper({
      paper_id: pmid,
      title: clean(textOf(art.ArticleTitle)),
      authors: asArray(art.AuthorList?.Author)
        .map((au: any) => clean(`${textOf(au.ForeName)} ${textOf(au.LastName)}`) || clean(textOf(au.CollectiveName)))
        .filter(Boolean),
      abstract: abs,
      doi: idOf("doi"),
      published_date: date,
      pdf_url: pmcid ? `https://pmc.ncbi.nlm.nih.gov/articles/${pmcid}/pdf/` : "",
      url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      source: "pubmed",
      venue: clean(textOf(art.Journal?.Title)) || undefined,
      keywords: asArray(cit.KeywordList?.Keyword).map((k: any) => clean(textOf(k))),
      categories: asArray(cit.MeshHeadingList?.MeshHeading).map((m: any) => clean(textOf(m.DescriptorName))),
      extra: pmcid ? { pmcid } : undefined,
    });
  });
}

export const pubmed: Source = {
  id: "pubmed",
  name: "PubMed",
  description: "Biomedical literature (MEDLINE). Supports PubMed query syntax, e.g. `cancer[Title] AND 2023[pdat]`.",
  async search(query, opts, env) {
    const ids = await esearch("pubmed", query, opts.maxResults, env, dateRange(opts.year));
    return fetchPubmed(ids, env);
  },
};

export const pmc: Source = {
  id: "pmc",
  name: "PubMed Central",
  description: "Free full-text biomedical articles (PMC). Results include direct PDF links.",
  async search(query, opts, env) {
    const ids = await esearch("pmc", `${query} AND open access[filter]`, opts.maxResults, env, dateRange(opts.year));
    if (!ids.length) return [];
    const data = await getJson(`${EUTILS}/esummary.fcgi?${qs({ db: "pmc", id: ids.join(","), retmode: "json", ...common(env) })}`);
    const result = data?.result ?? {};
    return (result.uids ?? []).map((uid: string) => {
      const r = result[uid] ?? {};
      const aid = (t: string) => (r.articleids ?? []).find((a: any) => a.idtype === t)?.value ?? "";
      const pmcid = aid("pmcid") || `PMC${uid}`;
      return paper({
        paper_id: pmcid,
        title: clean(r.title),
        authors: (r.authors ?? []).map((a: any) => a.name),
        doi: aid("doi"),
        published_date: r.pubdate ?? "",
        pdf_url: `https://pmc.ncbi.nlm.nih.gov/articles/${pmcid}/pdf/`,
        url: `https://pmc.ncbi.nlm.nih.gov/articles/${pmcid}/`,
        source: "pmc",
        venue: r.fulljournalname || r.source || undefined,
        extra: { pmid: aid("pmid") || undefined },
      });
    });
  },
};
