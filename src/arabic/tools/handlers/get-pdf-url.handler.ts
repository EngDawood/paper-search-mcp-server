/**
 * Handler for the get_pdf_url tool
 */
import type { GetPdfUrlInput } from "../../schemas/index";
import { getPdfUrl } from "../../services/pdf-extractor";
import { formatGetPdfUrlMarkdown, formatGetPdfUrlText } from "../../services/formatters";
import { buildResponse, buildErrorResponse } from "../response-builder";
import type { ToolHandlerDeps, ToolResponse } from "../types";

export async function handleGetPdfUrl(
  params: GetPdfUrlInput,
  deps: ToolHandlerDeps
): Promise<ToolResponse> {
  if (!deps.exaApiKey) {
    return buildErrorResponse(
      "Error: EXA_API_KEY is not configured. This tool requires an Exa API key to extract PDF URLs.\n\nTo use this tool, set the EXA_API_KEY environment variable."
    );
  }

  try {
    const response = await getPdfUrl(params.url, deps.exaApiKey);

    return buildResponse(response, params.response_format, {
      markdown: formatGetPdfUrlMarkdown,
      text: formatGetPdfUrlText,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error occurred";
    return buildErrorResponse(
      `Error extracting PDF URL: ${message}\n\nTry:\n- Check the URL is valid and accessible\n- Verify the source is supported (ASJP, SHAMAA)`
    );
  }
}
