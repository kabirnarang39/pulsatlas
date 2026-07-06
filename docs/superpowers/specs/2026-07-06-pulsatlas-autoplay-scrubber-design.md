# Pulsatlas — Auto-Play Time-Lapse Scrubber — Design Spec

Date: 2026-07-06
Status: Approved, pending implementation plan

## 0. Context

This is sub-project #1 of a larger feature roadmap for Pulsatlas (a GDELT-powered 3D globe news explorer, v1 already shipped and deployed). The roadmap was decomposed into independent sub-projects rather than one mega-plan:

1. **Auto-play time-lapse scrubber** (this spec) — biggest UX/value add, no new data pipeline
2. Tone + GKG themes (richer categories, sentiment coloring)
3. Search + fly-to camera
4. Real headline previews (og:title scrape)
5. Hybrid list view
6. Followed countries/topics + shareable deep links
7. Accessible list-view fallback + PWA
8. Paid tier (AI digest/export)

Each gets its own spec → plan → implementation cycle. This spec covers #1 only.

## 1. Overview

Turn the existing static date-picker scrubber into a time-lapse player: a play/pause button that auto-advances the displayed day, one day per second, so a user can watch a region's event history unfold instead of manually stepping through dates one at a time.

## 2. Architecture

A new `usePlayback` hook owns all playback state (interval timer, prefetching) and drives the existing `dashDate` state in `app/page.tsx` exactly the way manual date-picker interaction already does — no changes to `useEvents` or `Globe` are needed, since both already react to `dashDate` changes generically. A small addition to `app/api/events/route.ts` sets HTTP cache headers so a prefetched day's response is reused instantly by the real fetch that follows it, instead of hitting Netlify Blobs twice.

## 3. Components

- **`lib/usePlayback.ts`** — `usePlayback(currentDate: string, setDate: (d: string) => void, options: { min: string, max: string }): { isPlaying: boolean, toggle: () => void }`
  - `toggle()` starts or stops playback.
  - On start: immediately fires a background `fetch` for `currentDate + 1 day` (cache warm-up), then starts a 1000ms `setInterval`.
  - On each tick: compute `next = current + 1 day`.
    - If `next` is after `max` (today), stop playback (set `isPlaying` false, clear the interval) — do not advance past `max`.
    - Otherwise, call `setDate(next)` and fire a background `fetch` for `next + 1 day` (warms the cache for the *following* tick).
  - `toggle()` while playing stops the interval and clears any pending prefetch.
  - Dates use the same `YYYY-MM-DD` / `YYYYMMDD` conversion helpers already in `lib/date.ts` (`toCompactDate`, `toDashDate`) — this hook operates on dash-format dates (matching `TimeScrubber`'s `value` prop) and converts internally when building the prefetch URL (compact format, matching `/api/events`'s `date` query param).
  - The prefetch fetch reads the currently-selected categories fresh at call time (not captured once at play-start), so a category change mid-playback is reflected on the very next fetch — see §5 for why this doesn't need to pause playback.

- **Play/pause button** — a new icon button rendered next to `TimeScrubber`'s date input (inside the same `<label>` row in `app/page.tsx`'s filter bar, not inside `TimeScrubber` itself, since `TimeScrubber` stays a pure controlled date-input component with no playback awareness). Shows ▶ when `!isPlaying`, ⏸ when `isPlaying`. Calls `usePlayback`'s `toggle`.

- **Manual date changes pause playback**: `app/page.tsx`'s existing `onChange` handler for `TimeScrubber` (currently just `setDashDate`) also calls `usePlayback`'s stop path if a manual edit happens mid-playback — the hook exposes this by having `toggle()` be idempotent-safe to call, and `app/page.tsx` calls `toggle()` before `setDashDate` if `isPlaying` is currently true, so manual scrubbing while playing stops the auto-advance instead of fighting it.

- **`app/api/events/route.ts`** — after building the JSON response, set:
  - `Cache-Control: public, max-age=60` when `date` equals today's compact date (data may still be filling in during the day).
  - `Cache-Control: public, max-age=31536000, immutable` when `date` is any date before today (per the existing finalize-day design, once a day is finalized its data never changes — safe to cache for a year).

## 4. Data Flow

1. User clicks ▶.
2. `usePlayback` fires a background fetch for `currentDate + 1` (compact date, currently-selected categories).
3. 1000ms later, tick fires: `next = currentDate + 1`. If `next > max`, stop (auto-pause at today). Otherwise `setDate(next)`.
4. `app/page.tsx`'s existing `useEvents(toCompactDate(dashDate))` call re-fires its fetch effect (unchanged code path) for `next` — resolves from the warm HTTP cache set up in step 2, so there's no visible loading gap.
5. `Globe` re-renders with the new day's events — hard cut, no cross-fade (matches the app's existing lack of point-level transition animation; introducing one is out of scope for this sub-project).
6. `usePlayback` fires a background fetch for `next + 1`, warming the cache for the *following* tick.
7. Repeat from step 3 until `next > max`, or the user clicks ⏸, or manually changes the date (which also stops playback).

## 5. Error Handling

- **Prefetch failures**: best-effort only, caught and silently ignored. They exist purely to warm the HTTP cache; if one fails, the real fetch inside `useEvents` still fires normally on the next tick and either succeeds or shows the existing `status === 'error'` retry banner — playback behavior is unchanged either way.
- **A day's real fetch fails during playback**: playback keeps ticking regardless. The existing error/retry banner shows for that day as it already does outside of playback; the next tick moves to a new date and fetches again, which self-heals from a transient failure without any playback-specific error handling being added.
- **Category filter changes during playback**: for v1, changing categories while playing does **not** pause playback (simpler than wiring a pause-on-filter-change rule) — the next tick's prefetch and the real fetch both use whatever categories are selected at the moment each fetch fires, read fresh each time rather than captured once at play-start. This is a deliberate simplification; if it feels wrong in practice, pausing on filter change is a one-line follow-up.

## 6. Out of Scope (this sub-project)

- Adjustable playback speed (fixed 1 tick/second only, per approved design)
- Looping playback back to the start date (auto-stops at today instead)
- Cross-fade/point-level transition animation between days (hard cut only)
- A full timeline slider UI (play button stays next to the existing native date input)
- Any change to `useEvents`, `Globe`, or `TimeScrubber`'s own props/behavior

## 7. Testing

- `usePlayback`: unit tests using `vi.useFakeTimers()` — verify (a) each tick advances the date by exactly one day, (b) playback auto-stops when the next tick would exceed `max` (no `setDate` call past the boundary), (c) `toggle()` starts and stops the interval correctly, (d) a prefetch `fetch` call fires for `current+1` immediately on start and for `next+1` on each subsequent tick, with the correct compact-date URL.
- Play/pause button: component test verifying it renders ▶/⏸ based on `isPlaying` and calls `toggle` on click.
- `/api/events` route: unit test (via the existing thin-route conventions — extend `queryEvents`'s test file or add a small route-level check) verifying the two `Cache-Control` header cases (today vs. a past date).
- Manual: verify smooth playback in a real browser at 1 tick/second, confirm auto-stop at today, confirm manual date-picker interaction stops playback.
