/**
 * Parser for Mandumah record detail pages
 * Decomposed into smaller, testable functions
 */
import { SCHOLAR_RECORD_URL, ARABIC_FIELDS } from "../constants";
import type { ScholarRecordDetail, SimilarItem } from "../types";
import { cleanValue } from "./utils";

/**
 * Extract a value from markdown using multiple patterns
 * Handles various markdown formats from Mandumah pages
 */
export function extractValue(markdown: string, key: string): string | undefined {
  // Try multiple patterns for different markdown structures
  const patterns = [
    // Pattern: key:    value (with spaces/tabs)
    new RegExp(`${key}:\\s+([^\\n]+)`, 'i'),
    // Pattern: | key | value |
    new RegExp(`\\|\\s*${key}\\s*\\|\\s*([^\\n]+)`, 'i'),
    // Pattern: **key:** value
    new RegExp(`\\*\\*${key}:\\*\\*\\s*([^\\n]+)`, 'i'),
    // Pattern: key: value (simple)
    new RegExp(`${key}:\\s*([^\\n]+)`, 'i')
  ];

  for (const pattern of patterns) {
    const match = markdown.match(pattern);
    if (match && match[1]) {
      // Clean up: remove markdown links, pipes, br tags, trim whitespace
      const value = match[1].replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
      return cleanValue(value);
    }
  }
  return undefined;
}

/**
 * Extract title from markdown
 * Prioritizes explicit title field, falls back to Arabic heading
 */
export function extractTitle(markdown: string): string {
  const titleField = extractValue(markdown, ARABIC_FIELDS.TITLE);
  if (titleField && titleField.length > 5) {
    return titleField;
  }

  // Try heading that contains Arabic text (not just numbers)
  const titleMatch = markdown.match(/^#+\s+([^\n]*[\u0600-\u06FF][^\n]*)/m);
  if (titleMatch) {
    return cleanValue(titleMatch[1]) || 'Unknown Title';
  }

  return 'Unknown Title';
}

/**
 * Extract authors from markdown
 * Handles main author and other authors fields
 */
export function extractAuthors(markdown: string): { authors: string[]; mainAuthorEnglish?: string } {
  const authors: string[] = [];

  // Extract main author
  const mainAuthorRaw = extractValue(markdown, ARABIC_FIELDS.MAIN_AUTHOR);
  if (mainAuthorRaw) {
    // Remove role markers like (مؤلف)
    const cleanAuthor = mainAuthorRaw.replace(/\s*\([^)]+\)\s*/g, '').trim();
    if (cleanAuthor && cleanAuthor.length > 1) {
      authors.push(cleanAuthor);
    }
  }

  // Extract main author English name
  const mainAuthorEnglish = extractValue(markdown, ARABIC_FIELDS.MAIN_AUTHOR_ENGLISH);

  // Extract other authors
  const otherAuthorsRaw = extractValue(markdown, ARABIC_FIELDS.OTHER_AUTHORS);
  if (otherAuthorsRaw) {
    // Clean up br tags first, then split by comma
    const cleaned = otherAuthorsRaw
      .replace(/<br\s*\/?>/gi, ', ')
      .replace(/\s*,\s*,\s*/g, ', ');

    const authorParts = cleaned.split(/\s*,\s*(?=\S)/);

    for (const part of authorParts) {
      const cleanAuthor = part
        .replace(/\s*\([^)]+\)\s*/g, '')
        .replace(/^\|+|\|+$/g, '')
        .trim();
      if (cleanAuthor && cleanAuthor.length > 1 && !cleanAuthor.match(/^[\s|;]+$/)) {
        authors.push(cleanAuthor);
      }
    }
  }

  return {
    authors: authors.length > 0 ? authors : ['Unknown Author'],
    mainAuthorEnglish
  };
}

/**
 * Extract abstract from markdown
 * Requires minimum length to avoid false positives
 */
