import { SOURCE_MAP } from "../sources";
import type { Env, Paper } from "../types";
import { normalizeDoi } from "./text";

export interface SourceOutcome {
  source: string;
  count: number;
  error?: string;
  ms: number;
}

function key(p: Paper): string {
  const doi = normalizeDoi(p.doi);
  if (doi) return `doi:${doi}`;
  const arxivId = (p.source === "arxiv" ? p.paper_id : (p.extra?.arxiv_id as string)) ?? "";
  if (arxivId) return `arxiv:${arxivId.replace(/v\d+$/, "")}`;
  return `t:${p.title.toLowerCase().replace(/[^a-z0-9]+/g, "")}`;
}

/** Keep the first occurrence but fill missing fields from duplicates. */
export function dedupe(papers: Paper[]): Paper[] {
  const map = new Map<string, Paper>();
  for (const p of papers) {
    const k = key(p);
    const cur = map.get(k);
    if (!cur) {
      map.set(k, { ...p, extra: { ...p.extra, found_in: [p.source] } });
      continue;
    }
    (cur.extra!.found_in as string[]).push(p.source);
    for (const f of ["abstract", "doi", "pdf_url", "published_date", "venue"] as const) if (!cur[f] && p[f]) (cur as any)[f] = p[f];
    if (cur.citations === undefined && p.citations !== undefined) cur.citations = p.citations;
  }
  return [...map.values()];
}

export async function searchMany(
  query: string,
  sources: string[],
  maxPerSource: number,
  env: Env,
  year?: string,
  timeoutMs = 25_000,
): Promise<{ papers: Paper[]; outcomes: SourceOutcome[] }> {
  const outcomes: SourceOutcome[] = [];
  const results = await Promise.all(
    sources.map(async (id) => {
      const src = SOURCE_MAP.get(id)!;
      const t0 = Date.now();
      try {
        const papers = await Promise.race([
          src.search(query, { maxResults: maxPerSource, year }, env),
          new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`timed out after ${timeoutMs}ms`)), timeoutMs)),
        ]);
        outcomes.push({ source: id, count: papers.length, ms: Date.now() - t0 });
        return papers;
      } catch (err) {
        outcomes.push({ source: id, count: 0, error: err instanceof Error ? err.message : String(err), ms: Date.now() - t0 });
        return [];
      }
    }),
  );
  return { papers: dedupe(results.flat()), outcomes };
}
