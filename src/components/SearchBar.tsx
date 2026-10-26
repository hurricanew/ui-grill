import { useId, type Ref } from 'react'
import { Input } from '@/components/ui/input'
import { MAX_QUERY_LENGTH } from '@/lib/search'

type SearchBarProps = {
  value: string
  onChange: (value: string) => void
  ref?: Ref<HTMLInputElement>
}

export function SearchBar({ value, onChange, ref }: SearchBarProps) {
  const id = useId()
  return (
    <div>
      {/* A1: a real <label>; visually hidden because the placeholder explains the field. */}
      <label htmlFor={id} className="sr-only">
        Search links
      </label>
      <Input
        id={id}
        ref={ref}
        type="search"
        placeholder="Search by title, description or tag"
        autoComplete="off"
        maxLength={MAX_QUERY_LENGTH}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}
