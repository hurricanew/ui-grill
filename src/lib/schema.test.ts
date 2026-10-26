import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import sampleData from '@/data/data.json'
import { ALLOWED_ORIGINS, isAllowedUrl, parseCreatorData } from './schema'

const validLink = {
  id: 'link_ok',
  title: 'Shop my prints',
  url: 'https://example.com/prints',
  description: 'Limited edition prints.',
  tags: ['shop'],
  active: true,
}

const creator = { id: 'creator_001', name: 'Maya Creates', bio: 'Illustrator.' }

function withLinks(links: unknown[]) {
  return { creator, links }
}

describe('isAllowedUrl (S2: origin allowlist)', () => {
  it('allowlist is exactly ["https://example.com"]', () => {
    expect(ALLOWED_ORIGINS).toEqual(['https://example.com'])
  })

  it.each([
    { url: 'https://example.com/prints', reason: 'allowlisted origin with a path' },
    { url: 'https://example.com', reason: 'bare allowlisted origin' },
    { url: 'HTTPS://EXAMPLE.COM/x', reason: 'scheme and host are case-insensitive and normalise to the allowed origin' },
    { url: 'https://example.com:443/x', reason: 'explicit default port normalises to the allowed origin' },
    { url: 'https://example.com/a?q=1#top', reason: 'query string and fragment do not change the origin' },
  ])('accepts $url — $reason', ({ url }) => {
    expect(isAllowedUrl(url)).toBe(true)
  })

  it.each([
    { url: 'javascript:alert(1)', reason: 'script scheme (XSS); origin is "null"' },
    { url: 'JaVaScRiPt:alert(1)', reason: 'script scheme with mixed case' },
    { url: 'data:text/html,<script>alert(1)</script>', reason: 'data: URL can carry an HTML document' },
    { url: 'http://example.com/prints', reason: 'plain HTTP is not the allowed origin (https only)' },
    { url: 'https://example.com.evil.com/', reason: 'look-alike host: allowed domain used as a subdomain prefix' },
    { url: 'https://evilexample.com/', reason: 'look-alike host: allowed domain as a suffix without a dot' },
    { url: 'https://example.com@evil.com/', reason: 'userinfo trick: the real host is evil.com' },
    { url: 'https://user:pass@example.com/', reason: 'embedded credentials on the allowed host are rejected' },
    { url: 'https://www.example.com/', reason: 'subdomains are not allowed (exact origin match only)' },
    { url: 'https://example.com:8443/', reason: 'non-default port is a different origin' },
    { url: '//example.com/prints', reason: 'protocol-relative URL does not parse without a base' },
    { url: '/prints', reason: 'relative path does not parse without a base' },
    { url: 'not a url', reason: 'unparseable string' },
    { url: '', reason: 'empty string ("")' },
  ])('rejects $url — $reason', ({ url }) => {
    expect(isAllowedUrl(url)).toBe(false)
  })
})

describe('parseCreatorData (S1: validate untrusted data at the boundary)', () => {
  let warn: MockInstance<typeof console.warn>

  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    warn.mockRestore()
  })

  it('parses the sample data.json: creator plus all 6 links (inactive links are kept; filtering is search logic)', () => {
    const result = parseCreatorData(sampleData)
    expect(result?.creator.name).toBe('Maya Creates')
    expect(result?.links.map((l) => l.id)).toEqual([
      'link_001', 'link_002', 'link_003', 'link_004', 'link_005', 'link_006',
    ])
    expect(warn).not.toHaveBeenCalled()
  })

  it('keeps description: null as null (B4: null is valid data, not an error)', () => {
    const result = parseCreatorData(withLinks([{ ...validLink, description: null }]))
    expect(result?.links[0]?.description).toBeNull()
  })

  it('normalises the stored url to the parsed href, so what was checked is exactly what is rendered', () => {
    const result = parseCreatorData(withLinks([{ ...validLink, url: 'HTTPS://EXAMPLE.COM/prints' }]))
    expect(result?.links[0]?.url).toBe('https://example.com/prints')
  })

  it.each([
    { name: 'url with a disallowed origin (javascript:)', link: { ...validLink, url: 'javascript:alert(1)' } },
    { name: 'url using the userinfo trick', link: { ...validLink, url: 'https://example.com@evil.com/' } },
    { name: 'missing title', link: { ...validLink, title: undefined } },
    { name: 'whitespace-only title', link: { ...validLink, title: '   ' } },
    { name: 'tags: null', link: { ...validLink, tags: null } },
    { name: 'tags containing a non-string', link: { ...validLink, tags: ['ok', 42] } },
    { name: 'active as the string "true"', link: { ...validLink, active: 'true' } },
    { name: 'description as a number', link: { ...validLink, description: 123 } },
    { name: 'missing id', link: { ...validLink, id: undefined } },
    { name: 'a non-object entry (string)', link: 'https://example.com' },
    { name: 'a null entry', link: null },
  ])('drops a link with $name, keeps the valid ones, and warns instead of throwing', ({ link }) => {
    const result = parseCreatorData(withLinks([validLink, link]))
    expect(result?.links.map((l) => l.id)).toEqual(['link_ok'])
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('drops a link whose id duplicates an earlier one (React keys must be unique, P4); first one wins', () => {
    const result = parseCreatorData(
      withLinks([validLink, { ...validLink, title: 'Duplicate' }]),
    )
    expect(result?.links).toHaveLength(1)
    expect(result?.links[0]?.title).toBe('Shop my prints')
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it.each([
    { name: 'null', raw: null },
    { name: 'a string', raw: 'oops' },
    { name: 'missing creator', raw: { links: [validLink] } },
    { name: 'creator without a name', raw: { creator: { id: 'c', bio: '' }, links: [] } },
    { name: 'links that is not an array', raw: { creator, links: {} } },
  ])('returns null without throwing when the top-level payload is $name', ({ raw }) => {
    expect(() => parseCreatorData(raw)).not.toThrow()
    expect(parseCreatorData(raw)).toBeNull()
  })
})