export function extractAbstract(markdown: string): string | undefined {
  const abstractPatterns = [
    new RegExp(`${ARABIC_FIELDS.ABSTRACT}:\\s+([^\\n][\\s\\S]*?)(?=\\n\\s*\\n|\\n#+|\\n\\*\\*|$)`),
    new RegExp(`\\|\\s*${ARABIC_FIELDS.ABSTRACT}\\s*\\|\\s*([\\s\\S]*?)\\s*\\|`)
  ];

  for (const pattern of abstractPatterns) {
    const match = markdown.match(pattern);
    if (match && match[1] && match[1].length > 50) {
      return cleanValue(match[1]);
    }
  }
  return undefined;
}

/**
 * Extract subjects from markdown
 * Handles pipe and br tag separators
 */
export function extractSubjects(markdown: string): string[] {
  const subjects: string[] = [];
  const subjectsPatterns = [
    new RegExp(`${ARABIC_FIELDS.SUBJECTS}:\\s*\\n?\\s*([^\\n]+)`, 'i'),
    new RegExp(`${ARABIC_FIELDS.SUBJECTS}:\\s+([^\\n]+)`, 'i'),
    new RegExp(`\\|\\s*${ARABIC_FIELDS.SUBJECTS}\\s*\\|\\s*([^|]+)`, 'i')
  ];

  for (const pattern of subjectsPatterns) {
    const match = markdown.match(pattern);
    if (match && match[1]) {
      const rawSubjects = match[1]
        .replace(/<br\s*\/?>/gi, '|')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

      const subjectList = rawSubjects
        .split(/\s*\|\s*/)
        .map(s => s.replace(/\\/g, '').trim())
        .filter(s => s.length > 0);

      if (subjectList.length > 0) {
        subjects.push(...subjectList);
        break;
      }
    }
  }

  return subjects;
}

/**
 * Extract downloads count from markdown
 */
export function extractDownloadsCount(markdown: string): number | undefined {
  const downloadsPatterns = [
    new RegExp(`${ARABIC_FIELDS.DOWNLOADS_COUNT}\\s*\\n?\\s*(\\d+)`),
    /(\d+)\s*\n\s*أبلغ عن/
  ];

  for (const pattern of downloadsPatterns) {
    const match = markdown.match(pattern);
    if (match && match[1]) {
      return parseInt(match[1], 10);
    }
  }
  return undefined;
}

/**
 * Extract similar items from markdown
 */
export function extractSimilarItems(markdown: string): SimilarItem[] {
  const similarItems: SimilarItem[] = [];
  const similarSectionMatch = markdown.match(
    new RegExp(`${ARABIC_FIELDS.SIMILAR_ITEMS}([\\s\\S]*?)(?=##|$)`, 'i')
  );

  if (!similarSectionMatch) return similarItems;
  const section = similarSectionMatch[1];

  const linkPattern = /\[([^\]]+)\]\((https?:\/\/search\.mandumah\.com\/Record\/(\d+)[^)]*)\)/g;
  const links = [...section.matchAll(linkPattern)];

  links.forEach((link, i) => {
    const [whole, title, url, id] = link;
    // Text belonging to this item runs up to the next item's link
    const start = link.index! + whole.length;
    const end = i + 1 < links.length ? links[i + 1].index! : section.length;
    const details = section.slice(start, end);

    const author = details.match(new RegExp(`${ARABIC_FIELDS.BY_AUTHOR}:\\s*(.+?)\\s*(?:${ARABIC_FIELDS.PUBLISHED}:|$)`, 'm'))?.[1];
    const year = details.match(new RegExp(`${ARABIC_FIELDS.PUBLISHED}:\\s*\\(?(\\d{4})\\)?`))?.[1];

    similarItems.push({
      title: title.trim(),
      url: url.trim(),
      id,
      author: author?.trim() || undefined,
      year
    });
  });

  return similarItems;
}

/**
 * Extract author keywords ("كلمات المؤلف المفتاحية"), which are pipe-separated
 */
export function extractKeywords(markdown: string): string[] {
  const match = markdown.match(/\|\s*كلمات المؤلف المفتاحية:\s*\|\s*([^\n]+)/);
  if (!match) return [];
  return match[1]
    .replace(/\|\s*$/, '')
    .split(/\s*\\?\|\s*/)
    .map(k => k.trim())
    .filter(Boolean);
}

