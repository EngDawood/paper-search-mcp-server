import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Tiny, dependency-free bridge between src/lib/http.ts and the analytics recorder.
 * http.ts imports only this file, so the analytics code can depend on http.ts types freely.
 */
export interface FetchReport {
  url: string;
  method: string;
  /** Final HTTP status when one was received. */
  status?: number;
  ok: boolean;
  ms: number;
  /** Network attempts made. 0 for an edge cache hit. */
  attempts: number;
  cacheHit: boolean;
  bytes?: number;
  error?: string;
}

export interface FetchSink {
  onFetch(report: FetchReport): void;
}

export const fetchSinks = new AsyncLocalStorage<FetchSink>();

/** Report an upstream fetch to the current invocation, if any. Never throws. */
export function reportFetch(report: FetchReport): void {
  try {
    fetchSinks.getStore()?.onFetch(report);
  } catch {
    /* analytics must never affect a request */
  }
}
