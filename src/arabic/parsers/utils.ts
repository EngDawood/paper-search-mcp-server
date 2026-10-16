/**
 * Shared utility functions for markdown parsing
 */

/**
 * Clean up extracted value - remove pipes, br tags, extra whitespace
 */
export function cleanValue(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value
    .replace(/<br\s*\/?>/gi, ' ')      // Remove <br> tags
    .replace(/\\\s*$/g, '')             // Remove trailing backslashes
    .replace(/^\|+|\|+$/g, '')          // Remove leading/trailing pipes
    .replace(/\s*\|\s*/g, ' ')          // Replace internal pipes with space
    .replace(/\s+/g, ' ')               // Normalize whitespace
    .trim();
}
