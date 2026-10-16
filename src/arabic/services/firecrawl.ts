/**
 * Firecrawl REST client (POST /v1/scrape). Replaces @mendable/firecrawl-js, which needs Node.
 * The key goes in the Authorization header only.
 */
import { request } from "../../lib/http";

const FIRECRAWL_SCRAPE_URL = "https://api.firecrawl.dev/v1/scrape";

export interface ScrapeOptions {
  formats: Array<"markdown" | "rawHtml" | "html">;
  /** Milliseconds Firecrawl waits for dynamic content */
  waitFor?: number;
}

/** Same shape the SDK's scrapeUrl returned: the `data` fields spread next to `success` */
export interface ScrapeResult {
  success: boolean;
  error?: string;
  warning?: string;
  markdown?: string;
  rawHtml?: string;
  html?: string;
}

/** Request body the SDK sent, minus its `origin` tag */
export function buildScrapeBody(url: string, opts: ScrapeOptions): Record<string, unknown> {
  return { url, ...opts };
}

export async function scrapeUrl(apiKey: string, url: string, opts: ScrapeOptions): Promise<ScrapeResult> {
  const res = await request(FIRECRAWL_SCRAPE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(buildScrapeBody(url, opts)),
    timeoutMs: 60_000,
    retries: 2,
  });
  const json = (await res.json().catch(() => undefined)) as
    | { success?: boolean; error?: string; warning?: string; data?: Record<string, unknown> }
    | undefined;
  if (!json?.success) return { success: false, error: json?.error ?? "Unknown error" };
  return { success: true, warning: json.warning, ...(json.data as Partial<ScrapeResult>) };
}
