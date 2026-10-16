/**
 * Handler for the mandumah_get_citation tool
 */
import type { ScholarGetCitationInput } from "../../schemas/index";
import { getScholarCitation } from "../../services/scholar-client";
import { formatCitationMarkdown, formatCitationText } from "../../services/formatters";
import { buildResponse, buildErrorResponse } from "../response-builder";
import type { ToolHandlerDeps, ToolResponse } from "../types";

export async function handleMandumahGetCitation(
  params: ScholarGetCitationInput,
  deps: ToolHandlerDeps
): Promise<ToolResponse> {
  try {
    const citation = await getScholarCitation(
      params.record_id,
      params.style,
      deps.firecrawlKey!
    );

    return buildResponse(citation, params.response_format, {
      markdown: formatCitationMarkdown,
      text: formatCitationText,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error occurred";
    return buildErrorResponse(`Error fetching citation: ${message}`);
  }
}
