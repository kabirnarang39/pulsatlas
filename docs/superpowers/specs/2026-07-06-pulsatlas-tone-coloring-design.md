# Pulsatlas — Tone Coloring — Design Spec

Date: 2026-07-06
Status: Approved, pending implementation plan

## 0. Context

This is sub-project #2a of the Pulsatlas feature roadmap (see `docs/superpowers/specs/2026-07-06-pulsatlas-autoplay-scrubber-design.md` §0 for the full list; #1 auto-play scrubber already shipped). The original roadmap item #2 ("Tone + GKG themes") was split in two during brainstorming: this spec covers only tone coloring (small, uses data already ingested). GKG theme ingestion becomes its own future sub-project (#2b) — a much larger addition (new GDELT dataset, new ingest/parsing/storage) that doesn't belong in the same spec.

## 1. Overview

A "Category / Tone" toggle in the filter bar switches how globe pins are colored. Category mode (the current, unchanged default) colors pins by event category. Tone mode recolors every pin on a continuous red→gray→green gradient based on each event's `avgTone` field — already parsed and stored on every event, currently unused anywhere in the app. The article side-panel shows the tone value and a plain-language label regardless of which mode is active.

## 2. Architecture

- **`lib/gdelt/toneColor.ts`** — new pure function `toneColor(avgTone: number): string`, returning a hex color string. Clamps input to `[-10, 10]` (covers the large majority of real GDELT tone values) and linearly interpolates through three color stops reusing existing theme tokens — no new colors introduced:
  - `avgTone <= -10` → `#EF4444` (existing `destructive` token)
  - `avgTone === 0` → `#94A3B8` (existing `muted` token)
  - `avgTone >= 10` → `#22C55E` (existing `cooperation` category color)
  - Values between stops interpolate linearly per RGB channel between the two nearest stops (negative half: red→gray; positive half: gray→green).

- **`components/ColorModeToggle.tsx`** — new component, two pill buttons ("Category" / "Tone"), styled consistently with `CategoryFilter`'s existing pill buttons. Props: `mode: 'category' | 'tone'`, `onChange: (next: 'category' | 'tone') => void`.

- **`components/Globe.tsx`** — gains a new `colorMode: 'category' | 'tone'` prop. Its `pointColor` callback branches: `colorMode === 'category'` uses the existing `CATEGORY_COLORS[event.category]` lookup unchanged; `colorMode === 'tone'` calls `toneColor(event.avgTone)` instead.

- **`app/page.tsx`** — owns new `colorMode` state (`useState<'category' | 'tone'>('category')`), renders `ColorModeToggle` in the filter bar next to `CategoryFilter`, passes `colorMode` through to `Globe`.

- **`components/ArticlePanel.tsx`** — gains a new line showing the tone value and label, always rendered regardless of `colorMode` (it's informational content about the selected event, not tied to the map's current color mode). Label thresholds: `avgTone < -1` → "Negative", `-1 <= avgTone <= 1` → "Neutral", `avgTone > 1` → "Positive". Displayed as e.g. `Tone: -4.2 · Negative`.

## 3. Data Flow

1. User clicks the "Tone" pill in `ColorModeToggle`.
2. `app/page.tsx`'s `colorMode` state flips to `'tone'`.
3. `Globe` re-renders with the same `events` array (no new fetch — this is a pure client-side recoloring), computing each pin's color via `toneColor(event.avgTone)` instead of the category lookup.
4. Clicking a pin still opens the same `ArticlePanel` as before; the new tone line renders using `renderedEvent.avgTone` regardless of which `colorMode` is currently active on the globe.
5. Switching back to "Category" reverts pin colors to the category lookup; no data changes, purely a re-render with a different color function.

## 4. Error Handling

No new failure modes. `avgTone` is a required numeric field on every `GdeltEvent` already (see `lib/gdelt/parseEvents.ts`, which defaults it to `0` if GDELT's export ever omits the field) — `toneColor` always receives a valid number and never needs to handle `null`/`undefined`/`NaN`.

## 5. Out of Scope

- GKG theme ingestion (separate future sub-project #2b) — no changes to the ingest pipeline, storage schema, or category taxonomy in this spec.
- Persisting the chosen color mode across page reloads (resets to `'category'` on reload, matching the current lack of persistence for category-filter selections — no `localStorage` wiring added here).
- Any change to `useEvents`, the ingest/finalize scheduled functions, or `/api/events`.

## 6. Testing

- **`toneColor`**: unit tests for (a) exact color match at each of the three stops (`-10`, `0`, `10`), (b) clamping behavior for inputs beyond `±10` (e.g. `-50` returns the same color as `-10`), (c) a value strictly between two stops produces an interpolated color that is neither stop's exact value (proves real interpolation, not a hard step function).
- **`ColorModeToggle`**: component test verifying it renders both pills, reflects the active `mode` visually (e.g. `aria-pressed`), and calls `onChange` with the other mode on click.
- **`Globe`**: extend the existing test to verify the `pointColor` callback returns `toneColor`'s output for a fixture event when `colorMode="tone"` is passed, and the existing category-color behavior is unchanged when `colorMode="category"` (default).
- **`ArticlePanel`**: extend the existing test to verify the new tone line renders with the correct label for a negative, a neutral, and a positive `avgTone` fixture value.
