import { afterEach, describe, expect, it, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { arabicSourceIds, findArabicPdf, mandumahCitation, registerArabicTools, searchArabic } from '../../src/arabic';
import { mockFetch } from './helpers';

afterEach(() => vi.unstubAllGlobals());

async function toolNames(env: object): Promise<string[]> {
  const server = new McpServer({ name: 't', version: '1' });
  registerArabicTools(server, env);
  const client = new Client({ name: 'c', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  return (await client.listTools()).tools.map(t => t.name).sort();
}

describe('registration by key', () => {
  it('always has the two static tools', async () => {
    expect(await toolNames({})).toEqual(['list_arabic_tools', 'mandumah_list_filters']);
  });
  it('Firecrawl enables Mandumah tools and search', async () => {
    expect(await toolNames({ FIRECRAWL_API_KEY: 'k' })).toEqual([
      'list_arabic_tools', 'mandumah_get_citation', 'mandumah_get_record', 'mandumah_list_filters', 'mandumah_search', 'search_arabic_papers'
    ]);
  });
  it('Exa enables get_pdf_url and search', async () => {
    expect(await toolNames({ EXA_API_KEY: 'k' })).toEqual(['get_pdf_url', 'list_arabic_tools', 'mandumah_list_filters', 'search_arabic_papers']);
  });
  it('both keys give all 7', async () => {
    expect((await toolNames({ EXA_API_KEY: 'k', FIRECRAWL_API_KEY: 'k' })).length).toBe(7);
  });
});

describe('arabicSourceIds', () => {
  it('follows the keys', () => {
    expect(arabicSourceIds({})).toEqual([]);
    expect(arabicSourceIds({ FIRECRAWL_API_KEY: 'k' })).toEqual(['mandumah']);
    expect(arabicSourceIds({ EXA_API_KEY: 'k' })).toEqual(expect.arrayContaining(['mandumah_exa', 'asjp', 'ekb']));
  });
});

const MANDUMAH_MD = [
  'نتائج البحث من **2** نتيجة',
  '[البحث الأول في الذكاء الاصطناعي](https://search.mandumah.com/Record/111222)',
  '| **المؤلف:** | [أحمد علي](https://search.mandumah.com/Author/Home?author=x) |',
  'x'.repeat(80)
].join('\n');

describe('searchArabic', () => {
  it('maps Mandumah and Exa results to Paper with outcomes, and sends the year filter', async () => {
    const calls = mockFetch(c =>
      c.url.includes('firecrawl')
        ? { success: true, data: { markdown: MANDUMAH_MD, rawHtml: '' } }
        : { results: [{ title: 'Paper', url: 'https://asjp.cerist.dz/en/article/55', text: 'x', score: 1 }] }
    );
    const { papers, outcomes } = await searchArabic(
      'الذكاء الاصطناعي',
      { maxResults: 3, year: '2019-2023', platforms: ['mandumah', 'asjp'] },
      { FIRECRAWL_API_KEY: 'f', EXA_API_KEY: 'e' }
    );
    const fc = calls.find(c => c.url.includes('firecrawl'))!;
    expect(fc.body.url).toContain('publishDatefrom=2019');
    expect(fc.body.url).toContain('publishDateto=2023');
    expect(outcomes.map(o => o.source)).toEqual(['mandumah', 'asjp']);
    const m = papers.find(p => p.source === 'mandumah')!;
    expect(m.paper_id).toBe('111222');
    expect(m.extra?.record_id).toBe('111222');
  });

  it('reports a failing source in outcomes and ignores unknown platforms', async () => {
    mockFetch(() => ({ success: false, error: 'blocked' }));
    const r = await searchArabic('q', { maxResults: 2, platforms: ['mandumah', 'nope'] }, { FIRECRAWL_API_KEY: 'f' });
    expect(r.papers).toEqual([]);
    expect(r.outcomes[0].source).toBe('mandumah');
    expect(r.outcomes[0].error).toBeTruthy();
    expect((await searchArabic('q', { maxResults: 2, platforms: ['asjp'] }, {})).outcomes).toEqual([]);
  });
});

describe('findArabicPdf and mandumahCitation', () => {
  it('extracts the ASJP downArticle link from a page url', async () => {
    mockFetch(() => ({ results: [{ url: 'u', title: null, text: 'link /en/downArticle/12/3/4/198732 end' }] }));
    const r = await findArabicPdf({ url: 'https://asjp.cerist.dz/en/article/198732' }, { EXA_API_KEY: 'e' });
    expect(r).toMatchObject({ pdf_url: 'https://asjp.cerist.dz/en/downArticle/12/3/4/198732', source: 'ASJP' });
  });
  it('returns null without an Exa key', async () => {
    expect(await findArabicPdf({ title: 't' }, {})).toEqual({ pdf_url: null });
  });
  it('citation needs a Firecrawl key', async () => {
    await expect(mandumahCitation('1', {})).rejects.toThrow(/FIRECRAWL_API_KEY/);
  });
});
