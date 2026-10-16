/**
 * Exa REST client (POST /search and /contents). Replaces exa-js, which needs Node.
 * The key goes in the x-api-key header only.
 */
import { request } from "../../lib/http";

const EXA_BASE = "https://api.exa.ai";

export interface ExaRawResult {
  title: string | null;
  url: string;
  text?: string;
  score?: number;
}

export interface ExaResponse {
  results: ExaRawResult[];
}

export interface ExaSearchOptions {
  numResults: number;
  includeDomains: string[];
  type: string;
  textMaxCharacters: number;
  /** ISO country code, only sent when set */
  userLocation?: string;
}

const headers = (apiKey: string) => ({
  "Content-Type": "application/json",
  Accept: "application/json",
  "x-api-key": apiKey,
});

/**
 * Body of searchAndContents as exa-js 2.x sent it. Never add `category` here: with
 * includeDomains Exa then ignores the domains.
 */
export function buildSearchBody(query: string, o: ExaSearchOptions): Record<string, unknown> {
  return {
    query,
    contents: { text: { maxCharacters: o.textMaxCharacters } },
    numResults: o.numResults,
    includeDomains: o.includeDomains,
    type: o.type,
    ...(o.userLocation ? { userLocation: o.userLocation } : {}),
  };
}

export function buildContentsBody(urls: string[], maxCharacters: number): Record<string, unknown> {
  return { urls, text: { maxCharacters } };
}

async function post(apiKey: string, path: string, body: Record<string, unknown>): Promise<ExaResponse> {
  const res = await request(`${EXA_BASE}${path}`, {
    method: "POST",
    headers: headers(apiKey),
    body: JSON.stringify(body),
    timeoutMs: 30_000,
    retries: 2,
  });
  const json = (await res.json()) as { results?: ExaRawResult[] };
  return { results: json.results ?? [] };
}

export const exaSearch = (apiKey: string, query: string, o: ExaSearchOptions) =>
  post(apiKey, "/search", buildSearchBody(query, o));

export const exaContents = (apiKey: string, urls: string[], maxCharacters: number) =>
  post(apiKey, "/contents", buildContentsBody(urls, maxCharacters));
