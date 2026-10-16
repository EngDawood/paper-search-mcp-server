import { describe, it, expect } from 'vitest';
import { matchesDomains, buildSearchQuery } from '../../../src/arabic/services/pdf-finder';

describe('matchesDomains', () => {
  it('matches exact hosts and subdomains', () => {
    expect(matchesDomains('https://asjp.cerist.dz/en/article/1', ['asjp.cerist.dz'])).toBe(true);
    expect(matchesDomains('https://www.researchgate.net/publication/1', ['researchgate.net'])).toBe(true);
  });
  it('rejects other hosts, look-alikes and invalid urls', () => {
    expect(matchesDomains('https://exa.ai/library/publication/x', ['asjp.cerist.dz'])).toBe(false);
    expect(matchesDomains('https://evilresearchgate.net/x', ['researchgate.net'])).toBe(false);
    expect(matchesDomains('not a url', ['asjp.cerist.dz'])).toBe(false);
  });
});

describe('buildSearchQuery', () => {
  it('appends PDF by default and can skip it', () => {
    expect(buildSearchQuery('عنوان')).toBe('عنوان PDF');
    expect(buildSearchQuery('عنوان', undefined, false)).toBe('عنوان');
  });
});
