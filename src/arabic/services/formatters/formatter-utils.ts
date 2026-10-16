/**
 * Shared formatter utilities
 * Common functions used across multiple formatters to reduce duplication
 */
import { CHARACTER_LIMIT } from "../../constants";

/**
 * Truncate text to a maximum length with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength) + "...";
}

/**
 * Join lines and truncate at CHARACTER_LIMIT if needed
 */
export function finalizeOutput(lines: string[], truncationMessage?: string): string {
  const output = lines.join("\n");
  if (output.length > CHARACTER_LIMIT) {
    const message = truncationMessage || "[Output truncated]";
    return output.substring(0, CHARACTER_LIMIT - message.length - 4) + "\n\n" + message;
  }
  return output;
}
