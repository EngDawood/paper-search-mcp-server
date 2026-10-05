export interface Env {
  /** Optional contact email: Crossref polite pool, NCBI, Unpaywall (required for Unpaywall). */
  CONTACT_EMAIL?: string;
  /** Optional NCBI key: raises PubMed/PMC limit from 3 to 10 req/s. */
  NCBI_API_KEY?: string;
  /** Optional Semantic Scholar key: dedicated rate limit instead of the shared pool. */
  SEMANTIC_SCHOLAR_API_KEY?: string;
  /** OpenAlex API key (free). Enables the OpenAlex source and tools. */
  OPENALEX_API_KEY?: string;
  /** CORE API key (free). Enables the CORE source. */
  CORE_API_KEY?: string;
  /** IEEE Xplore API key (free). Enables the IEEE source. */
  IEEE_API_KEY?: string;
  /** Springer Nature Meta API key (free). Enables the Springer source. */
  SPRINGER_API_KEY?: string;
  /** NASA ADS API token (free). Enables the ADS source. */
  ADS_API_KEY?: string;
  /** Optional token. When set, token holders get full access and everyone else gets the anonymous tier. */
  MCP_AUTH_TOKEN?: string;
  /** Rate limiter for anonymous /mcp requests (per IP). Binding in wrangler.jsonc `ratelimits`. */
  ANON_LIMITER?: RateLimit;
  /** Usage log (one row per tool call). Binding in wrangler.jsonc `analytics_engine_datasets`. */
  USAGE?: AnalyticsEngineDataset;
}

export interface Paper {
  paper_id: string;
  title: string;
  authors: string[];
  abstract: string;
  doi: string;
  published_date: string;
  pdf_url: string;
  url: string;
  source: string;
  categories?: string[];
  keywords?: string[];
  citations?: number;
  venue?: string;
  extra?: Record<string, unknown>;
}

export interface SearchOptions {
  maxResults: number;
  year?: string;
}

export interface Source {
  id: string;
  name: string;
  description: string;
  search(query: string, opts: SearchOptions, env: Env): Promise<Paper[]>;
}

export function paper(p: Partial<Paper> & Pick<Paper, "paper_id" | "title" | "source">): Paper {
  const { paper_id, title, ...rest } = p;
  return {
    paper_id,
    title,
    authors: [],
    abstract: "",
    doi: "",
    published_date: "",
    pdf_url: "",
    url: "",
    ...rest,
  };
}
