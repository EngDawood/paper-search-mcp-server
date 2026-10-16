import { describe, it, expect } from 'vitest';
import {
  OPEN_ACCESS_REPOSITORIES, OPEN_ACCESS_KEYS, CORE_OPEN_ACCESS_KEYS, OPT_IN_OPEN_ACCESS_KEYS, UNIFIED_SEARCH_PLATFORMS
} from '../../../src/arabic/constants';
import { getDomains } from '../../../src/arabic/services/pdf-finder';
import { isPaperPage } from '../../../src/arabic/services/exa-result-cleaner';
import { UnifiedSearchInputSchema } from '../../../src/arabic/schemas/unified-search-schema';

describe('source registry', () => {
  it('keeps the default "all" set unchanged so Exa usage does not grow', () => {
    expect([...CORE_OPEN_ACCESS_KEYS].sort()).toEqual(['academia', 'asjp', 'google_scholar', 'researchgate', 'shamaa']);
    expect(getDomains(['all']).sort()).toEqual(
      ['academia.edu', 'asjp.cerist.dz', 'researchgate.net', 'scholar.google.com', 'search.shamaa.org']
    );
  });

  it('has the opt-in sources and every one has a name and a unique domain', () => {
    expect([...OPT_IN_OPEN_ACCESS_KEYS].sort()).toEqual(
      ['acm', 'ajsrp', 'democraticac', 'doaj', 'ekb', 'emarefa', 'kauj', 'najsp', 'pal_ea', 'sciencedirect', 'theses_dz']
    );
    const domains = OPEN_ACCESS_KEYS.map(k => OPEN_ACCESS_REPOSITORIES[k].domain);
    expect(new Set(domains).size).toBe(domains.length);
    for (const k of OPEN_ACCESS_KEYS) expect(OPEN_ACCESS_REPOSITORIES[k].name.length).toBeGreaterThan(0);
  });

  it('exposes every source as a unified-search platform', () => {
    for (const k of OPEN_ACCESS_KEYS) expect(k in UNIFIED_SEARCH_PLATFORMS).toBe(true);
  });

  it('getDomains resolves opt-in keys', () => {
    expect(getDomains(['ekb', 'doaj'])).toEqual(['journals.ekb.eg', 'doaj.org']);
  });

  it('accepts new platform keys in the tool schema and rejects unknown ones', () => {
    expect(UnifiedSearchInputSchema.safeParse({ query: 'x', platforms: ['ekb', 'acm', 'mandumah'] }).success).toBe(true);
    expect(UnifiedSearchInputSchema.safeParse({ query: 'x', platforms: ['almaany'] }).success).toBe(false);
  });
});

describe('isPaperPage for opt-in sources (real URLs from live Exa results)', () => {
  const yes = [
    'https://saep.journals.ekb.eg/article_394432.html',
    'https://journals.ajsrp.com/index.php/jeps/ar/article/view/3179',
    'https://www.journals.ajsrp.com/index.php/jctm/en/article/download/9828/8688/14',
    'https://doaj.org/article/ddac3af8a9124bbcb702b856f6196082',
    'https://search.emarefa.net/ar/detail/BIM-1626012-%D8%A7%D8%B3',
    'https://najsp.com/index.php/home/article/view/884',
    'https://pal-ea.com/ojs/index.php/edu/article/view/247',
    'https://bucket.theses-algerie.com/files/repositories-dz/6894107677472241.pdf',
    'https://theses-algerie.com/2265941314648420/article/universite-abou-el-kac',
    'https://dl.acm.org/doi/10.1145/3289100.3289132',
    'https://www.sciencedirect.com/science/article/pii/S2666557324000168',
    'https://www.sciencedirect.com/science/article/abs/pii/S0742051X24001033',
    'https://www.democraticac.de/?p=93992',
    'https://kauj.researchcommons.org/cgi/viewcontent.cgi?article=1027&context=jmrs',
    'https://kauj.researchcommons.org/jmrs/vol3/iss1/6/'
  ];
  const no = [
    'https://journals.ekb.eg/',
    'https://aijli.journals.ekb.eg/',
    'https://journals.ajsrp.com/index.php/jhss/index',
    'https://doaj.org/',
    'https://doaj.org/toc/1234-5678',
    'https://search.emarefa.net/ar',
    'https://najsp.com/index.php/home/index',
    'https://theses-algerie.com/blog',
    'https://dl.acm.org/',
    'https://www.sciencedirect.com/',
    'https://www.democraticac.de/',
    'https://kauj.researchcommons.org/'
  ];
  it.each(yes)('accepts %s', url => expect(isPaperPage(url)).toBe(true));
  it.each(no)('rejects %s', url => expect(isPaperPage(url)).toBe(false));
});
