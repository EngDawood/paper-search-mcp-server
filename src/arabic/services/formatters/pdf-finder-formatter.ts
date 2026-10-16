/**
 * Formatters for find_paper_pdf tool output
 */
import type { FindPaperPdfResponse } from "../../types";
import { truncateText } from "./formatter-utils";

/**
 * Format PDF search results as markdown
 */
export function formatPdfSearchMarkdown(response: FindPaperPdfResponse): string {
  const lines: string[] = [];

  lines.push("# PDF Search Results");
  lines.push("");
  lines.push(`**Search Title:** ${response.searchTitle}`);

  if (response.searchAuthors.length > 0) {
    lines.push(`**Authors:** ${response.searchAuthors.join(", ")}`);
  }

  lines.push(`**Searched Sites:** ${response.searchedSites.join(", ")}`);
  lines.push(`**Total Found:** ${response.totalFound}`);
  lines.push("");

  if (response.sources.length === 0) {
    lines.push("No PDF sources found for this paper.");
    lines.push("");
    lines.push("**Suggestions:**");
    lines.push("- Try searching with a shorter or simplified title");
    lines.push("- Search on different sites (e.g., include Google Scholar)");
    lines.push("- Check the paper title spelling");
    return lines.join("\n");
  }

  lines.push("## Sources");
  lines.push("");

  response.sources.forEach((source, index) => {
    const pdfBadge = source.isPdfDirect ? " 📄 **[Direct PDF]**" : "";
    const scoreBadge = source.score ? ` (relevance: ${source.score.toFixed(2)})` : "";

    lines.push(`### ${index + 1}. ${source.title}${pdfBadge}`);
    lines.push("");
    lines.push(`- **Source:** ${source.source}${scoreBadge}`);
    lines.push(`- **URL:** [${source.url}](${source.url})`);

    if (source.snippet) {
      lines.push(`- **Preview:** ${truncateText(source.snippet, 200)}`);
    }

    lines.push("");
  });

  return lines.join("\n");
}

/**
 * Format PDF search results as plain text
 */
export function formatPdfSearchText(response: FindPaperPdfResponse): string {
  const lines: string[] = [];

  lines.push("PDF SEARCH RESULTS");
  lines.push("==================");
  lines.push("");
  lines.push(`Search Title: ${response.searchTitle}`);

  if (response.searchAuthors.length > 0) {
    lines.push(`Authors: ${response.searchAuthors.join(", ")}`);
  }

  lines.push(`Searched Sites: ${response.searchedSites.join(", ")}`);
  lines.push(`Total Found: ${response.totalFound}`);
  lines.push("");

  if (response.sources.length === 0) {
    lines.push("No PDF sources found for this paper.");
    lines.push("");
    lines.push("Suggestions:");
    lines.push("- Try searching with a shorter or simplified title");
    lines.push("- Search on different sites (e.g., include Google Scholar)");
    lines.push("- Check the paper title spelling");
    return lines.join("\n");
  }

  lines.push("SOURCES");
  lines.push("-------");
  lines.push("");

  response.sources.forEach((source, index) => {
    const pdfIndicator = source.isPdfDirect ? " [Direct PDF]" : "";
    const scoreInfo = source.score ? ` (relevance: ${source.score.toFixed(2)})` : "";

    lines.push(`${index + 1}. ${source.title}${pdfIndicator}`);
    lines.push(`   Source: ${source.source}${scoreInfo}`);
    lines.push(`   URL: ${source.url}`);

    if (source.snippet) {
      lines.push(`   Preview: ${truncateText(source.snippet, 150)}`);
    }

    lines.push("");
  });

  return lines.join("\n");
}
