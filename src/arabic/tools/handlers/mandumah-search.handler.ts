/**
 * Handler for the mandumah_search tool
 */
import type { ScholarSearchInput } from "../../schemas/index";
import { searchScholar } from "../../services/scholar-client";
import { formatSearchResultsMarkdown, formatSearchResultsText } from "../../services/formatters";
import { buildResponse, buildErrorResponse } from "../response-builder";
import type { ToolHandlerDeps, ToolResponse } from "../types";

export async function handleMandumahSearch(
  params: ScholarSearchInput,
  deps: ToolHandlerDeps
): Promise<ToolResponse> {
  try {
    const response = await searchScholar({
      query: params.query,
      searchField: params.search_field,
      languages: params.languages,
      contentTypes: params.content_types,
      dateFrom: params.date_from,
      dateTo: params.date_to,
      peerReviewed: params.peer_reviewed,
      fullTextOnly: params.full_text_only,
      page: params.page,
      sort: params.sort,
    }, deps.firecrawlKey!);

    return buildResponse(response, params.response_format, {
      markdown: formatSearchResultsMarkdown,
      text: formatSearchResultsText,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error occurred";
    return buildErrorResponse(
      `Error searching Mandumah: ${message}\n\nTry:\n- Check your query spelling\n- Reduce the number of filters\n- Wait a moment and retry if rate limited`
    );
  }
}
