import { z } from "zod";
import { ResponseFormat } from "../types";

/**
 * Schema for list_tools utility tool
 */
export const ListToolsInputSchema = z.object({
  response_format: z.enum(ResponseFormat)
    .default(ResponseFormat.MARKDOWN)
    .describe("Output format: 'markdown' (formatted), 'json' (structured), or 'text' (plain text)")
}).strict();

export type ListToolsInput = z.infer<typeof ListToolsInputSchema>;
