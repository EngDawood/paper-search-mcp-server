import type { Env } from "../types";

export interface CallInfo {
  tool: string;
  tier: "full" | "anonymous";
  country: string;
  args: Record<string, unknown>;
  ok: boolean;
  error: string;
  results: number;
  ms: number;
}

const MAX_TEXT = 1000;

/** Best-effort result count from a tool's JSON text: array length, `papers.length`, or `total`. */
export function countResults(text: string): number {
  try {
    const data = JSON.parse(text);
    if (Array.isArray(data)) return data.length;
    if (Array.isArray(data?.papers)) return data.papers.length;
    if (typeof data?.total === "number") return data.total;
  } catch {
    // not JSON
  }
  return 0;
}

/**
 * One Analytics Engine row per tool call. Never stores IPs or tokens.
 * blobs: tool, tier, status, country, query, args JSON, error. doubles: ms, results. index: tool.
 */
export function logCall(env: Env, c: CallInfo): void {
  if (!env.USAGE) return;
  const query = String(c.args.query ?? c.args.title ?? c.args.doi ?? c.args.paper_id ?? c.args.pdf_url ?? "");
  try {
    env.USAGE.writeDataPoint({
      indexes: [c.tool],
      blobs: [
        c.tool,
        c.tier,
        c.ok ? "ok" : "error",
        c.country,
        query.slice(0, MAX_TEXT),
        JSON.stringify(c.args).slice(0, MAX_TEXT),
        c.error.slice(0, MAX_TEXT),
      ],
      doubles: [c.ms, c.results],
    });
  } catch (err) {
    console.error("usage log failed", err);
  }
}
