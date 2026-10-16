import { vi } from "vitest";

export interface Call {
  url: string;
  method?: string;
  headers: Record<string, string>;
  body: any;
}

/** Stub global fetch. `handler` returns the JSON for a request. Returns the recorded calls. */
export function mockFetch(handler: (c: Call) => unknown): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    const call: Call = {
      url: String(url),
      method: init.method,
      headers: (init.headers ?? {}) as Record<string, string>,
      body: init.body ? JSON.parse(String(init.body)) : undefined,
    };
    calls.push(call);
    return new Response(JSON.stringify(handler(call)), { status: 200, headers: { "content-type": "application/json" } });
  });
  return calls;
}
