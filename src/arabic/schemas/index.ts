import { z } from "zod";
import { OPEN_ACCESS_KEYS } from "../constants";
import { ResponseFormat } from "../types";

/**
 * Schema for mandumah_search tool
 */
export const ScholarSearchInputSchema = z.object({
  query: z.string()
    .min(1, "Query must not be empty")
    .max(500, "Query must not exceed 500 characters")
    .describe("Search query string (supports Arabic and English)"),
  
  search_field: z.enum(["AllFields", "Title", "JournalTitle", "Author", "Subject"])
    .default("AllFields")
    .describe("Field to search in: AllFields, Title, JournalTitle, Author, or Subject"),
  
  languages: z.array(z.string())
    .optional()
    .describe("Filter by languages (e.g., ['Arabic', 'English']). Available: Arabic, English, French, German, Turkish, Urdu, Persian, Bengali, Chinese, Hebrew, Italian, Japanese, Kurdish, Portuguese, Russian, Spanish"),
  
  content_types: z.array(z.enum([
    "articles", "dissertations", "conference_papers", "book_reviews",
    "editorials", "bibliographies", "legislation", "research_reviews",
    "thesis_reviews", "fatwas", "literary_texts", "other"
  ]))
    .optional()
    .describe("Filter by content type. Options: articles, dissertations, conference_papers, book_reviews, editorials, bibliographies, legislation, research_reviews, thesis_reviews, fatwas, literary_texts, other"),
  
  date_from: z.string()
    .regex(/^\d{4}$/, "Date must be a 4-digit year (e.g., '2020')")
    .optional()
    .describe("Start year for date range filter (e.g., '2020')"),
  
  date_to: z.string()
    .regex(/^\d{4}$/, "Date must be a 4-digit year (e.g., '2024')")
    .optional()
    .describe("End year for date range filter (e.g., '2024')"),
  
  peer_reviewed: z.boolean()
    .optional()
    .describe("Filter to only peer-reviewed content"),
  
  full_text_only: z.boolean()
    .optional()
    .describe("Filter to only content with downloadable full text"),
  
  page: z.number()
    .int()
    .min(1)
    .default(1)
    .describe("Page number for pagination (starts at 1)"),
  
  sort: z.enum(["relevance", "year_desc", "year_asc", "title", "author"])
    .default("relevance")
    .describe("Sort order: relevance, year_desc, year_asc, title, author"),
  
  response_format: z.enum(ResponseFormat)
    .default(ResponseFormat.MARKDOWN)
    .describe("Output format: 'markdown' (formatted), 'json' (structured), or 'text' (plain text)")
}).strict();

export type ScholarSearchInput = z.infer<typeof ScholarSearchInputSchema>;

/**
 * Schema for mandumah_get_record tool
 */
export const ScholarGetRecordInputSchema = z.object({
  record_id: z.string()
    .min(1, "Record ID must not be empty")
    .describe("The unique record ID from Mandumah (e.g., '1234567')"),
  
  response_format: z.enum(ResponseFormat)
    .default(ResponseFormat.MARKDOWN)
    .describe("Output format: 'markdown' (formatted), 'json' (structured), or 'text' (plain text)")
}).strict();

export type ScholarGetRecordInput = z.infer<typeof ScholarGetRecordInputSchema>;

/**
 * Schema for mandumah_list_filters tool
 */
export const ScholarListFiltersInputSchema = z.object({
  filter_type: z.enum(["languages", "content_types", "search_fields", "sort_options", "all"])
    .default("all")
    .describe("Type of filters to list: languages, content_types, search_fields, sort_options, or all")
}).strict();

export type ScholarListFiltersInput = z.infer<typeof ScholarListFiltersInputSchema>;

/**
 * Schema for mandumah_get_citation tool
 */
export const ScholarGetCitationInputSchema = z.object({
  record_id: z.string()
    .min(1, "Record ID must not be empty")
    .describe("The unique record ID from Mandumah (e.g., '1234567') or full record URL"),

  style: z.enum(["apa", "mla", "all"])
    .default("all")
    .describe("Citation style: 'apa' (APA format), 'mla' (MLA format), or 'all' (both styles)"),

  response_format: z.enum(ResponseFormat)
    .default(ResponseFormat.MARKDOWN)
    .describe("Output format: 'markdown' (formatted), 'json' (structured), or 'text' (plain text)")
}).strict();

export type ScholarGetCitationInput = z.infer<typeof ScholarGetCitationInputSchema>;

/**
 * Schema for find_paper_pdf tool
 */
export const FindPaperPdfInputSchema = z.object({
  title: z.string()
    .min(1, "Title must not be empty")
    .describe("Paper title to search for (Arabic or English)"),

  authors: z.array(z.string())
    .optional()
    .describe("Author names for better search accuracy"),

  include_sites: z.array(z.enum(["all", ...OPEN_ACCESS_KEYS] as [string, ...string[]]))
    .default(["all"])
    .describe(`Repositories to search: ${OPEN_ACCESS_KEYS.join(", ")}, or all (the core set)`),

  max_results: z.number()
    .int()
    .min(1)
    .max(20)
    .default(5)
    .describe("Maximum number of results to return (1-20)"),

  response_format: z.enum(ResponseFormat)
    .default(ResponseFormat.MARKDOWN)
    .describe("Output format: 'markdown', 'json', or 'text'")
}).strict();

export type FindPaperPdfInput = z.infer<typeof FindPaperPdfInputSchema>;

/**
 * Schema for get_pdf_url tool
 */
export const GetPdfUrlInputSchema = z.object({
  url: z.string()
    .url("Must be a valid URL")
    .describe("Article landing page URL to extract PDF from"),

  response_format: z.enum(ResponseFormat)
    .default(ResponseFormat.MARKDOWN)
    .describe("Output format: 'markdown', 'json', or 'text'")
}).strict();

export type GetPdfUrlInput = z.infer<typeof GetPdfUrlInputSchema>;

/**
 * Export unified search schema
 */
export { UnifiedSearchInputSchema, type UnifiedSearchInput } from "./unified-search-schema";

/**
 * Export list_tools schema
 */
export { ListToolsInputSchema, type ListToolsInput } from "./list-tools-schema";
