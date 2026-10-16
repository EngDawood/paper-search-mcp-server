/**
 * Unit tests for search-parser.ts
 */
import { describe, it, expect } from 'vitest';
import { parseSearchMarkdown } from '../../../src/arabic/parsers/search-parser';

describe('parseSearchMarkdown', () => {
  describe('total count extraction', () => {
    it('should extract total results count from bold pattern', () => {
      const markdown = `نتائج البحث من **10457**`;
      const result = parseSearchMarkdown(markdown);
      expect(result.total).toBe(10457);
    });

    it('should handle comma-separated numbers', () => {
      const markdown = `نتائج البحث من **1,234,567**`;
      const result = parseSearchMarkdown(markdown);
      expect(result.total).toBe(1234567);
    });

    it('should return results length as total when no total found', () => {
      const markdown = `[العنوان الأول](https://search.mandumah.com/Record/123456)`;
      const result = parseSearchMarkdown(markdown);
      expect(result.total).toBe(result.results.length);
    });
  });

  describe('search results extraction', () => {
    it('should extract record ID and title from Record links', () => {
      const markdown = `
[الذكاء الاصطناعي في التعليم العالي](https://search.mandumah.com/Record/123456)
`;
      const result = parseSearchMarkdown(markdown);
      expect(result.results.length).toBe(1);
      expect(result.results[0].id).toBe('123456');
      expect(result.results[0].title).toBe('الذكاء الاصطناعي في التعليم العالي');
    });

    it('should generate correct URL for each result', () => {
      const markdown = `[العنوان](https://search.mandumah.com/Record/789012)`;
      const result = parseSearchMarkdown(markdown);
      expect(result.results[0].url).toBe('https://search.mandumah.com/Record/789012');
    });

    it('should extract multiple results', () => {
      const markdown = `
[العنوان الأول](https://search.mandumah.com/Record/111111)
Some content
[العنوان الثاني](https://search.mandumah.com/Record/222222)
`;
      const result = parseSearchMarkdown(markdown);
      expect(result.results.length).toBe(2);
      expect(result.results[0].id).toBe('111111');
      expect(result.results[1].id).toBe('222222');
    });

    it('should skip duplicate record IDs', () => {
      const markdown = `
[العنوان الأول](https://search.mandumah.com/Record/123456)
[نفس العنوان](https://search.mandumah.com/Record/123456)
`;
      const result = parseSearchMarkdown(markdown);
      expect(result.results.length).toBe(1);
    });

    it('should skip titles shorter than 5 characters', () => {
      const markdown = `[أب](https://search.mandumah.com/Record/123456)`;
      const result = parseSearchMarkdown(markdown);
      expect(result.results.length).toBe(0);
    });
  });

  describe('author extraction', () => {
    it('should extract author from table format', () => {
      const markdown = `
[العنوان](https://search.mandumah.com/Record/123456)
| **المؤلف:** | [أحمد محمد](https://link) |
`;
      const result = parseSearchMarkdown(markdown);
      expect(result.results[0].authors).toContain('أحمد محمد');
    });

    it('should default to Unknown Author when no author found', () => {
      const markdown = `[العنوان الطويل](https://search.mandumah.com/Record/123456)`;
      const result = parseSearchMarkdown(markdown);
      expect(result.results[0].authors).toEqual(['Unknown Author']);
    });
  });

  describe('metadata extraction', () => {
    it('should extract year from table format', () => {
      const markdown = `
[العنوان](https://search.mandumah.com/Record/123456)
| **تاريخ:** | 2023 |
`;
      const result = parseSearchMarkdown(markdown);
      expect(result.results[0].year).toBe('2023');
    });

    it('should extract content type from table format', () => {
      const markdown = `
[العنوان](https://search.mandumah.com/Record/123456)
| **نوع المحتوى:** | بحوث ومقالات |
`;
      const result = parseSearchMarkdown(markdown);
      expect(result.results[0].contentType).toBe('بحوث ومقالات');
    });

    it('should extract journal from table format', () => {
      const markdown = `
[العنوان](https://search.mandumah.com/Record/123456)
| **المصدر:** | [مجلة البحث العلمي](https://link) |
`;
      const result = parseSearchMarkdown(markdown);
      expect(result.results[0].journal).toBe('مجلة البحث العلمي');
    });
  });

  describe('edge cases', () => {
    it('should return empty results for empty markdown', () => {
      const result = parseSearchMarkdown('');
      expect(result.results).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should return empty results for markdown without Record links', () => {
      const result = parseSearchMarkdown('Some random content without any links');
      expect(result.results).toEqual([]);
    });

    it('should handle markdown with only navigation links (short titles)', () => {
      const markdown = `
[1](https://search.mandumah.com/Record/123)
[<<](https://search.mandumah.com/Record/456)
`;
      const result = parseSearchMarkdown(markdown);
      expect(result.results.length).toBe(0);
    });
  });
});

