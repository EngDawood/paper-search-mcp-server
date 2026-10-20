import { reportFetch } from "../analytics/context";

const UA = "paper-search-mcp-server/0.1 (+https://github.com/EngDawood/paper-search-mcp-server)";

export class HttpError extends Error {
  constructor(
    public status: number,
    public url: string,
    body: string,
  ) {
    super(`HTTP ${status} from ${new URL(url).host}${body ? `: ${body.slice(0, 200)}` : ""}`);
  }
}

export interface FetchOpts {
  headers?: Record<string, string>;
  timeoutMs?: number;
  /** Retries on 429/5xx/network error. Default 1. */
  retries?: number;
  /** Seconds to keep a successful GET in the Cloudflare cache. Default 3600; 0 disables. */
  cacheTtl?: number;
  method?: string;
  body?: string;
  /** Statuses to throw at once, without the 429/5xx retry (used to switch API key on 429). */
  failFast?: number[];
}

function edgeCache(): Cache | undefined {
  return typeof caches !== "undefined" ? (caches as unknown as { default: Cache }).default : undefined;
}

/**
 * GET requests go through the Workers Cache API so repeated queries don't hit
 * rate-limited upstreams (arXiv, Semantic Scholar). The cache is per-colo and
 * only active on custom domains (it is a no-op on *.workers.dev).
 */
export async function request(url: string, opts: FetchOpts = {}): Promise<Response> {
  const cacheTtl = opts.cacheTtl ?? 3600;
  const cache = (opts.method ?? "GET") === "GET" && cacheTtl > 0 ? edgeCache() : undefined;
  const key = new Request(url, { headers: { Accept: opts.headers?.Accept ?? "*/*" } });
  if (cache) {
    const t0 = Date.now();
    const hit = await cache.match(key).catch(() => undefined);
    if (hit) {
      reportFetch({ url, method: "GET", status: hit.status, ok: true, ms: Date.now() - t0, attempts: 0, cacheHit: true, bytes: contentLength(hit) });
      return hit;
    }
  }
  const res = await fetchWithRetry(url, opts);
  if (cache) {
    const copy = new Response(res.clone().body, res);
    copy.headers.set("Cache-Control", `public, max-age=${cacheTtl}`);
    copy.headers.delete("Set-Cookie");
    await cache.put(key, copy).catch(() => undefined);
  }
  return res;
}

function contentLength(res: Response): number | undefined {
  const n = Number(res.headers.get("content-length"));
  return Number.isFinite(n) && res.headers.has("content-length") ? n : undefined;
}

/** Runs the retry loop and reports the outcome (timing, status, attempts) to the analytics recorder. */
async function fetchWithRetry(url: string, opts: FetchOpts): Promise<Response> {
  const t0 = Date.now();
  const method = opts.method ?? "GET";
  const state = { attempts: 0, status: undefined as number | undefined };
  try {
    const res = await fetchLoop(url, opts, state);
    reportFetch({ url, method, status: res.status, ok: true, ms: Date.now() - t0, attempts: state.attempts, cacheHit: false, bytes: contentLength(res) });
    return res;
  } catch (err) {
    const status = err instanceof HttpError ? err.status : state.status;
    reportFetch({ url, method, status, ok: false, ms: Date.now() - t0, attempts: state.attempts, cacheHit: false, error: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

async function fetchLoop(url: string, opts: FetchOpts, state: { attempts: number; status?: number }): Promise<Response> {
  const { timeoutMs = 20_000, retries = 1 } = opts;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      state.attempts++;
      const res = await fetch(url, {
        method: opts.method ?? "GET",
        body: opts.body,
        headers: { "User-Agent": UA, ...opts.headers },
        signal: AbortSignal.timeout(timeoutMs),
        redirect: "follow",
      });
      state.status = res.status;
      if (res.ok) return res;
      const body = await res.text().catch(() => "");
      lastErr = new HttpError(res.status, url, body);
      if (opts.failFast?.includes(res.status) || (res.status !== 429 && res.status < 500)) throw lastErr;
    } catch (err) {
      if (err instanceof HttpError && (opts.failFast?.includes(err.status) || (err.status !== 429 && err.status < 500))) throw err;
      lastErr = err;
    }
    if (attempt < retries) await sleep(800 * 2 ** attempt);
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export async function getJson<T = any>(url: string, opts?: FetchOpts): Promise<T> {
  const res = await request(url, { ...opts, headers: { Accept: "application/json", ...opts?.headers } });
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    const hint = /^\s*</.test(text) ? " (got HTML: likely a bot challenge or rate-limit page)" : "";
    throw new Error(`Invalid JSON from ${new URL(url).host}${hint}`);
  }
}

export async function getText(url: string, opts?: FetchOpts): Promise<string> {
  return (await request(url, opts)).text();
}

export function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  return sp.toString();
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
