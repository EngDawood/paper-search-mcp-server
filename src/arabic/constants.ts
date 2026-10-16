/**
 * Scholar Search API Constants (Mandumah database)
 */

export const SCHOLAR_BASE_URL = "https://search.mandumah.com";
export const SCHOLAR_SEARCH_URL = `${SCHOLAR_BASE_URL}/Search/Results`;
export const SCHOLAR_RECORD_URL = `${SCHOLAR_BASE_URL}/Record`;
export const SCHOLAR_CITE_URL = `${SCHOLAR_BASE_URL}/Record`; // /Record/{id}/Cite

export const CHARACTER_LIMIT = 50000;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/**
 * Search field types available in Mandumah
 */
export const SEARCH_FIELDS = {
  AllFields: "AllFields",
  Title: "Title",
  JournalTitle: "JournalTitle",
  Author: "Author",
  Subject: "Subject"
} as const;

export type SearchField = keyof typeof SEARCH_FIELDS;

/**
 * Languages available in Mandumah database
 */
export const LANGUAGES = {
  Arabic: "Arabic",
  English: "English",
  French: "French",
  German: "German",
  Turkish: "Turkish",
  Urdu: "Urdu",
  Persian: "Persian",
  Bengali: "Bengali",
  Chinese: "Chinese",
  Hebrew: "Hebrew",
  Italian: "Italian",
  Japanese: "Japanese",
  Kurdish: "Kurdish",
  Portuguese: "Portuguese",
  Russian: "Russian",
  Spanish: "Spanish",
  Unknown: "Unknown"
} as const;

export type Language = keyof typeof LANGUAGES;

/**
 * Content types (formats) in Mandumah - Arabic names as used in the API
 */
export const CONTENT_TYPES = {
  "بحوث ومقالات": "Articles",
  "رسائل جامعية": "Dissertations",
  "بحوث المؤتمرات": "Conference Papers",
  "عروض كتب": "Book Reviews",
  "افتتاحيات": "Editorials",
  "ببليوجرافية": "Bibliographies",
  "تشريعات": "Legislation",
  "عروض ابحاث": "Research Reviews",
  "عروض رسائل": "Thesis Reviews",
  "فتاوى": "Fatwas",
  "نصوص أدبية": "Literary Texts",
  "اخرى": "Other"
} as const;

export type ContentTypeArabic = keyof typeof CONTENT_TYPES;

/**
 * English to Arabic content type mapping for user convenience
 */
export const CONTENT_TYPES_ENGLISH_TO_ARABIC: Record<string, ContentTypeArabic> = {
  "articles": "بحوث ومقالات",
  "dissertations": "رسائل جامعية",
  "conference_papers": "بحوث المؤتمرات",
  "book_reviews": "عروض كتب",
  "editorials": "افتتاحيات",
  "bibliographies": "ببليوجرافية",
  "legislation": "تشريعات",
  "research_reviews": "عروض ابحاث",
  "thesis_reviews": "عروض رسائل",
  "fatwas": "فتاوى",
  "literary_texts": "نصوص أدبية",
  "other": "اخرى"
};

export type ContentTypeEnglish = keyof typeof CONTENT_TYPES_ENGLISH_TO_ARABIC;

/**
 * Sort options available in Mandumah
 */
export const SORT_OPTIONS = {
  relevance: "relevance",
  year_desc: "year", // Mandumah's "year" is newest first
  year_asc: "year asc",
  title: "title",
  author: "author"
} as const;

export type SortOption = keyof typeof SORT_OPTIONS;

/**
 * Arabic field names used in Mandumah record parsing
 * Centralized to enable easy maintenance and localization
 */
export const ARABIC_FIELDS = {
  // Title fields
  TITLE: "العنوان",
  ALTERNATE_TITLE: "العنوان بلغة أخرى",

  // Author fields
  MAIN_AUTHOR: "المؤلف الرئيسي",
  MAIN_AUTHOR_ENGLISH: "المؤلف الرئيسي \\(الإنجليزية\\)",
  OTHER_AUTHORS: "مؤلفين آخرين",

  // Publication metadata
  SOURCE: "المصدر",
  JOURNAL: "المجلة",
  PUBLISHER: "الناشر",
  GREGORIAN_DATE: "التاريخ الميلادي",
  HIJRI_DATE: "التاريخ الهجري",
  VOLUME: "المجلد",
  ISSUE: "العدد",
  PAGES: "الصفحات",

  // Content metadata
  CONTENT_TYPE: "نوع المحتوى",
  LANGUAGE: "اللغة",
  DATABASE: "قواعد المعلومات",
  PEER_REVIEWED: "محكمة",
  COUNTRY: "الدولة",

  // Subject fields
  SUBJECTS: "مواضيع",
  ABSTRACT: "المستخلص",

  // Identifiers
  ISSN: "ISSN",
  ISSN_ARABIC: "رقم ISSN",

  // Dissertation-specific
  DEGREE_TYPE: "الدرجة العلمية",
  UNIVERSITY: "الجامعة",
  COLLEGE: "الكلية",
  LOCATION: "موقع",

  // Statistics
  DOWNLOADS_COUNT: "عدد مرات التحميل",

  // Related items
  SIMILAR_ITEMS: "عناصر مشابهة",
  BY_AUTHOR: "بواسطة",
  PUBLISHED: "منشور",

  // Role markers (to be stripped from author names)
  ROLE_AUTHOR: "مؤلف",
  ROLE_SUPERVISOR: "مشرف",
  ROLE_CO_AUTHOR: "مؤلف مشارك",

  // Peer review values
  YES_ARABIC: "نعم",
  YES_ENGLISH: "yes"
} as const;