import { parseSearchHtml, parseSearchPage } from '../../../src/arabic/parsers/search-parser';

describe('parseSearchHtml', () => {
  const block = (id: string, titleHtml: string) => `
<div class="result sourcemandumah recordId ajaxItemId">
  <div class="span-9"><div class="resultItemLine1">
    <a href="https://search.mandumah.com/Record/${id}" class="title">${titleHtml}</a>
  </div></div>
  <div class="span-14"><table class="result-list-table"><tbody>
    <tr><td><strong>المؤلف: </strong></td><td><a href="https://search.mandumah.com/Author/Home?author=x">بكر، عبدالجواد السيد، ت. 2021 م.</a></td></tr>
    <tr><td><strong><strong>المصدر: </strong></strong></td><td><a href="https://x?a=1&amp;b=2">مجلة التربية</a> , ع184</td></tr>
    <tr><td><strong>الناشر: </strong></td><td>جامعة الأزهر &amp; شركاه</td></tr>
    <tr><td><strong>تاريخ: </strong></td><td>2019</td></tr>
    <tr><td><strong>نوع المحتوى: </strong></td><td>بحوث ومقالات</td></tr>
    <tr><td><strong>المستخلص:</strong></td><td> هدفت الورقة...<a href="https://search.mandumah.com/Record/${id}/Description#tabnav">المستخلص الكامل</a></td></tr>
    <tr><td colspan="2"><a class="downloadPdfImg" href="https://search.mandumah.com/Download?file=abc=&amp;id=${id}" target="mandumah">PDF</a></td></tr>
  </tbody></table></div>
</div>`;

  it('keeps spaces around highlighted terms', () => {
    const html = block('1', 'ال<span class="highlight">ذكاء</span> ال<span class="highlight">اصطناعي</span> <span class="highlight">في</span> ال<span class="highlight">تعليم</span>');
    expect(parseSearchHtml(html)[0].title).toBe('الذكاء الاصطناعي في التعليم');
  });

  it('extracts metadata, abstract and download link', () => {
    const r = parseSearchHtml(block('1048275', 'عنوان'))[0];
    expect(r).toMatchObject({
      id: '1048275',
      authors: ['بكر، عبدالجواد السيد'],
      journal: 'مجلة التربية',
      issue: 'ع184',
      publisher: 'جامعة الأزهر & شركاه',
      year: '2019',
      contentType: 'بحوث ومقالات',
      abstract: 'هدفت الورقة...',
      downloadUrl: 'https://search.mandumah.com/Download?file=abc=&id=1048275',
      url: 'https://search.mandumah.com/Record/1048275'
    });
  });

  it('skips duplicate ids and returns [] for unrelated html', () => {
    expect(parseSearchHtml(block('1', 'a') + block('1', 'b'))).toHaveLength(1);
    expect(parseSearchHtml('<html></html>')).toEqual([]);
  });

  it('parseSearchPage prefers html results but keeps the markdown total', () => {
    const page = parseSearchPage('من **4367**', block('1', 'عنوان'));
    expect(page.total).toBe(4367);
    expect(page.results[0].title).toBe('عنوان');
  });

  it('parseSearchPage falls back to markdown when html has no results', () => {
    const page = parseSearchPage('[العنوان الأول](https://search.mandumah.com/Record/123456)', '<html></html>');
    expect(page.results[0].id).toBe('123456');
  });
});
