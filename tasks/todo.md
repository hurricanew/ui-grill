# Tasks: Creator Link Search

See [plan.md](plan.md) for the order, time box and risks.

- [x] **T1: Scaffold (10 min)**
  - Acceptance: Vite React-TS app with Tailwind v4 and shadcn (`card input badge button`). The `@/` alias works. Vitest + jsdom + RTL are configured. `data.json` has moved to `src/data/`. `zod` is installed.
  - Verify: `npm run dev` renders the page; `npx vitest run` exits cleanly; `npx tsc -b --noEmit` passes.
  - Files: `package.json`, `vite.config.ts`, `tsconfig*.json`, `src/index.css`, `src/data/data.json`

- [x] **T2: Schema + origin allowlist, test first (10 min)**
  - Acceptance: `LinkSchema` and `CreatorDataSchema` exist. `isAllowedUrl()` uses an exact `URL.origin` match against `ALLOWED_ORIGINS`. `parseCreatorData(raw)` returns `{ creator, links }`, drops invalid links with a dev warning, and never throws. Covers S1 and S2.
  - Verify: `npx vitest run src/lib/schema.test.ts` is green. The table test covers `javascript:`, `http:`, `example.com.evil.com`, `example.com@evil.com`, `www.`, `:8443`, an unparseable URL, a missing title, `tags: null`, and a valid record.
  - Files: `src/lib/schema.ts`, `src/lib/schema.test.ts`

- [x] **T3: Search logic, test first (8 min)**
  - Acceptance: `buildSearchIndex()` keeps only active links and precomputes a lowercased `haystack`. `filterLinks()` does the trim, the 100-char cap and whitespace splitting, and returns links where every term matches. Source order is preserved. Covers B1–B5, B7, S5 and P1.
  - Verify: `npx vitest run src/lib/search.test.ts` is green. Sample-data cases: "" → 5, "art" → 3, "BEGINNER" → 2, "free drawing" → 1, "zzz" → 0, "podcast" → 1.
  - Files: `src/lib/search.ts`, `src/lib/search.test.ts`

- [x] **T4: Components + wiring (15 min)**
  - Acceptance: `CreatorHeader`, `SearchBar` (`maxLength={100}`), `LinkCard` (a single `<a>`, `target="_blank" rel="noopener noreferrer"`, no description line when null, tags as badges) and `NoResults` (echoes the query, has a "Clear search" button) exist. `App` keeps `query` state, uses `useDeferredValue`, wraps `filterLinks` in `useMemo`, keys cards by `link.id`, and builds the index once at module scope. No `dangerouslySetInnerHTML` anywhere. Covers B6, S3, S4 and P2–P4.
  - UI contract fixed by `App.test.tsx` (T5 was written first):
    - `App` takes an optional `data?: unknown` prop (defaults to `data.json`) and parses and indexes it in `useMemo`.
    - If the payload is invalid, the page shows "This profile is unavailable." and no search bar.
    - The creator name is an `<h1>`.
    - The search input is `type="search"` with `maxLength={100}`.
    - Each card is one `<a>` that contains an `<h2>` title and tags as separate elements.
    - The no-results text reads `No links match "…"`.
    - The "Clear search" button empties the input and moves focus back to it.
  - Verify: `npx vitest run src/App.test.tsx` goes green (14 tests); manual check in `npm run dev` with the sample queries from T3; `grep -r dangerouslySetInnerHTML src` returns nothing; `tsc` passes.
  - Files: `src/components/{CreatorHeader,SearchBar,LinkCard,NoResults}.tsx`, `src/App.tsx`

- [x] **T5: Integration test (6 min)**, written before T4 as its red test
  - Acceptance: an RTL test renders `App` and checks: 5 cards initially; typing "beginner" leaves 2; typing "zzz" shows the no-results state with the query; "Clear search" brings back 5 cards; a card has the correct `href`, `target` and `rel`.
  - Verify: `npx vitest run` (the whole suite) is green; `npm run build` passes.
  - Files: `src/App.test.tsx`

- [x] **T6: A11y pass + final check, stretch (4 min)**
  - Acceptance: the input has a `<label>` (can be `sr-only`). The result count sits in an `aria-live="polite"` region. Cards show a visible focus ring. Covers A1–A3.
  - Verify: keyboard tab-through in the browser; add an assertion to `App.test.tsx` that finds the input via `getByLabelText`; then run `npx vitest run && npx tsc -b --noEmit && npm run build`.
  - Files: `src/components/SearchBar.tsx`, `src/components/LinkCard.tsx`, `src/App.tsx`, `src/App.test.tsx`

## Feature: Tag filter (SPEC TF1–TF11)

- [ ] **TF-A: Logic (test first)**
  - Acceptance: `filterLinks(index, query, tags = [])` does exact, case-insensitive tag matching with AND, combined with the text query by AND. Each link's lowercased tags are precomputed into `tagSet`. The schema rejects empty or whitespace-only tags.
  - Verify: `npx vitest run src/lib` is green.
  - Files: `src/lib/search.ts`, `src/lib/search.test.ts`, `src/lib/schema.ts`, `src/lib/schema.test.ts`
- [ ] **TF-B: Card restructure (stretched link + tag buttons)**
  - Acceptance:
    - The card is an `<article>` labelled by its title.
    - The title `<a>` keeps `target` and `rel`, and an overlay keeps the whole card clickable.
    - Tags are buttons, never inside an `<a>`, labelled "Filter by tag {tag}" with `aria-pressed`.
    - The integration tests that depended on the old card structure are updated.
  - Verify: `npm test` is green.
  - Files: `src/components/LinkCard.tsx`, `src/App.test.tsx`
- [ ] **TF-C: Pill search box + wiring**
  - Acceptance:
    - Pills appear inside the search box, in a list labelled "Selected tags".
    - × removes a pill, Backspace in an empty input removes the last one, and both return focus to the input.
    - "Clear search" clears the text and the pills.
    - Tags are not deferred.
    - The no-results message echoes both the query and the tags.
  - Verify: `npm test`, `npm run typecheck`, `npm run lint` and `npm run build` all pass.
  - Files: `src/components/SearchBar.tsx`, `src/components/NoResults.tsx`, `src/App.tsx`, `src/App.test.tsx`
