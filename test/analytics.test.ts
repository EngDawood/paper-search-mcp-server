import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createRecorder, detectLanguage, getUsageStats, instrumentServer, normalizeQuery, redactPath, registerUsageStatsTool, sourceForHost } from "../src/analytics";
import { getJson } from "../src/lib/http";
import migration1 from "../migrations/0001_create_tool_calls.sql?raw";
import migration2 from "../migrations/0002_analytics.sql?raw";

/** Real SQLite (node:sqlite) behind the D1 surface the analytics code uses. */
function fakeD1(opts: { failBatch?: boolean } = {}) {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(migration1);
  sqlite.exec(migration2);
  class Stmt {
    constructor(
      readonly sql: string,
      readonly params: unknown[] = [],
    ) {}
    bind(...p: unknown[]) {
      return new Stmt(this.sql, p);
    }
    async run() {
      sqlite.prepare(this.sql).run(...this.params);
      return { success: true };
    }
    async all() {
      return { results: sqlite.prepare(this.sql).all(...this.params).map((r) => ({ ...r })) };
    }
  }
  const db = {
    prepare: (sql: string) => new Stmt(sql),
    async batch(stmts: Stmt[]) {
      if (opts.failBatch) throw new Error("D1 down");
      sqlite.exec("BEGIN");
      try {
        for (const s of stmts) await s.run();
        sqlite.exec("COMMIT");
      } catch (e) {
        sqlite.exec("ROLLBACK");
        throw e;
      }
      return [];
    },
  };
  const rows = (sql: string, ...p: unknown[]) => sqlite.prepare(sql).all(...p).map((r) => ({ ...r })) as Record<string, any>[];
  return { db: db as unknown as D1Database, rows, sqlite };
}

function setup(opts: { failBatch?: boolean; request?: Request } = {}) {
  const d = fakeD1(opts);
  const pending: Promise<unknown>[] = [];
  const rec = createRecorder({ db: d.db, waitUntil: (p) => void pending.push(p), request: opts.request });
  return { ...d, rec, settle: () => Promise.all(pending) };
}

async function connect(server: McpServer) {
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "t", version: "1" });
  await Promise.all([server.connect(a), client.connect(b)]);
  return client;
}

const papers = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ paper_id: `p${i}`, title: `Paper ${i}`, doi: `10.1/${i}`, source: i % 2 ? "arxiv" : "crossref", published_date: `${2020 + (i % 3)}-05-01` }));

function demoServer(rec?: ReturnType<typeof createRecorder>) {
  const server = new McpServer({ name: "demo", version: "1" });
  if (rec) instrumentServer(server, rec);
  server.registerTool("search_demo", { description: "d", inputSchema: { query: z.string(), sources: z.array(z.string()).optional(), year: z.string().optional() } }, async ({ query }) => ({
    content: [{ type: "text" as const, text: JSON.stringify({ query, total: 12, papers: papers(12) }) }],
  }));
  server.registerTool("boom", { description: "d", inputSchema: {} }, async () => {
    throw new Error("kaboom");
  });
  server.registerTool("soft_fail", { description: "d" }, async () => ({ isError: true, content: [{ type: "text" as const, text: "Error: upstream 503" }] }));
  server.registerTool("fetcher", { description: "d", inputSchema: { n: z.number() } }, async () => {
    const r = await getJson<{ ok: boolean }>("https://api.crossref.org/works?query=x&mailto=me@x.org&api_key=SECRET123");
    return { content: [{ type: "text" as const, text: JSON.stringify(r) }] };
  });
  return server;
}

afterEach(() => vi.unstubAllGlobals());

