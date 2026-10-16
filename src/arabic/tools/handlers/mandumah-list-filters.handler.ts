/**
 * Handler for the mandumah_list_filters tool
 */
import type { ScholarListFiltersInput } from "../../schemas/index";
import { formatFiltersMarkdown, formatFiltersJson } from "../../services/formatters";
import type { ToolResponse } from "../types";

export async function handleMandumahListFilters(
  params: ScholarListFiltersInput
): Promise<ToolResponse> {
  const filterType = params.filter_type || "all";

  const markdown = formatFiltersMarkdown(filterType);
  const json = formatFiltersJson(filterType);

  return {
    content: [{ type: "text" as const, text: markdown }],
    structuredContent: json,
  };
}
