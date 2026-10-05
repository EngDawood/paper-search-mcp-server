import type { Env, Source } from "../types";
import { ads } from "./ads";
import { arxiv } from "./arxiv";
import { biorxiv, medrxiv } from "./biorxiv";
import { core } from "./core";
import { crossref } from "./crossref";
import { dblp } from "./dblp";
import { doaj } from "./doaj";
import { eric } from "./eric";
import { europepmc } from "./europepmc";
import { hal } from "./hal";
import { iacr } from "./iacr";
import { ieee } from "./ieee";
import { inspirehep } from "./inspirehep";
import { pmc, pubmed } from "./ncbi";
import { openaire } from "./openaire";
import { openalex } from "./openalex";
import { openreview } from "./openreview";
import { semantic } from "./semantic";
import { springer } from "./springer";
import { zbmath } from "./zbmath";
import { zenodo } from "./zenodo";

/** Every source here works without an API key. */
export const SOURCES: Source[] = [
  arxiv,
  pubmed,
  pmc,
  europepmc,
  biorxiv,
  medrxiv,
  crossref,
  semantic,
  dblp,
  openreview,
  hal,
  zenodo,
  openaire,
  doaj,
  iacr,
  zbmath,
  eric,
  inspirehep,
];

/**
 * Sources that need an API key; enabled only when the key is configured.
 * `inDefaults` adds the source to search_papers when no sources are given.
 */
export const KEYED_SOURCES: { source: Source; enabled: (env: Env) => boolean; inDefaults: boolean }[] = [
  { source: openalex, enabled: (env) => !!env.OPENALEX_API_KEY, inDefaults: true },
  { source: core, enabled: (env) => !!env.CORE_API_KEY, inDefaults: true },
  { source: ieee, enabled: (env) => !!env.IEEE_API_KEY, inDefaults: false },
  { source: springer, enabled: (env) => !!env.SPRINGER_API_KEY, inDefaults: false },
  { source: ads, enabled: (env) => !!env.ADS_API_KEY, inDefaults: false },
];

export function activeSources(env: Env): Source[] {
  return [...SOURCES, ...KEYED_SOURCES.filter((k) => k.enabled(env)).map((k) => k.source)];
}

export const SOURCE_MAP = new Map([...SOURCES, ...KEYED_SOURCES.map((k) => k.source)].map((s) => [s.id, s]));

/** Fast, broad sources used by search_papers when no sources are given. */
const BASE_DEFAULTS = ["arxiv", "pubmed", "crossref", "semantic", "europepmc", "openreview"];

export function defaultSources(env: Env): string[] {
  return [...BASE_DEFAULTS, ...KEYED_SOURCES.filter((k) => k.inDefaults && k.enabled(env)).map((k) => k.source.id)];
}
