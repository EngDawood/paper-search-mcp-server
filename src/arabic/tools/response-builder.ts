/**
 * Shared response formatting utility for MCP tool handlers
 * Eliminates the repeated JSON/Text/Markdown format switch in every handler
 */
import { ResponseFormat } from "../types";
import type { ToolResponse } from "./types";

/**
 * Build a formatted MCP tool response based on the requested format
 */
export function buildResponse<T>(
  data: T,
  format: ResponseFormat | undefined,
  formatters: {
    markdown: (data: T) => string;
    text: (data: T) => string;
  }
): ToolResponse {
  if (format === ResponseFormat.JSON) {
    return {
      content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      structuredContent: data as { [key: string]: unknown },
    };
  }

  if (format === ResponseFormat.TEXT) {
    return {
      content: [{ type: "text" as const, text: formatters.text(data) }],
    };
  }

  // Default: markdown
  return {
    content: [{ type: "text" as const, text: formatters.markdown(data) }],
  };
}

/**
 * Build a standard MCP error response
 */
export function buildErrorResponse(message: string): ToolResponse {
  return {
    isError: true,
    content: [{ type: "text" as const, text: message }],
  };
}
