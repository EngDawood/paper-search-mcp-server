import { afterEach, describe, expect, it, vi } from "vitest";
import { ads } from "../src/sources/ads";
import { core } from "../src/sources/core";
import { ieee } from "../src/sources/ieee";
import { activeSources, defaultSources } from "../src/sources";
import { springer } from "../src/sources/springer";

/** Stub fetch with one JSON body and record the requests made. */
function mockFetch(body: unknown) {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    calls.push({ url, headers: (init.headers ?? {}) as Record<string, string> });
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  });
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe("keyed source registry", () => {
  it("hides keyed sources until their key is set", () => {
    const ids = (env: object) => activeSources(env).map((s) => s.id);
    expect(ids({})).not.toContain("core");
    expect(ids({ CORE_API_KEY: "k", ADS_API_KEY: "k" })).toEqual(expect.arrayContaining(["core", "ads"]));
    expect(defaultSources({ CORE_API_KEY: "k", IEEE_API_KEY: "k" })).toContain("core");
    expect(defaultSources({ CORE_API_KEY: "k", IEEE_API_KEY: "k" })).not.toContain("ieee");
  });

  it("errors clearly without a key", async () => {
    await expect(core.search("x", { maxResults: 1 }, {})).rejects.toThrow(/CORE_API_KEY/);
  });
});

describe("CORE", () => {
  it("maps results and sends a bearer key", async () => {
    const calls = mockFetch({
      results: [
        {
          id: 123,
          title: "Open Paper",
          authors: [{ name: "Ada Lovelace" }],
          abstract: "An abstract.",
          doi: "10.1/x",
          publishedDate: "2021-05-04T00:00:00",
          downloadUrl: "https://core.ac.uk/download/123.pdf",
          links: [{ type: "display", url: "https://core.ac.uk/works/123" }],
          journals: [{ title: "J" }],
        },
      ],
    });
    const [p] = await core.search("open", { maxResults: 1, year: "2020-2022" }, { CORE_API_KEY: "secret" });
    expect(p).toMatchObject({ paper_id: "123", title: "Open Paper", authors: ["Ada Lovelace"], doi: "10.1/x", published_date: "2021-05-04", pdf_url: "https://core.ac.uk/download/123.pdf", venue: "J" });
    expect(calls[0].url).toContain("/v3/search/works/?");
    expect(calls[0].url).toContain("yearPublished");
    expect(calls[0].headers.Authorization).toBe("Bearer secret");
  });
});

describe("IEEE Xplore", () => {
  it("maps articles and only exposes PDFs for open access", async () => {
    mockFetch({
      articles: [
        {
          article_number: "987",
          title: "Power Systems",
          authors: { authors: [{ full_name: "Nikola Tesla" }] },
          abstract: "Abs",
          doi: "10.1109/x",
          publication_year: 2020,
          pdf_url: "https://ieeexplore.ieee.org/stamp/987",
          html_url: "https://ieeexplore.ieee.org/document/987",
          access_type: "LOCKED",
          citing_paper_count: 4,
          index_terms: { author_terms: { terms: ["grid"] } },
        },
      ],
    });
    const [p] = await ieee.search("power", { maxResults: 1 }, { IEEE_API_KEY: "k" });
    expect(p).toMatchObject({ paper_id: "987", authors: ["Nikola Tesla"], published_date: "2020", pdf_url: "", citations: 4, keywords: ["grid"] });
  });
});

describe("Springer Nature", () => {
  it("maps records, flips creator names and handles object abstracts", async () => {
    mockFetch({
      records: [
        {
          identifier: "doi:10.1007/abc",
          doi: "10.1007/abc",
          title: "Cells",
          creators: [{ creator: "Curie, Marie" }],
          abstract: { h1: "Abstract", p: "Body text." },
          publicationDate: "2019-02-01",
          publicationName: "Nature",
          openaccess: "true",
          url: [
            { format: "html", value: "https://link.springer.com/abc" },
            { format: "pdf", value: "https://link.springer.com/abc.pdf" },
          ],
        },
      ],
    });
    const [p] = await springer.search("cells", { maxResults: 1 }, { SPRINGER_API_KEY: "k" });
    expect(p).toMatchObject({ paper_id: "10.1007/abc", authors: ["Marie Curie"], abstract: "Abstract Body text.", pdf_url: "https://link.springer.com/abc.pdf", url: "https://link.springer.com/abc", venue: "Nature" });
  });
});

describe("NASA ADS", () => {
  it("maps docs and prefers arXiv PDFs", async () => {
    const calls = mockFetch({
      response: {
        docs: [
          {
            bibcode: "2019ApJ...1A",
            title: ["Black Holes"],
            author: ["Hawking, S."],
            abstract: "Abs",
            doi: ["10.3847/x"],
            pubdate: "2019-05-00",
            pub: "ApJ",
            citation_count: 10,
            identifier: ["arXiv:1901.00001", "2019ApJ...1A"],
            esources: ["EPRINT_PDF"],
          },
        ],
      },
    });
    const [p] = await ads.search("black holes", { maxResults: 1, year: "2019" }, { ADS_API_KEY: "tok" });
    expect(p).toMatchObject({ paper_id: "2019ApJ...1A", title: "Black Holes", published_date: "2019-05", pdf_url: "https://arxiv.org/pdf/1901.00001", citations: 10 });
    expect(calls[0].headers.Authorization).toBe("Bearer tok");
    expect(decodeURIComponent(calls[0].url)).toContain("year:2019-2019");
  });
});
