import { describe, expect, it } from "vitest";
import { dedupe } from "../src/lib/aggregate";
import { jatsToText } from "../src/lib/fulltext";
import { extractDoi, parseYear, stripTags } from "../src/lib/text";
import { buildArxivQuery, normalizeArxivId } from "../src/sources/arxiv";
import { parseIacrHtml } from "../src/sources/iacr";
import { s2Id } from "../src/sources/semantic";
import { paper } from "../src/types";

describe("text helpers", () => {
  it("parses year filters", () => {
    expect(parseYear("2020")).toEqual({ from: 2020, to: 2020 });
    expect(parseYear("2019-2023")).toEqual({ from: 2019, to: 2023 });
    expect(parseYear("2020-")).toEqual({ from: 2020, to: undefined });
    expect(parseYear("-2015")).toEqual({ from: undefined, to: 2015 });
    expect(parseYear(undefined)).toEqual({});
  });

  it("extracts DOIs", () => {
    expect(extractDoi("https://doi.org/10.1038/nature14539.")).toBe("10.1038/nature14539");
    expect(extractDoi("no doi here")).toBe("");
  });

  it("strips JATS/HTML", () => {
    expect(stripTags("<jats:title>Abstract</jats:title><jats:p>Hello &amp; <i>world</i></jats:p>")).toBe("Hello & world");
  });
});

describe("arXiv", () => {
  it("builds queries", () => {
    expect(buildArxivQuery({ query: "graph neural networks", maxResults: 1 })).toBe('all:"graph neural networks"');
    expect(buildArxivQuery({ query: "ti:bert", maxResults: 1 })).toBe("ti:bert");
    expect(buildArxivQuery({ author: "Hinton", category: "cs.LG", year: "2020-2021", maxResults: 1 })).toBe(
      "(au:Hinton) AND (cat:cs.LG) AND (submittedDate:[202001010000 TO 202112312359])",
    );
  });

  it("normalizes ids", () => {
    expect(normalizeArxivId("https://arxiv.org/abs/1706.03762v5")).toBe("1706.03762v5");
    expect(normalizeArxivId("arXiv:2401.00001")).toBe("2401.00001");
    expect(normalizeArxivId("https://arxiv.org/pdf/1706.03762.pdf")).toBe("1706.03762");
  });
});

describe("Semantic Scholar ids", () => {
  it("prefixes ids", () => {
    expect(s2Id("10.1038/nature14539")).toBe("DOI:10.1038/nature14539");
    expect(s2Id("1706.03762")).toBe("ARXIV:1706.03762");
    expect(s2Id("PMID:123")).toBe("PMID:123");
    expect(s2Id("649def34f8be52c8b66281af98ae884c09aef38b")).toBe("649def34f8be52c8b66281af98ae884c09aef38b");
  });
});

describe("IACR HTML parser", () => {
  const html = `<div class="mb-4">
    <div class="d-flex"><a title="2026/2289" class="paperlink" href="/2026/2289">2026/2289</a>
      <span class="ms-2"><a href="/2026/2289.pdf">(PDF)</a></span>
      <small class="ms-auto">Last updated: 2026-10-01</small></div>
    <div class="ms-md-4"><div><strong>A Subexponential Algorithm for Binary LWE</strong>
      <div class="mt-1"><span class="fst-italic">Zhili Chen, Kaijie Jiang and Anyu Wang</span></div></div>
      <small class="badge category category-ATTACKS">Attacks and cryptanalysis</small>
      <p class="mb-0 mt-1 search-abstract">We study Binary LWE &#39;15...</p></div></div>`;
  it("extracts entries", () => {
    const [p] = parseIacrHtml(html);
    expect(p.paper_id).toBe("2026/2289");
    expect(p.title).toBe("A Subexponential Algorithm for Binary LWE");
    expect(p.authors).toEqual(["Zhili Chen", "Kaijie Jiang", "Anyu Wang"]);
    expect(p.abstract).toBe("We study Binary LWE '15...");
    expect(p.pdf_url).toBe("https://eprint.iacr.org/2026/2289.pdf");
    expect(p.categories).toEqual(["Attacks and cryptanalysis"]);
  });
});

describe("JATS full text", () => {
  it("keeps title, abstract and body", () => {
    const xml = `<article><front><article-title>My Paper</article-title><abstract><p>Short abstract.</p></abstract></front>
      <body><sec><title>Intro</title><p>First <xref ref-type="bibr">[1]</xref> para.</p></sec></body></article>`;
    const t = jatsToText(xml);
    expect(t).toContain("My Paper");
    expect(t).toContain("Abstract\nShort abstract.");
    expect(t).toContain("Intro");
    expect(t).toContain("First [1] para.");
  });
});

describe("dedupe", () => {
  it("merges by DOI and fills missing fields", () => {
    const a = paper({ paper_id: "1", title: "X", source: "crossref", doi: "10.1/ABC" });
    const b = paper({ paper_id: "2", title: "X", source: "semantic", doi: "10.1/abc", abstract: "abs", citations: 5 });
    const out = dedupe([a, b]);
    expect(out).toHaveLength(1);
    expect(out[0].abstract).toBe("abs");
    expect(out[0].citations).toBe(5);
    expect(out[0].extra?.found_in).toEqual(["crossref", "semantic"]);
  });
});

describe("OpenAlex", async () => {
  const { invertedIndexToText, openalexId } = await import("../src/sources/openalex");
  it("rebuilds abstracts from the inverted index", () => {
    expect(invertedIndexToText({ Deep: [0], learning: [1, 3], is: [2] })).toBe("Deep learning is learning");
    expect(invertedIndexToText(null)).toBe("");
  });
  it("normalizes ids", () => {
    expect(openalexId("https://openalex.org/W2741809807")).toBe("W2741809807");
    expect(openalexId("https://doi.org/10.1038/nature14539")).toBe("doi:10.1038/nature14539");
  });
});
