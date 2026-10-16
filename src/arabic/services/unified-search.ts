/**
 * Unified Search Service
 * Orchestrates searches across Mandumah (Firecrawl) and open-access repositories (Exa)
 */
import type {
  UnifiedSearchParams,
  UnifiedSearchResponse,
  UnifiedSearchResult,
  UnifiedSearchResultGroup,
  ScholarSearchResult,
  PdfSource
} from "../types";
import { searchScholar } from "./scholar-client";
import { searchWithDomains } from "./pdf-finder";
import { urlKey } from "./exa-result-cleaner";
import { UNIFIED_SEARCH_PLATFORMS, CORE_OPEN_ACCESS_KEYS, locationForSource, type OpenAccessRepositoryKey } from "../constants";

/**
 * Resolve which platforms to search based on user input and available API keys
 */
function resolveSearchTargets(
  platforms: string[],
  hasFirecrawl: boolean,
  hasExa: boolean
): { mandumah: boolean; mandumahExa: boolean; openAccess: string[] } {
  const targets = {
    mandumah: false,
    mandumahExa: false,
    openAccess: [] as string[]
  };

  // Handle "all" - search everything available
  if (platforms.includes("all")) {
    if (hasFirecrawl) {
      targets.mandumah = true;
    }
    if (hasExa) {
      // Core open-access repositories (the rest are opt-in by key)
      targets.openAccess = [...CORE_OPEN_ACCESS_KEYS];
      // Add mandumah_exa only if Firecrawl is NOT available (fallback)
      if (!hasFirecrawl) {
        targets.mandumahExa = true;
      }
    }
    return targets;
  }

  // Process specific platforms
  for (const platform of platforms) {
    if (platform === "mandumah" && hasFirecrawl) {
      targets.mandumah = true;
    } else if (platform === "mandumah_exa" && hasExa) {
      targets.mandumahExa = true;
    } else if (platform in UNIFIED_SEARCH_PLATFORMS && hasExa) {
      // Open-access repository
      if (!targets.openAccess.includes(platform)) {
        targets.openAccess.push(platform);
      }
    }
  }

  return targets;
}

/**
 * Convert Mandumah ScholarSearchResult to UnifiedSearchResult
 */
function convertMandumahResult(result: ScholarSearchResult): UnifiedSearchResult {
  return {
    title: result.title,
    authors: result.authors,
    url: result.url,
    source: "Mandumah",
    id: result.id,
    journal: result.journal,
    year: result.year,
    abstract: result.abstract,
    contentType: result.contentType,
    language: result.language,
    peerReviewed: result.peerReviewed
  };
}

/**
 * Convert Exa PdfSource to UnifiedSearchResult
 */
function convertExaResult(result: PdfSource): UnifiedSearchResult {
  // Exa titles for Mandumah pages carry a tab label prefix ("الوصف: ...", "مارك: ...")
  const title = result.source === "Mandumah"
    ? result.title.replace(/^(الوصف|مارك|التفاصيل)\s*:\s*/, "")
    : result.title;
  return {
    title,
    authors: result.authors ?? [], // best-effort, parsed from page text
    url: result.url,
    source: result.source,
    snippet: result.snippet,
    score: result.score,
    isPdfDirect: result.isPdfDirect
  };
}

/** Optional hooks so searchArabic can read timings and the full Mandumah records */
export interface SearchHooks {
  onTiming?: (source: string, ms: number) => void;
  onMandumahRaw?: (results: ScholarSearchResult[]) => void;
}

/**
 * Search across all selected platforms and merge results
 */
