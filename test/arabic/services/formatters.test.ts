/**
 * Unit tests for formatters.ts
 */
import { describe, it, expect } from 'vitest';
import {
  formatSearchResultsMarkdown,
  formatSearchResultsText,
  formatRecordDetailMarkdown,
  formatRecordDetailText,
  formatFiltersMarkdown,
  formatFiltersJson,
  formatCitationMarkdown,
  formatCitationText
} from '../../../src/arabic/services/formatters';
import type {
  ScholarSearchResponse,
  ScholarRecordDetail,
  ScholarCitation
} from '../../../src/arabic/types';

// Test fixtures
const mockSearchResponse: ScholarSearchResponse = {
  total: 100,
  count: 10,
  page: 1,
  results: [
    {
      id: '123456',
      title: 'الذكاء الاصطناعي في التعليم العالي',
      authors: ['أحمد محمد', 'سارة علي'],
      journal: 'مجلة البحث العلمي',
      year: '2023',
      contentType: 'بحوث ومقالات',
      url: 'https://search.mandumah.com/Record/123456',
      peerReviewed: true,
      abstract: 'هذه الدراسة تهدف إلى تحليل أثر التكنولوجيا على التعليم العالي.'
    }
  ],
  hasMore: true,
  nextPage: 2,
  query: 'الذكاء الاصطناعي',
  filters: {
    languages: ['Arabic'],
    contentTypes: ['articles'],
    peerReviewed: true
  },
  searchUrl: 'https://search.mandumah.com/Search/Results?lookfor=الذكاء+الاصطناعي'
};

const mockRecordDetail: ScholarRecordDetail = {
  id: '1199022',
  title: 'الذكاء الاصطناعي وأثره على التعليم',
  alternateTitle: 'Artificial Intelligence and its Impact on Education',
  authors: ['أحمد محمد علي'],
  mainAuthorEnglish: 'Ahmed Mohamed Ali',
  journal: 'مجلة التربية الحديثة',
  publisher: 'دار النشر العربية',
  year: '2023',
  volume: '15',
  issue: '2',
  pages: '100-125',
  contentType: 'بحوث ومقالات',
  language: 'العربية',
  url: 'https://search.mandumah.com/Record/1199022',
  peerReviewed: true,
  abstract: 'تهدف هذه الدراسة إلى استكشاف تأثير الذكاء الاصطناعي على منظومة التعليم العالي في العالم العربي.',
  subjects: ['الذكاء الاصطناعي', 'التعليم العالي', 'التكنولوجيا'],
  keywords: ['AI', 'education', 'technology'],
  issn: '1234-5678',
  database: 'EduSearch',
  country: 'مصر',
  degreeType: 'ماجستير',
  university: 'جامعة القاهرة',
  college: 'كلية التربية',
  downloadsCount: 2500,
  similarItems: [
    {
      id: '789012',
      title: 'دراسة مشابهة في الذكاء الاصطناعي',
      author: 'محمد أحمد',
      year: '2022',
      url: 'https://search.mandumah.com/Record/789012'
    }
  ]
};

const mockCitation: ScholarCitation = {
  id: '123456',
  apa: 'أحمد، محمد. (2023). الذكاء الاصطناعي في التعليم العالي. مجلة البحث العلمي، 15(2)، 100-125.',
  mla: 'أحمد، محمد. "الذكاء الاصطناعي في التعليم العالي." مجلة البحث العلمي 15.2 (2023): 100-125.',
  citeUrl: 'https://search.mandumah.com/Record/123456/Cite'
};

