import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { fetchSinks, type FetchReport } from "./context";
import { detectLanguage, normalizeQuery, redactPath, sourceForHost } from "./text";

const MAX_ARGS = 2000;
const MAX_ERROR = 500;
const MAX_QUERY = 500;
const MAX_SOURCE_CALLS = 100;
const TOP_RESULTS = 10;
/** Tools that are not worth recording (the stats tool itself). */
const IGNORED_TOOLS = new Set(["usage_stats"]);

export interface RecorderInit {
  db?: D1Database | null;
  waitUntil?: (p: Promise<unknown>) => void;
  request?: Request;
}

export interface Recorder {
  readonly enabled: boolean;
  readonly requestId: string;
  /** Log `initialize` messages found in a parsed JSON-RPC body (object or batch). */
  noteBody(body: unknown): void;
  /** Clone the request, parse its JSON body and call noteBody. Never throws. */
  observe(req: Request): Promise<void>;
  /** Run a tool handler, recording the call. Result and errors pass through untouched. */
  track<T>(tool: string, args: unknown, fn: () => Promise<T> | T): Promise<T>;
}

const nul = <T>(v: T | undefined): T | null => (v === undefined ? null : v);
const cut = (s: string | undefined | null, n: number): string | null => (s == null ? null : s.length > n ? s.slice(0, n) : s);

function safeJson(v: unknown, max: number): string | null {
  try {
    const s = JSON.stringify(v);
    return s === undefined ? null : s.length > max ? s.slice(0, max) : s;
  } catch {
    return null;
  }
}

interface Extracted {
  text: string;
  bytes: number;
  isError: boolean;
}

function extract(result: unknown): Extracted {
  const r = result as { content?: { type?: string; text?: unknown }[]; isError?: boolean } | null;
  let text = "";
  let bytes = 0;
  for (const c of r?.content ?? []) {
    if (c && typeof c.text === "string") {
      bytes += new TextEncoder().encode(c.text).length;
      if (!text) text = c.text;
    }
  }
  return { text, bytes, isError: r?.isError === true };
}

