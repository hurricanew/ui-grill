import { useId, type Ref } from 'react'
import { XIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { MAX_QUERY_LENGTH } from '@/lib/search'

type SearchBarProps = {
  value: string
  onChange: (value: string) => void
  tags: readonly string[]
  onRemoveTag: (tag: string) => void
  ref?: Ref<HTMLInputElement>
}

export function SearchBar({ value, onChange, tags, onRemoveTag, ref }: SearchBarProps) {
  const id = useId()
  const lastTag = tags.at(-1)
  return (
    <div className="flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-md border border-input px-2 py-1 shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
      {/* A1: a real <label>; visually hidden because the placeholder explains the field. */}
      <label htmlFor={id} className="sr-only">
        Search links
      </label>
      {/* TF11: pills. role="list" survives Tailwind's list-style reset in Safari. */}
      {tags.length > 0 && (
        <ul role="list" aria-label="Selected tags" className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <li key={tag}>
              <Badge className="pr-1">
                {tag}
                <button
                  type="button"
                  aria-label={`Remove tag ${tag}`}
                  onClick={() => onRemoveTag(tag)}
                  className="cursor-pointer rounded-full p-0.5 outline-none hover:bg-primary-foreground/20 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <XIcon aria-hidden="true" />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      )}
      <Input
        id={id}
        ref={ref}
        type="search"
        placeholder={tags.length > 0 ? 'Add words…' : 'Search by title, description or tag'}
        autoComplete="off"
        maxLength={MAX_QUERY_LENGTH}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          // TF6: Backspace in an empty input removes the last pill.
          if (event.key === 'Backspace' && value === '' && lastTag !== undefined) {
            event.preventDefault()
            onRemoveTag(lastTag)
          }
        }}
        className="h-7 min-w-32 flex-1 border-0 px-1 shadow-none focus-visible:ring-0 dark:bg-transparent"
      />
    </div>
  )
}
