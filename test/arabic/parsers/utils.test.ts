/**
 * Unit tests for parser utils
 */
import { describe, it, expect } from 'vitest';
import { cleanValue } from '../../../src/arabic/parsers/utils';

describe('cleanValue', () => {
  describe('basic functionality', () => {
    it('should return undefined for undefined input', () => {
      expect(cleanValue(undefined)).toBeUndefined();
    });

    it('should return undefined for empty string', () => {
      expect(cleanValue('')).toBeUndefined();
    });

    it('should trim whitespace', () => {
      expect(cleanValue('  hello world  ')).toBe('hello world');
    });

    it('should return clean value unchanged', () => {
      expect(cleanValue('hello world')).toBe('hello world');
    });
  });

  describe('br tag removal', () => {
    it('should remove <br> tags', () => {
      expect(cleanValue('hello<br>world')).toBe('hello world');
    });

    it('should remove <br/> tags', () => {
      expect(cleanValue('hello<br/>world')).toBe('hello world');
    });

    it('should remove <br /> tags with space', () => {
      expect(cleanValue('hello<br />world')).toBe('hello world');
    });

    it('should be case insensitive for br tags', () => {
      expect(cleanValue('hello<BR>world')).toBe('hello world');
    });
  });

  describe('pipe removal', () => {
    it('should remove leading pipes', () => {
      expect(cleanValue('||hello world')).toBe('hello world');
    });

    it('should remove trailing pipes', () => {
      expect(cleanValue('hello world||')).toBe('hello world');
    });

    it('should replace internal pipes with space', () => {
      expect(cleanValue('hello | world')).toBe('hello world');
    });

    it('should handle multiple internal pipes', () => {
      expect(cleanValue('a | b | c')).toBe('a b c');
    });
  });

  describe('backslash removal', () => {
    it('should remove trailing backslashes', () => {
      expect(cleanValue('hello world\\ ')).toBe('hello world');
    });

    it('should remove multiple trailing backslashes', () => {
      expect(cleanValue('hello\\  ')).toBe('hello');
    });
  });

  describe('whitespace normalization', () => {
    it('should normalize multiple spaces to single space', () => {
      expect(cleanValue('hello    world')).toBe('hello world');
    });

    it('should normalize tabs to spaces', () => {
      expect(cleanValue('hello\tworld')).toBe('hello world');
    });

    it('should normalize newlines to spaces', () => {
      expect(cleanValue('hello\nworld')).toBe('hello world');
    });
  });

  describe('combined operations', () => {
    it('should handle complex input with multiple issues', () => {
      const input = '||  hello<br>  world  | test  ||';
      expect(cleanValue(input)).toBe('hello world test');
    });

    it('should handle Arabic text', () => {
      const input = '  الذكاء الاصطناعي  ';
      expect(cleanValue(input)).toBe('الذكاء الاصطناعي');
    });

    it('should handle Arabic text with pipes', () => {
      const input = '| الذكاء | الاصطناعي |';
      expect(cleanValue(input)).toBe('الذكاء الاصطناعي');
    });
  });
});
