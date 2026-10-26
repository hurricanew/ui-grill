import type { Link } from './schema'

export type IndexedLink = Link & { haystack: string }

export const MAX_QUERY_LENGTH = 100

// P1: lowercase and join searchable fields once, not on every keystroke.
// B1: inactive links never enter the index, so no query can surface them.
export function buildSearchIndex(links: Link[]): IndexedLink[] {
  return links
    .filter((link) => link.active)
    .map((link) => ({
      ...link,
      haystack: [link.title, link.description ?? '', ...link.tags]
        .filter(Boolean)
        .join(' ')
        .toLowerCase(),
    }))
}

// B2–B5, S5: trim, cap, split on whitespace; every term must appear.
// Plain `includes`, never a RegExp built from user input.
export function filterLinks(index: IndexedLink[], query: string): IndexedLink[] {
  const terms = query
    .trim()
    .slice(0, MAX_QUERY_LENGTH)
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
  if (terms.length === 0) return index
  return index.filter((link) => terms.every((term) => link.haystack.includes(term)))
}
