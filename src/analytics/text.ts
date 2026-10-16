export type QueryLanguage = "ar" | "en" | "mixed" | "other";

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/**
 * Normalize a query for grouping: NFKC, lowercase, strip tashkeel and tatweel, unify alef forms,
 * ta marbuta -> ha, alef maqsura -> ya, Arabic-Indic digits -> ASCII, collapse whitespace.
 */
export function normalizeQuery(q: string): string {
  return q
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)))
    .replace(/\s+/g, " ")
    .trim();
}

export function detectLanguage(q: string): QueryLanguage {
  const ar = (q.match(/\p{Script=Arabic}/gu) ?? []).length;
  const en = (q.match(/\p{Script=Latin}/gu) ?? []).length;
  if (ar && en) return "mixed";
  if (ar) return "ar";
  if (en) return "en";
  return "other";
}

const SENSITIVE_PARAM = /^(.*[_-])?(api[_-]?key|apikey|key|token|secret|password|passwd|auth|authorization|mailto|email|sig|signature)$/i;

/** Path plus query string, with values of key-like parameters replaced, truncated. */
export function redactPath(url: string, max = 300): { host: string; path: string } {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return { host: "", path: "" };
  }
  const parts: string[] = [];
  for (const [k, v] of u.searchParams) parts.push(`${k}=${SENSITIVE_PARAM.test(k) ? "***" : v}`);
  const path = u.pathname + (parts.length ? `?${parts.join("&")}` : "");
  return { host: u.host, path: path.length > max ? path.slice(0, max) : path };
}

const HOST_SOURCES: [RegExp, string | ((path: string) => string)][] = [
  [/^export\.arxiv\.org$|^arxiv\.org$/, "arxiv"],
  [/^api\.crossref\.org$/, "crossref"],
  [/^api\.openalex\.org$/, "openalex"],
  [/^api\.semanticscholar\.org$/, "semantic"],
  [/^eutils\.ncbi\.nlm\.nih\.gov$|^pubmed\.ncbi\.nlm\.nih\.gov$|^pmc\.ncbi\.nlm\.nih\.gov$/, "pubmed"],
  [/^www\.ebi\.ac\.uk$|^europepmc\.org$/, "europepmc"],
  [/^api\.biorxiv\.org$/, (p) => (p.includes("/medrxiv") ? "medrxiv" : "biorxiv")],
  [/^api\.core\.ac\.uk$/, "core"],
  [/^ieeexploreapi\.ieee\.org$/, "ieee"],
  [/^api\.springernature\.com$/, "springer"],
  [/^api\.adsabs\.harvard\.edu$/, "ads"],
  [/^api\.openaire\.eu$/, "openaire"],
  [/^doaj\.org$/, "doaj"],
  [/^dblp\.org$/, "dblp"],
  [/^api\.archives-ouvertes\.fr$/, "hal"],
  [/^api2?\.openreview\.net$/, "openreview"],
  [/^api\.ies\.ed\.gov$|^eric\.ed\.gov$|^files\.eric\.ed\.gov$/, "eric"],
  [/^api\.zbmath\.org$|^zbmath\.org$/, "zbmath"],
  [/^zenodo\.org$/, "zenodo"],
  [/^inspirehep\.net$/, "inspirehep"],
  [/^eprint\.iacr\.org$/, "iacr"],
  [/^api\.unpaywall\.org$/, "unpaywall"],
  // Arabic: Firecrawl only scrapes Mandumah; Exa serves every open-access Arabic platform (per-site split is in query_results).
  [/^api\.firecrawl\.dev$/, "mandumah"],
  [/^api\.exa\.ai$/, "exa"],
  [/^doi\.org$/, "doi"],
];

/** Best-effort source id for an upstream host (null when unknown). */
export function sourceForHost(host: string, path = ""): string | null {
  for (const [re, id] of HOST_SOURCES) if (re.test(host)) return typeof id === "function" ? id(path) : id;
  return null;
}
