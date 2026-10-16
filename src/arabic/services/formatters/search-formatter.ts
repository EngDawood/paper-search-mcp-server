/**
 * Search results formatters
 */
import type { ScholarSearchResponse, ScholarSearchResult } from "../../types";
import { truncateText, finalizeOutput } from "./formatter-utils";

/**
 * Format a single search result as Markdown
 */
function formatSingleResultMarkdown(result: ScholarSearchResult): string {
  const lines: string[] = [];

  lines.push(`### ${result.title}`);
  lines.push("");
  lines.push(`**Authors:** ${result.authors.join("; ")}`);

  if (result.journal) {
    lines.push(`**Source:** ${result.journal}`);
  }

  if (result.year) {
    lines.push(`**Year:** ${result.year}`);
  }

  if (result.contentType) {
    lines.push(`**Type:** ${result.contentType}`);
  }

  if (result.language) {
    lines.push(`**Language:** ${result.language}`);
  }

  if (result.peerReviewed) {
    lines.push(`**Peer Reviewed:** Yes ✓`);
  }

  if (result.abstract) {
    lines.push("");
    lines.push(`> ${truncateText(result.abstract, 300)}`);
  }

  lines.push("");
  lines.push(`**Record ID:** ${result.id}`);
  lines.push(`**URL:** ${result.url}`);

  if (result.downloadUrl) {
    lines.push(`**Download:** [Full Text](${result.downloadUrl})`);
  }

  return lines.join("\n");
}

/**
 * Format search results as Markdown
 */
export function formatSearchResultsMarkdown(response: ScholarSearchResponse): string {
  const lines: string[] = [];

  // Header with summary
  lines.push(`# Arabic Scholar Search Results`);
  lines.push("");
  lines.push(`**Query:** ${response.query}`);
  lines.push(`**Total Results:** ${response.total.toLocaleString()}`);
  lines.push(`**Page:** ${response.page} (showing ${response.count} results)`);
  lines.push(`**Search URL:** ${response.searchUrl}`);

  // Applied filters
  if (response.filters) {
    const filterParts: string[] = [];
    if (response.filters.languages?.length) {
      filterParts.push(`Languages: ${response.filters.languages.join(", ")}`);
    }
    if (response.filters.contentTypes?.length) {
      filterParts.push(`Content Types: ${response.filters.contentTypes.join(", ")}`);
    }
    if (response.filters.dateFrom || response.filters.dateTo) {
      const dateRange = `${response.filters.dateFrom || "..."} - ${response.filters.dateTo || "..."}`;
      filterParts.push(`Date Range: ${dateRange}`);
    }
    if (response.filters.peerReviewed) {
      filterParts.push("Peer Reviewed Only");
    }
    if (response.filters.fullTextOnly) {
      filterParts.push("Full Text Available");
    }
    if (filterParts.length > 0) {
      lines.push(`**Filters:** ${filterParts.join(" | ")}`);
    }
  }

  lines.push("");
  lines.push("---");
  lines.push("");

  // Results
  if (response.results.length === 0) {
    lines.push("*No results found matching your search criteria.*");
    lines.push("");
    lines.push("**Suggestions:**");
    lines.push("- Try broader search terms");
    lines.push("- Remove some filters");
    lines.push("- Check spelling of Arabic terms");
  } else {
    for (const result of response.results) {
      lines.push(formatSingleResultMarkdown(result));
      lines.push("");
    }
  }

  // Pagination info
  if (response.hasMore) {
    lines.push("---");
    lines.push("");
    lines.push(`*More results available. Use \`page: ${response.nextPage}\` to see next page.*`);
  }

  return finalizeOutput(lines, "*[Output truncated due to length. Use filters or pagination to narrow results.]*");
}

/**
 * Format search results as plain text
 */
export function formatSearchResultsText(response: ScholarSearchResponse): string {
  const lines: string[] = [];

  lines.push(`Arabic Scholar Search Results`);
  lines.push(`Query: ${response.query}`);
  lines.push(`Total: ${response.total.toLocaleString()} | Page: ${response.page} | Showing: ${response.count}`);
  lines.push(`Search URL: ${response.searchUrl}`);
  lines.push("");

  if (response.results.length === 0) {
    lines.push("No results found.");
  } else {
    for (let i = 0; i < response.results.length; i++) {
      const result = response.results[i];
      lines.push(`${i + 1}. ${result.title}`);
      lines.push(`   Authors: ${result.authors.join("; ")}`);
      if (result.journal) lines.push(`   Source: ${result.journal}`);
      if (result.year) lines.push(`   Year: ${result.year}`);
      if (result.contentType) lines.push(`   Type: ${result.contentType}`);
      lines.push(`   ID: ${result.id}`);
      lines.push(`   URL: ${result.url}`);
      lines.push("");
    }
  }

  if (response.hasMore) {
    lines.push(`More results available. Use page: ${response.nextPage}`);
  }

  return finalizeOutput(lines);
}
