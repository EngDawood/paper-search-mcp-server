import { getJson, qs } from "../lib/http";
import { parseYear, stripTags } from "../lib/text";
import { paper, type Source } from "../types";

const API = "https://www.ebi.ac.uk/europepmc/webservices/rest/search";

export const europepmc: Source = {
  id: "europepmc",
  name: "Europe PMC",
  description: "40M+ life-science abstracts and full texts incl. PubMed, PMC, preprints, patents.",
  async search(query, opts) {
    const { from, to } = parseYear(opts.year);
    const q = from || to ? `(${query}) AND PUB_YEAR:[${from ?? 1800} TO ${to ?? 3000}]` : query;
    const data = await getJson(`${API}?${qs({ query: q, format: "json", resultType: "core", pageSize: opts.maxResults })}`);
    return (data?.resultList?.result ?? []).map((r: any) => {
      const urls: any[] = r.fullTextUrlList?.fullTextUrl ?? [];
      const pdf = urls.find((u) => u.documentStyle === "pdf" && u.availabilityCode === "OA")?.url ?? (r.pmcid ? `https://europepmc.org/articles/${r.pmcid}?pdf=render` : "");
      return paper({
        paper_id: r.pmcid || r.pmid || r.id,
        title: stripTags(r.title),
        authors: (r.authorList?.author ?? []).map((a: any) => a.fullName).filter(Boolean),
        abstract: stripTags(r.abstractText),
        doi: r.doi ?? "",
        published_date: r.firstPublicationDate ?? r.pubYear ?? "",
        pdf_url: pdf,
        url: `https://europepmc.org/article/${r.source}/${r.id}`,
        source: "europepmc",
        citations: r.citedByCount,
        venue: r.journalInfo?.journal?.title || r.bookOrReportDetails?.publisher || undefined,
        keywords: r.keywordList?.keyword,
        extra: { pmid: r.pmid, pmcid: r.pmcid, is_open_access: r.isOpenAccess === "Y", origin: r.source },
      });
    });
  },
};
