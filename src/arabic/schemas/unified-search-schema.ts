import { z } from "zod";
import { ResponseFormat } from "../types";
import { OPEN_ACCESS_KEYS, CORE_OPEN_ACCESS_KEYS } from "../constants";

/**
 * Schema for search_arabic_papers unified search tool
 */
export const UnifiedSearchInputSchema = z.object({
  query: z.string()
    .min(1, "Query must not be empty")
    .max(500, "Query must not exceed 500 characters")
    .describe("Search query string (supports Arabic and English)"),

  platforms: z.array(z.enum(["mandumah", "mandumah_exa", "all", ...OPEN_ACCESS_KEYS] as [string, ...string[]]))
    .default(["all"])
    .describe(`Platforms to search: mandumah (Firecrawl), mandumah_exa (Mandumah via Exa, fallback), or Exa-backed sources: ${OPEN_ACCESS_KEYS.join(", ")}. 'all' = mandumah + ${CORE_OPEN_ACCESS_KEYS.join(", ")}; other sources must be named explicitly.`),

  // Mandumah-specific filters (applied only when Mandumah is searched)
  search_field: z.enum(["AllFields", "Title", "JournalTitle", "Author", "Subject"])
    .default("AllFields")
    .optional()
    .describe("Field to search in Mandumah: AllFields, Title, JournalTitle, Author, or Subject"),

  languages: z.array(z.string())
    .optional()
    .describe("Filter Mandumah results by languages (e.g., ['Arabic', 'English'])"),

  content_types: z.array(z.enum([
    "articles", "dissertations", "conference_papers", "book_reviews",
    "editorials", "bibliographies", "legislation", "research_reviews",
    "thesis_reviews", "fatwas", "literary_texts", "other"
  ]))
    .optional()
    .describe("Filter Mandumah results by content type"),

  date_from: z.string()
    .regex(/^\d{4}$/, "Date must be a 4-digit year (e.g., '2020')")
    .optional()
    .describe("Start year for Mandumah date range filter (e.g., '2020')"),

  date_to: z.string()
    .regex(/^\d{4}$/, "Date must be a 4-digit year (e.g., '2024')")
    .optional()
    .describe("End year for Mandumah date range filter (e.g., '2024')"),

  peer_reviewed: z.boolean()
    .optional()
    .describe("Filter Mandumah to only peer-reviewed content"),

  full_text_only: z.boolean()
    .optional()
    .describe("Filter Mandumah to only content with downloadable full text"),

  page: z.number()
    .int()
    .min(1)
    .default(1)
    .optional()
    .describe("Page number for Mandumah pagination (starts at 1)"),

  sort: z.enum(["relevance", "year_desc", "year_asc", "title", "author"])
    .default("relevance")
    .optional()
    .describe("Sort order for Mandumah: relevance, year_desc, year_asc, title, author"),

  // Exa-specific parameters
  authors: z.array(z.string())
    .optional()
    .describe("Author names for better Exa search accuracy in open-access repositories"),

  max_results_per_source: z.number()
    .int()
    .min(1)
    .max(20)
    .default(5)
    .describe("Maximum number of results per source (1-20)"),

  user_location: z.string()
    .length(2, "Must be a 2-letter ISO country code")
    .toUpperCase()
    .optional()
    .describe("User location for Exa searches (ISO 3166-1 alpha-2 code: 'SA', 'EG', 'DZ', etc.). Overrides the per-source default: ekb is searched as 'EG', every other source with no location."),

  response_format: z.enum(ResponseFormat)
    .default(ResponseFormat.MARKDOWN)
    .describe("Output format: 'markdown' (formatted), 'json' (structured), or 'text' (plain text)")
}).strict();

export type UnifiedSearchInput = z.infer<typeof UnifiedSearchInputSchema>;
