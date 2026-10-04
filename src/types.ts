export interface Env {
  /** Optional contact email: Crossref polite pool, NCBI, Unpaywall (required for Unpaywall). */
  CONTACT_EMAIL?: string;
  /** Optional NCBI key: raises PubMed/PMC limit from 3 to 10 req/s. */
  NCBI_API_KEY?: string;
  /** Optional Semantic Scholar key: dedicated rate limit instead of the shared pool. */
  SEMANTIC_SCHOLAR_API_KEY?: string;
  /** OpenAlex API key (free). Enables the OpenAlex source and tools. */
  OPENALEX_API_KEY?: string;
  /** Optional bearer token. When set, /mcp requires `Authorization: Bearer <token>`. */
  MCP_AUTH_TOKEN?: string;
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
