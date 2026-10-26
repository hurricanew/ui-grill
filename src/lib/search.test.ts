import { describe, expect, it } from 'vitest'
import sampleData from '@/data/data.json'
import { parseCreatorData } from './schema'
import { MAX_QUERY_LENGTH, buildSearchIndex, filterLinks } from './search'

const parsed = parseCreatorData(sampleData)
if (!parsed) throw new Error('sample data.json failed validation')
const index = buildSearchIndex(parsed.links)

function ids(query: string): string[] {
  return filterLinks(index, query).map((link) => link.id)
}

const ALL_ACTIVE = ['link_001', 'link_002', 'link_003', 'link_004', 'link_006']

describe('buildSearchIndex (B1 active only, P1 normalise once)', () => {
  it('keeps only active links, in source order (link_005 "Book a commission" is inactive)', () => {
    expect(index.map((link) => link.id)).toEqual(ALL_ACTIVE)
  })

  it('precomputes a lowercased haystack of title, description and tags', () => {
    const prints = index.find((link) => link.id === 'link_001')
    expect(prints?.haystack).toBe('shop my prints limited edition illustrations and art prints. shop art prints')
  })

  it('leaves description out of the haystack when it is null, instead of indexing the text "null" (B4)', () => {
    const podcast = index.find((link) => link.id === 'link_004')
    expect(podcast?.haystack).toBe('the creative break podcast podcast creativity')
  })
})

describe('filterLinks (business logic over the sample data)', () => {
  describe('empty query shows every active link (B2)', () => {
    it.each([
      { label: 'empty string ("")', query: '' },
      { label: 'spaces only ("   ")', query: '   ' },
      { label: 'tabs and newlines', query: '\t\n' },
    ])('$label → all 5 active links', ({ query }) => {
      expect(ids(query)).toEqual(ALL_ACTIVE)
    })
  })

  describe('matching rules (B3 title/description/tags, case-insensitive substring; B7 source order)', () => {
    it.each([
      { query: 'prints', expected: ['link_001'], why: 'title match' },
      { query: 'monthly', expected: ['link_002', 'link_006'], why: 'description match, across two links in source order' },
      { query: 'creativity', expected: ['link_004'], why: 'tag-only match on a link whose description is null' },
      { query: 'podcast', expected: ['link_004'], why: 'title and tag match on the same link return it once' },
      { query: 'BEGINNER', expected: ['link_002', 'link_003'], why: 'upper-case query matches lower-case tag' },
      { query: 'WaTeRcOlOuR', expected: ['link_002'], why: 'mixed-case query matches title' },
      { query: 'art', expected: ['link_001', 'link_002', 'link_003'], why: 'substring: also matches "starter" in link_003 (accepted trade-off)' },
      { query: 'news', expected: ['link_006'], why: 'partial word matches as a substring' },
    ])('"$query" → $expected — $why', ({ query, expected }) => {
      expect(ids(query)).toEqual(expected)
    })
  })

  describe('multi-word queries require every term (B5)', () => {
    it.each([
      { query: 'free drawing', expected: ['link_003'], why: 'both terms in the title' },
      { query: 'drawing free', expected: ['link_003'], why: 'term order does not matter' },
      { query: '  free    drawing  ', expected: ['link_003'], why: 'extra and surrounding whitespace is ignored' },
      { query: 'podcast creativity', expected: ['link_004'], why: 'terms may match different fields (title + tag)' },
      { query: 'art beginner', expected: ['link_002', 'link_003'], why: 'AND across terms narrows the "art" results' },
      { query: 'art podcast', expected: [], why: 'no single link has both terms, so nothing matches' },
    ])('"$query" → $expected — $why', ({ query, expected }) => {
      expect(ids(query)).toEqual(expected)
    })
  })

  describe('no results (feeds the B6 empty state)', () => {
    it.each([
      { query: 'zzz', why: 'term appears nowhere' },
      { query: 'commission', why: 'only matches link_005, which is inactive (B1)' },
      { query: 'null', why: 'a null description is not searchable as the text "null" (B4)' },
    ])('"$query" → [] — $why', ({ query }) => {
      expect(ids(query)).toEqual([])
    })
  })

  describe('hostile or oversized input (S5)', () => {
    it.each([
      { query: '.*', why: 'regex wildcard is matched literally, not as a pattern' },
      { query: '(', why: 'unbalanced regex group does not throw' },
      { query: '[a-z]+', why: 'regex character class is matched literally' },
      { query: '<script>alert(1)</script>', why: 'HTML is just text to search' },
    ])('"$query" → [] without throwing — $why', ({ query }) => {
      expect(() => filterLinks(index, query)).not.toThrow()
      expect(ids(query)).toEqual([])
    })

    it(`ignores everything after the first ${MAX_QUERY_LENGTH} characters of the trimmed query`, () => {
      const query = 'prints'.padEnd(MAX_QUERY_LENGTH, ' ') + 'zzz'
      expect(query).toHaveLength(MAX_QUERY_LENGTH + 3)
      expect(ids(query)).toEqual(['link_001'])
    })

    it('trims leading whitespace before applying the length cap', () => {
      const query = ' '.repeat(MAX_QUERY_LENGTH) + 'prints'
      expect(ids(query)).toEqual(['link_001'])
    })

    it('handles a 10,000-character query without throwing', () => {
      expect(() => filterLinks(index, 'a'.repeat(10_000))).not.toThrow()
    })
  })
})
