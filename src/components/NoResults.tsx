import { Button } from '@/components/ui/button'

type NoResultsProps = {
  query: string
  tags: readonly string[]
  onClear: () => void
}

function describeFilters(query: string, tags: readonly string[]): string {
  const tagged = tags.length > 0 ? `tagged ${tags.join(', ')}` : ''
  if (query && tagged) return `No links match "${query}" ${tagged}`
  if (query) return `No links match "${query}"`
  return `No links ${tagged}`
}

// The message is rendered as a React text child, so it is escaped (S3).
export function NoResults({ query, tags, onClear }: NoResultsProps) {
  return (
    <div className="space-y-3 rounded-xl border border-dashed p-8 text-center">
      <p className="text-muted-foreground">{describeFilters(query, tags)}</p>
      <Button variant="outline" onClick={onClear}>
        Clear search
      </Button>
    </div>
  )
}
