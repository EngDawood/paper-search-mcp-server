/**
 * URL building utilities for Mandumah search
 */
import {
  SCHOLAR_SEARCH_URL,
  SORT_OPTIONS,
  CONTENT_TYPES_ENGLISH_TO_ARABIC,
  type ContentTypeEnglish
} from "../constants";

/**
 * Build URL parameters for Mandumah search
 */
export function buildSearchUrl(params: {
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
}): string {
  const urlParams = new URLSearchParams();

  // Basic search parameters
  urlParams.set("lookfor", params.query);
  urlParams.set("type", params.searchField);
  urlParams.set("page", params.page.toString());

  // Sort parameter
  if (params.sort && params.sort !== "relevance") {
    urlParams.set("sort", SORT_OPTIONS[params.sort as keyof typeof SORT_OPTIONS] || params.sort);
  }

  // Date range (Mandumah ignores publishDatefrom/to unless daterange[] is present)
  if (params.dateFrom || params.dateTo) {
    urlParams.append("daterange[]", "publishDate");
  }
  if (params.dateFrom) {
    urlParams.set("publishDatefrom", params.dateFrom);
  }
  if (params.dateTo) {
    urlParams.set("publishDateto", params.dateTo);
  }

  // Build filters array
  const filters: string[] = [];

  // Language filters
  if (params.languages && params.languages.length > 0) {
    for (const lang of params.languages) {
      filters.push(`~language:"${lang}"`);
    }
  }

  // Content type filters (convert English to Arabic)
  if (params.contentTypes && params.contentTypes.length > 0) {
    for (const type of params.contentTypes) {
      const arabicType = CONTENT_TYPES_ENGLISH_TO_ARABIC[type as ContentTypeEnglish];
      if (arabicType) {
        filters.push(`~format:"${arabicType}"`);
      }
    }
  }

  // Peer reviewed filter
  if (params.peerReviewed === true) {
    filters.push("peer_refereed:y");
  }

  // Full text only filter
  if (params.fullTextOnly === true) {
    filters.push("downloadable:y");
  }

  // Add all filters to URL
  for (const filter of filters) {
    urlParams.append("filter[]", filter);
  }

  return `${SCHOLAR_SEARCH_URL}?${urlParams.toString()}`;
}

/**
 * Extract record ID from input (handles both raw ID and full URL)
 */
export function extractRecordId(input: string): string {
  // If input looks like a URL, extract the ID from it
  const urlMatch = input.match(/\/Record\/(\d+)/i);
  if (urlMatch) {
    return urlMatch[1];
  }
  // Otherwise, return as-is (assume it's already an ID)
  return input.trim();
}
