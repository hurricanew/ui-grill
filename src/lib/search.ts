import type { Link } from './schema'

export type IndexedLink = Link & {
  words: readonly string[]
  tagSet: ReadonlySet<string>
}

export const MAX_QUERY_LENGTH = 100

// Splits data (never the query) into words on any run of non-letter,
// non-digit characters. A fixed constant: no RegExp is built from input.
const WORD_SEPARATOR = /[^\p{L}\p{N}]+/u

function toWords(text: string): string[] {
  return text.toLowerCase().split(WORD_SEPARATOR).filter(Boolean)
}

// P1/TF10: tokenise words and lowercase tags once, not on every keystroke.
// B1: inactive links never enter the index, so no query can surface them.
export function buildSearchIndex(links: Link[]): IndexedLink[] {
  return links
    .filter((link) => link.active)
    .map((link) => ({
      ...link,
      words: [...new Set(toWords([link.title, link.description ?? '', ...link.tags].join(' ')))],
      tagSet: new Set(link.tags.map((tag) => tag.toLowerCase())),
    }))
}

// B2, B5, S5: trim, cap, split on whitespace; every term must match.
// B3: a term matches when it is the start of one of the link's words.
// TF2–TF4: every selected tag must match a link tag exactly (case-insensitive).
export function filterLinks(
  index: IndexedLink[],
  query: string,
  tags: readonly string[] = [],
): IndexedLink[] {
  const terms = query
    .trim()
    .slice(0, MAX_QUERY_LENGTH)
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
  const selectedTags = tags.map((tag) => tag.toLowerCase())
  if (terms.length === 0 && selectedTags.length === 0) return index
  return index.filter(
    (link) =>
      selectedTags.every((tag) => link.tagSet.has(tag)) &&
      terms.every((term) => link.words.some((word) => word.startsWith(term))),
  )
}
