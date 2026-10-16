/**
 * Scholar API client - uses Firecrawl for web scraping (Mandumah database)
 */
import { SCHOLAR_RECORD_URL } from "../constants";
import type {
  ScholarSearchResponse,
  ScholarRecordDetail,
  ScholarCitation,
  AppliedFilters
} from "../types";

// Import parsers from modular files
import { parseRecordMarkdown, parseSearchPage, parseCitationMarkdown } from "../parsers/index";

// Import URL utilities
import { buildSearchUrl, extractRecordId } from "../utils/url-builder";

// Import error handling utilities
import { handleScholarError, validateScrapeResult } from "../utils/error-handler";

import { scrapeUrl } from "./firecrawl";

// Re-export buildSearchUrl for any external consumers
export { buildSearchUrl } from "../utils/url-builder";

/**
 * Search Scholar database (Mandumah) using Firecrawl
 */
export async function searchScholar(params: {
  query: string;
  searchField: string;
  languages?: string[];
  contentTypes?: string[];
  dateFrom?: string;
  dateTo?: string;
  peerReviewed?: boolean;
  fullTextOnly?: boolean;
  page: number;
  sort: string;
}, firecrawlKey: string): Promise<ScholarSearchResponse> {
  const url = buildSearchUrl(params);

  const filters: AppliedFilters = {
    languages: params.languages,
    contentTypes: params.contentTypes,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    peerReviewed: params.peerReviewed,
    fullTextOnly: params.fullTextOnly
  };

  try {
    // Use Firecrawl to scrape search results page as markdown with retry
    const scrapeResult = await scrapeUrl(firecrawlKey, url, {
        formats: ["markdown", "rawHtml"], // HTML keeps word spacing and carries abstracts/PDF links
        waitFor: 3000 // Wait for dynamic content
    });

    const markdown = validateScrapeResult(scrapeResult, "search results", 50);
    const rawHtml = "rawHtml" in scrapeResult ? scrapeResult.rawHtml : undefined;
    const { total, results } = parseSearchPage(markdown, rawHtml);

    const hasMore = results.length > 0 && (params.page * 20) < total;

    return {
      total,
      count: results.length,
      page: params.page,
      results,
      hasMore,
      nextPage: hasMore ? params.page + 1 : undefined,
      query: params.query,
      filters,
      searchUrl: url
    };
  } catch (error) {
    handleScholarError(error, "search", params.query);
  }
}

/**
 * Get detailed record from Scholar (Mandumah) using Firecrawl
 */
export async function getScholarRecord(recordId: string, firecrawlKey: string): Promise<ScholarRecordDetail> {
  const id = extractRecordId(recordId);
  const url = `${SCHOLAR_RECORD_URL}/${id}`;

  try {
    // Use Firecrawl to scrape record page as markdown with retry
    const scrapeResult = await scrapeUrl(firecrawlKey, url, {
        formats: ["markdown"],
        waitFor: 2000 // Wait for dynamic content
    });

    const markdown = validateScrapeResult(scrapeResult, `record ${id}`, 100);
    return parseRecordMarkdown(markdown, id);
  } catch (error) {
    handleScholarError(error, "Record", recordId);
  }
}

/**
 * Get citation for a Scholar (Mandumah) record
 */
export async function getScholarCitation(recordId: string, style: string = "all", firecrawlKey: string): Promise<ScholarCitation> {
  const id = extractRecordId(recordId);
  const citeUrl = `${SCHOLAR_RECORD_URL}/${id}/Cite`;

  try {
    // Use Firecrawl to scrape citation page as markdown with retry
    const scrapeResult = await scrapeUrl(firecrawlKey, citeUrl, {
        formats: ["markdown"],
        waitFor: 2000 // Wait for dynamic content
    });

    const markdown = validateScrapeResult(scrapeResult, `citation for record ${id}`, 50);
    const citations = parseCitationMarkdown(markdown, style);

    return {
      id,
      apa: citations.apa,
      mla: citations.mla,
      citeUrl
    };
  } catch (error) {
    handleScholarError(error, "Citation", recordId);
  }
}
