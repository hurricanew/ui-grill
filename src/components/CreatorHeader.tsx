import type { Creator } from '@/lib/schema'

type CreatorHeaderProps = { creator: Creator }

export function CreatorHeader({ creator }: CreatorHeaderProps) {
  return (
    <header className="space-y-2 text-center">
      <h1 className="text-3xl font-bold tracking-tight">{creator.name}</h1>
      {creator.bio && <p className="text-muted-foreground">{creator.bio}</p>}
    </header>
  )
}