describe('formatSearchResultsMarkdown', () => {
  it('should format search results with header', () => {
    const result = formatSearchResultsMarkdown(mockSearchResponse);
    expect(result).toContain('# Arabic Scholar Search Results');
    expect(result).toContain('**Query:** الذكاء الاصطناعي');
    expect(result).toContain('**Total Results:** 100');
  });

  it('should include applied filters', () => {
    const result = formatSearchResultsMarkdown(mockSearchResponse);
    expect(result).toContain('**Filters:**');
    expect(result).toContain('Languages: Arabic');
    expect(result).toContain('Peer Reviewed Only');
  });

  it('should format individual results with title headers', () => {
    const result = formatSearchResultsMarkdown(mockSearchResponse);
    expect(result).toContain('### الذكاء الاصطناعي في التعليم العالي');
    expect(result).toContain('**Authors:** أحمد محمد; سارة علي');
    expect(result).toContain('**Source:** مجلة البحث العلمي');
  });

  it('should include pagination info when hasMore is true', () => {
    const result = formatSearchResultsMarkdown(mockSearchResponse);
    expect(result).toContain('Use `page: 2` to see next page');
  });

  it('should show no results message when results are empty', () => {
    const emptyResponse = { ...mockSearchResponse, results: [] };
    const result = formatSearchResultsMarkdown(emptyResponse);
    expect(result).toContain('No results found matching your search criteria');
  });

  it('should include search URL', () => {
    const result = formatSearchResultsMarkdown(mockSearchResponse);
    expect(result).toContain('**Search URL:**');
    expect(result).toContain('search.mandumah.com');
  });
});

describe('formatSearchResultsText', () => {
  it('should format search results as plain text', () => {
    const result = formatSearchResultsText(mockSearchResponse);
    expect(result).toContain('Arabic Scholar Search Results');
    expect(result).toContain('Query: الذكاء الاصطناعي');
    expect(result).not.toContain('**'); // No markdown
    expect(result).not.toContain('#'); // No markdown headers
  });

  it('should number results', () => {
    const result = formatSearchResultsText(mockSearchResponse);
    expect(result).toContain('1. الذكاء الاصطناعي في التعليم العالي');
  });
});

describe('formatRecordDetailMarkdown', () => {
  it('should format record with title as main header', () => {
    const result = formatRecordDetailMarkdown(mockRecordDetail);
    expect(result).toContain('# الذكاء الاصطناعي وأثره على التعليم');
  });

  it('should include alternate title in italics', () => {
    const result = formatRecordDetailMarkdown(mockRecordDetail);
    expect(result).toContain('*Artificial Intelligence and its Impact on Education*');
  });

  it('should create metadata table', () => {
    const result = formatRecordDetailMarkdown(mockRecordDetail);
    expect(result).toContain('| Field | Value |');
    expect(result).toContain('| **Authors** | أحمد محمد علي |');
    expect(result).toContain('| **Journal** | مجلة التربية الحديثة |');
  });

  it('should include abstract section', () => {
    const result = formatRecordDetailMarkdown(mockRecordDetail);
    expect(result).toContain('## Abstract');
    expect(result).toContain('تهدف هذه الدراسة');
  });

  it('should include subjects as bullet list', () => {
    const result = formatRecordDetailMarkdown(mockRecordDetail);
    expect(result).toContain('## Subjects');
    expect(result).toContain('- الذكاء الاصطناعي');
    expect(result).toContain('- التعليم العالي');
  });

  it('should include keywords as comma-separated list', () => {
    const result = formatRecordDetailMarkdown(mockRecordDetail);
    expect(result).toContain('## Keywords');
    expect(result).toContain('AI, education, technology');
  });

  it('should include similar items section', () => {
    const result = formatRecordDetailMarkdown(mockRecordDetail);
    expect(result).toContain('## Similar Items');
    expect(result).toContain('دراسة مشابهة في الذكاء الاصطناعي');
    expect(result).toContain('محمد أحمد');
    expect(result).toContain('(2022)');
  });

  it('should include dissertation-specific fields', () => {
    const result = formatRecordDetailMarkdown(mockRecordDetail);
    expect(result).toContain('| **Degree** | ماجستير |');
    expect(result).toContain('| **University** | جامعة القاهرة |');
    expect(result).toContain('| **College** | كلية التربية |');
  });

  it('should include downloads count', () => {
    const result = formatRecordDetailMarkdown(mockRecordDetail);
    expect(result).toContain('| **Downloads** |');
    expect(result).toContain('2,500');
  });
});

