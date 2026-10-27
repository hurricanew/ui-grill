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
- B3. **Word-prefix matching** (changed from substring on 2026-10-27). Title, description and tags are split into words on any run of non-letter, non-digit characters (Unicode-aware: `/[^\p{L}\p{N}]+/u`, a fixed constant, never built from input). A query term matches a link when it is the **start of one of its words**, case-insensitively. "art" matches "art" and "artist" but not "starter"; "news" matches "newsletter"; "rints" matches nothing.
- B4. `description: null` is valid. It is not rendered and never throws during search.
- B5. Multi-word query: split on whitespace. A link matches when **every** term appears in its searchable text (under B3, "appears" means it is the start of one of the link's words).
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
- A3. ~~Each card is a single `<a>`~~ (superseded by TF8). Each card has one link, its title, with a visible focus ring; the whole card stays clickable.

**Tag filter** (added 2026-10-27, status: approved)
- TF1. Each tag on a card is a `<button>`. Clicking it (or pressing Enter/Space on it) adds that tag as a **pill** inside the search box, and the cards update immediately. Pills are not deferred; the text query still uses `useDeferredValue`.
- TF2. A pill filters by **exact** tag match, case-insensitive: the pill `art` matches the tag `art`, never `artist`. This is unlike text search, which uses word-prefix matching (B3).
- TF3. **Several pills are combined with AND.** A link must have every selected tag.
- TF4. Pills and text are also combined with AND: the result is the active links (B1) that have every selected tag *and* match the text query (B3/B5). Text search still covers tags.
- TF5. Clicking a tag that's already a pill does nothing: no duplicate, no toggle.
- TF6. Removing pills:
  - each pill has a × `<button>` labelled "Remove tag {tag}"
  - Backspace in an **empty** input removes the last pill
  - "Clear search" clears the text and every pill
  - Removing a pill moves focus to the input.
- TF7. B2 is extended: no text and no pills → all active links. B6 is extended: the no-results message echoes both, e.g. `No links match "zzz" tagged art, beginner`.
- TF8. **Card structure** (stretched link). An `<a>` inside the `<h2>` holds the URL, and an `after:absolute after:inset-0` overlay keeps the whole card clickable. Tag buttons are `relative z-10`, layered above the overlay, so a tag click never opens the link. No interactive element is nested inside another. S4 (`target`/`rel`) still applies to the title link.
- TF9. **Security.** Tags are untrusted data rendered as React text only (S3). Pills can only be created from tags that exist on a validated link; nothing the visitor types becomes a pill. The schema now rejects empty-string tags (`z.string().trim().min(1)`), so an empty pill or badge can't appear.
- TF10. **Logic stays pure.** `filterLinks(index, query, tags)` gets a third parameter `tags: readonly string[]`, defaulting to `[]` so existing calls still work. Each link's lowercased tags are precomputed once into the index as a `tagSet` (P1).
- TF11. **A11y.**
  - Pills sit in a list labelled "Selected tags".
  - Each tag button's accessible name is "Filter by tag {tag}", and it shows `aria-pressed="true"` while selected.
  - The existing live region (A2) announces the new count.

Out of scope for the tag filter: keeping tags in the URL, a list of all tags, OR logic, tag autocomplete, and turning typed text into pills.

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
export type IndexedLink = Link & { words: readonly string[] };

export const MAX_QUERY_LENGTH = 100;

const WORD_SEPARATOR = /[^\p{L}\p{N}]+/u; // constant: never built from input

export function toWords(text: string): string[] {
  return text.toLowerCase().split(WORD_SEPARATOR).filter(Boolean);
}

export function buildSearchIndex(links: Link[]): IndexedLink[] {
  return links
    .filter((link) => link.active)
    .map((link) => ({
      ...link,
      // P1: tokenised once; duplicates removed so each check scans fewer words.
      words: [...new Set(toWords([link.title, link.description ?? "", ...link.tags].join(" ")))],
    }));
}

export function filterLinks(index: IndexedLink[], query: string): IndexedLink[] {
  const terms = query.trim().slice(0, MAX_QUERY_LENGTH).toLowerCase().split(/\s+/).filter(Boolean); // B5 unchanged
  if (terms.length === 0) return index; // B2
  return index.filter((link) =>
    terms.every((term) => link.words.some((word) => word.startsWith(term))),
  );
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
- With the sample data: 5 cards show initially (`link_005` is inactive). "art" → 2 cards (prints, watercolour; **not** the starter kit). "start" → 1 (starter kit). "news" → 1 (newsletter). "rints" → no-results. "(" and "free-drawing" → no-results (a term containing punctuation can't be the start of a letters-and-digits word). "BEGINNER" → 2. "free drawing" → 1. "zzz" → no-results state. "podcast" → 1 card with no description line.
- Tag filter with the sample data:
  - Clicking `art` on any card leaves 2 cards (prints, watercolour; the inactive commission link stays hidden).
  - Then clicking `beginner` leaves 1 (watercolour).
  - The `beginner` pill plus the text "free" leaves 1 (starter kit).
  - The `art` pill plus "zzz" shows `No links match "zzz" tagged art`.
  - Removing the pills with × or Backspace restores the previous results.
  - A tag click never changes `window.location` or opens a tab.
- Injecting records with `url: "javascript:alert(1)"` or `url: "https://example.com@evil.com"` into the data results in no card for either and no error.

## Decisions (resolved 2026-10-27)

1. **Matching:** ~~plain substring~~ → **word-prefix**, superseded 2026-10-27 at the user's request, because "art" returned "starter" results. See B3. Query splitting (B5) is unchanged.
2. **Invalid links:** dropped at load, with a dev-only `console.warn`. They are not rendered as disabled cards.
3. **Data loading:** a static `import` of `src/data/data.json`. There is no fetch and no loading state.
4. **URL allowlist:** exact `origin` match against `["https://example.com"]`. Subdomains are not allowed.
