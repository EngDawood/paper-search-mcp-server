import { getJson } from "../lib/http";
import type { Env } from "../types";

export interface OaLocation {
  url: string;
  pdf_url: string;
  host_type: string;
  version: string;
  license: string;
}

export async function unpaywallLookup(doi: string, env: Env) {
  if (!env.CONTACT_EMAIL) throw new Error("Unpaywall requires CONTACT_EMAIL to be set (wrangler.jsonc vars).");
  const d = await getJson(`https://api.unpaywall.org/v2/${encodeURIComponent(doi)}?email=${encodeURIComponent(env.CONTACT_EMAIL)}`);
  const loc = (l: any): OaLocation => ({
    url: l?.url ?? "",
    pdf_url: l?.url_for_pdf ?? "",
    host_type: l?.host_type ?? "",
    version: l?.version ?? "",
    license: l?.license ?? "",
  });
  return {
    doi: d.doi,
    title: d.title,
    is_oa: !!d.is_oa,
    oa_status: d.oa_status,
    best: d.best_oa_location ? loc(d.best_oa_location) : null,
    locations: (d.oa_locations ?? []).map(loc),
  };
}
