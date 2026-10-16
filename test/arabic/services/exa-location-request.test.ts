import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { searchArabicPapers } from '../../../src/arabic/services/unified-search';
import { mockFetch, type Call } from '../helpers';

// Capture what is actually sent to Exa, through the real unified-search -> searchWithDomains chain
let calls: Call[];
beforeEach(() => {
  calls = mockFetch(() => ({ results: [] }));
});
afterEach(() => vi.unstubAllGlobals());

const byDomain = () => Object.fromEntries(calls.map(c => [c.body.includeDomains[0], c.body.userLocation]));

describe('userLocation sent to the Exa API', () => {
  it('does not put a userLocation key in the request when none applies', async () => {
    await searchArabicPapers({ query: 'q', platforms: ['doaj'], max_results_per_source: 2 }, false, 'key');
    expect(calls[0].body).not.toHaveProperty('userLocation');
  });

  it('EKB gets EG, other sources get no location', async () => {
    await searchArabicPapers({ query: 'q', platforms: ['ekb', 'doaj', 'asjp'], max_results_per_source: 2 }, false, 'key');
    expect(byDomain()).toEqual({ 'journals.ekb.eg': 'EG', 'doaj.org': undefined, 'asjp.cerist.dz': undefined });
  });

  it('an explicit user_location is sent for every source', async () => {
    await searchArabicPapers({ query: 'q', platforms: ['ekb', 'doaj'], user_location: 'DZ', max_results_per_source: 2 }, false, 'key');
    expect(byDomain()).toEqual({ 'journals.ekb.eg': 'DZ', 'doaj.org': 'DZ' });
  });
});
