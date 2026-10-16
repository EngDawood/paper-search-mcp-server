import { afterEach, describe, expect, it, vi } from "vitest";
import { detectLanguage, doiCitation, titleSimilarity } from "../src/cross";

describe("cross helpers", () => {
  it("detects query language", () => {
    expect(detectLanguage("الذكاء الاصطناعي في التعليم")).toBe("ar");
    expect(detectLanguage("machine learning")).toBe("en");
    expect(detectLanguage("تعلم الآلة machine learning")).toBe("mixed");
    expect(detectLanguage("2024")).toBe("other");
  });

  it("scores title similarity in English and Arabic", () => {
    expect(titleSimilarity("Attention Is All You Need", "Attention is all you need.")).toBe(1);
    expect(titleSimilarity("Attention Is All You Need", "Deep residual learning")).toBe(0);
    expect(titleSimilarity("الذكاء الاصطناعي في التعليم", "الذّكاء الاصطناعيّ في التعليم")).toBe(1);
  });
});

describe("doiCitation", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("asks doi.org for the right content type", async () => {
    const fetch = vi.fn(async () => new Response("@article{x, title={T}}", { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    expect(await doiCitation("10.1000/xyz", "bibtex")).toBe("@article{x, title={T}}");
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://doi.org/10.1000/xyz");
    expect((init.headers as Record<string, string>).Accept).toBe("application/x-bibtex");
  });

  it("uses CSL style names for formatted styles", async () => {
    const fetch = vi.fn(async () => new Response("Smith, J. (2020). T.", { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    await doiCitation("10.1000/xyz", "mla");
    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).Accept).toContain("style=modern-language-association");
  });

  it("rejects HTML answers", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<!DOCTYPE html><html></html>", { status: 200 })));
    await expect(doiCitation("10.1000/none", "apa")).rejects.toThrow(/HTML/);
  });
});
