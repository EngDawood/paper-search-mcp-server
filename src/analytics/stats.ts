import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export const STATS_SECTIONS = ["totals", "daily", "tools", "queries", "sources", "slowest", "errors", "clients"] as const;
export type StatsSection = (typeof STATS_SECTIONS)[number];

export interface UsageStatsOptions {
  days?: number;
  tool?: string;
  source?: string;
  section?: StatsSection;
}

const SAMPLE_LIMIT = 20_000;

/** Nearest-rank percentile of an ascending-sorted array. */
function pct(sorted: number[], p: number): number | null {
  if (!sorted.length) return null;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))];
}

function latency(values: (number | null)[]) {
  const v = values.filter((x): x is number => typeof x === "number").sort((a, b) => a - b);
  return {
    avg_ms: v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null,
    p50_ms: pct(v, 50),
    p95_ms: pct(v, 95),
    max_ms: v.length ? v[v.length - 1] : null,
  };
}

type Row = Record<string, any>;

export async function getUsageStats(db: D1Database, opts: UsageStatsOptions = {}) {
  const days = Math.min(365, Math.max(1, Math.floor(opts.days ?? 7)));
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const want = (s: StatsSection) => !opts.section || opts.section === s;
  const all = async (sql: string, ...params: unknown[]): Promise<Row[]> => (await db.prepare(sql).bind(...params).all<Row>()).results ?? [];

  // Invocation filter (alias i). A source filter keeps only invocations that called that source.
  let iWhere = "i.created_at >= ?";
  const iParams: unknown[] = [since];
  if (opts.tool) {
    iWhere += " AND i.tool = ?";
    iParams.push(opts.tool);
  }
  if (opts.source) {
    iWhere += " AND i.id IN (SELECT invocation_id FROM source_calls WHERE COALESCE(source, host) = ?)";
    iParams.push(opts.source);
  }
  // Source-call filter (alias s).
  let sWhere = "s.created_at >= ?";
  const sParams: unknown[] = [since];
  if (opts.source) {
    sWhere += " AND COALESCE(s.source, s.host) = ?";
    sParams.push(opts.source);
  }
  if (opts.tool) {
    sWhere += " AND s.invocation_id IN (SELECT id FROM invocations WHERE tool = ?)";
    sParams.push(opts.tool);
  }

  const out: Record<string, unknown> = { days, since, filters: { tool: opts.tool ?? null, source: opts.source ?? null } };

  if (want("totals")) {
    const [t] = await all(
      `SELECT COUNT(*) AS calls, COALESCE(SUM(i.status = 'error'), 0) AS errors, COUNT(DISTINCT i.request_id) AS requests,
              ROUND(AVG(i.duration_ms)) AS avg_ms, COALESCE(SUM(i.result_count), 0) AS results,
              COALESCE(SUM(i.response_bytes), 0) AS response_bytes
       FROM invocations i WHERE ${iWhere}`,
      ...iParams,
    );
    const [q] = await all(
      `SELECT COUNT(*) AS searches, COUNT(DISTINCT q.query_normalized) AS unique_queries
       FROM queries q JOIN invocations i ON i.id = q.invocation_id WHERE ${iWhere}`,
      ...iParams,
    );
    const [s] = await all(`SELECT COUNT(*) AS upstream_calls, COALESCE(SUM(s.ok = 0), 0) AS upstream_errors, COALESCE(SUM(s.cache_hit), 0) AS cache_hits FROM source_calls s WHERE ${sWhere}`, ...sParams);
    out.totals = { ...t, ...q, ...s, error_rate: t.calls ? +(t.errors / t.calls).toFixed(4) : 0 };
  }

  if (want("daily")) {
    out.daily = await all(
      `SELECT substr(i.created_at, 1, 10) AS day, COUNT(*) AS calls, SUM(i.status = 'error') AS errors,
              ROUND(AVG(i.duration_ms)) AS avg_ms, SUM(COALESCE(i.result_count, 0)) AS results
       FROM invocations i WHERE ${iWhere} GROUP BY day ORDER BY day`,
      ...iParams,
    );
  }

  if (want("tools")) {
    out.top_tools = await all(
      `SELECT i.tool, COUNT(*) AS calls, SUM(i.status = 'error') AS errors, ROUND(AVG(i.duration_ms)) AS avg_ms,
              ROUND(AVG(i.result_count), 1) AS avg_results, SUM(i.result_count = 0) AS zero_result
       FROM invocations i WHERE ${iWhere} GROUP BY i.tool ORDER BY calls DESC LIMIT 20`,
      ...iParams,
    );
  }

  if (want("queries")) {
    out.top_queries = await all(
      `SELECT q.query_normalized AS query, q.language, COUNT(*) AS searches, ROUND(AVG(q.result_count), 1) AS avg_results,
              MAX(q.created_at) AS last_seen
       FROM queries q JOIN invocations i ON i.id = q.invocation_id WHERE ${iWhere}
       GROUP BY q.query_normalized, q.language ORDER BY searches DESC, last_seen DESC LIMIT 20`,
      ...iParams,
    );
    out.query_languages = await all(
      `SELECT q.language, COUNT(*) AS searches FROM queries q JOIN invocations i ON i.id = q.invocation_id
       WHERE ${iWhere} GROUP BY q.language ORDER BY searches DESC`,
      ...iParams,
    );
  }

  if (want("sources")) {
    const rows = await all(
      `SELECT COALESCE(s.source, s.host) AS source, s.host, s.ok, s.cache_hit, s.attempts, s.duration_ms
       FROM source_calls s WHERE ${sWhere} ORDER BY s.created_at DESC LIMIT ${SAMPLE_LIMIT}`,
      ...sParams,
    );
    const groups = new Map<string, Row[]>();
    for (const r of rows) {
      const g = groups.get(r.source);
      if (g) g.push(r);
      else groups.set(r.source, [r]);
    }
    out.sources = [...groups.entries()]
      .map(([source, g]) => {
        const errors = g.filter((r) => !r.ok).length;
        return {
          source,
          host: g[0].host,
          calls: g.length,
          errors,
          error_rate: +(errors / g.length).toFixed(4),
          cache_hits: g.filter((r) => r.cache_hit).length,
          retries: g.reduce((n, r) => n + Math.max(0, (r.attempts ?? 1) - 1), 0),
          // Latency over real network calls only; cache hits would flatter it.
          ...latency(g.filter((r) => !r.cache_hit).map((r) => r.duration_ms)),
        };
      })
      .sort((a, b) => b.calls - a.calls);
  }

  if (want("slowest")) {
    const rows = await all(
      `SELECT i.tool, i.duration_ms FROM invocations i WHERE ${iWhere} AND i.status = 'ok' ORDER BY i.created_at DESC LIMIT ${SAMPLE_LIMIT}`,
      ...iParams,
    );
    const g = new Map<string, number[]>();
    for (const r of rows) (g.get(r.tool) ?? g.set(r.tool, []).get(r.tool)!).push(r.duration_ms);
    out.slowest_tools = [...g.entries()]
      .map(([tool, v]) => ({ tool, calls: v.length, ...latency(v) }))
      .sort((a, b) => (b.p95_ms ?? 0) - (a.p95_ms ?? 0))
      .slice(0, 10);
  }

  if (want("errors")) {
    out.recent_errors = await all(
      `SELECT i.created_at, i.tool, i.error_message, i.duration_ms, i.args_json
       FROM invocations i WHERE ${iWhere} AND i.status = 'error' ORDER BY i.created_at DESC LIMIT 20`,
      ...iParams,
    );
    out.recent_source_errors = await all(
      `SELECT s.created_at, COALESCE(s.source, s.host) AS source, s.http_status, s.attempts, s.duration_ms, s.error
       FROM source_calls s WHERE ${sWhere} AND s.ok = 0 ORDER BY s.created_at DESC LIMIT 20`,
      ...sParams,
    );
  }

  if (want("clients")) {
    // Handshakes carry clientInfo; tool calls only carry the user agent in stateless mode.
    out.clients = {
      initialize: await all(
        `SELECT client_name, client_version, COUNT(*) AS handshakes, MAX(created_at) AS last_seen
         FROM clients WHERE created_at >= ? GROUP BY client_name, client_version ORDER BY handshakes DESC LIMIT 20`,
        since,
      ),
      user_agents: await all(`SELECT i.user_agent, COUNT(*) AS calls FROM invocations i WHERE ${iWhere} GROUP BY i.user_agent ORDER BY calls DESC LIMIT 10`, ...iParams),
      countries: await all(`SELECT i.country, COUNT(*) AS calls FROM invocations i WHERE ${iWhere} GROUP BY i.country ORDER BY calls DESC LIMIT 10`, ...iParams),
    };
  }

  return out;
}

export function registerUsageStatsTool(server: McpServer, db: D1Database): void {
  server.registerTool(
    "usage_stats",
    {
      title: "Usage statistics",
      description:
        "Server usage analytics from the D1 log: totals, per-day series, top tools, top queries (normalized, with language), " +
        "per-source error rate and p50/p95 latency, slowest tools, recent errors and client breakdown.",
      inputSchema: {
        days: z.number().int().min(1).max(365).default(7).describe("Look-back window in days (1-365)."),
        tool: z.string().optional().describe("Only count calls to this tool."),
        source: z.string().optional().describe("Only count calls that used this upstream source (e.g. openalex)."),
        section: z.enum(STATS_SECTIONS).optional().describe("Return only one section; omit for everything."),
      },
      annotations: { readOnlyHint: true, openWorldHint: false, idempotentHint: true },
    },
    async ({ days, tool, source, section }) => {
      try {
        const stats = await getUsageStats(db, { days, tool, source, section });
        return { content: [{ type: "text" as const, text: JSON.stringify(stats, null, 2) }] };
      } catch (err) {
        return { isError: true, content: [{ type: "text" as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }] };
      }
    },
  );
}
