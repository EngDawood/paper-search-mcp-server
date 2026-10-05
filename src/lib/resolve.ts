import { normalizeArxivId } from "../sources/arxiv";
import { getS2Paper } from "../sources/semantic";
import { unpaywallLookup } from "../sources/unpaywall";
import type { Env } from "../types";
import { getJson, qs } from "./http";
import { extractDoi } from "./text";

/** Map (source, paper_id) to a direct PDF URL without a network call where possible. */
export async function pdfUrlFor(source: string, id: string, env: Env): Promise<string> {
  const pid = id.trim();
  switch (source) {
    case "arxiv":
      return `https://arxiv.org/pdf/${normalizeArxivId(pid)}`;
    case "pmc":
    case "europepmc": {
      const pmcid = /PMC\d+/i.exec(pid)?.[0];
      if (pmcid) return `https://europepmc.org/articles/${pmcid.toUpperCase()}?pdf=render`;
      break;
    }
    case "iacr":
      return `https://eprint.iacr.org/${pid.replace(/\.pdf$/, "")}.pdf`;
    case "openreview":
      return `https://openreview.net/pdf?id=${encodeURIComponent(pid)}`;
    case "eric":
      return `https://files.eric.ed.gov/fulltext/${pid}.pdf`;
    case "biorxiv":
    case "medrxiv": {
      const doi = extractDoi(pid);
      const data = await getJson(`https://api.biorxiv.org/details/${source}/${doi}/na/json`);
      const last = (data?.collection ?? []).at(-1);
      if (last) return `https://www.${source}.org/content/${last.doi}v${last.version}.full.pdf`;
      break;
    }
    case "semantic": {
      const p = await getS2Paper(pid, env);
      if (p.pdf_url) return p.pdf_url;
      if (p.doi) return findOpenAccessPdf(p.doi, env).then((r) => r.pdf_url);
      break;
    }
  }
  const doi = extractDoi(pid);
  if (doi) {
    const r = await findOpenAccessPdf(doi, env);
    if (r.pdf_url) return r.pdf_url;
  }
  throw new Error(`Could not resolve a PDF for ${source}:${pid}. Pass pdf_url directly if you have one.`);
}

export interface OaResult {
  doi: string;
  pdf_url: string;
  candidates: { via: string; pdf_url: string; landing_url?: string; version?: string; license?: string }[];
  errors: Record<string, string>;
}

/** Find an open-access PDF for a DOI: Unpaywall (if CONTACT_EMAIL set), Semantic Scholar (if keyed), Europe PMC, arXiv. */
export async function findOpenAccessPdf(doiInput: string, env: Env): Promise<OaResult> {
  const doi = extractDoi(doiInput) || doiInput.trim();
  const out: OaResult = { doi, pdf_url: "", candidates: [], errors: {} };
  const tasks: Record<string, () => Promise<void>> = {
    europepmc: async () => {
      const d = await getJson(
        `https://www.ebi.ac.uk/europepmc/webservices/rest/search?${qs({ query: `DOI:"${doi}"`, format: "json", resultType: "lite" })}`,
      );
      const r = d?.resultList?.result?.[0];
      if (r?.pmcid && r.isOpenAccess === "Y")
        out.candidates.push({ via: "europepmc", pdf_url: `https://europepmc.org/articles/${r.pmcid}?pdf=render`, landing_url: `https://europepmc.org/article/PMC/${r.pmcid}` });
    },
  };
  // Semantic Scholar only with a key; the shared pool is almost always 429.
  if (env.SEMANTIC_SCHOLAR_API_KEY) {
    tasks.semantic = async () => {
      const p = await getS2Paper(`DOI:${doi}`, env);
      if (p.pdf_url) out.candidates.push({ via: "semantic", pdf_url: p.pdf_url, landing_url: p.url });
    };
  }
  if (env.CONTACT_EMAIL) {
    tasks.unpaywall = async () => {
      const u = await unpaywallLookup(doi, env);
      for (const l of u.locations) if (l.pdf_url) out.candidates.push({ via: "unpaywall", pdf_url: l.pdf_url, landing_url: l.url, version: l.version, license: l.license });
    };
  }
  if (/^10\.48550\/arxiv\./i.test(doi)) {
    out.candidates.push({ via: "arxiv", pdf_url: `https://arxiv.org/pdf/${doi.replace(/^10\.48550\/arxiv\./i, "")}` });
  }
  await Promise.all(
    Object.entries(tasks).map(([k, fn]) =>
      fn().catch((e) => {
        out.errors[k] = e instanceof Error ? e.message : String(e);
      }),
    ),
  );
  const order = ["arxiv", "unpaywall", "europepmc", "semantic"];
  out.candidates.sort((a, b) => order.indexOf(a.via) - order.indexOf(b.via));
  out.pdf_url = out.candidates[0]?.pdf_url ?? "";
  return out;
}
