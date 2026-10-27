import { useDeferredValue, useMemo, useRef, useState } from 'react'
import { CreatorHeader } from '@/components/CreatorHeader'
import { LinkCard } from '@/components/LinkCard'
import { NoResults } from '@/components/NoResults'
import { SearchBar } from '@/components/SearchBar'
import sampleData from '@/data/data.json'
import { parseCreatorData } from '@/lib/schema'
import { buildSearchIndex, filterLinks } from '@/lib/search'

function formatCount(count: number): string {
  if (count === 0) return 'No links'
  return count === 1 ? '1 link' : `${count} links`
}

type AppProps = {
  // Untrusted input; defaults to the bundled data.json. Injectable for tests.
  data?: unknown
}

export default function App({ data = sampleData }: AppProps) {
  // Validate and index once per data payload (S1, S2, P1).
  const profile = useMemo(() => {
    const parsed = parseCreatorData(data)
    return parsed && { creator: parsed.creator, index: buildSearchIndex(parsed.links) }
  }, [data])

  const [query, setQuery] = useState('')
  // P3: typing stays responsive; filtering renders at lower priority.
  const deferredQuery = useDeferredValue(query)
  const isStale = query !== deferredQuery

  // TF1: pills apply immediately (not deferred). Stored with original casing
  // for display; compared lowercased (TF2).
  const [tags, setTags] = useState<string[]>([])
  const selectedTags = useMemo(() => new Set(tags.map((tag) => tag.toLowerCase())), [tags])

  // P2: results are derived, never stored in state.
  const results = useMemo(
    () => (profile ? filterLinks(profile.index, deferredQuery, tags) : []),
    [profile, deferredQuery, tags],
  )

  const searchRef = useRef<HTMLInputElement>(null)

  // TF5: a tag already selected is a no-op. TF9: only called with tags
  // from validated links, never with typed text.
  function addTag(tag: string) {
    if (selectedTags.has(tag.toLowerCase())) return
    setTags((current) => [...current, tag])
  }

  // TF6: removing a pill returns focus to the input.
  function removeTag(tag: string) {
    setTags((current) => current.filter((selected) => selected !== tag))
    searchRef.current?.focus()
  }

  function clearSearch() {
    setQuery('')
    setTags([])
    searchRef.current?.focus()
  }

  if (!profile) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <p role="alert" className="text-muted-foreground">
          This profile is unavailable.
        </p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-xl space-y-6 px-4 py-12">
      <CreatorHeader creator={profile.creator} />
      <SearchBar
        ref={searchRef}
        value={query}
        onChange={setQuery}
        tags={tags}
        onRemoveTag={removeTag}
      />
      {/* A2: always mounted so screen readers hear each change. */}
      <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
        {formatCount(results.length)}
      </p>
      {results.length > 0 ? (
        <ul className={`space-y-3 transition-opacity ${isStale ? 'opacity-60' : ''}`}>
          {results.map((link) => (
            <li key={link.id}>
              <LinkCard link={link} selectedTags={selectedTags} onTagClick={addTag} />
            </li>
          ))}
        </ul>
      ) : (
        <NoResults query={deferredQuery.trim()} tags={tags} onClear={clearSearch} />
      )}
    </main>
  )
}
