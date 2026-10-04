import { getJson, qs } from "../lib/http";
import { asArray, clean, parseYear } from "../lib/text";
import { paper, type Source } from "../types";

const FIELDS = "halId_s,title_s,authFullName_s,abstract_s,doiId_s,producedDate_s,uri_s,fileMain_s,keyword_s,journalTitle_s,docType_s,domain_s";

export const hal: Source = {
  id: "hal",
  name: "HAL",
  description: "French national open archive: multidisciplinary papers and theses, many with full text.",
  async search(query, opts) {
    const { from, to } = parseYear(opts.year);
    const fq = from || to ? `producedDateY_i:[${from ?? "*"} TO ${to ?? "*"}]` : undefined;
    const data = await getJson(`https://api.archives-ouvertes.fr/search/?${qs({ q: query, wt: "json", rows: opts.maxResults, fl: FIELDS, fq })}`);
    return (data?.response?.docs ?? []).map((d: any) =>
      paper({
        paper_id: d.halId_s,
        title: clean(asArray(d.title_s)[0]),
        authors: asArray(d.authFullName_s),
        abstract: clean(asArray(d.abstract_s)[0]),
        doi: d.doiId_s ?? "",
        published_date: d.producedDate_s ?? "",
        pdf_url: d.fileMain_s ?? "",
        url: d.uri_s,
        source: "hal",
        venue: d.journalTitle_s,
        keywords: asArray(d.keyword_s),
        extra: { doc_type: d.docType_s },
      }),
    );
  },
};
