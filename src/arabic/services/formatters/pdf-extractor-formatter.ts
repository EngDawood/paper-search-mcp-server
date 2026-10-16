/**
 * Formatters for get_pdf_url tool output
 */
import type { GetPdfUrlResponse } from "../../types";

/**
 * Format PDF URL extraction result as markdown
 */
export function formatGetPdfUrlMarkdown(response: GetPdfUrlResponse): string {
  const lines: string[] = [];

  if (response.pdfUrl) {
    lines.push("## PDF URL Found");
    lines.push("");
    lines.push(`**Source:** ${response.source}`);
    lines.push(`**PDF URL:** [Download PDF](${response.pdfUrl})`);
    lines.push("");
    lines.push(`> ${response.message || "PDF URL extracted successfully."}`);
  } else if (!response.supported) {
    lines.push("## PDF Extraction Not Supported");
    lines.push("");
    lines.push(`**Source:** ${response.source}`);
    lines.push(`**Message:** ${response.message}`);
    lines.push("");
    lines.push(`Please visit the [landing page](${response.url}) to download manually.`);
  } else {
    lines.push("## PDF URL Not Found");
    lines.push("");
    lines.push(`**Source:** ${response.source}`);
    lines.push(`**Message:** ${response.message}`);
    lines.push("");
    lines.push(`Please visit the [landing page](${response.url}) to download manually.`);
  }

  return lines.join("\n");
}

/**
 * Format PDF URL extraction result as plain text
 */
export function formatGetPdfUrlText(response: GetPdfUrlResponse): string {
  const lines: string[] = [];

  if (response.pdfUrl) {
    lines.push("PDF URL FOUND");
    lines.push("=============");
    lines.push("");
    lines.push(`Source: ${response.source}`);
    lines.push(`PDF URL: ${response.pdfUrl}`);
    lines.push("");
    lines.push(response.message || "PDF URL extracted successfully.");
  } else if (!response.supported) {
    lines.push("PDF EXTRACTION NOT SUPPORTED");
    lines.push("============================");
    lines.push("");
    lines.push(`Source: ${response.source}`);
    lines.push(`Message: ${response.message}`);
    lines.push("");
    lines.push(`Landing Page: ${response.url}`);
  } else {
    lines.push("PDF URL NOT FOUND");
    lines.push("=================");
    lines.push("");
    lines.push(`Source: ${response.source}`);
    lines.push(`Message: ${response.message}`);
    lines.push("");
    lines.push(`Landing Page: ${response.url}`);
  }

  return lines.join("\n");
}
