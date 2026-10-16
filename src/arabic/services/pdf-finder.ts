/**
 * PDF Finder Service
 * Uses Exa API to search for freely available PDFs of academic papers
 */
import { OPEN_ACCESS_REPOSITORIES, CORE_OPEN_ACCESS_KEYS, EXA_DEFAULTS, type OpenAccessRepositoryKey } from "../constants";
import type { PdfSource, FindPaperPdfResponse } from "../types";
import { exaSearch } from "./exa";
import { processExaResults } from "./exa-result-cleaner";

/**
 * Build optimized search query from paper metadata
 */
export function buildSearchQuery(title: string, authors?: string[], appendPdfKeyword = true): string {
  let query = title.trim();

  // Add author names if provided (limit to first 2 for query length)
  if (authors && authors.length > 0) {
    const authorPart = authors.slice(0, 2).join(" ");
    query = `${query} ${authorPart}`;
  }

  // Add PDF keyword to prioritize PDF results (not wanted for general discovery searches)
  if (appendPdfKeyword) {
    query = `${query} PDF`;
  }

  return query;
}

/**
 * Get domain list based on user selection
 */
export function getDomains(includeSites: string[]): string[] {
  // If "all" is selected, return all domains
  if (includeSites.includes("all")) {
    return CORE_OPEN_ACCESS_KEYS.map(key => OPEN_ACCESS_REPOSITORIES[key].domain);
  }

  // Map selected site keys to their domains
  return includeSites
    .filter((site): site is OpenAccessRepositoryKey => site in OPEN_ACCESS_REPOSITORIES)
    .map(site => OPEN_ACCESS_REPOSITORIES[site].domain);
}

/**
 * Get repository name from URL
 */
function getSourceFromUrl(url: string): string {
  // Check Mandumah first
  if (url.includes("search.mandumah.com")) {
    return "Mandumah";
  }

  for (const [, repo] of Object.entries(OPEN_ACCESS_REPOSITORIES)) {
    if (url.includes(repo.domain)) {
      return repo.name;
    }
  }
  // Extract domain as fallback
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace("www.", "");
  } catch {
    return "Unknown";
  }
}

/**
 * Check whether a URL's hostname belongs to one of the given domains
 */
export function matchesDomains(url: string, domains: string[]): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return domains.some(d => host === d || host.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

/**
 * Check if URL points directly to a PDF
 */
function isPdfUrl(url: string): boolean {
  return url.toLowerCase().endsWith(".pdf");
}

export interface FindPaperPdfParams {
  title: string;
  authors?: string[];
  includeSites: string[];
  maxResults: number;
}

/**
 * Core Exa search with custom domains - exported for use in unified search
 */
export async function searchWithDomains(
  query: string,
  authors: string[] | undefined,
  domains: string[],
  maxResults: number,
  exaApiKey: string,
  userLocation?: string,
  appendPdfKeyword = true
): Promise<PdfSource[]> {
  // Build search query
  const searchQuery = buildSearchQuery(query, authors, appendPdfKeyword);

  // NOTE: do not set `category` (e.g. "research paper"): Exa then ignores includeDomains
  // and returns its own exa.ai/library entries instead of pages from the requested sites.
  const searchResponse = await exaSearch(exaApiKey, searchQuery, {
    numResults: Math.min(maxResults * EXA_DEFAULTS.overfetchFactor, 50),
    includeDomains: domains,
    type: EXA_DEFAULTS.type,
    textMaxCharacters: EXA_DEFAULTS.textMaxCharacters,
    // Only sent when set (EKB: EG, or the caller's user_location). Tested against live Exa:
    // SA, EG and no location gave the same share of on-topic results, so there is no default.
    userLocation,
  });

  // Keep pages from the requested domains, then clean them up (see exa-result-cleaner.ts)
  const onDomain = searchResponse.results.filter((result: { url: string }) => matchesDomains(result.url, domains));
  return processExaResults(onDomain, query, maxResults, getSourceFromUrl);
}

/**
 * Find free PDF sources for an academic paper using Exa search
 */
export async function findPaperPdf(
  params: FindPaperPdfParams,
  exaApiKey: string
): Promise<FindPaperPdfResponse> {
  const { title, authors, includeSites, maxResults } = params;

  // Get domains to search
  const domains = getDomains(includeSites);

  // Use the core search function
  const sources = await searchWithDomains(title, authors, domains, maxResults, exaApiKey);

  // Get searched site names for response
  const searchedSites = domains.map(domain => {
    const repo = Object.values(OPEN_ACCESS_REPOSITORIES).find(r => r.domain === domain);
    return repo?.name || domain;
  });

  return {
    searchTitle: title,
    searchAuthors: authors || [],
    sources,
    totalFound: sources.length,
    searchedSites
  };
}
