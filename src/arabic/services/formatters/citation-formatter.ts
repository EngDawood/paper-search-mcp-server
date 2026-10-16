/**
 * Citation formatters
 */
import type { ScholarCitation } from "../../types";

/**
 * Format citation as Markdown
 */
export function formatCitationMarkdown(citation: ScholarCitation): string {
  const lines: string[] = [];

  lines.push(`# Citation for Record ${citation.id}`);
  lines.push("");
  lines.push(`**Cite URL:** ${citation.citeUrl}`);
  lines.push("");

  if (citation.apa) {
    lines.push("## APA");
    lines.push("");
    lines.push(`> ${citation.apa}`);
    lines.push("");
  }

  if (citation.mla) {
    lines.push("## MLA");
    lines.push("");
    lines.push(`> ${citation.mla}`);
    lines.push("");
  }

  if (!citation.apa && !citation.mla) {
    lines.push("*No citation data could be extracted for this record.*");
  }

  return lines.join("\n");
}

/**
 * Format citation as plain text
 */
export function formatCitationText(citation: ScholarCitation): string {
  const lines: string[] = [];

  lines.push(`Citation for Record ${citation.id}`);
  lines.push(`Cite URL: ${citation.citeUrl}`);
  lines.push("");

  if (citation.apa) {
    lines.push("APA:");
    lines.push(citation.apa);
    lines.push("");
  }

  if (citation.mla) {
    lines.push("MLA:");
    lines.push(citation.mla);
    lines.push("");
  }

  if (!citation.apa && !citation.mla) {
    lines.push("No citation data could be extracted for this record.");
  }

  return lines.join("\n");
}
