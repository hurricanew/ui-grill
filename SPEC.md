# Spec: Creator Link Search

Source: [prd.md](prd.md). Time box: 60 minutes, live interview.

## Objective

A single page showing one creator's profile and their **active** links as cards. A search bar filters cards by title, description, or tags. Priorities, in order: **security → business logic → performance → a11y (stretch)**.

### Acceptance criteria

**Security**
- S1. `data.json` is parsed with a zod schema at load. Records that fail validation are dropped (a dev-only `console.warn`); the page never crashes on bad data.
- S2. **Origin allowlist.** A link is only rendered if its `url` parses with `new URL()` and `url.origin` is exactly one of `ALLOWED_ORIGINS = ["https://example.com"]`. Otherwise it is dropped at validation. Comparing `origin`, not doing string checks on the raw URL, rejects all of these:
  - other schemes (`javascript:`, `data:`, `http://example.com`)
  - look-alike hosts (`https://example.com.evil.com`, `https://evilexample.com`)
  - userinfo tricks (`https://example.com@evil.com`, whose host is `evil.com`)
  - subdomains (`https://www.example.com`) and non-default ports (`https://example.com:8443`)

  Adding a domain means editing the one constant in `lib/schema.ts`.
- S3. All text is rendered as React children. `dangerouslySetInnerHTML` does not appear in the codebase.
- S4. Cards open with `target="_blank" rel="noopener noreferrer"`.
- S5. The query is trimmed and capped at 100 chars (`maxLength` on the input, plus `slice` in logic). No `RegExp` is built from user input.

**Business logic**
- B1. Only `active: true` links are shown.
- B2. Empty or whitespace-only query → all active links, in source order.
- B3. Matching is case-insensitive substring over title, description, and tags.
- B4. `description: null` is valid. It is not rendered and never throws during search.
- B5. Multi-word query: split on whitespace. A link matches when **every** term appears in its searchable text.
- B6. Zero matches → a no-results message that echoes the (escaped) query, plus a "Clear search" action.
- B7. Results keep source order (no ranking).

**Performance**
- P1. Searchable text (lowercased title + description + tags) is computed once per link at load, not per keystroke.
- P2. Results come from `useMemo` over `[index, deferredQuery]`. No `useEffect` + `setState` filtering.
- P3. The query is passed through `useDeferredValue`. No debounce.
- P4. Cards are keyed by `link.id`.

**A11y (stretch)**
- A1. The search input has a visible or `sr-only` `<label>`.
- A2. The result count ("3 links") is in an `aria-live="polite"` region.
- A3. Each card is a single `<a>` with a visible focus ring.

## Tech Stack

- Vite + React 19 + TypeScript (strict)
- Tailwind CSS v4 + shadcn/ui (`card`, `input`, `badge`, `button`)
- zod for runtime validation
- Vitest + React Testing Library + jsdom

## Commands

```
Scaffold:  npm create vite@latest . -- --template react-ts
shadcn:    npx shadcn@latest init && npx shadcn@latest add card input badge button
Dev:       npm run dev
Test:      npm test            (vitest run; watch: npm run test:watch)
Typecheck: npm run typecheck   (tsc -b --noEmit)
Lint:      npm run lint        (oxlint; ignores src/components/ui)
Build:     npm run build
```

## Project Structure

```
src/
  data/data.json          → creator data (moved from repo root, imported statically)
  lib/schema.ts           → zod schemas, safe-URL check, parseCreatorData()
  lib/search.ts           → buildSearchIndex(), filterLinks()  (pure, no React)
  lib/*.test.ts           → unit tests, colocated
  components/
    CreatorHeader.tsx
    SearchBar.tsx
    LinkCard.tsx
    NoResults.tsx
    ui/                   → shadcn-generated, not hand-edited
  App.tsx                 → wiring: state, useDeferredValue, useMemo
  App.test.tsx            → integration test via RTL
```

## Code Style

Pure logic in `lib/`, components stay thin. Named exports, explicit types at module boundaries, no `any`.

```ts
// lib/search.ts
export type IndexedLink = Link & { haystack: string };

export const MAX_QUERY_LENGTH = 100;

export function buildSearchIndex(links: Link[]): IndexedLink[] {
  return links
    .filter((link) => link.active)
    .map((link) => ({
      ...link,
      haystack: [link.title, link.description ?? "", ...link.tags]
        .join(" ")
        .toLowerCase(),
    }));
}

export function filterLinks(index: IndexedLink[], query: string): IndexedLink[] {
  const terms = query.slice(0, MAX_QUERY_LENGTH).toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return index;
  return index.filter((link) => terms.every((term) => link.haystack.includes(term)));
}
```

## Testing Strategy

- **Unit (Vitest)**, the bulk of the tests:
  - `search.test.ts`: B1–B5 and B7, plus the 100-char cap.
  - `schema.test.ts`: S1–S2. A table-driven test runs every rejected URL listed under S2 and checks each is dropped, and checks `https://example.com/prints` is accepted. A missing title is dropped, `tags: null` is dropped, an unparseable URL is dropped, and a valid record passes.
- **Integration (RTL)**, one file, `App.test.tsx`: typing filters the cards, the no-results state appears and "Clear search" works, and cards have the correct `href`/`rel`/`target`.
- No E2E and no coverage threshold (time box). Every acceptance criterion maps to at least one test.

## Boundaries

- **Always:** write a failing test before the logic in `lib/`; run `vitest run` + `tsc` before calling a task done; keep `lib/` free of React imports.
- **Ask first:** adding any dependency beyond those listed; changing search semantics (B3/B5); changing the drop-invalid-records policy; adding an origin to `ALLOWED_ORIGINS`.
- **Never:** `dangerouslySetInnerHTML`; building a `RegExp` from the query; hand-editing `components/ui/`; storing filtered results in state.

## Success Criteria

- `npx vitest run`, `npx tsc -b --noEmit`, and `npm run build` all pass.
- With the sample data: 5 cards show initially (`link_005` is inactive). "art" → 3 cards (prints, watercolour, starter kit, since "start" contains "art"). "BEGINNER" → 2. "free drawing" → 1. "zzz" → no-results state. "podcast" → 1 card with no description line.
- Injecting records with `url: "javascript:alert(1)"` or `url: "https://example.com@evil.com"` into the data results in no card for either and no error.

## Decisions (resolved 2026-10-27)

1. **Matching:** plain substring. "art" matching "starter" is accepted and called out as a known trade-off (word-prefix is the follow-up).
2. **Invalid links:** dropped at load, with a dev-only `console.warn`. They are not rendered as disabled cards.
3. **Data loading:** a static `import` of `src/data/data.json`. There is no fetch and no loading state.
4. **URL allowlist:** exact `origin` match against `["https://example.com"]`. Subdomains are not allowed.
