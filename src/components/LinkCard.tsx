import { useId } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import type { Link } from '@/lib/schema'

type LinkCardProps = {
  link: Link
  // Lowercased tags currently selected as pills.
  selectedTags?: ReadonlySet<string>
  onTagClick?: (tag: string) => void
}

const NO_TAGS: ReadonlySet<string> = new Set()

// TF8 stretched link: the title <a> carries the URL and an ::after overlay
// makes the whole card clickable. Tag buttons sit above the overlay (z-10)
// and are never nested inside the link. `link.url` was origin-checked in
// parseCreatorData (S2); rel blocks reverse tabnabbing and referrer leaks (S4).
export function LinkCard({ link, selectedTags = NO_TAGS, onTagClick }: LinkCardProps) {
  const titleId = useId()
  return (
    <article aria-labelledby={titleId} className="group relative rounded-xl transition-shadow hover:shadow-md">
      <Card className="gap-3 group-has-[a:focus-visible]:ring-[3px] group-has-[a:focus-visible]:ring-ring/50">
        <CardHeader>
          <h2 id={titleId} className="leading-none font-semibold">
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="outline-none after:absolute after:inset-0 after:rounded-xl"
            >
              {link.title}
            </a>
          </h2>
          {link.description && <CardDescription>{link.description}</CardDescription>}
        </CardHeader>
        {link.tags.length > 0 && (
          <CardContent className="flex flex-wrap gap-1.5">
            {link.tags.map((tag) => {
              const pressed = selectedTags.has(tag.toLowerCase())
              return (
                <Badge key={tag} asChild variant={pressed ? 'default' : 'secondary'}>
                  <button
                    type="button"
                    aria-label={`Filter by tag ${tag}`}
                    aria-pressed={pressed}
                    onClick={() => onTagClick?.(tag)}
                    className="relative z-10 cursor-pointer outline-none"
                  >
                    {tag}
                  </button>
                </Badge>
              )
            })}
          </CardContent>
        )}
      </Card>
    </article>
  )
}
