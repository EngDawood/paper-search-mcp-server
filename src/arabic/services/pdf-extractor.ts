/**
 * PDF URL Extractor Service
 * Extracts direct PDF download URLs from article landing pages
 */
import { OPEN_ACCESS_REPOSITORIES } from "../constants";
import type { GetPdfUrlResponse } from "../types";
import { exaContents } from "./exa";

/**
 * Detect the source repository from a URL
 */
export function detectSource(url: string): string {
  const urlLower = url.toLowerCase();

  for (const [key, repo] of Object.entries(OPEN_ACCESS_REPOSITORIES)) {
    if (urlLower.includes(repo.domain)) {
      return repo.name;
    }
  }

  // Check for common patterns not in the repository list
  if (urlLower.includes("researchgate.net")) {
    return "ResearchGate";
  }
  if (urlLower.includes("academia.edu")) {
    return "Academia.edu";
  }

  // Try to extract domain as fallback
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace("www.", "");
  } catch {
    return "Unknown";
  }
}

/**
 * Check if the source is supported for PDF extraction
 */
function isSourceSupported(source: string): boolean {
  const supportedSources = ["ASJP", "SHAMAA"];
  return supportedSources.includes(source);
}

/**
 * Get unsupported source message
 */
function getUnsupportedMessage(source: string): string {
  const messages: Record<string, string> = {
    "ResearchGate": "ResearchGate requires login to download PDFs. Please visit the landing page to download manually.",
    "Academia.edu": "Academia.edu requires login to download PDFs. Please visit the landing page to download manually.",
    "Google Scholar": "Google Scholar links to external sources. Please visit the landing page to access the PDF."
  };

  return messages[source] || `PDF extraction is not supported for ${source}. Please visit the landing page to download manually.`;
}

/**
 * Extract PDF URL from ASJP (Algerian Scientific Journal Platform)
 *
 * ASJP article URLs follow pattern: /en/article/{articleId}
 * PDF URLs follow pattern: /en/downArticle/{journalId}/{volume}/{issue}/{articleId}
 * The citation_pdf_url meta tag contains the direct PDF link
 */
async function extractFromASJP(url: string, exaApiKey: string): Promise<string | null> {
  try {
    const response = await exaContents(exaApiKey, [url], 10000);

    if (!response.results || response.results.length === 0) {
      return null;
    }

    const content = response.results[0].text || "";

    // Look for downArticle pattern in content
    // Pattern: /en/downArticle/journalId/volume/issue/articleId
    const downArticleMatch = content.match(/\/en\/downArticle\/\d+\/\d+\/\d+\/\d+/);
    if (downArticleMatch) {
      return `https://asjp.cerist.dz${downArticleMatch[0]}`;
    }

    // Try to construct PDF URL from article URL
    // Article URL: https://asjp.cerist.dz/en/article/198732
    const articleIdMatch = url.match(/\/article\/(\d+)/);
    if (articleIdMatch) {
      // We can't construct the full PDF URL without journal/volume/issue info
      // but we can try the search API to find it
      return null;
    }

    return null;
  } catch (error) {
    // Extraction is best effort: a failed fetch means "no PDF found"
    return null;
  }
}

/**
 * Extract PDF URL from SHAMAA
 *
 * SHAMAA URLs often directly end with .pdf or contain /PDF/ path
 */
async function extractFromSHAMAA(url: string, exaApiKey: string): Promise<string | null> {
  // If URL already ends with .pdf, return as-is
  if (url.toLowerCase().endsWith(".pdf")) {
    return url;
  }

  // Check if URL contains /PDF/ path (already a PDF link)
  if (url.includes("/PDF/")) {
    return url;
  }

  try {
    const response = await exaContents(exaApiKey, [url], 10000);

    if (!response.results || response.results.length === 0) {
      return null;
    }

    const content = response.results[0].text || "";

    // Look for PDF links in content
    // Pattern: /PDF/Articles/.../.pdf
    const pdfMatch = content.match(/\/PDF\/[^\s"'<>]+\.pdf/i);
    if (pdfMatch) {
      // Construct full URL
      const baseUrl = new URL(url);
      return `${baseUrl.origin}${pdfMatch[0]}`;
    }

    // Look for download links
    const downloadMatch = content.match(/href=["']([^"']*\.pdf)["']/i);
    if (downloadMatch) {
      const pdfPath = downloadMatch[1];
      if (pdfPath.startsWith("http")) {
        return pdfPath;
      }
      const baseUrl = new URL(url);
      return `${baseUrl.origin}${pdfPath.startsWith("/") ? "" : "/"}${pdfPath}`;
    }

    return null;
  } catch (error) {
    // Extraction is best effort: a failed fetch means "no PDF found"
    return null;
  }
}

/**
 * Main function to extract PDF URL from an article landing page
 */
export async function getPdfUrl(
  url: string,
  exaApiKey: string
): Promise<GetPdfUrlResponse> {
  const source = detectSource(url);

  // Check if URL already points directly to a PDF
  if (url.toLowerCase().endsWith(".pdf")) {
    return {
      url,
      pdfUrl: url,
      source,
      supported: true,
      message: "URL already points to a PDF file."
    };
  }

  // Check if source is supported
  if (!isSourceSupported(source)) {
    return {
      url,
      pdfUrl: null,
      source,
      supported: false,
      message: getUnsupportedMessage(source)
    };
  }

  // Extract PDF URL based on source
  let pdfUrl: string | null = null;

  switch (source) {
    case "ASJP":
      pdfUrl = await extractFromASJP(url, exaApiKey);
      break;
    case "SHAMAA":
      pdfUrl = await extractFromSHAMAA(url, exaApiKey);
      break;
  }

  if (pdfUrl) {
    return {
      url,
      pdfUrl,
      source,
      supported: true,
      message: "PDF URL extracted successfully."
    };
  }

  return {
    url,
    pdfUrl: null,
    source,
    supported: true,
    message: "Could not find a direct PDF URL on this page. The page may require manual navigation to download the PDF."
  };
}
