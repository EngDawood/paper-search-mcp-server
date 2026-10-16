/**
 * Parser for Mandumah search results pages
 */
import { SCHOLAR_RECORD_URL } from "../constants";
import type { ScholarSearchResult } from "../types";

/**
 * Parse search results from Mandumah markdown output
 */
export function parseSearchMarkdown(markdown: string): { total: number; results: ScholarSearchResult[] } {
  const results: ScholarSearchResult[] = [];

  // Try to extract total results count - pattern: "من **10457**"
  let total = 0;
  const totalMatch = markdown.match(/من\s*\*\*(\d[\d,]*)\*\*/);
  if (totalMatch) {
    total = parseInt(totalMatch[1].replace(/,/g, ''), 10);
  }

  // Extract individual results - look for Record links (title links)
  const recordPattern = /\[([^\]]+)\]\(https?:\/\/search\.mandumah\.com\/Record\/(\d+)[^)]*\)/g;
  let match;
  const seenIds = new Set<string>();

  while ((match = recordPattern.exec(markdown)) !== null) {
    const title = match[1].trim();
    const id = match[2];

    // Skip if we've already seen this ID or it's a navigation/short link
    if (seenIds.has(id) || title.length < 5) continue;
    seenIds.add(id);

    // Find the section after this record link (contains the metadata table)
    const afterMatch = markdown.substring(match.index, Math.min(markdown.length, match.index + 2000));

    // Extract author from table: | **المؤلف:** | [author name](...) |
    const authors: string[] = [];
    const authorMatch = afterMatch.match(/\|\s*\*\*المؤلف:\*\*\s*\|\s*\[([^\]]+)\]/);
    if (authorMatch) {
      authors.push(authorMatch[1].trim());
    }

    // Extract year from table: | **تاريخ:** | 2017 |
    let year: string | undefined;
    const yearMatch = afterMatch.match(/\|\s*\*\*تاريخ:\*\*\s*\|\s*(\d{4})\s*\|/);
    if (yearMatch) {
      year = yearMatch[1];
    }

    // Extract content type: | **نوع المحتوى:** | بحوث ومقالات |
    let contentType: string | undefined;
    const contentTypeMatch = afterMatch.match(/\|\s*\*\*نوع المحتوى:\*\*\s*\|\s*([^|]+)\s*\|/);
    if (contentTypeMatch) {
      contentType = contentTypeMatch[1].trim();
    }

    // Extract journal/source: | **المصدر:** | [journal name](...) |
    let journal: string | undefined;
    const journalMatch = afterMatch.match(/\|\s*\*\*المصدر:\*\*\s*\|\s*\[([^\]]+)\]/);
    if (journalMatch) {
      journal = journalMatch[1].trim();
    }

    results.push({
      id,
      title,
      authors: authors.length > 0 ? authors : ['Unknown Author'],
      year,
      journal,
      contentType,
      url: `${SCHOLAR_RECORD_URL}/${id}`
    });
  }

  return { total: total || results.length, results };
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " "
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, ent: string) => {
    if (ent[0] === "#") {
      const code = ent[1].toLowerCase() === "x" ? parseInt(ent.slice(2), 16) : parseInt(ent.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return NAMED_ENTITIES[ent.toLowerCase()] ?? whole;
  });
}

/** Strip tags, decode entities, collapse whitespace */
function htmlToText(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();
}

/** Remove a trailing death-date marker such as "، ت. 2021 م." from an author name */
function cleanAuthorName(name: string): string {
  return name.replace(/[،,]?\s*ت\.\s*\d{3,4}\s*(?:هـ|م)?\.?\s*(?:م\.?)?\s*$/, "").trim();
}

/**
 * Parse search results from Mandumah's raw HTML.
 *
 * The HTML is preferred over Firecrawl's markdown because Mandumah wraps matched terms in
 * <span class="highlight">, and the markdown conversion drops the whitespace around them
 * ("الذكاء الاصطناعيفي"). The HTML also carries abstracts, publisher and PDF links.
 */
