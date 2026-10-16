/**
 * Unit tests for record-parser.ts
 */
import { describe, it, expect } from 'vitest';
import { parseRecordMarkdown } from '../../../src/arabic/parsers/record-parser';

describe('parseRecordMarkdown', () => {
  // Test title extraction
  describe('title extraction', () => {
    it('should extract Arabic title from العنوان field', () => {
      const markdown = `العنوان:   الذكاء الاصطناعي في التعليم العالي`;
      const result = parseRecordMarkdown(markdown, '123');
      expect(result.title).toBe('الذكاء الاصطناعي في التعليم العالي');
    });

    it('should extract title from heading with Arabic text', () => {
      const markdown = `# دراسة تحليلية للتعليم الإلكتروني\n\nSome content here`;
      const result = parseRecordMarkdown(markdown, '123');
      expect(result.title).toBe('دراسة تحليلية للتعليم الإلكتروني');
    });

    it('should fallback to Unknown Title when no title found', () => {
      const markdown = `Some random content without title`;
      const result = parseRecordMarkdown(markdown, '123');
      expect(result.title).toBe('Unknown Title');
    });
  });

  // Test alternate title extraction
  describe('alternate title extraction', () => {
    it('should extract English alternate title', () => {
      const markdown = `العنوان بلغة أخرى: Artificial Intelligence in Higher Education`;
      const result = parseRecordMarkdown(markdown, '123');
      expect(result.alternateTitle).toBe('Artificial Intelligence in Higher Education');
    });

    it('should return undefined when no alternate title exists', () => {
      const markdown = `العنوان:   بعض العنوان العربي`;
      const result = parseRecordMarkdown(markdown, '123');
      expect(result.alternateTitle).toBeUndefined();
    });
  });

  // Test author extraction
  describe('author extraction', () => {
    it('should extract main author', () => {
      const markdown = `المؤلف الرئيسي: أحمد محمد علي`;
      const result = parseRecordMarkdown(markdown, '123');
      expect(result.authors).toContain('أحمد محمد علي');
    });

    it('should remove role markers from author names', () => {
      const markdown = `المؤلف الرئيسي: أحمد محمد (مؤلف)`;
      const result = parseRecordMarkdown(markdown, '123');
      expect(result.authors).toContain('أحمد محمد');
      expect(result.authors[0]).not.toContain('(مؤلف)');
    });

    it('should extract multiple other authors', () => {
      const markdown = `مؤلفين آخرين: محمد أحمد (مشرف), سارة علي (مؤلف مشارك)`;
      const result = parseRecordMarkdown(markdown, '123');
      expect(result.authors).toContain('محمد أحمد');
      expect(result.authors).toContain('سارة علي');
    });

    it('should handle comma-separated authors in other authors field', () => {
      const markdown = `مؤلفين آخرين: أحمد محمد (مشرف), سارة علي (مؤلف)`;
      const result = parseRecordMarkdown(markdown, '123');
      expect(result.authors.length).toBeGreaterThanOrEqual(2);
    });

    it('should return Unknown Author when no authors found', () => {
      const markdown = `العنوان: بعض العنوان`;
      const result = parseRecordMarkdown(markdown, '123');
      expect(result.authors).toEqual(['Unknown Author']);
    });
  });

  // Test main author English extraction
  describe('main author English extraction', () => {
    it('should extract English name of main author', () => {
      const markdown = `المؤلف الرئيسي (الإنجليزية): Ahmed Mohamed`;
      const result = parseRecordMarkdown(markdown, '123');
      expect(result.mainAuthorEnglish).toBe('Ahmed Mohamed');
    });
  });

  // Test abstract extraction
  describe('abstract extraction', () => {
    it('should extract abstract from المستخلص field', () => {
      const abstract = 'هذه الدراسة تهدف إلى تحليل أثر التكنولوجيا على التعليم العالي في المملكة العربية السعودية';
      const markdown = `المستخلص: ${abstract}\n\nAnother section`;
      const result = parseRecordMarkdown(markdown, '123');
      expect(result.abstract).toBe(abstract);
    });

    it('should return undefined for short or missing abstracts', () => {
      const markdown = `المستخلص: قصير جدا`;
      const result = parseRecordMarkdown(markdown, '123');
      expect(result.abstract).toBeUndefined();
    });
  });

  // Test subjects extraction
  describe('subjects extraction', () => {
    it('should extract subjects separated by pipe', () => {
      const markdown = `مواضيع: الذكاء الاصطناعي | التعليم العالي | التكنولوجيا`;
      const result = parseRecordMarkdown(markdown, '123');
      expect(result.subjects).toContain('الذكاء الاصطناعي');
      expect(result.subjects).toContain('التعليم العالي');
      expect(result.subjects).toContain('التكنولوجيا');
    });

    it('should handle br tags in subjects', () => {
      const markdown = `مواضيع: الذكاء الاصطناعي<br>التعليم العالي`;
      const result = parseRecordMarkdown(markdown, '123');
      expect(result.subjects?.length).toBeGreaterThanOrEqual(2);
    });
  });

  // Test metadata extraction
  describe('metadata extraction', () => {
    it('should extract year from التاريخ الميلادي', () => {
      const markdown = `التاريخ الميلادي: 2023`;
      const result = parseRecordMarkdown(markdown, '123');
      expect(result.year).toBe('2023');
    });

    it('should extract pages from الصفحات', () => {
      const markdown = `الصفحات: 100 - 125`;
      const result = parseRecordMarkdown(markdown, '123');
      expect(result.pages).toBe('100 - 125');
    });

    it('should extract content type from نوع المحتوى', () => {
      const markdown = `نوع المحتوى: بحوث ومقالات`;
      const result = parseRecordMarkdown(markdown, '123');
      expect(result.contentType).toBe('بحوث ومقالات');
    });

    it('should extract language from اللغة', () => {
      const markdown = `اللغة: العربية`;
      const result = parseRecordMarkdown(markdown, '123');
      expect(result.language).toBe('العربية');
    });

    it('should extract database from قواعد المعلومات', () => {
      const markdown = `قواعد المعلومات: EduSearch`;
      const result = parseRecordMarkdown(markdown, '123');
      expect(result.database).toBe('EduSearch');
    });

    it('should extract ISSN', () => {
      const markdown = `ISSN: 1234-5678`;
      const result = parseRecordMarkdown(markdown, '123');
      expect(result.issn).toBe('1234-5678');
    });

    it('should extract country from الدولة', () => {
      const markdown = `الدولة: مصر`;
      const result = parseRecordMarkdown(markdown, '123');
      expect(result.country).toBe('مصر');
    });
  });

  // Test journal extraction
  describe('journal extraction', () => {
    it('should extract journal from المصدر', () => {
      const markdown = `المصدر: مجلة البحث العلمي`;
      const result = parseRecordMarkdown(markdown, '123');
      expect(result.journal).toBe('مجلة البحث العلمي');
    });

    it('should fallback to المجلة if المصدر not found', () => {
      const markdown = `المجلة: مجلة التربية`;
      const result = parseRecordMarkdown(markdown, '123');
      expect(result.journal).toBe('مجلة التربية');
    });
  });

  // Test peer reviewed extraction
  describe('peer reviewed extraction', () => {
    it('should detect peer reviewed as true when نعم', () => {
      const markdown = `محكمة: نعم`;
      const result = parseRecordMarkdown(markdown, '123');
      expect(result.peerReviewed).toBe(true);
    });

    it('should detect peer reviewed as true when yes', () => {
      const markdown = `محكمة: Yes`;
      const result = parseRecordMarkdown(markdown, '123');
      expect(result.peerReviewed).toBe(true);
    });
  });

  // Test downloads count extraction
  describe('downloads count extraction', () => {
    it('should extract downloads count', () => {
      const markdown = `عدد مرات التحميل\n2500`;
      const result = parseRecordMarkdown(markdown, '123');
      expect(result.downloadsCount).toBe(2500);
    });
  });

  // Test dissertation-specific fields
  describe('dissertation fields extraction', () => {
    it('should extract degree type', () => {
      const markdown = `الدرجة العلمية: ماجستير`;
      const result = parseRecordMarkdown(markdown, '123');
      expect(result.degreeType).toBe('ماجستير');
    });

    it('should extract university', () => {
      const markdown = `الجامعة: جامعة القاهرة`;
      const result = parseRecordMarkdown(markdown, '123');
      expect(result.university).toBe('جامعة القاهرة');
    });

    it('should extract college', () => {
      const markdown = `الكلية: كلية التربية`;
      const result = parseRecordMarkdown(markdown, '123');
      expect(result.college).toBe('كلية التربية');
    });
  });

  // Test similar items extraction
  describe('similar items extraction', () => {
    it('should extract similar items with all fields', () => {
      const markdown = `
عناصر مشابهة

[دراسة مشابهة](https://search.mandumah.com/Record/456789)
بواسطة: محمد أحمد منشور: (2022)
`;
      const result = parseRecordMarkdown(markdown, '123');
      expect(result.similarItems).toBeDefined();
      expect(result.similarItems?.length).toBeGreaterThan(0);
      expect(result.similarItems?.[0].title).toBe('دراسة مشابهة');
      expect(result.similarItems?.[0].id).toBe('456789');
    });
  });

  // Test record ID and URL
  describe('record ID and URL', () => {
    it('should include the provided record ID', () => {
      const markdown = `العنوان: Test`;
      const result = parseRecordMarkdown(markdown, '1199022');
      expect(result.id).toBe('1199022');
    });

    it('should generate correct URL from record ID', () => {
      const markdown = `العنوان: Test`;
      const result = parseRecordMarkdown(markdown, '1199022');
      expect(result.url).toBe('https://search.mandumah.com/Record/1199022');
    });
  });
});

