/**
 * Handler for the search_arabic_papers tool
 */
import type { UnifiedSearchInput } from "../../schemas/index";
import { searchArabicPapers } from "../../services/unified-search";
import { formatUnifiedSearchMarkdown, formatUnifiedSearchText } from "../../services/formatters";
import { buildResponse, buildErrorResponse } from "../response-builder";
import type { ToolHandlerDeps, ToolResponse } from "../types";

export async function handleSearchArabicPapers(
  params: UnifiedSearchInput,
  deps: ToolHandlerDeps
): Promise<ToolResponse> {
  if (!deps.hasFirecrawl && !deps.exaApiKey) {
    return buildErrorResponse(
      "Error: No API keys configured. This tool requires at least one of:\n\n- FIRECRAWL_API_KEY (for Mandumah searches)\n- EXA_API_KEY (for open-access repository searches)\n\nPlease set at least one environment variable to use this tool."
    );
  }

  try {
    const response = await searchArabicPapers(
      {
        query: params.query,
        platforms: params.platforms,
        search_field: params.search_field,
        languages: params.languages,
        content_types: params.content_types,
        date_from: params.date_from,
        date_to: params.date_to,
        peer_reviewed: params.peer_reviewed,
        full_text_only: params.full_text_only,
        page: params.page,
        sort: params.sort,
        authors: params.authors,
        max_results_per_source: params.max_results_per_source,
        response_format: params.response_format,
      },
      deps.hasFirecrawl,
      deps.exaApiKey,
      deps.firecrawlKey
    );

    return buildResponse(response, params.response_format, {
      markdown: formatUnifiedSearchMarkdown,
      text: formatUnifiedSearchText,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error occurred";
    return buildErrorResponse(
      `Error performing unified search: ${message}\n\nTry:\n- Check your query is valid (1-500 characters)\n- Verify at least one platform is accessible\n- Check API keys are configured correctly`
    );
  }
}