describe("text helpers", () => {
  it("normalizes Arabic", () => {
    expect(normalizeQuery("  الذَّكاءُ   الاصطناعيّ في التعليمـــ ")).toBe("الذكاء الاصطناعي في التعليم");
    expect(normalizeQuery("أبحاث إسلامية آمنة")).toBe(normalizeQuery("ابحاث اسلاميه امنه"));
    expect(normalizeQuery("مكتبة")).toBe("مكتبه");
    expect(normalizeQuery("على")).toBe("علي");
    expect(normalizeQuery("COVID-19 ٢٠٢٠")).toBe("covid-19 2020");
  });

  it("detects language", () => {
    expect(detectLanguage("الذكاء الاصطناعي")).toBe("ar");
    expect(detectLanguage("machine learning")).toBe("en");
    expect(detectLanguage("الذكاء الاصطناعي AI")).toBe("mixed");
    expect(detectLanguage("12345 !!")).toBe("other");
    expect(detectLanguage("机器学习")).toBe("other");
  });

  it("redacts key-like query values and maps hosts to sources", () => {
    const { host, path } = redactPath("https://api.x.org/v1/w?q=hello&api_key=S1&apikey=S2&key=S3&token=S4&mailto=a@b.c&email=a@b.c&keywords=ok");
    expect(host).toBe("api.x.org");
    expect(path).toBe("/v1/w?q=hello&api_key=***&apikey=***&key=***&token=***&mailto=***&email=***&keywords=ok");
    expect(path).not.toMatch(/S[1-4]|a@b/);
    expect(sourceForHost("api.openalex.org")).toBe("openalex");
    expect(sourceForHost("api.biorxiv.org", "/details/medrxiv/2020")).toBe("medrxiv");
    expect(sourceForHost("example.com")).toBeNull();
  });
});

