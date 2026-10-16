/**
 * Unit tests for citation-parser.ts
 */
import { describe, it, expect } from 'vitest';
import { parseCitationMarkdown } from '../../../src/arabic/parsers/citation-parser';

describe('parseCitationMarkdown', () => {
  describe('APA citation extraction', () => {
    it('should extract APA citation when style is apa', () => {
      const markdown = `
APA
أحمد، محمد. (2023). الذكاء الاصطناعي في التعليم العالي. مجلة البحث العلمي، 15(2)، 100-125.
`;
      const result = parseCitationMarkdown(markdown, 'apa');
      expect(result.apa).toBeDefined();
      expect(result.apa).toContain('أحمد');
      expect(result.mla).toBeUndefined();
    });

    it('should extract APA citation with bold header format', () => {
      const markdown = `
**APA**:
أحمد، محمد. (2023). الذكاء الاصطناعي في التعليم العالي. مجلة البحث العلمي.
`;
      const result = parseCitationMarkdown(markdown, 'apa');
      expect(result.apa).toBeDefined();
    });

    it('should not extract APA when style is mla', () => {
      const markdown = `
APA
أحمد، محمد. (2023). الذكاء الاصطناعي في التعليم العالي.
`;
      const result = parseCitationMarkdown(markdown, 'mla');
      expect(result.apa).toBeUndefined();
    });

    it('should ignore short citations (less than 10 chars)', () => {
      const markdown = `
APA
Short
`;
      const result = parseCitationMarkdown(markdown, 'apa');
      expect(result.apa).toBeUndefined();
    });

    it('should extract APA citation with Arabic header format **APA إسلوب**', () => {
      const markdown = `
**APA إسلوب**

بن ميلود، عبدالقادر سلامي. (2018). التعليم: ملابساته وعلاقته بالتنمية. مجلة البحث العلمي.

**MLA إسلوب**

بن ميلود، عبدالقادر سلامي. "التعليم: ملابساته وعلاقته بالتنمية."

تنبيه: هذه الاقتباسات قد لا تكون دقيقة 100%.
`;
      const result = parseCitationMarkdown(markdown, 'apa');
      expect(result.apa).toBeDefined();
      expect(result.apa).toContain('بن ميلود');
      expect(result.apa).toContain('(2018)');
      expect(result.apa).not.toContain('MLA');
      expect(result.apa).not.toContain('تنبيه');
    });
  });

  describe('MLA citation extraction', () => {
    it('should extract MLA citation when style is mla', () => {
      const markdown = `
MLA
أحمد، محمد. "الذكاء الاصطناعي في التعليم العالي." مجلة البحث العلمي 15.2 (2023): 100-125.
`;
      const result = parseCitationMarkdown(markdown, 'mla');
      expect(result.mla).toBeDefined();
      expect(result.mla).toContain('أحمد');
      expect(result.apa).toBeUndefined();
    });

    it('should extract MLA citation with bold header format', () => {
      const markdown = `
**MLA**:
أحمد، محمد. "الذكاء الاصطناعي في التعليم العالي." مجلة البحث العلمي.
`;
      const result = parseCitationMarkdown(markdown, 'mla');
      expect(result.mla).toBeDefined();
    });

    it('should extract MLA citation with Arabic header format **MLA إسلوب**', () => {
      const markdown = `
**APA إسلوب**

بن ميلود، عبدالقادر سلامي. (2018). التعليم: ملابساته وعلاقته بالتنمية.

**MLA إسلوب**

بن ميلود، عبدالقادر سلامي. "التعليم: ملابساته وعلاقته بالتنمية." مجلة البحث العلمي 15.2 (2018): 100-125.

تنبيه: هذه الاقتباسات قد لا تكون دقيقة 100%.
`;
      const result = parseCitationMarkdown(markdown, 'mla');
      expect(result.mla).toBeDefined();
      expect(result.mla).toContain('بن ميلود');
      expect(result.mla).toContain('"التعليم');
      expect(result.mla).not.toContain('APA');
      expect(result.mla).not.toContain('تنبيه');
    });
  });

  describe('both citations extraction', () => {
    it('should extract both APA and MLA when style is all', () => {
      const markdown = `
APA
أحمد، محمد. (2023). الذكاء الاصطناعي في التعليم العالي. مجلة البحث العلمي، 15(2)، 100-125.

MLA
أحمد، محمد. "الذكاء الاصطناعي في التعليم العالي." مجلة البحث العلمي 15.2 (2023): 100-125.
`;
      const result = parseCitationMarkdown(markdown, 'all');
      expect(result.apa).toBeDefined();
      expect(result.mla).toBeDefined();
    });

    it('should extract both citations with Arabic إسلوب headers', () => {
      const markdown = `
**APA إسلوب**

بن ميلود، عبدالقادر سلامي. (2018). التعليم: ملابساته وعلاقته بالتنمية. مجلة البحث العلمي، 15(2)، 100-125.

**MLA إسلوب**

بن ميلود، عبدالقادر سلامي. "التعليم: ملابساته وعلاقته بالتنمية." مجلة البحث العلمي 15.2 (2018): 100-125.

تنبيه: هذه الاقتباسات قد لا تكون دقيقة 100%.
`;
      const result = parseCitationMarkdown(markdown, 'all');
      expect(result.apa).toBeDefined();
      expect(result.mla).toBeDefined();
      expect(result.apa).toContain('(2018)');
      expect(result.mla).toContain('"التعليم');
    });
  });

  describe('citation cleaning', () => {
    it('should normalize whitespace in citations', () => {
      const markdown = `
APA
أحمد،    محمد.   (2023).   الذكاء   الاصطناعي   في   التعليم   العالي.
`;
      const result = parseCitationMarkdown(markdown, 'apa');
      expect(result.apa).not.toContain('   ');
    });

    it('should remove pipe characters from citations', () => {
      const markdown = `
APA
|أحمد، محمد. (2023). الذكاء الاصطناعي في التعليم العالي.|
`;
      const result = parseCitationMarkdown(markdown, 'apa');
      expect(result.apa).not.toMatch(/^\|/);
      expect(result.apa).not.toMatch(/\|$/);
    });
  });

  describe('edge cases', () => {
    it('should return empty object when no citations found', () => {
      const markdown = `Some random content without citations`;
      const result = parseCitationMarkdown(markdown, 'all');
      expect(result).toEqual({});
    });

    it('should handle empty markdown', () => {
      const result = parseCitationMarkdown('', 'all');
      expect(result).toEqual({});
    });
  });
});