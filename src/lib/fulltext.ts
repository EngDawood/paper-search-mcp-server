import { getText } from "./http";
import { decodeEntities } from "./text";

/** Convert JATS XML (PMC / Europe PMC) to readable plain text. */
export function jatsToText(xml: string): string {
  const pick = (tag: string) => new RegExp(`<${tag}[\\s>][\\s\\S]*?</${tag}>`, "i").exec(xml)?.[0] ?? "";
  const title = pick("article-title");
  const abstract = pick("abstract");
  const body = pick("body");
  const toText = (s: string) =>
    decodeEntities(
      s
        .replace(/<(xref|ext-link)[^>]*>([\s\S]*?)<\/\1>/gi, "$2")
        .replace(/<(table-wrap|fig|disp-formula)[\s>][\s\S]*?<\/\1>/gi, "\n")
        .replace(/<\/?(title)[^>]*>/gi, "\n\n")
        .replace(/<\/(p|sec|list-item)>/gi, "\n")
        .replace(/<[^>]+>/g, ""),
    )
      .replace(/[ \t]+/g, " ")
      .replace(/\n\s*\n\s*\n+/g, "\n\n")
      .trim();
  return [toText(title), abstract && `Abstract\n${toText(abstract)}`, toText(body)].filter(Boolean).join("\n\n");
}

/** Full text for an open-access PMC article via Europe PMC, or null if not available. */
export async function europePmcFullText(pmcid: string): Promise<string | null> {
  try {
    const xml = await getText(`https://www.ebi.ac.uk/europepmc/webservices/rest/${pmcid}/fullTextXML`, { retries: 0 });
    if (!xml.includes("<body")) return null;
    return jatsToText(xml);
  } catch {
    return null;
  }
}
