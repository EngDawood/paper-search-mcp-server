/**
 * Type definitions for Arabic Scholar MCP Server
 */

export interface ScholarSearchResult {
  [key: string]: unknown;
  id: string;
  title: string;
  authors: string[];
  journal?: string;
  publisher?: string;
  year?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  abstract?: string;
  contentType?: string;
  language?: string;
  url: string;
  downloadUrl?: string;
  peerReviewed?: boolean;
}

export interface AppliedFilters {
  [key: string]: unknown;
  languages?: string[];
  contentTypes?: string[];
  dateFrom?: string;
  dateTo?: string;
  peerReviewed?: boolean;
  fullTextOnly?: boolean;
}

export interface ScholarSearchResponse {
  [key: string]: unknown;
  total: number;
  count: number;
  page: number;
  results: ScholarSearchResult[];
  hasMore: boolean;
  nextPage?: number;
  query: string;
  filters: AppliedFilters;
  searchUrl: string;
}

export interface SimilarItem {
  title: string;
  author?: string;
  year?: string;
  url: string;
  id: string;
}

export interface ScholarRecordDetail extends ScholarSearchResult {
  subjects?: string[];
  keywords?: string[];
  issn?: string;
  doi?: string;
  database?: string;
  fullText?: string;
  country?: string;
  hijriDate?: string;
  downloadsCount?: number;
  // Additional fields for dissertations/theses
  alternateTitle?: string;
  mainAuthorEnglish?: string;
  degreeType?: string;
  university?: string;
  college?: string;
  location?: string;
  // Related items
  similarItems?: SimilarItem[];
}

export enum ResponseFormat {
  JSON = "json",
  MARKDOWN = "markdown",
  TEXT = "text"
}

export interface ScholarCitation {
  [key: string]: unknown;
  id: string;
  apa?: string;
  mla?: string;
  citeUrl: string;
}

/**
 * PDF source from open-access repositories
 */
export interface PdfSource {
  [key: string]: unknown;
  title: string;
  url: string;
  source: string;           // Repository name
  authors?: string[];       // Best-effort, extracted from page text
  snippet?: string;
  score?: number;           // Exa relevance score
  isPdfDirect: boolean;     // URL ends with .pdf
}

/**
 * Response from find_paper_pdf tool
 */
export interface FindPaperPdfResponse {
  [key: string]: unknown;
  searchTitle: string;
  searchAuthors: string[];
  sources: PdfSource[];
  totalFound: number;
  searchedSites: string[];
}

/**
 * Response from get_pdf_url tool
 */
export interface GetPdfUrlResponse {
  [key: string]: unknown;
  url: string;              // Original input URL
  pdfUrl: string | null;    // Extracted PDF URL (null if not found)
  source: string;           // Detected source (ASJP, SHAMAA, etc.)
  supported: boolean;       // Whether extraction is supported for this source
  message?: string;         // User-friendly message (errors, login requirements)
}

/**
 * Configuration for retry logic with exponential backoff
 */
export interface RetryConfig {
  maxRetries: number;       // Maximum number of retry attempts
  initialDelayMs: number;   // Initial delay before first retry (ms)
  maxDelayMs: number;       // Maximum delay between retries (ms)
  backoffMultiplier: number; // Multiplier for exponential backoff
}

/**
 * Log level for structured logging
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Context for structured logging
 */
export interface LogContext {
  requestId?: string;       // Unique request identifier
  tool?: string;            // MCP tool name (e.g., "mandumah_search")
  service?: string;         // Service name (e.g., "firecrawl", "exa")
  operation?: string;       // Operation being performed
  [key: string]: unknown;   // Additional metadata
}

/**
 * D1 persistence record for tool call analytics
 */
export interface ToolCallRecord {
  id: string;
  tool_name: string;
  request_params: string;
  response_data: string;
  is_error: number;
  duration_ms: number;
  created_at: string;
}

/**
 * Unified search result - normalized result from multiple sources
 */
export interface UnifiedSearchResult {
  [key: string]: unknown;
  title: string;
  authors: string[];
  url: string;
  source: string;           // "Mandumah" | "ASJP" | "SHAMAA" | etc.
  // Optional Mandumah fields
  id?: string;
  journal?: string;
  year?: string;
  abstract?: string;
  contentType?: string;
  language?: string;
  peerReviewed?: boolean;
  // Optional Exa fields
  snippet?: string;
  score?: number;
  isPdfDirect?: boolean;
  // Google Scholar (direct scrape) fields
  pdfUrl?: string;
  citations?: number;
  clusterId?: string;
}

/**
 * Result group by source
 */
export interface UnifiedSearchResultGroup {
  source: string;           // "mandumah" | "asjp" | "shamaa" | etc.
  sourceLabel: string;      // Display name: "Mandumah" | "ASJP" | "SHAMAA"
  totalFound: number;
  results: UnifiedSearchResult[];
  metadata?: {              // Optional metadata for the group
    searchUrl?: string;     // Mandumah search URL
    hasMore?: boolean;      // Mandumah pagination
    nextPage?: number;
    via?: "direct" | "exa";   // Google Scholar: scraped directly or through Exa
    fallbackReason?: string;  // why the direct scrape was not used
  };
}

/**
 * Input parameters for unified search
 */
export interface UnifiedSearchParams {
  query: string;
  platforms: string[];
  // Mandumah-specific filters
  search_field?: string;
  languages?: string[];
  content_types?: string[];
  date_from?: string;
  date_to?: string;
  peer_reviewed?: boolean;
  full_text_only?: boolean;
  page?: number;
  sort?: string;
  // Exa-specific
  authors?: string[];
  max_results_per_source?: number;
  /** User location for Exa searches (ISO country code) */
  user_location?: string;
  // Output format
  response_format?: ResponseFormat;
}

/**
 * Response from unified search
 */
export interface UnifiedSearchResponse {
  [key: string]: unknown;
  query: string;
  totalResults: number;
  searchedPlatforms: string[];
  resultGroups: UnifiedSearchResultGroup[];
  errors?: string[];        // Partial failure messages
  availableKeys: {
    firecrawl: boolean;
    exa: boolean;
  };
}
