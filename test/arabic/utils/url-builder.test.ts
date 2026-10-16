import { describe, it, expect } from 'vitest';
import { buildSearchUrl } from '../../../src/arabic/utils/url-builder';

const base = { query: 'q', searchField: 'AllFields', page: 1, sort: 'relevance' };

describe('buildSearchUrl', () => {
  it('adds daterange[] so Mandumah applies the year filter', () => {
    const url = new URL(buildSearchUrl({ ...base, dateFrom: '2024', dateTo: '2025' }));
    expect(url.searchParams.getAll('daterange[]')).toEqual(['publishDate']);
    expect(url.searchParams.get('publishDatefrom')).toBe('2024');
    expect(url.searchParams.get('publishDateto')).toBe('2025');
  });

  it('omits date params when no range is given', () => {
    const url = new URL(buildSearchUrl(base));
    expect(url.searchParams.has('daterange[]')).toBe(false);
  });

  it('maps year_desc to Mandumah "year" and year_asc to "year asc"', () => {
    expect(new URL(buildSearchUrl({ ...base, sort: 'year_desc' })).searchParams.get('sort')).toBe('year');
    expect(new URL(buildSearchUrl({ ...base, sort: 'year_asc' })).searchParams.get('sort')).toBe('year asc');
  });
});
