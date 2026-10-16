import { afterEach, describe, expect, it, vi } from "vitest";
import { searchArabic } from "../../../src/arabic";
import { buildGoogleScholarUrl, parseByline, parseGoogleScholarHtml } from "../../../src/arabic/services/google-scholar";
import arPage from "../fixtures/google-scholar-ar.html?raw";
import enPage from "../fixtures/google-scholar-en.html?raw";
import { mockFetch } from "../helpers";

const pages: Record<string, string> = { "google-scholar-ar.html": arPage, "google-scholar-en.html": enPage };
const fixture = (name: string) => pages[name];

describe("Google Scholar parser (real pages, trimmed)", () => {
  it("parses an Arabic results page", () => {
    const { total, results } = parseGoogleScholarHtml(fixture("google-scholar-ar.html"));
    expect(total).toBe(1230);
    expect(results).toHaveLength(3);
    const r = results[0];
    expect(r.title).toBe("الذكاء الاصطناعي في التعليم: مراجعة منهجية");
    expect(r.url).toBe("https://jasep.journals.ekb.eg/article_362479.html");
    expect(r.authors).toEqual(["العنزي", "مريم عايد", "العبيكان"]);
    expect(r.journal).toBe("المجلة العربية للعلوم");
    expect(r.year).toBe("2024");
    expect(r.pdfUrl).toBe("https://jasep.journals.ekb.eg/article_362479_af7387926e4c25b3b7a1c3d6d952d4ab.pdf");
    expect(r.snippet).toMatch(/^هدفت الدراسة إلى التعرف/);
    expect(r.clusterId).toBe("5VmXryKoABkJ");
    expect(r.source).toBe("Google Scholar");
    for (const x of results) {
      expect(x.title).not.toMatch(/\[(PDF|HTML)\]/);
      expect(x.year).toMatch(/^20\d\d$/);
    }
  });

  it("parses an English result with a citation count and strips type labels", () => {
    const { results } = parseGoogleScholarHtml(fixture("google-scholar-en.html"));
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("Twitter sentiment analysis on health services in Arabic");
    expect(results[0].authors).toEqual(["A Alayba"]);
    expect(results[0].year).toBe("2019");
    expect(results[0].citations).toBe(8);
    expect(results[0].pdfUrl).toMatch(/^https:\/\/pure\.coventry\.ac\.uk\//);
  });

  it("throws on a captcha page and returns empty on a real no-results page", () => {
    expect(() => parseGoogleScholarHtml('<div id="gs_captcha_ccl">unusual traffic</div>')).toThrow(/captcha/);
    expect(() => parseGoogleScholarHtml("<html><body>something else</body></html>")).toThrow(/no result list/);
    expect(parseGoogleScholarHtml('<div id="gs_res_ccl_mid"></div>')).toEqual({ total: 0, results: [] });
  });

  it("parses bylines", () => {
    expect(parseByline("A Vaswani, N Shazeer, N Parmar… - Advances in neural …, 2017 - proceedings.neurips.cc")).toEqual({
      authors: ["A Vaswani", "N Shazeer", "N Parmar"],
      venue: "Advances in neural",
      year: "2017",
    });
    expect(parseByline("A Alayba - 2019 - pure.coventry.ac.uk")).toEqual({ authors: ["A Alayba"], venue: undefined, year: "2019" });
  });

  it("builds the search URL with language, years and page size", () => {
    const u = new URL(buildGoogleScholarUrl("الذكاء الاصطناعي", { maxResults: 30, yearFrom: "2020", yearTo: "2024" }));
    expect(u.searchParams.get("hl")).toBe("ar");
    expect(u.searchParams.get("as_ylo")).toBe("2020");
    expect(u.searchParams.get("as_yhi")).toBe("2024");
    expect(u.searchParams.get("num")).toBe("20");
    expect(new URL(buildGoogleScholarUrl("deep learning", { maxResults: 5 })).searchParams.get("hl")).toBe("en");
  });
});

describe("Google Scholar direct scrape with Exa fallback", () => {
  afterEach(() => vi.unstubAllGlobals());

  const exaHit = {
    results: [
      {
        url: "https://scholar.google.com/citations?view_op=view_citation&hl=en&user=abc&citation_for_view=abc:xyz",
        title: "Exa paper title about learning",
        text: "Exa paper title about learning",
        score: 0.5,
      },
    ],
  };

  it("uses the direct scrape when it returns results", async () => {
    const calls = mockFetch((c) =>
      c.url.includes("firecrawl") ? { success: true, data: { rawHtml: fixture("google-scholar-ar.html") } } : exaHit,
    );
    const { papers, outcomes } = await searchArabic("الذكاء الاصطناعي في التعليم", { maxResults: 2, platforms: ["google_scholar"], year: "2020-" }, { FIRECRAWL_API_KEY: "fc", EXA_API_KEY: "exa" });
    expect(calls.map((c) => new URL(c.url).host)).toEqual(["api.firecrawl.dev"]);
    expect(new URL(calls[0].body.url).searchParams.get("as_ylo")).toBe("2020");
    expect(calls[0].body.formats).toEqual(["rawHtml"]);
    expect(papers).toHaveLength(2);
    expect(papers[0].pdf_url).toMatch(/\.pdf$/);
    expect(papers[0].extra?.via).toBe("direct");
    expect(outcomes[0]).toMatchObject({ source: "google_scholar", count: 2, via: "direct" });
  });

  it("falls back to Exa when Google blocks the scrape", async () => {
    const calls = mockFetch((c) =>
      c.url.includes("firecrawl") ? { success: true, data: { rawHtml: "<div>unusual traffic from your computer network</div>" } } : exaHit,
    );
    const { outcomes } = await searchArabic("learning", { maxResults: 3, platforms: ["google_scholar"] }, { FIRECRAWL_API_KEY: "fc", EXA_API_KEY: "exa" });
    expect(calls.map((c) => new URL(c.url).host)).toEqual(["api.firecrawl.dev", "api.exa.ai"]);
    expect(calls[1].body.includeDomains).toEqual(["scholar.google.com"]);
    expect(outcomes[0]).toMatchObject({ source: "google_scholar", via: "exa", fallback_reason: expect.stringMatching(/captcha|block/) });
  });

  it("works with Firecrawl only and reports the error when there is no Exa to fall back to", async () => {
    mockFetch(() => ({ success: false, error: "Rate limited" }));
    const { papers, outcomes } = await searchArabic("learning", { maxResults: 3, platforms: ["google_scholar"] }, { FIRECRAWL_API_KEY: "fc" });
    expect(papers).toEqual([]);
    expect(outcomes[0]).toMatchObject({ source: "google_scholar", error: expect.stringMatching(/Rate limited/) });
  });
});
