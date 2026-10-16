import { afterEach, describe, expect, it, vi } from 'vitest';
import { scrapeUrl } from '../../../src/arabic/services/firecrawl';
import { exaContents } from '../../../src/arabic/services/exa';
import { searchWithDomains } from '../../../src/arabic/services/pdf-finder';
import { getScholarCitation, searchScholar } from '../../../src/arabic/services/scholar-client';
import { mockFetch } from '../helpers';

afterEach(() => vi.unstubAllGlobals());

describe('Firecrawl REST request', () => {
  it('posts to /v1/scrape with a bearer key and the SDK body', async () => {
    const calls = mockFetch(() => ({ success: true, data: { markdown: '# hi', rawHtml: '<p>hi</p>' } }));
    const r = await scrapeUrl('fc-key', 'https://search.mandumah.com/Record/1', { formats: ['markdown', 'rawHtml'], waitFor: 3000 });
    expect(calls[0].url).toBe('https://api.firecrawl.dev/v1/scrape');
    expect(calls[0].method).toBe('POST');
    expect(calls[0].headers.Authorization).toBe('Bearer fc-key');
    expect(calls[0].url).not.toContain('fc-key');
    expect(calls[0].body).toEqual({ url: 'https://search.mandumah.com/Record/1', formats: ['markdown', 'rawHtml'], waitFor: 3000 });
    expect(r).toMatchObject({ success: true, markdown: '# hi', rawHtml: '<p>hi</p>' });
  });

  it('reports success:false with the error text', async () => {
    mockFetch(() => ({ success: false, error: 'blocked' }));
    expect(await scrapeUrl('k', 'https://x.test', { formats: ['markdown'] })).toEqual({ success: false, error: 'blocked' });
  });

  it('search asks for markdown and rawHtml with waitFor 3000; record and cite ask for markdown, waitFor 2000', async () => {
    const calls = mockFetch(() => ({ success: true, data: { markdown: 'x'.repeat(200), rawHtml: '' } }));
    await searchScholar({ query: 'ذكاء', searchField: 'AllFields', page: 1, sort: 'relevance', dateFrom: '2020' }, 'k').catch(() => undefined);
    expect(calls[0].body.formats).toEqual(['markdown', 'rawHtml']);
    expect(calls[0].body.waitFor).toBe(3000);
    expect(calls[0].body.url).toContain('daterange%5B%5D=publishDate');
    await getScholarCitation('https://search.mandumah.com/Record/777', 'all', 'k').catch(() => undefined);
    const cite = calls[calls.length - 1].body;
    expect(cite.url).toBe('https://search.mandumah.com/Record/777/Cite');
    expect(cite.formats).toEqual(['markdown']);
    expect(cite.waitFor).toBe(2000);
  });
});

describe('Exa REST request', () => {
  it('search body matches exa-js searchAndContents, key in x-api-key only', async () => {
    const calls = mockFetch(() => ({ results: [] }));
    await searchWithDomains('عنوان', undefined, ['asjp.cerist.dz'], 5, 'exa-key', undefined, false);
    const c = calls[0];
    expect(c.url).toBe('https://api.exa.ai/search');
    expect(c.method).toBe('POST');
    expect(c.headers['x-api-key']).toBe('exa-key');
    expect(c.url).not.toContain('exa-key');
    expect(c.body).toEqual({
      query: 'عنوان',
      contents: { text: { maxCharacters: 1500 } },
      numResults: 10,
      includeDomains: ['asjp.cerist.dz'],
      type: 'auto'
    });
  });

  it('never sends category together with includeDomains', async () => {
    const calls = mockFetch(() => ({ results: [] }));
    await searchWithDomains('q', ['a', 'b', 'c'], ['doaj.org', 'asjp.cerist.dz'], 50, 'k', 'EG');
    expect(calls[0].body.includeDomains).toBeDefined();
    expect(calls[0].body).not.toHaveProperty('category');
    expect(calls[0].body.numResults).toBe(50); // capped at 50
    expect(calls[0].body.query).toBe('q a b PDF');
    expect(calls[0].body.userLocation).toBe('EG');
  });

  it('contents body matches exa-js getContents', async () => {
    const calls = mockFetch(() => ({ results: [{ url: 'u', text: 't', title: null }] }));
    const r = await exaContents('k', ['https://asjp.cerist.dz/en/article/1'], 10000);
    expect(calls[0].url).toBe('https://api.exa.ai/contents');
    expect(calls[0].body).toEqual({ urls: ['https://asjp.cerist.dz/en/article/1'], text: { maxCharacters: 10000 } });
    expect(r.results[0].text).toBe('t');
  });
});