/**
 * Extract the full-text download link ("رابط المحتوى")
 */
export function extractDownloadUrl(markdown: string): string | undefined {
  const match = markdown.match(/رابط المحتوى:[^\n]*?\]\((https?:\/\/[^)\s]+)\)/);
  return match?.[1];
}

/**
 * Check if record is peer reviewed
 */
export function isPeerReviewed(markdown: string): boolean {
  const peerReviewedRaw = extractValue(markdown, ARABIC_FIELDS.PEER_REVIEWED);
  return (
    peerReviewedRaw?.includes(ARABIC_FIELDS.YES_ARABIC) ||
    peerReviewedRaw?.toLowerCase().includes(ARABIC_FIELDS.YES_ENGLISH) ||
    false
  );
}

/**
 * Parse record details from Mandumah markdown output
 * Main function that orchestrates all extraction helpers
 */
export function parseRecordMarkdown(markdown: string, recordId: string): ScholarRecordDetail {
  const title = extractTitle(markdown);
  const alternateTitle = extractValue(markdown, ARABIC_FIELDS.ALTERNATE_TITLE);
  const { authors, mainAuthorEnglish } = extractAuthors(markdown);
  const abstract = extractAbstract(markdown);
  const subjects = extractSubjects(markdown);
  const downloadsCount = extractDownloadsCount(markdown);
  const similarItems = extractSimilarItems(markdown);
  const keywords = extractKeywords(markdown);

  return {
    id: recordId,
    title,
    alternateTitle,
    authors,
    mainAuthorEnglish,
    journal: cleanValue(extractValue(markdown, ARABIC_FIELDS.SOURCE)) ||
             cleanValue(extractValue(markdown, ARABIC_FIELDS.JOURNAL)),
    publisher: cleanValue(extractValue(markdown, ARABIC_FIELDS.PUBLISHER)),
    year: cleanValue(extractValue(markdown, ARABIC_FIELDS.GREGORIAN_DATE)),
    volume: cleanValue(extractValue(markdown, ARABIC_FIELDS.VOLUME)),
    issue: cleanValue(extractValue(markdown, ARABIC_FIELDS.ISSUE)),
    pages: cleanValue(extractValue(markdown, ARABIC_FIELDS.PAGES)),
    abstract,
    contentType: cleanValue(extractValue(markdown, ARABIC_FIELDS.CONTENT_TYPE)),
    language: cleanValue(extractValue(markdown, ARABIC_FIELDS.LANGUAGE)),
    url: `${SCHOLAR_RECORD_URL}/${recordId}`,
    peerReviewed: isPeerReviewed(markdown),
    subjects: subjects.length > 0 ? subjects : undefined,
    keywords: keywords.length > 0 ? keywords : undefined,
    downloadUrl: extractDownloadUrl(markdown),
    doi: markdown.match(/\|\s*DOI:\s*\|\s*(10\.[^\s|]+)/)?.[1],
    issn: cleanValue(extractValue(markdown, ARABIC_FIELDS.ISSN)) ||
          cleanValue(extractValue(markdown, ARABIC_FIELDS.ISSN_ARABIC)),
    database: cleanValue(extractValue(markdown, ARABIC_FIELDS.DATABASE)),
    country: cleanValue(extractValue(markdown, ARABIC_FIELDS.COUNTRY)),
    hijriDate: cleanValue(extractValue(markdown, ARABIC_FIELDS.HIJRI_DATE)),
    downloadsCount,
    // Dissertation-specific fields
    degreeType: cleanValue(extractValue(markdown, ARABIC_FIELDS.DEGREE_TYPE)),
    university: cleanValue(extractValue(markdown, ARABIC_FIELDS.UNIVERSITY)),
    college: cleanValue(extractValue(markdown, ARABIC_FIELDS.COLLEGE)),
    location: cleanValue(extractValue(markdown, ARABIC_FIELDS.LOCATION)),
    // Similar items
    similarItems: similarItems.length > 0 ? similarItems : undefined
  };
}
