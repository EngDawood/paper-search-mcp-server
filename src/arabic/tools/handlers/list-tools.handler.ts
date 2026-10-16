/**
 * Handler for the list_tools tool
 */
import { CORE_OPEN_ACCESS_KEYS, OPT_IN_OPEN_ACCESS_KEYS } from "../../constants";
import type { ListToolsInput } from "../../schemas/index";
import { ResponseFormat } from "../../types";
import { buildResponse } from "../response-builder";
import type { ToolResponse } from "../types";

/** Static metadata for all available tools */
const TOOLS_METADATA = [
  {
    name: "search_arabic_papers",
    title: "Unified Arabic Papers Search",
    description: `Search for Arabic academic papers across multiple sources simultaneously - Mandumah database and open-access repositories. Default: Mandumah + ${CORE_OPEN_ACCESS_KEYS.join(", ")}. Also available by name: ${OPT_IN_OPEN_ACCESS_KEYS.join(", ")}.`,
    category: "search",
    requiresApiKeys: ["FIRECRAWL_API_KEY or EXA_API_KEY (at least one)"]
  },
  {
    name: "list_tools",
    title: "List Available Tools",
    description: "List all available MCP tools in this server with their names, descriptions, and requirements. This utility tool helps discover available functionality.",
    category: "utility",
    requiresApiKeys: []
  },
  {
    name: "get_pdf_url",
    title: "Get PDF URL",
    description: "Extract direct PDF download URL from an article landing page. Supports ASJP and SHAMAA sources. Complements find_paper_pdf by extracting actual PDF URLs from landing pages.",
    category: "pdf",
    requiresApiKeys: ["EXA_API_KEY"]
  },
  {
    name: "mandumah_search",
    title: "Search Mandumah Database",
    description: "Search the Mandumah (دار المنظومة) Arabic academic database with advanced filters (language, content type, date range, peer review). Returns search results with metadata.",
    category: "search",
    requiresApiKeys: ["FIRECRAWL_API_KEY"]
  },
  {
    name: "mandumah_get_record",
    title: "Get Mandumah Record Details",
    description: "Get detailed metadata for a specific Mandumah record by ID or URL. Returns comprehensive information including title, authors, abstract, subjects, and related items.",
    category: "metadata",
    requiresApiKeys: ["FIRECRAWL_API_KEY"]
  },
  {
    name: "mandumah_list_filters",
    title: "List Mandumah Filter Options",
    description: "List available filter options for Mandumah searches (languages, content types, search fields, sort options). No API key required - returns static reference data.",
    category: "utility",
    requiresApiKeys: []
  },
  {
    name: "mandumah_get_citation",
    title: "Get Citation",
    description: "Get formatted citations (APA, MLA, or both) for a Mandumah record. Supports both record IDs and full URLs.",
    category: "metadata",
    requiresApiKeys: ["FIRECRAWL_API_KEY"]
  }
];

const CATEGORIES = ["search", "metadata", "pdf", "utility"] as const;

const CATEGORY_LABELS: Record<string, string> = {
  search: "Search Tools",
  metadata: "Metadata Tools",
  pdf: "PDF Tools",
  utility: "Utility Tools"
};

const CATEGORY_LABELS_UPPER: Record<string, string> = {
  search: "SEARCH TOOLS",
  metadata: "METADATA TOOLS",
  pdf: "PDF TOOLS",
  utility: "UTILITY TOOLS"
};

function formatToolsMarkdown(data: { tools: typeof TOOLS_METADATA; totalTools: number }): string {
  let markdown = "# Available MCP Tools\n\n";
  markdown += `**Total tools:** ${data.totalTools}\n\n`;

  for (const category of CATEGORIES) {
    const categoryTools = data.tools.filter(t => t.category === category);
    if (categoryTools.length === 0) continue;

    markdown += `## ${CATEGORY_LABELS[category]}\n\n`;

    for (const tool of categoryTools) {
      markdown += `### ${tool.name}\n\n`;
      markdown += `**${tool.title}**\n\n`;
      markdown += `${tool.description}\n\n`;
      markdown += `**Required API Keys:** ${tool.requiresApiKeys.length > 0 ? tool.requiresApiKeys.join(", ") : "None"}\n\n`;
      markdown += "---\n\n";
    }
  }

  return markdown.trim();
}

function formatToolsText(data: { tools: typeof TOOLS_METADATA; totalTools: number }): string {
  const separator = "=".repeat(50);
  let text = "AVAILABLE MCP TOOLS\n" + separator + "\n\n";
  text += `Total tools: ${data.totalTools}\n\n`;

  for (const category of CATEGORIES) {
    const categoryTools = data.tools.filter(t => t.category === category);
    if (categoryTools.length === 0) continue;

    text += `${CATEGORY_LABELS_UPPER[category]}\n${separator}\n\n`;

    for (const tool of categoryTools) {
      text += `Tool: ${tool.name}\n`;
      text += `Title: ${tool.title}\n`;
      text += `Description: ${tool.description}\n`;
      text += `Required API Keys: ${tool.requiresApiKeys.length > 0 ? tool.requiresApiKeys.join(", ") : "None"}\n\n`;
    }
  }

  return text.trim();
}

export async function handleListTools(params: ListToolsInput): Promise<ToolResponse> {
  const data = { tools: TOOLS_METADATA, totalTools: TOOLS_METADATA.length };

  return buildResponse(data, params.response_format as ResponseFormat | undefined, {
    markdown: formatToolsMarkdown,
    text: formatToolsText,
  });
}
