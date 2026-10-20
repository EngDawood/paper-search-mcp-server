import type { Env } from "../types";
import { HttpError } from "./http";

/** Statuses that mean "this key is spent or rejected": try the next one. */
const KEY_FAILURES = [401, 402, 429];

/** Request headers a client can use to bring its own Exa / Firecrawl keys (one key or a comma list). */
export const CLIENT_KEY_HEADERS = { EXA_API_KEY: "x-exa-api-key", FIRECRAWL_API_KEY: "x-firecrawl-api-key" } as const;

export function parseKeys(value?: string | null): string[] {
  return (value ?? "").split(",").map((k) => k.trim()).filter(Boolean);
}

/** Env with the caller's own Exa / Firecrawl keys. A client key replaces the server key, never adds to it. */
export function envWithClientKeys(env: Env, req: Request): Env {
  const out = { ...env };
  for (const [name, header] of Object.entries(CLIENT_KEY_HEADERS)) {
    const keys = parseKeys(req.headers.get(header));
    if (keys.length) out[name as keyof typeof CLIENT_KEY_HEADERS] = keys.join(",");
  }
  return out;
}

/**
 * Runs `fn` with one key from a comma-separated list, starting at a random key to spread load.
 * On 401/402/429 it moves to the next key; any other error, or the last key's error, is thrown.
 */
export async function withKeys<T>(keys: string, fn: (key: string) => Promise<T>): Promise<T> {
  const list = parseKeys(keys);
  if (list.length <= 1) return fn(list[0] ?? keys);
  const start = Math.floor(Math.random() * list.length);
  let lastErr: unknown;
  for (let i = 0; i < list.length; i++) {
    try {
      return await fn(list[(start + i) % list.length]);
    } catch (err) {
      if (!(err instanceof HttpError) || !KEY_FAILURES.includes(err.status)) throw err;
      lastErr = err;
    }
  }
  throw lastErr;
}