describe("instrumentation", () => {
  it("never alters results or errors", async () => {
    const plain = await connect(demoServer());
    const t = setup();
    const inst = await connect(demoServer(t.rec));
    for (const [name, args] of [["search_demo", { query: "q" }], ["boom", {}], ["soft_fail", {}]] as const) {
      expect(await inst.callTool({ name, arguments: args })).toEqual(await plain.callTool({ name, arguments: args }));
    }
    await t.settle();
    const inv = t.rows("SELECT tool, status, error_message FROM invocations ORDER BY created_at, tool");
    expect(inv.map((r) => [r.tool, r.status])).toEqual(expect.arrayContaining([["search_demo", "ok"], ["boom", "error"], ["soft_fail", "error"]]));
    expect(inv.find((r) => r.tool === "boom")!.error_message).toContain("kaboom");
    expect(inv.find((r) => r.tool === "soft_fail")!.error_message).toContain("503");
  });

  it("records invocation, query and top 10 results", async () => {
    const req = new Request("https://x/mcp", { headers: { "user-agent": "TestClient/1.0", "mcp-protocol-version": "2025-06-18" } });
    const t = setup({ request: req });
    const c = await connect(demoServer(t.rec));
    await c.callTool({ name: "search_demo", arguments: { query: "الذَّكاءُ الاصطناعيّ", sources: ["a", "b"], year: "2020-" } });
    await t.settle();
    const [inv] = t.rows("SELECT * FROM invocations");
    expect(inv).toMatchObject({ tool: "search_demo", status: "ok", result_count: 12, user_agent: "TestClient/1.0", mcp_protocol_version: "2025-06-18" });
    expect(inv.request_id).toBe(t.rec.requestId);
    expect(inv.response_bytes).toBeGreaterThan(100);
    expect(JSON.parse(inv.args_json).year).toBe("2020-");
    const [q] = t.rows("SELECT * FROM queries");
    expect(q).toMatchObject({ invocation_id: inv.id, language: "ar", query_normalized: "الذكاء الاصطناعي", result_count: 12 });
    expect(JSON.parse(q.sources_requested)).toEqual(["a", "b"]);
    expect(JSON.parse(q.filters_json)).toEqual({ year: "2020-" });
    const res = t.rows("SELECT * FROM query_results ORDER BY rank");
    expect(res).toHaveLength(10);
    expect(res[0]).toMatchObject({ rank: 1, paper_id: "p0", doi: "10.1/0", title: "Paper 0", source: "crossref", year: 2020 });
    expect(res[9].rank).toBe(10);
  });

  it("captures source_calls through http.ts with key redaction", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-length": "11" } }));
    const t = setup();
    const c = await connect(demoServer(t.rec));
    const res = await c.callTool({ name: "fetcher", arguments: { n: 1 } });
    expect(JSON.parse((res.content as any)[0].text)).toEqual({ ok: true });
    await t.settle();
    const [sc] = t.rows("SELECT * FROM source_calls");
    expect(sc).toMatchObject({ host: "api.crossref.org", source: "crossref", method: "GET", http_status: 200, ok: 1, attempts: 1, cache_hit: 0, response_bytes: 11 });
    expect(sc.path).toBe("/works?query=x&mailto=***&api_key=***");
    expect(JSON.stringify(t.rows("SELECT * FROM source_calls"))).not.toMatch(/SECRET123|me@x/);
    expect(sc.invocation_id).toBe(t.rows("SELECT id FROM invocations")[0].id);
  });

  it("records retries, failures and cache hits", async () => {
    let n = 0;
    vi.stubGlobal("fetch", async () => (++n === 1 ? new Response("busy", { status: 503 }) : new Response("{}", { status: 200 })));
    vi.stubGlobal("caches", { default: { match: async (r: Request) => (r.url.includes("cached") ? new Response("{}", { status: 200 }) : undefined), put: async () => {} } });
    const t = setup();
    const server = new McpServer({ name: "d", version: "1" });
    instrumentServer(server, t.rec);
    server.registerTool("multi", { description: "d" }, async () => {
      await getJson("https://api.example.org/a", { retries: 1 });
      await getJson("https://api.example.org/cached");
      await getJson("https://api.example.org/bad", { retries: 0, cacheTtl: 0 }).catch(() => undefined);
      return { content: [{ type: "text" as const, text: "{}" }] };
    });
    n = 0;
    // The first call hits 503 once then succeeds; the third call gets a 200 too, so force a 404 via a new stub.
    await (await connect(server)).callTool({ name: "multi", arguments: {} });
    await t.settle();
    const rows = t.rows("SELECT path, attempts, cache_hit, ok FROM source_calls ORDER BY id");
    expect(rows[0]).toMatchObject({ path: "/a", attempts: 2, ok: 1 });
    expect(rows[1]).toMatchObject({ path: "/cached", attempts: 0, cache_hit: 1, ok: 1 });
    expect(rows).toHaveLength(3);
  });

  it("logs failed upstream calls", async () => {
    vi.stubGlobal("fetch", async () => new Response("nope", { status: 404 }));
    const t = setup();
    const server = new McpServer({ name: "d", version: "1" });
    instrumentServer(server, t.rec);
    server.registerTool("f", { description: "d" }, async () => {
      await getJson("https://api.example.org/missing", { cacheTtl: 0 });
      return { content: [] };
    });
    const res = await (await connect(server)).callTool({ name: "f", arguments: {} });
    expect(res.isError).toBe(true);
    await t.settle();
    expect(t.rows("SELECT http_status, ok, error FROM source_calls")[0]).toMatchObject({ http_status: 404, ok: 0 });
    expect(t.rows("SELECT status FROM invocations")[0].status).toBe("error");
  });

  it("tolerates a failing database", async () => {
    const t = setup({ failBatch: true });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await (await connect(demoServer(t.rec))).callTool({ name: "search_demo", arguments: { query: "x" } });
    await t.settle();
    expect(res.isError).toBeFalsy();
    spy.mockRestore();
  });

  it("is a no-op without a DB", async () => {
    const rec = createRecorder({ request: new Request("https://x") });
    expect(rec.enabled).toBe(false);
    const server = new McpServer({ name: "d", version: "1" });
    const before = server.registerTool;
    instrumentServer(server, rec);
    expect(server.registerTool).toBe(before);
    rec.noteBody({ method: "initialize" });
    await rec.observe(new Request("https://x", { method: "POST", body: "{}" }));
    expect(await rec.track("t", {}, async () => 5)).toBe(5);
    // http.ts with no active recorder
    vi.stubGlobal("fetch", async () => new Response("{}", { status: 200 }));
    await expect(getJson("https://api.example.org/x", { cacheTtl: 0 })).resolves.toEqual({});
    const res = await (await connect(demoServer(rec))).callTool({ name: "search_demo", arguments: { query: "x" } });
    expect(res.isError).toBeFalsy();
  });

  it("logs initialize requests (single and batched)", async () => {
    const t = setup({ request: new Request("https://x/mcp", { headers: { "user-agent": "UA" } }) });
    t.rec.noteBody([
      { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: { roots: {} }, clientInfo: { name: "claude-ai", version: "0.1" } } },
      { jsonrpc: "2.0", id: 2, method: "tools/list" },
    ]);
    await t.rec.observe(new Request("https://x/mcp", { method: "POST", body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { clientInfo: { name: "cursor", version: "2" } } }) }));
    await t.settle();
    const rows = t.rows("SELECT client_name, client_version, protocol_version, user_agent, request_id FROM clients ORDER BY client_name");
    expect(rows.map((r) => r.client_name)).toEqual(["claude-ai", "cursor"]);
    expect(rows[0]).toMatchObject({ client_version: "0.1", protocol_version: "2025-06-18", user_agent: "UA", request_id: t.rec.requestId });
  });
});

