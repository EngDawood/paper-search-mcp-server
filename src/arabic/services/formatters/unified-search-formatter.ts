/**
 * Unified Search Formatters
 * Format unified search results for markdown and text output
 */
import type { UnifiedSearchResponse, UnifiedSearchResultGroup, UnifiedSearchResult } from "../../types";
import { truncateText, finalizeOutput } from "./formatter-utils";

/**
 * Format a single Mandumah result with academic metadata
 */
function formatMandumahResult(result: UnifiedSearchResult, index: number): string {
  const parts = [`${index + 1}. **${result.title}**`];

  if (result.authors && result.authors.length > 0) {
    parts.push(`   - Authors: ${result.authors.join(", ")}`);
  }

  if (result.journal) {
    parts.push(`   - Journal: ${result.journal}`);
  }

  if (result.year) {
    parts.push(`   - Year: ${result.year}`);
  }

  if (result.contentType) {
    parts.push(`   - Type: ${result.contentType}`);
  }

  if (result.language) {
    parts.push(`   - Language: ${result.language}`);
  }

  if (result.peerReviewed !== undefined) {
    parts.push(`   - Peer Reviewed: ${result.peerReviewed ? "Yes" : "No"}`);
  }

  if (result.abstract) {
    parts.push(`   - Abstract: ${truncateText(result.abstract, 200)}`);
  }

  parts.push(`   - URL: ${result.url}`);

  return parts.join("\n");
}

/**
 * Format a single open-access result with snippet
 */
function formatOpenAccessResult(result: UnifiedSearchResult, index: number): string {
  const parts = [`${index + 1}. **${result.title}**`];

  if (result.snippet) {
    parts.push(`   - Snippet: ${truncateText(result.snippet, 150)}`);
  }

  if (result.isPdfDirect) {
    parts.push(`   - 🔗 Direct PDF link`);
  }

  if (result.score !== undefined) {
    parts.push(`   - Relevance: ${(result.score * 100).toFixed(0)}%`);
  }

  parts.push(`   - URL: ${result.url}`);

  return parts.join("\n");
}

/**
 * Format a result group
 */
function formatResultGroup(group: UnifiedSearchResultGroup): string {
  const parts: string[] = [];

  // Group header
  parts.push(`### ${group.sourceLabel} (${group.totalFound} results)`);

  if (group.results.length === 0) {
    parts.push("\nNo results found.");
    return parts.join("\n");
  }

  parts.push(""); // Empty line

  // Format results based on source type
  const isMandumah = group.source === "mandumah" || group.source === "mandumah_exa";

  for (let i = 0; i < group.results.length; i++) {
    const result = group.results[i];
    if (isMandumah && result.id) {
      parts.push(formatMandumahResult(result, i));
    } else {
      parts.push(formatOpenAccessResult(result, i));
    }
    parts.push(""); // Empty line between results
  }

  // Add Mandumah metadata if available
  if (group.metadata?.searchUrl) {
    parts.push(`🔗 Browse more: ${group.metadata.searchUrl}`);
    if (group.metadata.hasMore) {
      parts.push(`📄 More results available (page ${group.metadata.nextPage})`);
    }
  }

  return parts.join("\n");
}

/**
 * Format unified search results as markdown
 */
export function formatUnifiedSearchMarkdown(response: UnifiedSearchResponse): string {
  const parts: string[] = [];

  // Header with query and summary
  parts.push(`# Unified Search Results: "${response.query}"\n`);
  parts.push(`**Total Results:** ${response.totalResults}`);
  parts.push(`**Searched Platforms:** ${response.searchedPlatforms.join(", ")}`);
  parts.push(`**API Keys Status:** Firecrawl: ${response.availableKeys.firecrawl ? "✓" : "✗"}, Exa: ${response.availableKeys.exa ? "✓" : "✗"}\n`);

  // Show errors if any
  if (response.errors && response.errors.length > 0) {
    parts.push(`⚠️ **Partial Results** - Some sources failed:\n`);
    for (const error of response.errors) {
      parts.push(`- ${error}`);
    }
    parts.push(""); // Empty line
  }

  // Format each result group
  for (let i = 0; i < response.resultGroups.length; i++) {
    if (i > 0) {
      parts.push("\n---\n"); // Separator between groups
    }
    parts.push(formatResultGroup(response.resultGroups[i]));
  }

  // No results case
  if (response.resultGroups.length === 0) {
    parts.push("\n❌ No results found from any source.");
  }

  return finalizeOutput(parts, "... (output truncated)");
}

/**
 * Format unified search results as plain text
 */
export function formatUnifiedSearchText(response: UnifiedSearchResponse): string {
  const parts: string[] = [];

  // Header
  parts.push(`UNIFIED SEARCH RESULTS: "${response.query}"\n`);
  parts.push(`Total Results: ${response.totalResults}`);
  parts.push(`Searched Platforms: ${response.searchedPlatforms.join(", ")}`);
  parts.push(`API Keys: Firecrawl: ${response.availableKeys.firecrawl ? "Yes" : "No"}, Exa: ${response.availableKeys.exa ? "Yes" : "No"}\n`);

  // Show errors
  if (response.errors && response.errors.length > 0) {
    parts.push(`PARTIAL RESULTS - Some sources failed:\n`);
    for (const error of response.errors) {
      parts.push(`- ${error}`);
    }
    parts.push(""); // Empty line
  }

  // Format each group
  for (let i = 0; i < response.resultGroups.length; i++) {
    const group = response.resultGroups[i];

    if (i > 0) {
      parts.push("\n" + "=".repeat(60) + "\n");
    }

    parts.push(`${group.sourceLabel.toUpperCase()} (${group.totalFound} results)\n`);

    if (group.results.length === 0) {
      parts.push("No results found.\n");
      continue;
    }

    const isMandumah = group.source === "mandumah" || group.source === "mandumah_exa";

    for (let j = 0; j < group.results.length; j++) {
      const result = group.results[j];
      parts.push(`${j + 1}. ${result.title}`);

      if (isMandumah) {
        if (result.authors && result.authors.length > 0) {
          parts.push(`   Authors: ${result.authors.join(", ")}`);
        }
        if (result.journal) parts.push(`   Journal: ${result.journal}`);
        if (result.year) parts.push(`   Year: ${result.year}`);
        if (result.contentType) parts.push(`   Type: ${result.contentType}`);
      } else {
        if (result.snippet) {
          parts.push(`   ${truncateText(result.snippet, 150)}`);
        }
        if (result.isPdfDirect) parts.push(`   [Direct PDF]`);
      }

      parts.push(`   URL: ${result.url}\n`);
    }

    if (group.metadata?.searchUrl) {
      parts.push(`Browse more: ${group.metadata.searchUrl}`);
    }
  }

  // No results case
  if (response.resultGroups.length === 0) {
    parts.push("\nNo results found from any source.");
  }

  return finalizeOutput(parts, "... (output truncated)");
}