export async function searchArabicPapers(
  params: UnifiedSearchParams,
  firecrawlAvailable: boolean,
  exaApiKey?: string,
  firecrawlKey?: string,
  hooks?: SearchHooks
): Promise<UnifiedSearchResponse> {
  const { query, platforms, authors, max_results_per_source } = params;
  const hasExa = !!exaApiKey;

  // Resolve which platforms to search
  const targets = resolveSearchTargets(platforms, firecrawlAvailable, hasExa);

  const resultGroups: UnifiedSearchResultGroup[] = [];
  const errors: string[] = [];
  const searchedPlatforms: string[] = [];

  // Build array of search promises
  const searchPromises: Promise<void>[] = [];

  // 1. Search Mandumah via Firecrawl
  if (targets.mandumah) {
    searchedPlatforms.push("mandumah");
    searchPromises.push(
      (async () => {
        const t0 = Date.now();
        try {
          const response = await searchScholar({
            query,
            searchField: params.search_field || "AllFields",
            languages: params.languages,
            contentTypes: params.content_types,
            dateFrom: params.date_from,
            dateTo: params.date_to,
            peerReviewed: params.peer_reviewed,
            fullTextOnly: params.full_text_only,
            page: params.page || 1,
            sort: params.sort || "relevance"
          }, firecrawlKey!);

          hooks?.onMandumahRaw?.(response.results);
          resultGroups.push({
            source: "mandumah",
            sourceLabel: "Mandumah",
            totalFound: response.total,
            results: response.results.map(convertMandumahResult),
            metadata: {
              searchUrl: response.searchUrl,
              hasMore: response.hasMore,
              nextPage: response.nextPage
            }
          });
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          errors.push(`Mandumah (Firecrawl): ${errorMsg}`);
        } finally {
          hooks?.onTiming?.("mandumah", Date.now() - t0);
        }
      })()
    );
  }

  // 2. Search Mandumah via Exa (fallback)
  if (targets.mandumahExa && exaApiKey) {
    searchedPlatforms.push("mandumah_exa");
    searchPromises.push(
      (async () => {
        const t0 = Date.now();
        try {
          const results = await searchWithDomains(
            query,
            authors,
            ["search.mandumah.com"],
            max_results_per_source || 5,
            exaApiKey,
            params.user_location,
            false
          );

          resultGroups.push({
            source: "mandumah_exa",
            sourceLabel: "Mandumah (Exa)",
            totalFound: results.length,
            results: results.map(convertExaResult)
          });
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          errors.push(`Mandumah (Exa): ${errorMsg}`);
        } finally {
          hooks?.onTiming?.("mandumah_exa", Date.now() - t0);
        }
      })()
    );
  }

  // 3. Search open-access repositories via Exa
  if (targets.openAccess.length > 0 && exaApiKey) {
    for (const platform of targets.openAccess) {
      searchedPlatforms.push(platform);
      const platformConfig = UNIFIED_SEARCH_PLATFORMS[platform as keyof typeof UNIFIED_SEARCH_PLATFORMS];

      searchPromises.push(
        (async () => {
          const t0 = Date.now();
          try {
            const results = await searchWithDomains(
              query,
              authors,
              [platformConfig.domain],
              max_results_per_source || 5,
              exaApiKey,
              // explicit user_location wins; otherwise the source's own (EKB: EG), else none
              params.user_location ?? locationForSource(platform as OpenAccessRepositoryKey),
              false
            );

            resultGroups.push({
              source: platform,
              sourceLabel: platformConfig.name,
              totalFound: results.length,
              results: results.map(convertExaResult)
            });
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            errors.push(`${platformConfig.name}: ${errorMsg}`);
          } finally {
            hooks?.onTiming?.(platform, Date.now() - t0);
          }
        })()
      );
    }
  }

  // Execute all searches in parallel
  await Promise.allSettled(searchPromises);

  // Promise.allSettled finishes in arbitrary order; keep output order stable
  const order = [...searchedPlatforms];
  resultGroups.sort((a, b) => order.indexOf(a.source) - order.indexOf(b.source));

  // Drop URLs already shown by an earlier group (same page can surface via several domains)
  const seenUrls = new Set<string>();
  for (const group of resultGroups) {
    group.results = group.results.filter(r => {
      const key = urlKey(r.url);
      if (seenUrls.has(key)) return false;
      seenUrls.add(key);
      return true;
    });
    if (group.source !== "mandumah") group.totalFound = group.results.length;
  }

  // Calculate total results
  const totalResults = resultGroups.reduce((sum, group) => sum + group.results.length, 0);

  return {
    query,
    totalResults,
    searchedPlatforms,
    resultGroups,
    errors: errors.length > 0 ? errors : undefined,
    availableKeys: {
      firecrawl: firecrawlAvailable,
      exa: hasExa
    }
  };
}
