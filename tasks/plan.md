# Plan: Creator Link Search

Implements [SPEC.md](../SPEC.md). Budget: 60 min total, including ~7 min of buffer.

## Approach

Build from the inside out: **pure logic first, UI last.** Security and business logic are the top priorities and they live entirely in `lib/`, so they are built with TDD before any React code exists. If time runs out, what's left unfinished is UI polish, not correctness.

## Dependency graph

```
T1 scaffold ──┬──→ T2 schema + allowlist ──┐
              │                            ├──→ T4 UI + wiring ──→ T5 integration test ──→ T6 a11y + final check
              └──→ T3 search logic ────────┘
```

T2 and T3 both depend only on the `Link` type. The type is defined first in T2, then T3 imports it. So they run in sequence, but neither one's logic blocks the other.

## Phases and time box

| # | Task | Min | Cumulative | Priority covered |
|---|---|---|---|---|
| T1 | Scaffold: Vite, Tailwind, shadcn, Vitest, move data | 10 | 10 | — |
| T2 | `lib/schema.ts`: zod + origin allowlist (TDD) | 10 | 20 | Security S1, S2 |
| T3 | `lib/search.ts`: index + filter (TDD) | 8 | 28 | Business B1–B5, B7, S5; Perf P1 |
| T4 | Components + `App.tsx` wiring | 15 | 43 | B6, S3, S4, P2–P4 |
| T5 | `App.test.tsx` integration | 6 | 49 | End-to-end check of the above |
| T6 | A11y pass + full verification | 4 | 53 | A1–A3 |
| — | Buffer | 7 | 60 | |

## Verification checkpoints

- **After T1:** `npm run dev` serves the page, and `npx vitest run` runs (it may report no tests yet).
- **After T3:** all `lib/` tests are green and `tsc` is clean. *At this point security and business logic are done and demonstrable, even if nothing else is.*
- **After T5:** the full suite, `tsc` and `npm run build` are all green.

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| shadcn + Tailwind v4 + Vite path-alias setup eats time | Overruns T1 | Follow the shadcn Vite guide exactly (`@/*` alias in `tsconfig.json`, `tsconfig.app.json` and `vite.config.ts`). **Hard stop at 12 min:** fall back to plain Tailwind elements and add shadcn later. |
| zod v4 API differs from memory | Small delays in T2 | Use only `z.object/string/array/boolean/nullable` and `safeParse`, which are stable across v3 and v4. |
| Vitest + jsdom + React 19 config friction | Blocks T5 | Configure the `test` block in `vite.config.ts` during T1, so friction shows up early. |
| Running short on time | A11y or polish missing | The order is set by priority. T6 is the stretch item, and the buffer protects T5. |

## Talking points to say out loud

- **Why `origin` comparison:** it defeats `startsWith`/`includes` bypasses such as `example.com@evil.com` and `example.com.evil.com`.
- **Why no `useEffect` filtering:** filtered results are derived state, and syncing them through an effect causes a double render and a stale frame.
- **Why `useDeferredValue` and not debounce:** it never delays the input itself, and it lets React drop stale renders.
- **What was skipped on purpose, and why:** virtualization, fuzzy search, ranking. A linear scan of about 1k links is under 1 ms.
- **Word-prefix matching:** "art" matches "art"/"artist" but not "starter". Words in the data are split on punctuation by a constant regex, and the query is split on whitespace only, so a term like "free-drawing" finds nothing (known limitation).