describe('formatRecordDetailText', () => {
  it('should format record as plain text without markdown', () => {
    const result = formatRecordDetailText(mockRecordDetail);
    expect(result).toContain('الذكاء الاصطناعي وأثره على التعليم');
    expect(result).not.toContain('**');
    expect(result).not.toContain('#');
    expect(result).not.toContain('|');
  });

  it('should include all metadata fields', () => {
    const result = formatRecordDetailText(mockRecordDetail);
    expect(result).toContain('Authors: أحمد محمد علي');
    expect(result).toContain('Journal: مجلة التربية الحديثة');
    expect(result).toContain('Year: 2023');
  });

  it('should include similar items', () => {
    const result = formatRecordDetailText(mockRecordDetail);
    expect(result).toContain('Similar Items:');
    expect(result).toContain('دراسة مشابهة');
  });
});

describe('formatFiltersMarkdown', () => {
  it('should format all filters when type is "all"', () => {
    const result = formatFiltersMarkdown('all');
    expect(result).toContain('## Languages');
    expect(result).toContain('## Content Types');
    expect(result).toContain('## Search Fields');
    expect(result).toContain('## Sort Options');
  });

  it('should format only languages when type is "languages"', () => {
    const result = formatFiltersMarkdown('languages');
    expect(result).toContain('## Languages');
    expect(result).not.toContain('## Content Types');
    expect(result).not.toContain('## Search Fields');
  });

  it('should format only content types when type is "content_types"', () => {
    const result = formatFiltersMarkdown('content_types');
    expect(result).toContain('## Content Types');
    expect(result).not.toContain('## Languages');
  });

  it('should include header', () => {
    const result = formatFiltersMarkdown('all');
    expect(result).toContain('# Arabic Scholar Search Filters');
  });
});

describe('formatFiltersJson', () => {
  it('should return all filters as JSON when type is "all"', () => {
    const result = formatFiltersJson('all');
    expect(result).toHaveProperty('languages');
    expect(result).toHaveProperty('content_types');
    expect(result).toHaveProperty('search_fields');
    expect(result).toHaveProperty('sort_options');
  });

  it('should return only languages when type is "languages"', () => {
    const result = formatFiltersJson('languages');
    expect(result).toHaveProperty('languages');
    expect(result).not.toHaveProperty('content_types');
  });

  it('should return array of language keys', () => {
    const result = formatFiltersJson('languages');
    expect(Array.isArray(result.languages)).toBe(true);
  });

  it('should return content types with arabic and description', () => {
    const result = formatFiltersJson('content_types');
    expect(result.content_types).toBeDefined();
    const contentTypes = result.content_types as Record<string, { arabic: string; description: string }>;
    const firstKey = Object.keys(contentTypes)[0];
    expect(contentTypes[firstKey]).toHaveProperty('arabic');
    expect(contentTypes[firstKey]).toHaveProperty('description');
  });
});

describe('formatCitationMarkdown', () => {
  it('should format citation with header', () => {
    const result = formatCitationMarkdown(mockCitation);
    expect(result).toContain('# Citation for Record 123456');
  });

  it('should include cite URL', () => {
    const result = formatCitationMarkdown(mockCitation);
    expect(result).toContain('**Cite URL:** https://search.mandumah.com/Record/123456/Cite');
  });

  it('should include APA section', () => {
    const result = formatCitationMarkdown(mockCitation);
    expect(result).toContain('## APA');
    expect(result).toContain('> أحمد، محمد');
  });

  it('should include MLA section', () => {
    const result = formatCitationMarkdown(mockCitation);
    expect(result).toContain('## MLA');
    expect(result).toContain('> أحمد، محمد');
  });

  it('should show message when no citations found', () => {
    const emptyCitation: ScholarCitation = {
      id: '123',
      citeUrl: 'https://search.mandumah.com/Record/123/Cite'
    };
    const result = formatCitationMarkdown(emptyCitation);
    expect(result).toContain('No citation data could be extracted');
  });
});

describe('formatCitationText', () => {
  it('should format citation as plain text', () => {
    const result = formatCitationText(mockCitation);
    expect(result).toContain('Citation for Record 123456');
    expect(result).not.toContain('**');
    expect(result).not.toContain('#');
  });

  it('should include APA citation', () => {
    const result = formatCitationText(mockCitation);
    expect(result).toContain('APA:');
    expect(result).toContain('أحمد، محمد');
  });

  it('should include MLA citation', () => {
    const result = formatCitationText(mockCitation);
    expect(result).toContain('MLA:');
    expect(result).toContain('أحمد، محمد');
  });
});