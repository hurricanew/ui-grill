import type { Ref } from 'react'
import { Input } from '@/components/ui/input'
import { MAX_QUERY_LENGTH } from '@/lib/search'

type SearchBarProps = {
  value: string
  onChange: (value: string) => void
  ref?: Ref<HTMLInputElement>
}

export function SearchBar({ value, onChange, ref }: SearchBarProps) {
  return (
    <Input
      ref={ref}
      type="search"
      aria-label="Search links"
      placeholder="Search by title, description or tag"
      autoComplete="off"
      maxLength={MAX_QUERY_LENGTH}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}
