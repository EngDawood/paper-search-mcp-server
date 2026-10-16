/**
 * Handler for the mandumah_get_record tool
 */
import type { ScholarGetRecordInput } from "../../schemas/index";
import { getScholarRecord } from "../../services/scholar-client";
import { formatRecordDetailMarkdown, formatRecordDetailText } from "../../services/formatters";
import { buildResponse, buildErrorResponse } from "../response-builder";
import type { ToolHandlerDeps, ToolResponse } from "../types";

export async function handleMandumahGetRecord(
  params: ScholarGetRecordInput,
  deps: ToolHandlerDeps
): Promise<ToolResponse> {
  try {
    const record = await getScholarRecord(params.record_id, deps.firecrawlKey!);

    return buildResponse(record, params.response_format, {
      markdown: formatRecordDetailMarkdown,
      text: formatRecordDetailText,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error occurred";
    return buildErrorResponse(`Error fetching record: ${message}`);
  }
}
