/**
 * Shared error handling utilities for Scholar client operations
 */

/**
 * Error types that can be identified and handled
 */
export enum ScholarErrorType {
  RateLimit = "RATE_LIMIT",
  Timeout = "TIMEOUT",
  NotFound = "NOT_FOUND",
  ScrapeFailed = "SCRAPE_FAILED",
  NoData = "NO_DATA",
  Unknown = "UNKNOWN"
}

/**
 * Custom error class for Scholar operations
 */
export class ScholarError extends Error {
  constructor(
    message: string,
    public readonly type: ScholarErrorType,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = "ScholarError";
  }
}

/**
 * Detect the type of error from an error message
 */
export function detectErrorType(error: Error): ScholarErrorType {
  const message = error.message.toLowerCase();

  if (message.includes("rate limit") || message.includes("429")) {
    return ScholarErrorType.RateLimit;
  }

  if (message.includes("timeout")) {
    return ScholarErrorType.Timeout;
  }

  if (message.includes("404") || message.includes("not found")) {
    return ScholarErrorType.NotFound;
  }

  if (message.includes("scrape failed")) {
    return ScholarErrorType.ScrapeFailed;
  }

  return ScholarErrorType.Unknown;
}

/**
 * Get user-friendly error message based on error type
 */
export function getErrorMessage(type: ScholarErrorType, context: string): string {
  switch (type) {
    case ScholarErrorType.RateLimit:
      return "Rate limit exceeded. Please wait before making more requests.";
    case ScholarErrorType.Timeout:
      return "Request timed out. The Mandumah server may be slow. Try again later.";
    case ScholarErrorType.NotFound:
      return `${context} not found.`;
    case ScholarErrorType.ScrapeFailed:
      return `Failed to retrieve data from Mandumah.`;
    case ScholarErrorType.NoData:
      return `No data retrieved for ${context}.`;
    default:
      return `Failed to process ${context}.`;
  }
}

/**
 * Handle errors from Scholar client operations
 * Converts raw errors into user-friendly ScholarError instances
 */
export function handleScholarError(
  error: unknown,
  context: string,
  identifier?: string
): never {
  if (error instanceof ScholarError) {
    throw error;
  }

  if (error instanceof Error) {
    const errorType = detectErrorType(error);
    const contextWithId = identifier ? `${context} ${identifier}` : context;

    if (errorType === ScholarErrorType.NotFound && identifier) {
      throw new ScholarError(
        `${context} not found: ${identifier}`,
        errorType,
        error
      );
    }

    const message = getErrorMessage(errorType, contextWithId);

    if (errorType === ScholarErrorType.Unknown) {
      throw new ScholarError(
        `${message}: ${error.message}`,
        errorType,
        error
      );
    }

    throw new ScholarError(message, errorType, error);
  }

  throw new ScholarError(
    `Unexpected error processing ${context}`,
    ScholarErrorType.Unknown
  );
}

/**
 * Validate scrape result and throw appropriate error if failed
 */
export function validateScrapeResult(
  result: { success: boolean; error?: string; markdown?: string },
  context: string,
  minLength: number = 100
): string {
  if (!result.success) {
    throw new ScholarError(
      `Firecrawl scrape failed: ${result.error || "Unknown error"}`,
      ScholarErrorType.ScrapeFailed
    );
  }

  const markdown = result.markdown || "";

  if (!markdown || markdown.length < minLength) {
    throw new ScholarError(
      `No data retrieved for ${context}`,
      ScholarErrorType.NoData
    );
  }

  return markdown;
}
