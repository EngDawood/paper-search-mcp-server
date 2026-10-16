import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/arabic/services/pdf-finder', () => ({
  searchWithDomains: vi.fn(async () => [])
}));

import { searchWithDomains } from '../../../src/arabic/services/pdf-finder';
import { searchArabicPapers } from '../../../src/arabic/services/unified-search';
import { locationForSource } from '../../../src/arabic/constants';
import { UnifiedSearchInputSchema } from '../../../src/arabic/schemas/unified-search-schema';

const mocked = vi.mocked(searchWithDomains);

/** location used for each searched domain: { 'journals.ekb.eg': 'EG', 'doaj.org': undefined, ... } */
function locationsByDomain(): Record<string, string | undefined> {
  return Object.fromEntries(mocked.mock.calls.map(c => [(c[2] as string[])[0], c[5] as string | undefined]));
}

const base = { query: 'التعلم العميق', max_results_per_source: 3 };

beforeEach(() => mocked.mockClear());

describe('per-source Exa location', () => {
  it('EKB is searched as an Egyptian user and no other source is', async () => {
    await searchArabicPapers({ ...base, platforms: ['ekb', 'doaj', 'asjp', 'acm'] }, false, 'exa-key');
    expect(locationsByDomain()).toEqual({
      'journals.ekb.eg': 'EG',
      'doaj.org': undefined, // no location sent
      'asjp.cerist.dz': undefined,
      'dl.acm.org': undefined
    });
  });

  it('an explicit user_location overrides every source, including EKB', async () => {
    await searchArabicPapers({ ...base, platforms: ['ekb', 'doaj'], user_location: 'DZ' }, false, 'exa-key');
    expect(locationsByDomain()).toEqual({ 'journals.ekb.eg': 'DZ', 'doaj.org': 'DZ' });
  });

  it('platforms=["all"] keeps using the default location for the core sources', async () => {
    await searchArabicPapers({ ...base, platforms: ['all'] }, false, 'exa-key');
    expect(Object.values(locationsByDomain()).every(l => l === undefined)).toBe(true);
  });

  it('locationForSource only returns a value for sources that define one', () => {
    expect(locationForSource('ekb')).toBe('EG');
    expect(locationForSource('doaj')).toBeUndefined();
    expect(locationForSource('asjp')).toBeUndefined();
  });
});

describe('user_location in the tool schema', () => {
  it('has no default, so per-source defaults can apply', () => {
    expect(UnifiedSearchInputSchema.parse({ query: 'x' }).user_location).toBeUndefined();
  });
  it('upper-cases and validates the code', () => {
    expect(UnifiedSearchInputSchema.parse({ query: 'x', user_location: 'eg' }).user_location).toBe('EG');
    expect(UnifiedSearchInputSchema.safeParse({ query: 'x', user_location: 'EGY' }).success).toBe(false);
  });
});
