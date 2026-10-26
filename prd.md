# Link Search UI — PRD

**Context:** 1-hour interactive coding test. The goal is production-quality judgment, not feature count. Every choice should be explainable while building.

**Stack:** React, TypeScript, Tailwind, shadcn/ui components. Local data (`data.json`), no backend.

## Priorities (in order)

1. Security
2. Business logic
3. Performance
4. Accessibility (stretch)

## 1. Security — treat `data.json` as untrusted creator input

- Validate data at the boundary with a runtime schema (zod). Skip malformed records instead of crashing.
- Allowlist link origins: only `https://example.com` (exact `URL.origin` match). Everything else is dropped, including other schemes like `javascript:`, look-alike hosts and subdomains.
- Render all text through React only. No `dangerouslySetInnerHTML`, including for any match highlighting.
- Outbound links: `target="_blank" rel="noopener noreferrer"`.
- Search input: trim and cap length (e.g. 100 chars). Never build a regex from user input; use plain substring matching.

## 2. Business logic

- One page: creator header (name, bio) and link cards for that creator.
- Show active links only (`active: true`).
- Visitors type keywords into a search bar. Matching checks title, description, and tags.
- Matching is case-insensitive.
- `description` may be `null`. Handle it safely.
- An empty or whitespace-only query shows all active links.
- Multi-word query: a link matches if **every** word appears in at least one of title, description, or tags.
- Each card opens the link's destination.
- Clear no-results state that echoes the query.
- Filtering lives in a pure function, `filterLinks(links, query)`, with unit tests covering: inactive excluded, case-insensitivity, null description, tag match, empty query, multi-word query, and no results.

## 3. Performance — sized for ~1,000 links, no premature optimization

- Normalize once: precompute a lowercased search string per link after validation, not on every keystroke.
- Derive results with `useMemo` from `[index, query]`. No `useEffect` + `setState` filtering.
- Use `useDeferredValue` on the query so typing stays responsive (no debounce).
- Use stable keys (`link.id`).
- Skipped on purpose: virtualization, web workers, fuzzy-search libraries. A linear scan is well under 1 ms at this scale.

## 4. Accessibility (stretch)

- Labelled search input.
- Result count announced via `aria-live="polite"`.
- Cards are real `<a>` elements and work with the keyboard.

## Out of scope

Auth, editing link properties, backend, routing, state libraries, CI/deployment, CSP headers, fuzzy search, dark mode.
