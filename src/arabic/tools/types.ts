/**
 * Shared types for tool handlers
 */

/**
 * Dependencies injected into tool handlers
 */
export interface ToolHandlerDeps {
  firecrawlKey?: string;
  exaApiKey?: string;
  hasFirecrawl: boolean;
}

/**
 * Standard MCP tool response
 */
export interface ToolResponse {
  [key: string]: unknown;
  isError?: boolean;
  content: Array<{ type: "text"; text: string }>;
  structuredContent?: { [key: string]: unknown };
}
