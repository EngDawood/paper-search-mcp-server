/**
 * Cleans raw Exa results for open-access repositories.
 *
 * Exa returns whole page text, so snippets start with site chrome (ASJP modal text,
 * ResearchGate breadcrumbs, Google Scholar UI strings), titles carry site suffixes, and
 * many hits are not papers at all (profiles, home pages). This module turns that into
 * paper-level results with titles, authors and readable snippets.
 */
import type { PdfSource } from "../types";

export interface RawExaResult {
  title: string | null;
  url: string;
  text?: string;
  score?: number;
}

const SNIPPET_MAX_CHARS = 400;

/** Lines that are page chrome rather than content */
const CHROME_LINE =
  /^(loading\.\.\.|read online$|the system can't perform|download\b|read full-text|request full-text|copy link|show all|hide\b|view article|save to|cite\b|×|annuler|\*\*(les revues|seules|pour les autres))/i;

/**
 * Per-site rules: does this URL point at an individual paper (as opposed to a profile,
 * journal, search or home page)? Keyed by hostname suffix. Sites without a rule accept any URL.
 */
const PAPER_URL_RULES: Array<[host: string, isPaper: (u: URL) => boolean]> = [
  ["asjp.cerist.dz", u => /\/article\/\d+/.test(u.pathname)],
  ["scholar.google.com", u => u.pathname === "/citations" && u.searchParams.get("view_op") === "view_citation"],
  ["search.shamaa.org", u => /\.pdf$/i.test(u.pathname) || /\/FullRecord/i.test(u.pathname)],
  ["researchgate.net", u => /\/publication\//.test(u.pathname)],
  // Egyptian Knowledge Bank journals: <journal>.journals.ekb.eg/article_<id>.html
  ["journals.ekb.eg", u => /\/article_\d+\.html$/.test(u.pathname)],
  // OJS sites: /article/view/<id> (landing page) or /article/download/<id>/<file> (PDF)
  ["journals.ajsrp.com", u => /\/article\/(view|download)\//.test(u.pathname)],
  ["najsp.com", u => /\/article\/view\//.test(u.pathname)],
  ["pal-ea.com", u => /\/article\/view\//.test(u.pathname)],
  ["doaj.org", u => /^\/article\/[0-9a-f]{32}\/?$/.test(u.pathname)],
  ["search.emarefa.net", u => /\/detail\//.test(u.pathname)],
  // Theses and articles live under /<16 digit id>/..., plus PDFs in the bucket
  ["theses-algerie.com", u => /\.pdf$/i.test(u.pathname) || /^\/\d{10,}\//.test(u.pathname)],
  ["dl.acm.org", u => u.pathname.startsWith("/doi/")],
  ["sciencedirect.com", u => /\/science\/article\/(abs\/)?pii\//.test(u.pathname)],
  // WordPress posts: /?p=<id>
  ["democraticac.de", u => /^\d+$/.test(u.searchParams.get("p") ?? "")],
  // bepress Digital Commons: PDF viewer or /<journal>/vol<N>/iss<N>/<n>
  ["kauj.researchcommons.org", u => u.pathname === "/cgi/viewcontent.cgi" || /\/vol\d+\/iss\d+\/\d+/.test(u.pathname)]
];

/**
 * Identity of a page for de-duplication: ignores scheme, "www." and the ?lang= switch that
 * some sites (EKB) add to the same article.
 */
export function urlKey(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.delete("lang");
    const query = u.searchParams.toString();
    return `${u.hostname.replace(/^www\./, "")}${u.pathname.replace(/\/$/, "")}${query ? `?${query}` : ""}`;
  } catch {
    return url;
  }
}

export function isPaperPage(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const rule = PAPER_URL_RULES.find(([suffix]) => host === suffix || host.endsWith(`.${suffix}`));
    return rule ? rule[1](u) : true;
  } catch {
    return false;
  }
}

/** Google Scholar citation pages: "Authors\n\nA, B\n\nPublication date\n\n2015/5/28\n\nSource\n\nnature ..." */
function parseScholarCitation(text: string): { authors: string[]; year?: string; source?: string; description?: string } {
  const field = (label: string): string | undefined =>
    text.match(new RegExp(`(?:^|\\n)${label}\\s*\\n+([^\\n]+)`))?.[1]?.trim();

  const authors = (field("Authors") ?? "")
    .split(",")
    .map(a => a.trim())
    .filter(Boolean);
  const year = field("Publication date")?.match(/\d{4}/)?.[0];
  const source = field("Journal") ?? field("Source") ?? field("Book") ?? field("Conference");
  const description = text.match(/(?:^|\n)Description\s*\n+([\s\S]*?)(?:\n+Total citations|\n+Scholar articles|$)/)?.[1]?.trim();

  return { authors, year, source, description };
}

/** Bullet list that follows a bold label, e.g. "**المؤلف**\n* name\n* name" (EKB pages) */
function boldLabelBullets(text: string, labels: string[]): string[] {
  const m = text.match(new RegExp(`\\*\\*(?:${labels.join("|")})\\*\\*[ \\t]*\\n((?:[ \\t]*\\*[ \\t]+[^\\n]+(?:\\n|$))+)`));
  if (!m) return [];
  return m[1]
    .split("\n")
    .map(l => l.replace(/^[ \t]*\*[ \t]+/, "").trim())
    .filter(Boolean);
}

/**
 * Best-effort author extraction from page text (empty when the page has no author block)
 */
export function extractAuthors(url: string, text: string): string[] {
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return [];
  }

  if (host.endsWith("asjp.cerist.dz")) {
    const m = text.match(/الكاتب\s*:\s*\**\s*([^\n]+)/);
    // Several authors are joined with "." ("دمان دبيح.بوالقمح محمد")
    return (m?.[1] ?? "")
      .split(/\s*[.،;]\s*/)
      .map(n => n.replace(/\*/g, "").trim())
      .filter(Boolean);
  }

  if (host.endsWith("scholar.google.com")) {
    return parseScholarCitation(text).authors;
  }

  if (host.endsWith("search.emarefa.net")) {
    // Names are "family، given" pairs separated only by a space, so they cannot be split
    // reliably; keep the field as one entry rather than guess.
    const names: string[] = [];
    for (const label of ["المؤلف الرئيسي", "المؤلف", "المؤلفون المشاركون"]) {
      const m = text.match(new RegExp(`#{2,3}\\s*${label}\\s*\\n+([^\\n#]+)`));
      const value = m?.[1]?.trim();
      if (value) names.push(value);
    }
    return names;
  }

  if (host.endsWith("journals.ekb.eg")) {
    return boldLabelBullets(text, ["المؤلف", "المؤلفون", "Authors?"])
      .map(n => n.replace(/\*+/g, "").replace(/\s*\([^)]*@[^)]*\)/g, "").trim()) // "name** (mail@x.edu)"
      .filter(Boolean)
      .slice(0, 10);
  }

  if (host.endsWith("researchgate.net")) {
    const block = text.match(/(?:^|\n)Authors:?\s*\n([\s\S]*?)(?:\n(?:Show all|Request full-text|Download|Read full-text|##|---)|$)/);
    if (!block) return [];
    const names: string[] = [];
    for (const raw of block[1].split("\n")) {
      const line = raw.trim();
      if (!line || /^[*-]\s/.test(line) || line.includes(":") || /\d/.test(line)) continue;
      const name = line.replace(/\s+at\s+.+$/, "").trim();
      if (name.length > 1 && name.length <= 60 && !names.includes(name)) names.push(name);
      if (names.length >= 10) break;
    }
    return names;
  }

  return [];
}

/**
 * Strip site suffixes and decoration from a result title
 */
export function cleanTitle(title: string | null, fallback: string): string {
  const cleaned = (title ?? "")
    .replace(/[‪-‮]/g, "") // bidi marks Scholar puts around names
    .replace(/^\s*[:\-–]\s*/, "")
    .replace(/^\s*(\(PDF\)|\[PDF\])\s*/i, "")
    .replace(
      /\s*[|\-–]\s*(ASJP(\s*-\s*CERIST)?|Google Scholar|Shamaa|ResearchGate|Academia\.edu|DOAJ|ScienceDirect|ACM Digital Library|[^|]*\(NAJSP\))\s*$/i,
      ""
    )
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || fallback;
}

const GENERIC_TITLE = /^(google scholar|view article|الباحث العلمي من google|google akademik)$/i;

/**
 * Build a readable snippet: drop site chrome, prefer the abstract section, cap the length
 */
export function cleanSnippet(text: string | undefined, title: string): string | undefined {
  if (!text) return undefined;

  let body = text;

  // Prefer the abstract section when the page has one
  const abstractMatch =
    body.match(/(?:^|\n)#{2,3}\s*(?:الملخص|ملخص|Abstract(?: and Figures)?)\s*\n+([\s\S]+)/i) ??
    body.match(/(?:^|\n)\*\*(?:المستخلص|الملخص|Abstract)\*\*[ \t]*\n+([\s\S]+)/i) ??
    // eMarefa: metadata fields as "### label" blocks, the abstract follows the record number
    body.match(/(?:^|\n)#{2,3}\s*رقم السجل\s*\n+(?:BIM-\d+[ \t]*\n+)?([\s\S]+)/) ??
    body.match(/(?:^|\n)#{2,3}\s*الملخص(?=\S)([\s\S]+)/); // ASJP glues the heading to the text
  if (abstractMatch) {
    body = abstractMatch[1];
  } else {
    const description = parseScholarCitation(body).description;
    if (description) body = description;
  }

  // Pages that open with site navigation (older EKB templates, ScienceDirect) and whose abstract
  // is out of reach would otherwise return that navigation as the snippet
  if (!abstractMatch && /iKNiTO Journal Management System|Skip to main content/.test(text)) body = "";

  const strip = (t: string) => t.replace(/[\s#|:*"'«»]/g, "");
  const titleKey = strip(title);
  const lines = body
    .split("\n")
    .map(l => l.trim().replace(/^#{1,6}\s*/, ""))
    .filter(l => l && !CHROME_LINE.test(l))
    // lines that only repeat the title (ASJP prints it several times, sometimes without spaces)
    .filter(l => strip(l) !== titleKey);

  let snippet = lines.join(" ").replace(/\s+/g, " ").trim();
  // "Université X - Alger 2 Résumé: الملخص: ..." -> keep only the abstract text
  snippet = snippet.replace(/^.{0,120}?\b(?:Résumé|Resume|Abstract)\s*:\s*(?:الملخص\s*:\s*)?/i, "");
  snippet = snippet.replace(/^(?:الملخص|ملخص|المستخلص)\s*:\s*/, "");
  if (!snippet || looksMashed(snippet)) {
    // Abstract text with stripped spaces is unreadable; keyword lists usually keep their spaces
    const keywords = boldLabelBullets(text, ["الكلمات الرئيسية", "الكلمات المفتاحية", "Keywords?"]).join(", ");
    return keywords && !looksMashed(keywords) ? `Keywords: ${keywords}`.slice(0, SNIPPET_MAX_CHARS) : undefined;
  }

  if (snippet.length > SNIPPET_MAX_CHARS) {
    const cut = snippet.slice(0, SNIPPET_MAX_CHARS);
    snippet = `${cut.slice(0, Math.max(cut.lastIndexOf(" "), SNIPPET_MAX_CHARS * 0.8))}...`;
  }
  return snippet;
}

/**
 * ASJP page text sometimes has every space stripped ("تعدالنظريةالمعرفية..."), which is unreadable
 * and cannot be repaired reliably. Arabic prose normally has about one space per 5-6 characters.
 */
export function looksMashed(text: string): boolean {
  const arabic = (text.match(/[\u0600-\u06FF]/g) ?? []).length;
  if (arabic < 40) return false;
  const spaces = (text.match(/\s/g) ?? []).length;
  if (spaces / text.length < 0.08) return true;

  // Partly stripped text still has spaces, but many 15+ letter "words" (normal Arabic rarely has any)
  const words = text.split(/\s+/).filter(w => /[\u0600-\u06FF]/.test(w));
  const long = words.filter(w => (w.match(/[\u0600-\u06FF]/g) ?? []).length >= 15).length;
  return words.length >= 4 && long / words.length >= 0.2;
}

/** Normalize Arabic/Latin text for loose matching */
function normalizeToken(token: string): string {
  return token
    .toLowerCase()
    .replace(/[ً-ْـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/^ال/, "");
}

const STOPWORDS = new Set(["في", "من", "على", "عن", "الى", "إلى", "the", "and", "for", "of"]);

function tokenize(text: string): string[] {
  return (text.match(/[\p{L}\p{N}]+/gu) ?? [])
    .map(t => (STOPWORDS.has(t.toLowerCase()) ? "" : normalizeToken(t)))
    .filter(t => t.length >= 3);
}

/**
 * Fraction of the query's terms found (as a prefix match, to tolerate Arabic affixes) in the text
 */
export function relevanceScore(query: string, text: string): number {
  const q = tokenize(query);
  if (q.length === 0) return 0;
  const t = tokenize(text);
  const hit = q.filter(qt => t.some(tt => tt.startsWith(qt) || qt.startsWith(tt)));
  return hit.length / q.length;
}

/**
 * Turn raw Exa results into paper-level results: only real paper pages, clean titles and
 * snippets, authors where available, best query matches first.
 *
 * @param sourceOf maps a URL to a repository name
 */
export function processExaResults(
  raw: RawExaResult[],
  query: string,
  maxResults: number,
  sourceOf: (url: string) => string
): PdfSource[] {
  const seen = new Set<string>();
  const cleaned = raw
    .filter(r => isPaperPage(r.url))
    .filter(r => {
      const key = urlKey(r.url);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((r, index) => {
      const text = r.text ?? "";
      const scholar = new URL(r.url).hostname.endsWith("scholar.google.com") ? parseScholarCitation(text) : undefined;

      let title = cleanTitle(r.title, query);
      if (scholar && GENERIC_TITLE.test(title)) {
        // Scholar citation pages carry no title text, so label them as a citation instead
        const label = [scholar.authors.slice(0, 3).join(", "), scholar.year && `(${scholar.year})`, scholar.source]
          .filter(Boolean)
          .join(" ");
        title = label || title;
      }

      const snippet = cleanSnippet(text, title);
      return {
        index,
        source: {
          title,
          url: r.url,
          source: sourceOf(r.url),
          authors: extractAuthors(r.url, text),
          snippet,
          score: r.score,
          isPdfDirect: r.url.toLowerCase().endsWith(".pdf")
        } as PdfSource,
        relevance: relevanceScore(query, `${title} ${snippet ?? ""}`)
      };
    });

  // Drop results that share no term with the query, unless nothing does (e.g. cross-language queries)
  const anyRelevant = cleaned.some(c => c.relevance > 0);
  return cleaned
    .filter(c => !anyRelevant || c.relevance > 0)
    .sort((a, b) => b.relevance - a.relevance || a.index - b.index)
    .slice(0, maxResults)
    .map(c => c.source);
}
