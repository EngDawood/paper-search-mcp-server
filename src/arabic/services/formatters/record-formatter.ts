/**
 * Record detail formatters
 */
import type { ScholarRecordDetail } from "../../types";

/**
 * Format record detail as Markdown
 */
export function formatRecordDetailMarkdown(record: ScholarRecordDetail): string {
  const lines: string[] = [];

  lines.push(`# ${record.title}`);
  if (record.alternateTitle) {
    lines.push(`*${record.alternateTitle}*`);
  }
  lines.push("");

  // Metadata table
  lines.push("## Metadata");
  lines.push("");
  lines.push(`| Field | Value |`);
  lines.push(`|-------|-------|`);
  lines.push(`| **Authors** | ${record.authors.join("; ")} |`);

  if (record.mainAuthorEnglish) {
    lines.push(`| **Author (English)** | ${record.mainAuthorEnglish} |`);
  }
  if (record.journal) {
    lines.push(`| **Journal** | ${record.journal} |`);
  }
  if (record.publisher) {
    lines.push(`| **Publisher** | ${record.publisher} |`);
  }
  if (record.year) {
    lines.push(`| **Year** | ${record.year} |`);
  }
  if (record.volume) {
    lines.push(`| **Volume** | ${record.volume} |`);
  }
  if (record.issue) {
    lines.push(`| **Issue** | ${record.issue} |`);
  }
  if (record.pages) {
    lines.push(`| **Pages** | ${record.pages} |`);
  }
  if (record.contentType) {
    lines.push(`| **Type** | ${record.contentType} |`);
  }
  if (record.language) {
    lines.push(`| **Language** | ${record.language} |`);
  }
  if (record.peerReviewed) {
    lines.push(`| **Peer Reviewed** | Yes |`);
  }
  if (record.country) {
    lines.push(`| **Country** | ${record.country} |`);
  }
  if (record.degreeType) {
    lines.push(`| **Degree** | ${record.degreeType} |`);
  }
  if (record.university) {
    lines.push(`| **University** | ${record.university} |`);
  }
  if (record.college) {
    lines.push(`| **College** | ${record.college} |`);
  }
  if (record.location) {
    lines.push(`| **Location** | ${record.location} |`);
  }
  if (record.issn) {
    lines.push(`| **ISSN** | ${record.issn} |`);
  }
  if (record.doi) {
    lines.push(`| **DOI** | ${record.doi} |`);
  }
  if (record.database) {
    lines.push(`| **Database** | ${record.database} |`);
  }
  if (record.downloadsCount) {
    lines.push(`| **Downloads** | ${record.downloadsCount.toLocaleString()} |`);
  }

  lines.push("");

  // Abstract
  if (record.abstract) {
    lines.push("## Abstract");
    lines.push("");
    lines.push(record.abstract);
    lines.push("");
  }

  // Subjects
  if (record.subjects && record.subjects.length > 0) {
    lines.push("## Subjects");
    lines.push("");
    lines.push(record.subjects.map(s => `- ${s}`).join("\n"));
    lines.push("");
  }

  // Keywords
  if (record.keywords && record.keywords.length > 0) {
    lines.push("## Keywords");
    lines.push("");
    lines.push(record.keywords.join(", "));
    lines.push("");
  }

  // Similar Items
  if (record.similarItems && record.similarItems.length > 0) {
    lines.push("## Similar Items (عناصر مشابهة)");
    lines.push("");
    for (const item of record.similarItems) {
      let itemLine = `- [${item.title}](${item.url})`;
      if (item.author) {
        itemLine += ` - ${item.author}`;
      }
      if (item.year) {
        itemLine += ` (${item.year})`;
      }
      lines.push(itemLine);
    }
    lines.push("");
  }

  // Links
  lines.push("## Links");
  lines.push("");
  lines.push(`- **Record URL:** ${record.url}`);
  if (record.downloadUrl) {
    lines.push(`- **Download Full Text:** ${record.downloadUrl}`);
  }

  return lines.join("\n");
}

/**
 * Format record detail as plain text
 */
export function formatRecordDetailText(record: ScholarRecordDetail): string {
  const lines: string[] = [];

  lines.push(record.title);
  if (record.alternateTitle) {
    lines.push(`(${record.alternateTitle})`);
  }
  lines.push("");

  lines.push(`Authors: ${record.authors.join("; ")}`);
  if (record.mainAuthorEnglish) lines.push(`Author (English): ${record.mainAuthorEnglish}`);
  if (record.journal) lines.push(`Journal: ${record.journal}`);
  if (record.publisher) lines.push(`Publisher: ${record.publisher}`);
  if (record.year) lines.push(`Year: ${record.year}`);
  if (record.volume) lines.push(`Volume: ${record.volume}`);
  if (record.issue) lines.push(`Issue: ${record.issue}`);
  if (record.pages) lines.push(`Pages: ${record.pages}`);
  if (record.contentType) lines.push(`Type: ${record.contentType}`);
  if (record.language) lines.push(`Language: ${record.language}`);
  if (record.peerReviewed) lines.push(`Peer Reviewed: Yes`);
  if (record.issn) lines.push(`ISSN: ${record.issn}`);
  if (record.database) lines.push(`Database: ${record.database}`);
  if (record.country) lines.push(`Country: ${record.country}`);
  if (record.degreeType) lines.push(`Degree: ${record.degreeType}`);
  if (record.university) lines.push(`University: ${record.university}`);
  if (record.college) lines.push(`College: ${record.college}`);
  if (record.downloadsCount) lines.push(`Downloads: ${record.downloadsCount.toLocaleString()}`);
  lines.push("");

  if (record.abstract) {
    lines.push("Abstract:");
    lines.push(record.abstract);
    lines.push("");
  }

  if (record.subjects && record.subjects.length > 0) {
    lines.push(`Subjects: ${record.subjects.join("; ")}`);
    lines.push("");
  }

  if (record.keywords && record.keywords.length > 0) {
    lines.push(`Keywords: ${record.keywords.join("; ")}`);
    lines.push("");
  }

  if (record.similarItems && record.similarItems.length > 0) {
    lines.push("Similar Items:");
    for (const item of record.similarItems) {
      let itemLine = `  - ${item.title}`;
      if (item.author) itemLine += ` - ${item.author}`;
      if (item.year) itemLine += ` (${item.year})`;
      lines.push(itemLine);
      lines.push(`    ID: ${item.id}`);
    }
    lines.push("");
  }

  lines.push(`Record ID: ${record.id}`);
  lines.push(`URL: ${record.url}`);
  if (record.downloadUrl) {
    lines.push(`Download: ${record.downloadUrl}`);
  }

  return lines.join("\n");
}