describe("usage stats", () => {
  function seed() {
    const t = fakeD1();
    const inv = (id: string, at: string, tool: string, status: string, ms: number, count: number | null, ua = "UA-A", err: string | null = null) =>
      t.sqlite.prepare("INSERT INTO invocations (id, created_at, request_id, tool, status, duration_ms, result_count, user_agent, country, error_message) VALUES (?,?,?,?,?,?,?,?,?,?)").run(id, at, "r" + id, tool, status, ms, count, ua, "SA", err);
    const day = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
    inv("1", day(0), "search_papers", "ok", 1000, 10);
    inv("2", day(0), "search_papers", "ok", 3000, 0);
    inv("3", day(1), "search_papers", "error", 500, null, "UA-B", "all sources failed");
    inv("4", day(1), "get_paper_details", "ok", 200, 1);
    inv("5", day(30), "search_papers", "ok", 100, 5); // outside a 7-day window
    const q = (id: string, norm: string, lang: string, count: number) =>
      t.sqlite.prepare("INSERT INTO queries (invocation_id, created_at, tool, query_text, query_normalized, language, result_count) VALUES (?,?,?,?,?,?,?)").run(id, day(0), "search_papers", norm, norm, lang, count);
    q("1", "الذكاء الاصطناعي", "ar", 10);
    q("2", "الذكاء الاصطناعي", "ar", 0);
    q("3", "transformers", "en", 4);
    q("5", "old", "en", 5);
    const sc = (id: string, source: string, host: string, ok: number, ms: number, cache = 0, attempts = 1) =>
      t.sqlite.prepare("INSERT INTO source_calls (invocation_id, created_at, source, host, method, http_status, ok, duration_ms, attempts, cache_hit) VALUES (?,?,?,?,?,?,?,?,?,?)").run(id, day(0), source, host, "GET", ok ? 200 : 500, ok, ms, attempts, cache);
    for (const ms of [100, 200, 300, 400, 1000]) sc("1", "openalex", "api.openalex.org", 1, ms);
    sc("3", "openalex", "api.openalex.org", 0, 5000, 0, 2);
    sc("1", "arxiv", "export.arxiv.org", 1, 2000);
    sc("2", "arxiv", "export.arxiv.org", 1, 1, 1, 0);
    t.sqlite.prepare("INSERT INTO clients (id, created_at, request_id, client_name, client_version) VALUES (?,?,?,?,?)").run("c1", day(0), "x", "claude-ai", "1");
    return t;
  }

  it("aggregates seeded rows", async () => {
    const t = seed();
    const s: any = await getUsageStats(t.db, { days: 7 });
    expect(s.totals).toMatchObject({ calls: 4, errors: 1, requests: 4, searches: 3, unique_queries: 2, upstream_calls: 8, upstream_errors: 1, cache_hits: 1, error_rate: 0.25 });
    expect(s.daily).toHaveLength(2);
    expect(s.daily[1]).toMatchObject({ calls: 2, errors: 0, results: 10 });
    expect(s.top_tools[0]).toMatchObject({ tool: "search_papers", calls: 3, errors: 1, zero_result: 1 });
    expect(s.top_queries[0]).toMatchObject({ query: "الذكاء الاصطناعي", language: "ar", searches: 2, avg_results: 5 });
    expect(s.query_languages).toEqual(expect.arrayContaining([{ language: "ar", searches: 2 }, { language: "en", searches: 1 }]));
    const oa = s.sources.find((x: any) => x.source === "openalex");
    expect(oa).toMatchObject({ calls: 6, errors: 1, retries: 1, p50_ms: 300, p95_ms: 5000, max_ms: 5000 });
    expect(oa.error_rate).toBeCloseTo(1 / 6, 3);
    expect(s.sources.find((x: any) => x.source === "arxiv")).toMatchObject({ calls: 2, cache_hits: 1, p50_ms: 2000 });
    expect(s.slowest_tools[0]).toMatchObject({ tool: "search_papers", p95_ms: 3000 });
    expect(s.recent_errors[0]).toMatchObject({ tool: "search_papers", error_message: "all sources failed" });
    expect(s.recent_source_errors).toHaveLength(1);
    expect(s.clients.initialize[0]).toMatchObject({ client_name: "claude-ai", handshakes: 1 });
    expect(s.clients.user_agents[0]).toMatchObject({ user_agent: "UA-A", calls: 3 });
  });

  it("honours the window and tool/source/section filters", async () => {
    const t = seed();
    expect(((await getUsageStats(t.db, { days: 60 })) as any).totals.calls).toBe(5);
    const byTool: any = await getUsageStats(t.db, { tool: "get_paper_details" });
    expect(byTool.totals.calls).toBe(1);
    const bySource: any = await getUsageStats(t.db, { source: "arxiv" });
    expect(bySource.totals.calls).toBe(2);
    expect(bySource.sources.map((x: any) => x.source)).toEqual(["arxiv"]);
    const only: any = await getUsageStats(t.db, { section: "totals" });
    expect(Object.keys(only)).toEqual(expect.arrayContaining(["totals"]));
    expect(only.sources).toBeUndefined();
    const empty: any = await getUsageStats(fakeD1().db);
    expect(empty.totals.calls).toBe(0);
    expect(empty.sources).toEqual([]);
  });

  it("serves the usage_stats tool and does not record itself", async () => {
    const t = seed();
    const pending: Promise<unknown>[] = [];
    const rec = createRecorder({ db: t.db, waitUntil: (p) => void pending.push(p) });
    const server = new McpServer({ name: "d", version: "1" });
    instrumentServer(server, rec);
    registerUsageStatsTool(server, t.db);
    const c = await connect(server);
    const res = await c.callTool({ name: "usage_stats", arguments: { days: 7, section: "totals" } });
    expect(JSON.parse((res.content as any)[0].text).totals.calls).toBe(4);
    await Promise.all(pending);
    expect(t.rows("SELECT * FROM invocations WHERE tool = 'usage_stats'")).toHaveLength(0);
    const bad = await c.callTool({ name: "usage_stats", arguments: { days: 0 } });
    expect(bad.isError).toBe(true);
  });
});