export type ArabicFieldKey = keyof typeof ARABIC_FIELDS;

/**
 * Open-access repositories searched through Exa (includeDomains).
 *
 * `core: true` sources are searched when platforms=["all"]. The others are opt-in by key,
 * so the default query does not spend 3x the Exa quota. To add a site, see "Adding a source"
 * in CLAUDE.md (registry entry here, a paper-page rule in exa-result-cleaner.ts, a test).
 */
export const OPEN_ACCESS_REPOSITORIES = {
  // Core: searched by default
  asjp: { name: "ASJP", domain: "asjp.cerist.dz", core: true },
  shamaa: { name: "SHAMAA", domain: "search.shamaa.org", core: true },
  researchgate: { name: "ResearchGate", domain: "researchgate.net", core: true },
  academia: { name: "Academia.edu", domain: "academia.edu", core: true },
  google_scholar: { name: "Google Scholar", domain: "scholar.google.com", core: true },
  // Opt-in: tested with live Exa queries (Arabic and English), individual papers, on-topic
  ekb: { name: "EKB Journals", domain: "journals.ekb.eg", core: false, location: "EG" }, // covers *.journals.ekb.eg; Egyptian site, so search as an Egyptian user
  ajsrp: { name: "AJSRP", domain: "journals.ajsrp.com", core: false },
  doaj: { name: "DOAJ", domain: "doaj.org", core: false },
  emarefa: { name: "eMarefa", domain: "search.emarefa.net", core: false },
  najsp: { name: "NAJSP", domain: "najsp.com", core: false },
  theses_dz: { name: "Algerian Theses", domain: "theses-algerie.com", core: false },
  pal_ea: { name: "PAL-EA", domain: "pal-ea.com", core: false },
  kauj: { name: "KAU Journals", domain: "kauj.researchcommons.org", core: false },
  democraticac: { name: "Democratic Arab Center", domain: "democraticac.de", core: false },
  acm: { name: "ACM Digital Library", domain: "dl.acm.org", core: false },
  sciencedirect: { name: "ScienceDirect", domain: "sciencedirect.com", core: false }
} as const;

export type OpenAccessRepositoryKey = keyof typeof OPEN_ACCESS_REPOSITORIES;

/** Keys of every Exa-backed repository, typed as a non-empty tuple for z.enum */
export const OPEN_ACCESS_KEYS = Object.keys(OPEN_ACCESS_REPOSITORIES) as [OpenAccessRepositoryKey, ...OpenAccessRepositoryKey[]];

/**
 * Exa userLocation (ISO country code) for a source: the source's own `location` if it has one,
 * otherwise undefined, which means no location is sent to Exa.
 */
export function locationForSource(key: OpenAccessRepositoryKey): string | undefined {
  const repo = OPEN_ACCESS_REPOSITORIES[key];
  return "location" in repo ? repo.location : undefined;
}

/** Repositories searched when platforms=["all"] */
export const CORE_OPEN_ACCESS_KEYS = OPEN_ACCESS_KEYS.filter(k => OPEN_ACCESS_REPOSITORIES[k].core);

/** Repositories that must be named explicitly */
export const OPT_IN_OPEN_ACCESS_KEYS = OPEN_ACCESS_KEYS.filter(k => !OPEN_ACCESS_REPOSITORIES[k].core);

/**
 * Unified search platforms - extends open-access repositories with Mandumah sources
 */
export const UNIFIED_SEARCH_PLATFORMS = {
  mandumah: { name: "Mandumah", engine: "firecrawl", domain: "search.mandumah.com" },
  mandumah_exa: { name: "Mandumah", engine: "exa", domain: "search.mandumah.com" },
  ...Object.fromEntries(
    Object.entries(OPEN_ACCESS_REPOSITORIES).map(([key, val]) => [
      key,
      { name: val.name, engine: "exa", domain: val.domain }
    ])
  )
} as const;

export type UnifiedSearchPlatformKey = keyof typeof UNIFIED_SEARCH_PLATFORMS;

/**
 * Default configuration for retry logic with exponential backoff
 */
export const DEFAULT_RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2
} as const;

/**
 * Exa API default configuration for Arabic academic search optimization
 */
export const EXA_DEFAULTS = {
  /** Search type: "auto" lets Exa choose between neural/keyword */
  type: "auto" as const,
  /** Page text requested from Exa. Must be large enough to get past site chrome
   *  (ASJP modals, ResearchGate breadcrumbs) to the abstract and author block. */
  textMaxCharacters: 1500,
  /** Fetch this many times maxResults, since non-paper pages are filtered out afterwards */
  overfetchFactor: 2,
} as const;

export type ExaSearchType = "keyword" | "neural" | "auto";
