import { extractText, getDocumentProxy } from "unpdf";
import { request } from "./http";

const MAX_BYTES = 40 * 1024 * 1024;

export async function fetchPdf(url: string): Promise<Uint8Array> {
  const res = await request(url, { timeoutMs: 60_000, cacheTtl: 86_400, headers: { Accept: "application/pdf,*/*" } });
  const len = Number(res.headers.get("content-length") ?? 0);
  if (len > MAX_BYTES) throw new Error(`PDF too large (${(len / 1e6).toFixed(1)} MB)`);
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength > MAX_BYTES) throw new Error(`PDF too large (${(buf.byteLength / 1e6).toFixed(1)} MB)`);
  const head = new TextDecoder().decode(buf.subarray(0, 1024));
  if (!head.includes("%PDF-")) {
    throw new Error(
      `URL did not return a PDF (content-type: ${res.headers.get("content-type") ?? "unknown"}). The host may require a browser or block bots.`,
    );
  }
  return buf;
}

export async function pdfToText(buf: Uint8Array): Promise<{ pages: number; text: string }> {
  const doc = await getDocumentProxy(buf);
  const { totalPages, text } = await extractText(doc, { mergePages: true });
  return { pages: totalPages, text: text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim() };
}