// Real page format (trimmed from https://search.mandumah.com/Record/1649116)
describe('real record page format', () => {
  const markdown = `
| DOI: | 10.37136/1969-017-001-035 |
| ISSN: | 1112-9468 |
| كلمات المؤلف المفتاحية: | ذكاء اصطناعي \\| تعليم لغة عربية \\| Artificial Intelligence |
| رابط المحتوى: | [PDF (صورة)](https://search.mandumah.com/Download?file=S50V+kPw=&id=1649116) |

#### عناصر مشابهة

- [تأثير تطبيقات الذكاء الاصطناعي على تعليم اللغة العربية](https://search.mandumah.com/Record/1559546)

بواسطة: عائشة، سارية عبدالرحمن منشور: (2025)

- [استثمار تطبيقات الذكاء الاصطناعي](https://search.mandumah.com/Record/1596532)

بواسطة: الظفيري، محمد هديني منشور: (2024)

### تواصل معنا
`;

  it('extracts full similar-item authors and years (not a single letter)', () => {
    const items = parseRecordMarkdown(markdown, '1649116').similarItems!;
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ id: '1559546', author: 'عائشة، سارية عبدالرحمن', year: '2025' });
    expect(items[1]).toMatchObject({ id: '1596532', author: 'الظفيري، محمد هديني', year: '2024' });
  });

  it('extracts keywords, download url and DOI', () => {
    const r = parseRecordMarkdown(markdown, '1649116');
    expect(r.keywords).toEqual(['ذكاء اصطناعي', 'تعليم لغة عربية', 'Artificial Intelligence']);
    expect(r.downloadUrl).toBe('https://search.mandumah.com/Download?file=S50V+kPw=&id=1649116');
    expect(r.doi).toBe('10.37136/1969-017-001-035');
  });
});
