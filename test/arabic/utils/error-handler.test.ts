/**
 * Unit tests for error-handler.ts
 */
import { describe, it, expect } from 'vitest';
import {
  ScholarError,
  ScholarErrorType,
  detectErrorType,
  getErrorMessage,
  handleScholarError,
  validateScrapeResult
} from '../../../src/arabic/utils/error-handler';

describe('ScholarError', () => {
  it('should create error with type and message', () => {
    const error = new ScholarError('Test message', ScholarErrorType.RateLimit);
    expect(error.message).toBe('Test message');
    expect(error.type).toBe(ScholarErrorType.RateLimit);
    expect(error.name).toBe('ScholarError');
  });

  it('should store original error', () => {
    const originalError = new Error('Original');
    const error = new ScholarError('Wrapped', ScholarErrorType.Unknown, originalError);
    expect(error.originalError).toBe(originalError);
  });
});

describe('detectErrorType', () => {
  it('should detect rate limit errors', () => {
    expect(detectErrorType(new Error('rate limit exceeded'))).toBe(ScholarErrorType.RateLimit);
    expect(detectErrorType(new Error('Error 429: Too Many Requests'))).toBe(ScholarErrorType.RateLimit);
  });

  it('should detect timeout errors', () => {
    expect(detectErrorType(new Error('request timeout'))).toBe(ScholarErrorType.Timeout);
    expect(detectErrorType(new Error('Connection timeout after 30s'))).toBe(ScholarErrorType.Timeout);
  });

  it('should detect not found errors', () => {
    expect(detectErrorType(new Error('404 Not Found'))).toBe(ScholarErrorType.NotFound);
    expect(detectErrorType(new Error('Resource not found'))).toBe(ScholarErrorType.NotFound);
  });

  it('should detect scrape failed errors', () => {
    expect(detectErrorType(new Error('Scrape failed for URL'))).toBe(ScholarErrorType.ScrapeFailed);
  });

  it('should return unknown for unrecognized errors', () => {
    expect(detectErrorType(new Error('Some random error'))).toBe(ScholarErrorType.Unknown);
  });
});

describe('getErrorMessage', () => {
  it('should return rate limit message', () => {
    const message = getErrorMessage(ScholarErrorType.RateLimit, 'search');
    expect(message).toContain('Rate limit');
  });

  it('should return timeout message', () => {
    const message = getErrorMessage(ScholarErrorType.Timeout, 'record');
    expect(message).toContain('timed out');
  });

  it('should return not found message with context', () => {
    const message = getErrorMessage(ScholarErrorType.NotFound, 'Record 123');
    expect(message).toContain('Record 123');
    expect(message).toContain('not found');
  });

  it('should return no data message with context', () => {
    const message = getErrorMessage(ScholarErrorType.NoData, 'record 456');
    expect(message).toContain('record 456');
  });
});

describe('handleScholarError', () => {
  it('should re-throw ScholarError unchanged', () => {
    const original = new ScholarError('Test', ScholarErrorType.RateLimit);
    expect(() => handleScholarError(original, 'test')).toThrow(original);
  });

  it('should convert rate limit Error to ScholarError', () => {
    const original = new Error('429 rate limit');
    try {
      handleScholarError(original, 'search');
    } catch (error) {
      expect(error).toBeInstanceOf(ScholarError);
      expect((error as ScholarError).type).toBe(ScholarErrorType.RateLimit);
    }
  });

  it('should include identifier in not found errors', () => {
    const original = new Error('404 not found');
    try {
      handleScholarError(original, 'Record', '123456');
    } catch (error) {
      expect(error).toBeInstanceOf(ScholarError);
      expect((error as ScholarError).message).toContain('123456');
    }
  });

  it('should include original message for unknown errors', () => {
    const original = new Error('Specific error details');
    try {
      handleScholarError(original, 'operation');
    } catch (error) {
      expect(error).toBeInstanceOf(ScholarError);
      expect((error as ScholarError).message).toContain('Specific error details');
    }
  });

  it('should handle non-Error objects', () => {
    try {
      handleScholarError('string error', 'test');
    } catch (error) {
      expect(error).toBeInstanceOf(ScholarError);
      expect((error as ScholarError).type).toBe(ScholarErrorType.Unknown);
    }
  });
});

describe('validateScrapeResult', () => {
  it('should return markdown for successful scrape', () => {
    const result = {
      success: true,
      markdown: 'A'.repeat(150)
    };
    expect(validateScrapeResult(result, 'test')).toBe(result.markdown);
  });

  it('should throw on unsuccessful scrape', () => {
    const result = {
      success: false,
      error: 'Connection failed'
    };
    expect(() => validateScrapeResult(result, 'test')).toThrow(ScholarError);
    try {
      validateScrapeResult(result, 'test');
    } catch (error) {
      expect((error as ScholarError).type).toBe(ScholarErrorType.ScrapeFailed);
      expect((error as ScholarError).message).toContain('Connection failed');
    }
  });

  it('should throw on empty markdown', () => {
    const result = {
      success: true,
      markdown: ''
    };
    expect(() => validateScrapeResult(result, 'record')).toThrow(ScholarError);
    try {
      validateScrapeResult(result, 'record');
    } catch (error) {
      expect((error as ScholarError).type).toBe(ScholarErrorType.NoData);
    }
  });

  it('should throw on markdown below minimum length', () => {
    const result = {
      success: true,
      markdown: 'Short content'
    };
    expect(() => validateScrapeResult(result, 'record', 100)).toThrow(ScholarError);
  });

  it('should accept custom minimum length', () => {
    const result = {
      success: true,
      markdown: 'Short but ok'
    };
    expect(validateScrapeResult(result, 'test', 10)).toBe(result.markdown);
  });
});
