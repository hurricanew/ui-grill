import { Button } from '@/components/ui/button'

type NoResultsProps = {
  query: string
  onClear: () => void
}

// The query is rendered as a React text child, so it is escaped (S3).
export function NoResults({ query, onClear }: NoResultsProps) {
  return (
    <div className="space-y-3 rounded-xl border border-dashed p-8 text-center">
      <p className="text-muted-foreground">No links match "{query}"</p>
      <Button variant="outline" onClick={onClear}>
        Clear search
      </Button>
    </div>
  )
}