function parseResultJson(text: string): unknown {
  if (!text || (text[0] !== "{" && text[0] !== "[")) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function resultItems(data: unknown): unknown[] | undefined {
  if (Array.isArray(data)) return data;
  const o = data as { papers?: unknown; results?: unknown } | null;
  if (o && typeof o === "object") {
    if (Array.isArray(o.papers)) return o.papers;
    if (Array.isArray(o.results)) return o.results;
  }
  return undefined;
}

export function resultCount(data: unknown): number | null {
  const items = resultItems(data);
  if (items) return items.length;
  const total = (data as { total?: unknown } | null)?.total;
  return typeof total === "number" && Number.isFinite(total) ? total : null;
}

export interface TopResult {
  source: string | null;
  paper_id: string | null;
  doi: string | null;
  title: string;
  year: number | null;
}

export function topResults(data: unknown, n = TOP_RESULTS): TopResult[] {
  const out: TopResult[] = [];
  for (const it of resultItems(data) ?? []) {
    const p = it as Record<string, unknown> | null;
    if (!p || typeof p !== "object" || typeof p.title !== "string" || !p.title) continue;
    const date = typeof p.published_date === "string" ? p.published_date : typeof p.year === "string" ? p.year : "";
    const y = typeof p.year === "number" ? p.year : /^\d{4}/.test(date) ? Number(date.slice(0, 4)) : null;
    out.push({
      source: typeof p.source === "string" ? p.source : null,
      paper_id: p.paper_id != null ? String(p.paper_id).slice(0, 200) : null,
      doi: typeof p.doi === "string" && p.doi ? p.doi.slice(0, 200) : null,
      title: p.title.slice(0, 300),
      year: y,
    });
    if (out.length >= n) break;
  }
  return out;
}

class RecorderImpl implements Recorder {
  readonly requestId = crypto.randomUUID();
  readonly enabled: boolean;
  private readonly db: D1Database | null;
  private readonly ua: string | null;
  private readonly proto: string | null;
  private readonly country: string | null;
  private readonly colo: string | null;
  private readonly asn: number | null;
  private readonly waitUntil?: (p: Promise<unknown>) => void;

  constructor(init: RecorderInit) {
    this.db = init.db ?? null;
    this.enabled = !!this.db;
    this.waitUntil = init.waitUntil;
    const req = init.request;
    const cf = (req as unknown as { cf?: { country?: string; colo?: string; asn?: number } } | undefined)?.cf;
    this.ua = cut(req?.headers.get("user-agent"), 300);
    this.proto = cut(req?.headers.get("mcp-protocol-version"), 40);
    this.country = cf?.country ?? null;
    this.colo = cf?.colo ?? null;
    this.asn = typeof cf?.asn === "number" ? cf.asn : null;
  }

  noteBody(body: unknown): void {
    if (!this.enabled) return;
    try {
      const msgs = Array.isArray(body) ? body : [body];
      const stmts: D1PreparedStatement[] = [];
      for (const m of msgs) {
        const msg = m as { method?: unknown; params?: { clientInfo?: { name?: unknown; version?: unknown }; protocolVersion?: unknown; capabilities?: unknown } } | null;
        if (!msg || msg.method !== "initialize") continue;
        const ci = msg.params?.clientInfo;
        stmts.push(
          this.db!
            .prepare(
              "INSERT INTO clients (id, created_at, request_id, client_name, client_version, protocol_version, capabilities_json, user_agent, country, colo, asn) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            )
            .bind(
              crypto.randomUUID(),
              new Date().toISOString(),
              this.requestId,
              cut(typeof ci?.name === "string" ? ci.name : null, 100),
              cut(typeof ci?.version === "string" ? ci.version : null, 50),
              cut(typeof msg.params?.protocolVersion === "string" ? msg.params.protocolVersion : null, 40),
              safeJson(msg.params?.capabilities, 1000),
              this.ua,
              this.country,
              this.colo,
              this.asn,
            ),
        );
      }
      this.flush(stmts);
    } catch {
      /* ignore */
    }
  }

  async observe(req: Request): Promise<void> {
    if (!this.enabled) return;
    try {
      this.noteBody(await req.clone().json());
    } catch {
      /* not JSON, or unreadable: nothing to log */
    }
  }

  async track<T>(tool: string, args: unknown, fn: () => Promise<T> | T): Promise<T> {
    if (!this.enabled || IGNORED_TOOLS.has(tool)) return fn();
    const calls: { report: FetchReport; at: string }[] = [];
    const sink = { onFetch: (report: FetchReport) => void (calls.length < MAX_SOURCE_CALLS && calls.push({ report, at: new Date().toISOString() })) };
    const startedAt = new Date().toISOString();
    const t0 = Date.now();
    let result: unknown;
    let thrown: unknown;
    let failed = false;
    try {
      const value = await fetchSinks.run(sink, fn);
      result = value;
      return value;
    } catch (err) {
      failed = true;
      thrown = err;
      throw err;
    } finally {
      try {
        this.finish(tool, args, startedAt, Date.now() - t0, failed ? { thrown } : { result }, calls);
      } catch {
        /* analytics must never affect a handler */
      }
    }
  }

  private finish(
    tool: string,
    args: unknown,
    createdAt: string,
    ms: number,
    outcome: { thrown: unknown } | { result: unknown },
    calls: { report: FetchReport; at: string }[],
  ): void {
    const db = this.db!;
    const id = crypto.randomUUID();
    let status: "ok" | "error" = "ok";
    let errorMessage: string | null = null;
    let count: number | null = null;
    let bytes: number | null = null;
    let top: TopResult[] = [];

    if ("thrown" in outcome) {
      status = "error";
      const e = outcome.thrown;
      errorMessage = cut(e instanceof Error ? e.message : String(e), MAX_ERROR);
    } else {
      const ex = extract(outcome.result);
      bytes = ex.bytes;
      if (ex.isError) {
        status = "error";
        errorMessage = cut(ex.text, MAX_ERROR);
      } else {
        const data = parseResultJson(ex.text);
        count = resultCount(data);
        top = topResults(data);
      }
    }

    const argObj = args && typeof args === "object" ? (args as Record<string, unknown>) : {};
    const stmts: D1PreparedStatement[] = [
      db
        .prepare(
          "INSERT INTO invocations (id, created_at, request_id, tool, args_json, status, error_message, duration_ms, result_count, response_bytes, user_agent, mcp_protocol_version, client_name, client_version, country, colo, asn) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        )
        .bind(id, createdAt, this.requestId, tool, safeJson(argObj, MAX_ARGS), status, errorMessage, ms, nul(count), nul(bytes), this.ua, this.proto, null, null, this.country, this.colo, this.asn),
    ];

    for (const { report: r, at } of calls) {
      const { host, path } = redactPath(r.url);
      stmts.push(
        db
          .prepare(
            "INSERT INTO source_calls (invocation_id, created_at, source, host, method, path, http_status, ok, duration_ms, attempts, cache_hit, response_bytes, error) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
          )
          .bind(id, at, sourceForHost(host, path), host, r.method, path, nul(r.status), r.ok ? 1 : 0, Math.round(r.ms), r.attempts, r.cacheHit ? 1 : 0, nul(r.bytes), cut(r.error, MAX_ERROR)),
      );
    }

    const q = argObj.query;
    if (typeof q === "string" && q.trim()) {
      const { query: _q, sources, ...filters } = argObj;
      // Multi-source tools name their sources in args; single-source search_<id> tools are their own source.
      const multi = ["search_papers", "search_all", "search_arabic_papers"];
      const named = [sources, argObj.arabic_platforms, argObj.platforms].flatMap((v) => (Array.isArray(v) ? v : []));
      const srcs = named.length ? named : tool.startsWith("search_") && !multi.includes(tool) ? [tool.slice(7)] : null;
      stmts.push(
        db
          .prepare(
            "INSERT INTO queries (invocation_id, created_at, tool, query_text, query_normalized, language, sources_requested, filters_json, result_count) VALUES (?,?,?,?,?,?,?,?,?)",
          )
          .bind(id, createdAt, tool, q.slice(0, MAX_QUERY), normalizeQuery(q).slice(0, MAX_QUERY), detectLanguage(q), srcs ? safeJson(srcs, 500) : null, Object.keys(filters).length ? safeJson(filters, 1000) : null, nul(count)),
      );
      top.forEach((p, i) =>
        stmts.push(
          db
            .prepare("INSERT INTO query_results (invocation_id, rank, source, paper_id, doi, title, year) VALUES (?,?,?,?,?,?,?)")
            .bind(id, i + 1, p.source, p.paper_id, p.doi, p.title, p.year),
        ),
      );
    }
    this.flush(stmts);
  }

  private flush(stmts: D1PreparedStatement[]): void {
    if (!stmts.length) return;
    let p: Promise<unknown>;
    try {
      p = Promise.resolve(this.db!.batch(stmts)).catch((e) => console.error("analytics write failed", e instanceof Error ? e.message : e));
    } catch (e) {
      console.error("analytics write failed", e instanceof Error ? e.message : e);
      return;
    }
    if (this.waitUntil) this.waitUntil(p);
  }
}

export function createRecorder(init: RecorderInit = {}): Recorder {
  return new RecorderImpl(init);
}

/**
 * Wrap `server.registerTool` so every handler registered afterwards (by any module) is recorded.
 * Call it right after `new McpServer(...)`. No-op when the recorder is disabled.
 */
export function instrumentServer(server: McpServer, rec: Recorder): void {
  if (!rec.enabled) return;
  const orig = server.registerTool.bind(server) as (...a: unknown[]) => unknown;
  (server as unknown as { registerTool: (...a: unknown[]) => unknown }).registerTool = (name: unknown, config: unknown, cb: unknown) => {
    if (typeof cb !== "function") return orig(name, config, cb);
    const hasArgs = !!(config as { inputSchema?: unknown } | undefined)?.inputSchema;
    const wrapped = (...a: unknown[]) => rec.track(String(name), hasArgs ? a[0] : {}, () => (cb as (...x: unknown[]) => unknown)(...a));
    return orig(name, config, wrapped);
  };
}
