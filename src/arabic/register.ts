/**
 * Registers the 7 Arabic tools on an McpServer. Mandumah tools need FIRECRAWL_API_KEY,
 * Exa-backed parts need EXA_API_KEY; search_arabic_papers works with either.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CORE_OPEN_ACCESS_KEYS, OPEN_ACCESS_KEYS, OPT_IN_OPEN_ACCESS_KEYS } from "./constants";
import {
  GetPdfUrlInputSchema,
  ListToolsInputSchema,
  ScholarGetCitationInputSchema,
  ScholarGetRecordInputSchema,
  ScholarListFiltersInputSchema,
  ScholarSearchInputSchema,
  UnifiedSearchInputSchema,
} from "./schemas/index";
import {
  handleGetPdfUrl,
  handleListTools,
  handleMandumahGetCitation,
  handleMandumahGetRecord,
  handleMandumahListFilters,
  handleMandumahSearch,
  handleSearchArabicPapers,
} from "./tools/handlers/index";
import type { ToolHandlerDeps } from "./tools/types";

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true } as const;
const STATIC = { ...READ_ONLY, openWorldHint: false } as const;

export function registerTools(server: McpServer, deps: ToolHandlerDeps): void {
  const hasExa = !!deps.exaApiKey;

  if (deps.hasFirecrawl || hasExa)
  server.registerTool(
    "search_arabic_papers",
    {
      title: "Unified Arabic Papers Search",
      description: `Search for Arabic academic papers across multiple sources simultaneously - Mandumah database and open-access repositories.

This tool provides a unified search across:
  - Mandumah (دار المنظومة) - Primary Arabic academic database via Firecrawl
  - ASJP (asjp.cerist.dz) - Algerian Scientific Journals Platform
  - SHAMAA (search.shamaa.org) - Syrian E-Library for Higher Education
  - ResearchGate - Academic social network
  - Academia.edu - Academic social network
  - Google Scholar - Academic search engine
  - Mandumah via Exa (mandumah_exa) - Fallback when Firecrawl is unavailable

Results are grouped by source and returned in parallel, with graceful handling of partial failures.

Args:
  - query (string, required): Search query (supports Arabic and English, 1-500 chars)
  - platforms (string[]): Platforms to search - ["mandumah", "mandumah_exa", "all", ${OPEN_ACCESS_KEYS.map(k => `"${k}"`).join(", ")}]. Default: ["all"] (mandumah + ${CORE_OPEN_ACCESS_KEYS.join(", ")}). Other sources (${OPT_IN_OPEN_ACCESS_KEYS.join(", ")}) must be named explicitly.

  Mandumah-specific filters (applied only when Mandumah is searched):
  - search_field (string): Field to search - AllFields, Title, JournalTitle, Author, Subject (default: AllFields)
  - languages (string[]): Filter by languages (e.g., ["Arabic", "English"])
  - content_types (string[]): Filter by type - articles, dissertations, conference_papers, etc.
  - date_from (string): Start year (e.g., "2020")
  - date_to (string): End year (e.g., "2024")
  - peer_reviewed (boolean): Only peer-reviewed content
  - full_text_only (boolean): Only content with downloadable full text
  - page (number): Page number for Mandumah pagination (default: 1)
  - sort (string): Sort order - relevance, year_desc, year_asc, title, author (default: relevance)

  Exa-specific parameters (for open-access repositories):
  - authors (string[]): Author names for better search accuracy
  - max_results_per_source (number): Max results per source, 1-20 (default: 5)

  - response_format (string): Output format - 'markdown', 'json', or 'text' (default: markdown)

Returns:
  For JSON format:
  {
    "query": string,
    "totalResults": number,
    "searchedPlatforms": string[],
    "resultGroups": [
      {
        "source": string,
        "sourceLabel": string,
        "totalFound": number,
        "results": [...],
        "metadata": {...}
      }
    ],
    "errors": string[],  // Partial failures
    "availableKeys": {
      "firecrawl": boolean,
      "exa": boolean
    }
  }

Examples:
  - Search everywhere: platforms=["all"], query="الذكاء الاصطناعي"
  - Mandumah only with filters: platforms=["mandumah"], peer_reviewed=true, date_from="2020"
  - Open-access only: platforms=["asjp", "shamaa"], authors=["أحمد"]
  - Exa fallback: platforms=["mandumah_exa"] (when Firecrawl unavailable)

Note:
  - Requires FIRECRAWL_API_KEY for Mandumah (main) searches
  - Requires EXA_API_KEY for open-access repository and mandumah_exa searches
  - Tool works with partial keys - returns results from available sources`,
      inputSchema: UnifiedSearchInputSchema,
      annotations: READ_ONLY,
    },
    async (params) => handleSearchArabicPapers(params, deps),
  );

server.registerTool(
  "list_arabic_tools",
  {
    title: "List Available Tools",
    description: `List all available MCP tools in this server with their names, descriptions, and requirements.

This utility tool helps you discover what tools are available without needing external documentation.

Args:
- response_format (string): Output format - 'markdown' (default), 'json', or 'text'

Returns:
For JSON format:
{
  "tools": [
    {
      "name": string,
      "title": string,
      "description": string,
      "category": string,
      "requiresApiKeys": string[]
    }
  ],
  "totalTools": number

Categories:
  - search: Search tools for finding papers
  - metadata: Tools for retrieving detailed information
  - pdf: Tools for finding and extracting PDF files
  - utility: Helper tools for discovery and information

Examples:
  - list_arabic_tools() → Returns markdown list grouped by category
  - list_arabic_tools(response_format="json") → Returns structured JSON data
  - list_arabic_tools(response_format="text") → Returns plain text list`,
      inputSchema: ListToolsInputSchema,
      annotations: STATIC,
    },
    async (params) => handleListTools(params),
  );

  if (hasExa)
  server.registerTool(
    "get_pdf_url",
    {
      title: "Get PDF URL",
      description: `Extract direct PDF download URL from an article landing page.

This tool extracts the actual PDF download URL from landing pages returned by search_arabic_papers.

Supported sources:
  - ASJP (asjp.cerist.dz) - Extracts PDF URL from citation metadata
  - SHAMAA (search.shamaa.org) - Detects direct PDF URLs

Unsupported sources (require login):
  - ResearchGate - Returns guidance message
  - Academia.edu - Returns guidance message

Workflow:
  1. Use search_arabic_papers(query) to get landing page URLs
  2. User selects a result from ASJP or SHAMAA
  3. Use get_pdf_url(url) to extract the direct PDF download URL

Args:
  - url (string, required): Article landing page URL to extract PDF from
  - response_format (string): Output format - 'markdown', 'json', or 'text' (default: markdown)

Returns:
  For JSON format:
  {
    "url": string,           // Original input URL
    "pdfUrl": string | null, // Extracted PDF URL (null if not found)
    "source": string,        // Detected source (ASJP, SHAMAA, etc.)
    "supported": boolean,    // Whether extraction is supported
    "message": string        // Status or error message
  }

Examples:
  - ASJP article: url="https://asjp.cerist.dz/en/article/198732"
  - SHAMAA PDF: url="https://search.shamaa.org/PDF/Articles/.../file.pdf"
  - Unsupported: url="https://www.researchgate.net/publication/123"

Note: Requires EXA_API_KEY environment variable to be set.`,
      inputSchema: GetPdfUrlInputSchema,
      annotations: READ_ONLY,
    },
    async (params) => handleGetPdfUrl(params, deps),
  );

  if (deps.hasFirecrawl)
  server.registerTool(
    "mandumah_search",
    {
      title: "Search Mandumah Database",
      description: `Search the Mandumah Arabic academic database for articles, dissertations, and research papers.

This tool searches Mandumah (دار المنظومة), one of the largest Arabic academic databases containing over 4 million records from journals, dissertations, and conference proceedings.

Args:
  - query (string, required): Search query string - supports Arabic and English
  - search_field (string): Field to search - AllFields, Title, JournalTitle, Author, or Subject (default: AllFields)
  - languages (string[]): Filter by language - Arabic, English, French, German, Turkish, Urdu, Persian, etc.
  - content_types (string[]): Filter by type - articles, dissertations, conference_papers, book_reviews, etc.
  - date_from (string): Start year for date filter (e.g., "2020")
  - date_to (string): End year for date filter (e.g., "2024")
  - peer_reviewed (boolean): Filter to only peer-reviewed content
  - full_text_only (boolean): Filter to only content with downloadable full text
  - page (number): Page number for pagination, starts at 1 (default: 1)
  - sort (string): Sort order - relevance, year_desc, year_asc, title, author (default: relevance)
  - response_format (string): Output format - 'markdown' or 'json' (default: markdown)

Returns:
  For JSON format:
  {
    "total": number,         // Total number of matching records
    "count": number,         // Number of results on this page
    "page": number,          // Current page number
    "hasMore": boolean,      // Whether more results exist
    "nextPage": number,      // Next page number (if hasMore is true)
    "query": string,         // The search query used
    "filters": object,       // Applied filters
    "results": [
      {
        "id": string,        // Record ID for use with mandumah_get_record
        "title": string,     // Article/paper title
        "authors": string[], // Author names
        "journal": string,   // Journal or source name
        "year": string,      // Publication year
        "abstract": string,  // Abstract text (if available)
        "contentType": string,// Type of content
        "language": string,  // Language of the content
        "url": string,       // Direct URL to the record
        "downloadUrl": string,// URL to download full text (if available)
        "peerReviewed": boolean // Whether peer reviewed
      }
    ]
  }

Examples:
  - Search for AI articles in Arabic: query="الذكاء الاصطناعي", languages=["Arabic"]
  - Find recent dissertations: query="machine learning", content_types=["dissertations"], date_from="2020"
  - Search specific author: query="محمد علي", search_field="Author"

Error Handling:
  - Returns "Rate limit exceeded" if too many requests (wait and retry)
  - Returns "Request timed out" if server is slow (try again later)
  - Returns "No results found" with suggestions if search returns empty`,
      inputSchema: ScholarSearchInputSchema,
      annotations: READ_ONLY,
    },
    async (params) => handleMandumahSearch(params, deps),
  );

  if (deps.hasFirecrawl)
  server.registerTool(
    "mandumah_get_record",
    {
      title: "Get Mandumah Record Details",
      description: `Get detailed information about a specific record from the Mandumah database.

Retrieves full metadata for a record including title, authors, abstract, subjects, keywords, and download links.

Args:
  - record_id (string, required): The unique record ID from Mandumah (obtained from search results)
  - response_format (string): Output format - 'markdown' or 'json' (default: markdown)

Returns:
  For JSON format:
  {
    "id": string,          // Record ID
    "title": string,       // Full title
    "authors": string[],   // List of author names
    "journal": string,     // Journal name
    "publisher": string,   // Publisher name
    "year": string,        // Publication year
    "volume": string,      // Volume number
    "issue": string,       // Issue number
    "pages": string,       // Page range
    "abstract": string,    // Full abstract
    "contentType": string, // Type of content
    "language": string,    // Language
    "subjects": string[],  // Subject classifications
    "keywords": string[],  // Keywords
    "issn": string,        // ISSN if available
    "database": string,    // Source database
    "url": string,         // Record URL
    "downloadUrl": string  // Full text download URL (if available)
  }

Examples:
  - Get record details: record_id="1234567"
  - Get as JSON: record_id="1234567", response_format="json"

Error Handling:
  - Returns "Record not found" if the ID doesn't exist`,
      inputSchema: ScholarGetRecordInputSchema,
      annotations: READ_ONLY,
    },
    async (params) => handleMandumahGetRecord(params, deps),
  );

server.registerTool(
  "mandumah_list_filters",
  {
    title: "List Arabic Scholar Search Filters",
    description: `List available filter options for Mandumah search.

Returns the available languages, content types, search fields, and sort options that can be used with the mandumah_search tool.

Args:
- filter_type (string): Type of filters to list - 'languages', 'content_types', 'search_fields', 'sort_options', or 'all' (default: all)

Returns:
Lists of available filter values with descriptions.

Examples:
- List all filters: filter_type="all"
- List only languages: filter_type="languages"
- List content types: filter_type="content_types"`,
    inputSchema: ScholarListFiltersInputSchema,
    annotations: STATIC,
  },
  async (params) => handleMandumahListFilters(params),
);

  if (deps.hasFirecrawl)
  server.registerTool(
    "mandumah_get_citation",
    {
      title: "Get Mandumah Citation",
      description: `Get formatted citations (APA/MLA) for a Mandumah record.

Retrieves properly formatted academic citations for a record, useful for bibliography generation and academic writing.

Args:
  - record_id (string, required): The unique record ID from Mandumah or full record URL
  - style (string): Citation style - 'apa', 'mla', or 'all' (default: all)
  - response_format (string): Output format - 'markdown', 'json', or 'text' (default: markdown)

Returns:
  For JSON format:
  {
    "id": string,       // Record ID
    "apa": string,      // APA formatted citation (if style is 'apa' or 'all')
    "mla": string,      // MLA formatted citation (if style is 'mla' or 'all')
    "citeUrl": string   // URL to the citation page
  }

Examples:
  - Get all citations: record_id="1234567"
  - Get only APA: record_id="1234567", style="apa"
  - Get as JSON: record_id="1234567", response_format="json"

Error Handling:
  - Returns "Record not found" if the ID doesn't exist`,
      inputSchema: ScholarGetCitationInputSchema,
      annotations: READ_ONLY,
    },
    async (params) => handleMandumahGetCitation(params, deps),
  );
}