export function parseSearchHtml(html: string): ScholarSearchResult[] {
  const results: ScholarSearchResult[] = [];
  const seenIds = new Set<string>();

  const blocks = html.split(/<div class="result [^"]*\brecordId\b[^"]*">/).slice(1);

  for (const block of blocks) {
    const titleMatch = block.match(/<a\s+href="[^"]*\/Record\/(\d+)[^"]*"\s+class="title"[^>]*>([\s\S]*?)<\/a>/);
    if (!titleMatch) continue;

    const id = titleMatch[1];
    const title = htmlToText(titleMatch[2]);
    if (seenIds.has(id) || !title) continue;
    seenIds.add(id);

    // Metadata rows: <tr><td><strong>LABEL:</strong></td><td>VALUE</td></tr>
    const fields = new Map<string, string>();
    const rowPattern = /<tr>\s*<td>\s*(?:<strong>\s*)+([^<]+?)\s*(?:<\/strong>\s*)+<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/g;
    let row;
    while ((row = rowPattern.exec(block)) !== null) {
      const label = row[1].replace(/[:\s]+$/, "").trim();
      if (!fields.has(label)) fields.set(label, row[2]);
    }

    const authorsHtml = fields.get("المؤلف");
    const authors: string[] = [];
    if (authorsHtml) {
      const names = [...authorsHtml.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/g)].map(m => htmlToText(m[1]));
      for (const name of names.length > 0 ? names : [htmlToText(authorsHtml)]) {
        const cleaned = cleanAuthorName(name);
        if (cleaned) authors.push(cleaned);
      }
    }

    // Source cell: <a>journal</a> , ع31
    let journal: string | undefined;
    let issue: string | undefined;
    const sourceHtml = fields.get("المصدر");
    if (sourceHtml) {
      const linkMatch = sourceHtml.match(/<a\b[^>]*>([\s\S]*?)<\/a>([\s\S]*)$/);
      if (linkMatch) {
        journal = htmlToText(linkMatch[1]) || undefined;
        issue = htmlToText(linkMatch[2]).replace(/^[,،\s]+/, "") || undefined;
      } else {
        journal = htmlToText(sourceHtml) || undefined;
      }
    }

    const yearText = fields.get("تاريخ") ? htmlToText(fields.get("تاريخ")!) : undefined;
    const year = yearText?.match(/\d{4}/)?.[0];

    // Abstract cell ends with a "full abstract" link that is not part of the text
    const abstractHtml = fields.get("المستخلص");
    const abstract = abstractHtml
      ? htmlToText(abstractHtml.replace(/<a\b[^>]*>[\s\S]*?<\/a>/g, "")) || undefined
      : undefined;

    const downloadMatch = block.match(/<a\b[^>]*class="downloadPdfImg"[^>]*href="([^"]+)"/)
      ?? block.match(/<a\b[^>]*href="([^"]+)"[^>]*class="downloadPdfImg"/);

    results.push({
      id,
      title,
      authors: authors.length > 0 ? authors : ["Unknown Author"],
      year,
      journal,
      issue,
      publisher: fields.get("الناشر") ? htmlToText(fields.get("الناشر")!) || undefined : undefined,
      pages: fields.get("الصفحات") ? htmlToText(fields.get("الصفحات")!) || undefined : undefined,
      contentType: fields.get("نوع المحتوى") ? htmlToText(fields.get("نوع المحتوى")!) || undefined : undefined,
      abstract,
      downloadUrl: downloadMatch ? decodeEntities(downloadMatch[1]) : undefined,
      url: `${SCHOLAR_RECORD_URL}/${id}`
    });
  }

  return results;
}

/**
 * Parse a Mandumah search page. Uses the HTML when available and falls back to markdown
 * (always used for the total count, which the markdown exposes reliably).
 */
export function parseSearchPage(markdown: string, html?: string): { total: number; results: ScholarSearchResult[] } {
  const fromMarkdown = parseSearchMarkdown(markdown);
  const fromHtml = html ? parseSearchHtml(html) : [];

  if (fromHtml.length === 0) return fromMarkdown;

  const markdownTotal = markdown.match(/من\s*\*\*(\d[\d,]*)\*\*/);
  return { total: markdownTotal ? fromMarkdown.total : fromHtml.length, results: fromHtml };
}
