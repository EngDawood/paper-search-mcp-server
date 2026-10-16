/**
 * Filters formatters
 */
import {
  LANGUAGES,
  CONTENT_TYPES,
  SEARCH_FIELDS,
  SORT_OPTIONS,
  CONTENT_TYPES_ENGLISH_TO_ARABIC
} from "../../constants";

/**
 * Format available filters as Markdown
 */
export function formatFiltersMarkdown(filterType: string): string {
  const lines: string[] = [];

  lines.push("# Arabic Scholar Search Filters");
  lines.push("");

  if (filterType === "all" || filterType === "languages") {
    lines.push("## Languages");
    lines.push("");
    lines.push("Available language filters:");
    lines.push("");
    for (const key of Object.keys(LANGUAGES)) {
      lines.push(`- \`${key}\``);
    }
    lines.push("");
  }

  if (filterType === "all" || filterType === "content_types") {
    lines.push("## Content Types");
    lines.push("");
    lines.push("Use these English names in the `content_types` parameter:");
    lines.push("");
    for (const [english, arabic] of Object.entries(CONTENT_TYPES_ENGLISH_TO_ARABIC)) {
      const description = CONTENT_TYPES[arabic as keyof typeof CONTENT_TYPES];
      lines.push(`- \`${english}\` - ${description} (${arabic})`);
    }
    lines.push("");
  }

  if (filterType === "all" || filterType === "search_fields") {
    lines.push("## Search Fields");
    lines.push("");
    lines.push("Available fields for the `search_field` parameter:");
    lines.push("");
    for (const key of Object.keys(SEARCH_FIELDS)) {
      lines.push(`- \`${key}\``);
    }
    lines.push("");
  }

  if (filterType === "all" || filterType === "sort_options") {
    lines.push("## Sort Options");
    lines.push("");
    lines.push("Available options for the `sort` parameter:");
    lines.push("");
    for (const [key, value] of Object.entries(SORT_OPTIONS)) {
      lines.push(`- \`${key}\` - ${value}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Format filters as JSON
 */
export function formatFiltersJson(filterType: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  if (filterType === "all" || filterType === "languages") {
    result.languages = Object.keys(LANGUAGES);
  }

  if (filterType === "all" || filterType === "content_types") {
    result.content_types = Object.fromEntries(
      Object.entries(CONTENT_TYPES_ENGLISH_TO_ARABIC).map(([en, ar]) => [
        en,
        { arabic: ar, description: CONTENT_TYPES[ar as keyof typeof CONTENT_TYPES] }
      ])
    );
  }

  if (filterType === "all" || filterType === "search_fields") {
    result.search_fields = Object.keys(SEARCH_FIELDS);
  }

  if (filterType === "all" || filterType === "sort_options") {
    result.sort_options = SORT_OPTIONS;
  }

  return result;
}
