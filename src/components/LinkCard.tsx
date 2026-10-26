import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import type { Link } from '@/lib/schema'

type LinkCardProps = { link: Link }

// The whole card is one <a>. `link.url` was origin-checked and normalised in
// parseCreatorData (S2); rel blocks reverse tabnabbing and referrer leaks (S4).
export function LinkCard({ link }: LinkCardProps) {
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-xl transition-shadow hover:shadow-md"
    >
      <Card className="gap-3">
        <CardHeader>
          <h2 className="leading-none font-semibold">{link.title}</h2>
          {link.description && <CardDescription>{link.description}</CardDescription>}
        </CardHeader>
        {link.tags.length > 0 && (
          <CardContent className="flex flex-wrap gap-1.5">
            {link.tags.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </CardContent>
        )}
      </Card>
    </a>
  )
}
