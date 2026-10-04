import type { Source } from "../types";
import { arxiv } from "./arxiv";
import { biorxiv, medrxiv } from "./biorxiv";
import { crossref } from "./crossref";
import { dblp } from "./dblp";
import { doaj } from "./doaj";
import { eric } from "./eric";
import { europepmc } from "./europepmc";
import { hal } from "./hal";
import { iacr } from "./iacr";
import { inspirehep } from "./inspirehep";
import { pmc, pubmed } from "./ncbi";
import { openaire } from "./openaire";
import { openreview } from "./openreview";
import { semantic } from "./semantic";
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

export const SOURCE_MAP = new Map(SOURCES.map((s) => [s.id, s]));

/** Fast, broad sources used by search_papers when no sources are given. */
export const DEFAULT_SOURCES = ["arxiv", "pubmed", "crossref", "semantic", "europepmc", "openreview"];
