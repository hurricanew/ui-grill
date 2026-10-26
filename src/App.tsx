import { useDeferredValue, useMemo, useRef, useState } from 'react'
import { CreatorHeader } from '@/components/CreatorHeader'
import { LinkCard } from '@/components/LinkCard'
import { NoResults } from '@/components/NoResults'
import { SearchBar } from '@/components/SearchBar'
import sampleData from '@/data/data.json'
import { parseCreatorData } from '@/lib/schema'
import { buildSearchIndex, filterLinks } from '@/lib/search'

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

  // P2: results are derived, never stored in state.
  const results = useMemo(
    () => (profile ? filterLinks(profile.index, deferredQuery) : []),
    [profile, deferredQuery],
  )

  const searchRef = useRef<HTMLInputElement>(null)

  function clearSearch() {
    setQuery('')
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
      <SearchBar ref={searchRef} value={query} onChange={setQuery} />
      {results.length > 0 ? (
        <ul className={`space-y-3 transition-opacity ${isStale ? 'opacity-60' : ''}`}>
          {results.map((link) => (
            <li key={link.id}>
              <LinkCard link={link} />
            </li>
          ))}
        </ul>
      ) : (
        <NoResults query={deferredQuery.trim()} onClear={clearSearch} />
      )}
    </main>
  )
}
