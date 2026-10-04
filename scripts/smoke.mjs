// Calls every tool against a running server. Usage: node scripts/smoke.mjs [baseUrl] [token]
const BASE = process.argv[2] ?? "http://localhost:8787";
const TOKEN = process.argv[3] ?? process.env.MCP_AUTH_TOKEN;
let id = 0;

async function rpc(method, params) {
  const res = await fetch(`${BASE}/mcp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...(TOKEN ? { authorization: `Bearer ${TOKEN}` } : {}),
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
  });
  const body = await res.json();
  if (body.error) throw new Error(JSON.stringify(body.error));
  return body.result;
}

const q = "graph neural networks";
const cases = [
  ["list_sources", {}],
  ["search_papers", { query: "CRISPR base editing", max_results_per_source: 2 }],
  ["search_arxiv", { query: q, max_results: 2, category: "cs.LG", sort_by: "submittedDate" }],
  ["get_arxiv_papers", { ids: ["1706.03762"] }],
  ["search_pubmed", { query: "CRISPR", max_results: 2, year: "2024" }],
  ["search_pmc", { query: "CRISPR", max_results: 2 }],
  ["search_europepmc", { query: "malaria vaccine", max_results: 2 }],
  ["search_biorxiv", { query: "neuron", max_results: 2, days: 14 }],
  ["search_medrxiv", { query: "covid", max_results: 2, days: 30 }],
  ["search_crossref", { query: q, max_results: 2, sort: "is-referenced-by-count" }],
  ["search_semantic", { query: q, max_results: 2, year: "2020-2023" }],
  ["search_dblp", { query: q, max_results: 2 }],
  ["search_openreview", { query: "diffusion models", max_results: 2 }],
  ["search_hal", { query: "apprentissage profond", max_results: 2 }],
  ["search_zenodo", { query: q, max_results: 2 }],
  ["search_openaire", { query: q, max_results: 2 }],
  ["search_doaj", { query: "climate change", max_results: 2 }],
  ["search_iacr", { query: "lattice", max_results: 2 }],
  ["search_zbmath", { query: "algebraic topology", max_results: 2 }],
  ["search_eric", { query: "active learning", max_results: 2 }],
  ["search_inspirehep", { query: "higgs boson", max_results: 2 }],
  ["get_paper_by_doi", { doi: "10.1038/nature14539" }],
  // OpenAlex tools only exist when OPENALEX_API_KEY is set; skipped otherwise.
  ["search_openalex", { query: "large language models", max_results: 2, year: "2024" }],
  ["get_openalex_work", { id: "10.1038/nature14539" }],
  ["get_openalex_citations", { id: "10.1038/nature14539", direction: "citing", max_results: 2 }],
  ["get_paper_details", { paper_id: "arXiv:1706.03762" }],
  ["get_citing_papers", { paper_id: "1706.03762", max_results: 2 }],
  ["get_referenced_papers", { paper_id: "1706.03762", max_results: 2 }],
  ["find_open_access_pdf", { doi: "10.1371/journal.pone.0000308" }],
  ["read_paper", { source: "arxiv", paper_id: "1706.03762", max_chars: 1000 }],
  ["read_paper", { source: "pmc", paper_id: "PMC3257301", max_chars: 1000 }],
];

const tools = (await rpc("tools/list", {})).tools.map((t) => t.name);
console.log(`${tools.length} tools: ${tools.join(", ")}\n`);
let failed = 0;
for (const [name, args] of cases) {
  if (!tools.includes(name)) {
    console.log(`SKIP ${name.padEnd(24)} (not enabled on this server)`);
    continue;
  }
  // arXiv asks for one request every 3 s.
  if (/arxiv/.test(name) || (name === "read_paper" && args.source === "arxiv") || name === "search_papers") await new Promise((r) => setTimeout(r, 3500));
  const t0 = Date.now();
  try {
    const r = await rpc("tools/call", { name, arguments: args });
    const text = r.content?.[0]?.text ?? "";
    if (r.isError) throw new Error(text);
    const data = JSON.parse(text);
    const n = Array.isArray(data) ? data.length : data.papers?.length ?? data.total_chars ?? data.candidates?.length ?? (data ? 1 : 0);
    const errs = data.sources?.filter((s) => s.error).map((s) => `${s.source}: ${s.error}`);
    const ok = n > 0;
    if (!ok) failed++;
    console.log(`${ok ? "PASS" : "EMPTY"} ${name.padEnd(24)} n=${n} ${Date.now() - t0}ms${errs?.length ? `  partial errors: ${errs.join("; ")}` : ""}`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${name.padEnd(24)} ${Date.now() - t0}ms  ${String(e.message).slice(0, 200)}`);
  }
}
console.log(`\n${cases.length - failed}/${cases.length} passed`);
process.exit(failed ? 1 : 0);
