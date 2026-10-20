import { afterEach, describe, expect, it, vi } from "vitest";
import { exaSearch } from "../src/arabic/services/exa";
import { scrapeUrl } from "../src/arabic/services/firecrawl";
import { envWithClientKeys, parseKeys, withKeys } from "../src/lib/keys";
import { HttpError } from "../src/lib/http";

afterEach(() => vi.unstubAllGlobals());

const exaOpts = { numResults: 1, includeDomains: ["a.org"], type: "auto", textMaxCharacters: 10 };

/** fetch stub: status per API key, recording which keys were tried in order */
function stub(statusByKey: Record<string, number>, header: (h: Record<string, string>) => string): string[] {
  const tried: string[] = [];
  vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
    const key = header(init.headers as Record<string, string>);
    tried.push(key);
    const status = statusByKey[key] ?? 200;
    return new Response(JSON.stringify(status === 200 ? { success: true, results: [], data: {} } : { error: "x" }), { status });
  });
  return tried;
}

describe("parseKeys", () => {
  it("splits, trims and drops empties", () => {
    expect(parseKeys(" a, b ,,c ")).toEqual(["a", "b", "c"]);
    expect(parseKeys(undefined)).toEqual([]);
  });
});

describe("withKeys", () => {
  it("moves to the next key on 401/402/429 and returns the first success", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const seen: string[] = [];
    const out = await withKeys("k1,k2,k3", async (k) => {
      seen.push(k);
      if (k !== "k3") throw new HttpError(k === "k1" ? 429 : 402, "https://api.exa.ai/search", "");
      return "ok";
    });
    expect(out).toBe("ok");
    expect(seen).toEqual(["k1", "k2", "k3"]);
  });
  it("throws other errors at once and the last error when every key fails", async () => {
    await expect(withKeys("a,b", async () => { throw new HttpError(400, "https://x.org", ""); })).rejects.toThrow(/400/);
    await expect(withKeys("a,b", async () => { throw new HttpError(429, "https://x.org", ""); })).rejects.toThrow(/429/);
  });
});

describe("Exa and Firecrawl with several keys", () => {
  it("Exa skips a rate-limited key without waiting on retries", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const tried = stub({ bad: 429 }, (h) => h["x-api-key"]);
    await exaSearch("bad,good", "q", exaOpts);
    expect(tried).toEqual(["bad", "good"]);
  });
  it("Firecrawl skips a key with no credits", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const tried = stub({ bad: 402 }, (h) => h.Authorization.replace("Bearer ", ""));
    const r = await scrapeUrl("bad,good", "https://example.org", { formats: ["markdown"] });
    expect(r.success).toBe(true);
    expect(tried).toEqual(["bad", "good"]);
  });
});

describe("envWithClientKeys", () => {
  const req = (h: Record<string, string>) => new Request("https://x.org/mcp", { headers: h });
  it("client keys replace the server keys", () => {
    const env = envWithClientKeys({ EXA_API_KEY: "server", FIRECRAWL_API_KEY: "s" }, req({ "x-exa-api-key": "c1, c2" }));
    expect(env.EXA_API_KEY).toBe("c1,c2");
    expect(env.FIRECRAWL_API_KEY).toBe("s");
  });
  it("keeps the server keys when no header is sent", () => {
    expect(envWithClientKeys({ EXA_API_KEY: "server" }, req({})).EXA_API_KEY).toBe("server");
  });
});
