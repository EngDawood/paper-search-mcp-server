const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** Strip HTML/JATS tags, decode entities, collapse whitespace. */
export function stripTags(s: unknown): string {
  if (typeof s !== "string") return "";
  return decodeEntities(s.replace(/<jats:title>[^<]*<\/jats:title>/gi, " ").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

export function clean(s: unknown): string {
  return typeof s === "string" ? s.replace(/\s+/g, " ").trim() : "";
}

const DOI_RE = /\b(10\.\d{4,9}\/[^\s"'<>]+)/i;

export function extractDoi(s: string | undefined | null): string {
  if (!s) return "";
  const m = DOI_RE.exec(s);
  return m ? m[1].replace(/[.,;)\]]+$/, "") : "";
}

export function normalizeDoi(s: string): string {
  return extractDoi(s).toLowerCase();
}

export function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

/** Parse a year filter: "2020", "2020-2023", "2020-", "-2023". */
export function parseYear(year?: string): { from?: number; to?: number } {
  if (!year) return {};
  const m = /^\s*(\d{4})?\s*(-)?\s*(\d{4})?\s*$/.exec(year);
  if (!m) return {};
  const from = m[1] ? +m[1] : undefined;
  const to = m[3] ? +m[3] : m[2] ? undefined : from;
  return { from, to };
}
