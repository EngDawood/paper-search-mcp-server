/**
 * Parser for Mandumah citation pages
 */

/**
 * Clean citation text by removing artifacts and normalizing whitespace
 */
function cleanCitation(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^\|+|\|+$/g, '')
    .replace(/\|\s*---\s*\|/g, '') // Remove table artifacts
    .replace(/---/g, '')
    .trim();
}

/**
 * Parse citation from Mandumah Cite page markdown
 */
export function parseCitationMarkdown(markdown: string, style: string): { apa?: string; mla?: string } {
  const result: { apa?: string; mla?: string } = {};

  // Extract APA citation - look for APA section
  if (style === "apa" || style === "all") {
    // Pattern: APA header followed by citation text
    // Actual format: **APA إسلوب** followed by citation until **MLA or تنبيه: warning
    const apaPatterns = [
      // Match **APA إسلوب** or **APA** followed by multi-line citation until **MLA or warning
      /\*\*APA[^*]*\*\*\s*\n+([\s\S]+?)(?=\*\*MLA|تنبيه:|$)/i,
      // Fallback: APA header followed by citation text
      /APA[^\n]*\n+([^\n]+(?:\n(?!\*\*)[^\n]+)*)/i,
    ];
    for (const pattern of apaPatterns) {
      const match = markdown.match(pattern);
      if (match && match[1] && match[1].trim().length > 10) {
        result.apa = cleanCitation(match[1]);
        break;
      }
    }
  }

  // Extract MLA citation - look for MLA section
  if (style === "mla" || style === "all") {
    // Pattern: MLA header followed by citation text
    // Actual format: **MLA إسلوب** followed by citation until تنبيه: warning or end
    const mlaPatterns = [
      // Match **MLA إسلوب** or **MLA** followed by multi-line citation until warning or end
      /\*\*MLA[^*]*\*\*\s*\n+([\s\S]+?)(?=تنبيه:|$)/i,
      // Fallback: MLA header followed by citation text
      /MLA[^\n]*\n+([^\n]+(?:\n(?!\*\*)[^\n]+)*)/i,
    ];
    for (const pattern of mlaPatterns) {
      const match = markdown.match(pattern);
      if (match && match[1] && match[1].trim().length > 10) {
        result.mla = cleanCitation(match[1]);
        break;
      }
    }
  }

  return result;
}
