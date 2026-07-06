# Pulsatlas Auto-Play Time-Lapse Scrubber Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a play/pause control that auto-advances Pulsatlas's date scrubber one day per second, so users can watch a region's event history unfold as a time-lapse instead of manually stepping through dates.

**Architecture:** A new `usePlayback` hook owns all playback timing/prefetch state and drives the existing `dashDate` state in `app/page.tsx` through the same `setDate` path manual date-picker edits already use — `useEvents` and `Globe` need no changes. A new `PlaybackButton` component renders the play/pause control. `/api/events` gains `Cache-Control` headers (via a small pure helper) so a prefetched day resolves from HTTP cache instead of hitting Netlify Blobs twice.

**Tech Stack:** Next.js (App Router, TypeScript), React hooks, Vitest + `@testing-library/react` + `vi.useFakeTimers()`. No new dependencies.

## Global Constraints

- Fixed 1000ms tick interval — no adjustable speed (spec §"Out of Scope").
- Playback auto-stops when the next tick would exceed `max` (today) — never advances past it, never loops.
- Hard cut between days — no cross-fade/point animation.
- Play/pause button sits next to `TimeScrubber`'s date input in `app/page.tsx`, not inside `TimeScrubber` itself — `TimeScrubber` stays a pure controlled component with no playback awareness.
- Manual date-picker interaction while playing stops playback instead of fighting it.
- Prefetch failures are silently ignored (best-effort cache warming only); a real fetch failure during playback shows the existing error/retry banner and playback keeps ticking regardless.
- Category changes during playback are read fresh per-fetch, not captured once at play-start — do not pause on filter change.
- `Cache-Control`: `public, max-age=60` when the requested date is today; `public, max-age=31536000, immutable` for any earlier date (finalized days never change).

---

### Task 1: Cache-Control header helper + wire into `/api/events`

**Files:**
- Create: `lib/gdelt/cacheControl.ts`
- Modify: `app/api/events/route.ts`
- Test: `tests/gdelt/cacheControl.test.ts`

**Interfaces:**
- Produces: `cacheControlFor(date: string, today: string): string` — both args are `YYYYMMDD` compact-format strings (matching `/api/events`'s existing `date` query param format and `todayUtc()`'s return type from `lib/date.ts`).

- [ ] **Step 1: Write the failing test**

Create `tests/gdelt/cacheControl.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { cacheControlFor } from '@/lib/gdelt/cacheControl'

describe('cacheControlFor', () => {
  it('uses a short cache for today (data may still be filling in)', () => {
    expect(cacheControlFor('20260706', '20260706')).toBe('public, max-age=60')
  })

  it('uses a long immutable cache for any date before today', () => {
    expect(cacheControlFor('20260705', '20260706')).toBe('public, max-age=31536000, immutable')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/gdelt/cacheControl.test.ts
```
Expected: FAIL — cannot find module `@/lib/gdelt/cacheControl`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/gdelt/cacheControl.ts`:
```ts
export function cacheControlFor(date: string, today: string): string {
  if (date === today) return 'public, max-age=60'
  return 'public, max-age=31536000, immutable'
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/gdelt/cacheControl.test.ts
```
Expected: PASS — both tests pass.

- [ ] **Step 5: Wire the header into the route**

Current `app/api/events/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server'
import { NetlifyBlobStore } from '@/lib/storage/blobStore'
import { ALL_CATEGORIES } from '@/lib/gdelt/categoryMap'
import { queryEvents } from '@/lib/gdelt/eventsQuery'
import type { EventCategory } from '@/lib/gdelt/types'

export async function GET(request: NextRequest) {
  const blobStore = new NetlifyBlobStore()
  const date = request.nextUrl.searchParams.get('date')
  const categoriesParam = request.nextUrl.searchParams.get('categories')

  if (!date || !/^\d{8}$/.test(date)) {
    return NextResponse.json({ error: 'date must be provided as YYYYMMDD' }, { status: 400 })
  }

  const validCategories = new Set<string>(ALL_CATEGORIES)
  const categories = categoriesParam
    ? (categoriesParam
        .split(',')
        .map((c) => c.trim())
        .filter((c) => validCategories.has(c)) as EventCategory[])
    : ALL_CATEGORIES
  const events = await queryEvents(blobStore, date, categories)

  return NextResponse.json({ date, events })
}
```

Replace the final two lines (`const events = ...` and `return NextResponse.json(...)`) so the file ends with:
```ts
import { NextRequest, NextResponse } from 'next/server'
import { NetlifyBlobStore } from '@/lib/storage/blobStore'
import { ALL_CATEGORIES } from '@/lib/gdelt/categoryMap'
import { queryEvents } from '@/lib/gdelt/eventsQuery'
import { cacheControlFor } from '@/lib/gdelt/cacheControl'
import { todayUtc } from '@/lib/date'
import type { EventCategory } from '@/lib/gdelt/types'

export async function GET(request: NextRequest) {
  const blobStore = new NetlifyBlobStore()
  const date = request.nextUrl.searchParams.get('date')
  const categoriesParam = request.nextUrl.searchParams.get('categories')

  if (!date || !/^\d{8}$/.test(date)) {
    return NextResponse.json({ error: 'date must be provided as YYYYMMDD' }, { status: 400 })
  }

  const validCategories = new Set<string>(ALL_CATEGORIES)
  const categories = categoriesParam
    ? (categoriesParam
        .split(',')
        .map((c) => c.trim())
        .filter((c) => validCategories.has(c)) as EventCategory[])
    : ALL_CATEGORIES
  const events = await queryEvents(blobStore, date, categories)

  return NextResponse.json(
    { date, events },
    { headers: { 'Cache-Control': cacheControlFor(date, todayUtc()) } }
  )
}
```

- [ ] **Step 6: Verify the full suite and build still pass**

```bash
npm run test
npx tsc --noEmit
npm run build
```
Expected: all existing tests still pass (route.ts has no dedicated test file per project convention — thin routes aren't unit tested), zero type errors, build succeeds.

- [ ] **Step 7: Commit**

```bash
git add lib/gdelt/cacheControl.ts tests/gdelt/cacheControl.test.ts app/api/events/route.ts
git commit -m "feat: add Cache-Control headers to /api/events for playback prefetch"
```

---

### Task 2: `usePlayback` hook

**Files:**
- Create: `lib/usePlayback.ts`
- Test: `tests/usePlayback.test.ts`

**Interfaces:**
- Consumes: `toCompactDate` from `lib/date.ts`; `EventCategory` from `lib/gdelt/types.ts`.
- Produces: `usePlayback(currentDate: string, setDate: (next: string) => void, options: { min: string, max: string, categories: EventCategory[] }): { isPlaying: boolean, toggle: () => void }`. `currentDate`, `options.min`, `options.max` are dash-format (`YYYY-MM-DD`) strings, matching `TimeScrubber`'s `value`/`min`/`max` props and `app/page.tsx`'s `dashDate` state. Used by Task 4's `app/page.tsx` wiring.

- [ ] **Step 1: Write the failing tests**

Create `tests/usePlayback.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePlayback } from '@/lib/usePlayback'

beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({}) } as Response)
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('usePlayback', () => {
  it('prefetches the next day on start, then advances and prefetches on each tick', () => {
    const setDate = vi.fn()
    const { result } = renderHook(() =>
      usePlayback('2026-07-01', setDate, { min: '2026-07-01', max: '2026-07-10', categories: ['conflict'] })
    )

    act(() => result.current.toggle())
    expect(result.current.isPlaying).toBe(true)
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('date=20260702'))
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('categories=conflict'))

    act(() => vi.advanceTimersByTime(1000))
    expect(setDate).toHaveBeenCalledWith('2026-07-02')
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('date=20260703'))
  })

  it('stops playback when the next tick would exceed max, without calling setDate past it', () => {
    const setDate = vi.fn()
    const { result, rerender } = renderHook(
      ({ currentDate }) =>
        usePlayback(currentDate, setDate, { min: '2026-07-01', max: '2026-07-10', categories: ['conflict'] }),
      { initialProps: { currentDate: '2026-07-09' } }
    )

    act(() => result.current.toggle())
    act(() => vi.advanceTimersByTime(1000))
    expect(setDate).toHaveBeenCalledWith('2026-07-10')
    expect(result.current.isPlaying).toBe(true)

    rerender({ currentDate: '2026-07-10' })
    act(() => vi.advanceTimersByTime(1000))
    expect(setDate).toHaveBeenCalledTimes(1)
    expect(result.current.isPlaying).toBe(false)
  })

  it('toggle stops an in-progress playback', () => {
    const setDate = vi.fn()
    const { result } = renderHook(() =>
      usePlayback('2026-07-01', setDate, { min: '2026-07-01', max: '2026-07-10', categories: ['conflict'] })
    )

    act(() => result.current.toggle())
    expect(result.current.isPlaying).toBe(true)

    act(() => result.current.toggle())
    expect(result.current.isPlaying).toBe(false)

    act(() => vi.advanceTimersByTime(5000))
    expect(setDate).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/usePlayback.test.ts
```
Expected: FAIL — cannot find module `@/lib/usePlayback`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/usePlayback.ts`:
```ts
'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toCompactDate } from './date'
import type { EventCategory } from './gdelt/types'

const TICK_MS = 1000

function addOneDay(dash: string): string {
  const [y, m, d] = dash.split('-').map(Number)
  const next = new Date(Date.UTC(y, m - 1, d + 1))
  const yyyy = next.getUTCFullYear()
  const mm = String(next.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(next.getUTCDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

interface UsePlaybackOptions {
  min: string
  max: string
  categories: EventCategory[]
}

export function usePlayback(currentDate: string, setDate: (next: string) => void, options: UsePlaybackOptions) {
  const [isPlaying, setIsPlaying] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const stateRef = useRef({ currentDate, ...options })
  stateRef.current = { currentDate, ...options }

  const prefetch = useCallback((dashDate: string) => {
    const date = toCompactDate(dashDate)
    const categories = stateRef.current.categories.join(',')
    fetch(`/api/events?date=${date}&categories=${categories}`).catch(() => {})
  }, [])

  const stop = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setIsPlaying(false)
  }, [])

  const tick = useCallback(() => {
    const { currentDate: current, max } = stateRef.current
    const next = addOneDay(current)
    if (next > max) {
      stop()
      return
    }
    setDate(next)
    prefetch(addOneDay(next))
  }, [setDate, prefetch, stop])

  const start = useCallback(() => {
    prefetch(addOneDay(stateRef.current.currentDate))
    intervalRef.current = setInterval(tick, TICK_MS)
    setIsPlaying(true)
  }, [prefetch, tick])

  const toggle = useCallback(() => {
    if (isPlaying) {
      stop()
    } else {
      start()
    }
  }, [isPlaying, start, stop])

  useEffect(() => stop, [stop])

  return { isPlaying, toggle }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/usePlayback.test.ts
```
Expected: PASS — all 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/usePlayback.ts tests/usePlayback.test.ts
git commit -m "feat: add usePlayback hook for time-lapse auto-advance"
```

---

### Task 3: `PlaybackButton` component

**Files:**
- Create: `components/PlaybackButton.tsx`
- Test: `tests/components/PlaybackButton.test.tsx`

**Interfaces:**
- Produces: `<PlaybackButton isPlaying={boolean} onToggle={() => void} />` — used by Task 4's `app/page.tsx` wiring.

- [ ] **Step 1: Write the failing test**

Create `tests/components/PlaybackButton.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PlaybackButton } from '@/components/PlaybackButton'

describe('PlaybackButton', () => {
  it('shows a play icon and label when not playing', () => {
    render(<PlaybackButton isPlaying={false} onToggle={() => {}} />)
    const button = screen.getByRole('button', { name: 'Play time-lapse' })
    expect(button).toHaveTextContent('▶')
    expect(button).toHaveAttribute('aria-pressed', 'false')
  })

  it('shows a pause icon and label when playing', () => {
    render(<PlaybackButton isPlaying={true} onToggle={() => {}} />)
    const button = screen.getByRole('button', { name: 'Pause playback' })
    expect(button).toHaveTextContent('⏸')
    expect(button).toHaveAttribute('aria-pressed', 'true')
  })

  it('calls onToggle when clicked', () => {
    const onToggle = vi.fn()
    render(<PlaybackButton isPlaying={false} onToggle={onToggle} />)
    screen.getByRole('button').click()
    expect(onToggle).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/components/PlaybackButton.test.tsx
```
Expected: FAIL — cannot find module `@/components/PlaybackButton`.

- [ ] **Step 3: Write minimal implementation**

Create `components/PlaybackButton.tsx`:
```tsx
'use client'
interface PlaybackButtonProps {
  isPlaying: boolean
  onToggle: () => void
}

export function PlaybackButton({ isPlaying, onToggle }: PlaybackButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={isPlaying ? 'Pause playback' : 'Play time-lapse'}
      aria-pressed={isPlaying}
      className="rounded-md border border-white/10 bg-card px-2 py-1.5 text-sm text-foreground transition duration-150 ease hover:border-accent active:scale-[0.97]"
    >
      {isPlaying ? '⏸' : '▶'}
    </button>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/components/PlaybackButton.test.tsx
```
Expected: PASS — all 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/PlaybackButton.tsx tests/components/PlaybackButton.test.tsx
git commit -m "feat: add PlaybackButton component"
```

---

### Task 4: Wire playback into the home page

**Files:**
- Modify: `app/page.tsx`
- Test: `tests/app/page.test.tsx`

**Interfaces:**
- Consumes: `usePlayback` (Task 2), `PlaybackButton` (Task 3).

- [ ] **Step 1: Write the failing test**

`tests/app/page.test.tsx` currently reads:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import HomePage from '@/app/page'
import * as useEventsModule from '@/lib/useEvents'

vi.mock('@/components/Globe', () => ({ Globe: () => <div data-testid="globe" /> }))

describe('HomePage', () => {
  it('renders the globe when events load successfully', () => {
    vi.spyOn(useEventsModule, 'useEvents').mockReturnValue({
      events: [],
      categories: [],
      setCategories: vi.fn(),
      status: 'ready',
      retry: vi.fn(),
    })
    render(<HomePage />)
    expect(screen.getByTestId('globe')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows a retry alert when loading events fails, and retries on click', () => {
    const retry = vi.fn()
    vi.spyOn(useEventsModule, 'useEvents').mockReturnValue({
      events: [],
      categories: [],
      setCategories: vi.fn(),
      status: 'error',
      retry,
    })
    render(<HomePage />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    screen.getByText('Retry').click()
    expect(retry).toHaveBeenCalled()
  })
})
```

Replace it with (adds a mock for `usePlayback` and a new test for the pause-on-manual-date-change behavior):
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import HomePage from '@/app/page'
import * as useEventsModule from '@/lib/useEvents'
import * as usePlaybackModule from '@/lib/usePlayback'

vi.mock('@/components/Globe', () => ({ Globe: () => <div data-testid="globe" /> }))

function mockUseEvents(overrides: Partial<ReturnType<typeof useEventsModule.useEvents>> = {}) {
  vi.spyOn(useEventsModule, 'useEvents').mockReturnValue({
    events: [],
    categories: [],
    setCategories: vi.fn(),
    status: 'ready',
    retry: vi.fn(),
    ...overrides,
  })
}

describe('HomePage', () => {
  it('renders the globe when events load successfully', () => {
    mockUseEvents({ status: 'ready' })
    vi.spyOn(usePlaybackModule, 'usePlayback').mockReturnValue({ isPlaying: false, toggle: vi.fn() })
    render(<HomePage />)
    expect(screen.getByTestId('globe')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows a retry alert when loading events fails, and retries on click', () => {
    const retry = vi.fn()
    mockUseEvents({ status: 'error', retry })
    vi.spyOn(usePlaybackModule, 'usePlayback').mockReturnValue({ isPlaying: false, toggle: vi.fn() })
    render(<HomePage />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    screen.getByText('Retry').click()
    expect(retry).toHaveBeenCalled()
  })

  it('stops playback when the date is changed manually while playing', () => {
    mockUseEvents({ status: 'ready' })
    const toggle = vi.fn()
    vi.spyOn(usePlaybackModule, 'usePlayback').mockReturnValue({ isPlaying: true, toggle })
    render(<HomePage />)
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-07-01' } })
    expect(toggle).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify the new one fails**

```bash
npx vitest run tests/app/page.test.tsx
```
Expected: FAIL on the new "stops playback when the date is changed manually" test — `usePlayback` isn't called/wired in `app/page.tsx` yet, so mocking it has no effect and `toggle` is never invoked.

- [ ] **Step 3: Wire `usePlayback` and `PlaybackButton` into the page**

Current `app/page.tsx`:
```tsx
'use client'
import { useState } from 'react'
import { Globe } from '@/components/Globe'
import { CategoryFilter } from '@/components/CategoryFilter'
import { TimeScrubber } from '@/components/TimeScrubber'
import { ArticlePanel } from '@/components/ArticlePanel'
import { AdSlot } from '@/components/AdSlot'
import { SupportLink } from '@/components/SupportLink'
import { useEvents } from '@/lib/useEvents'
import { todayUtc, toDashDate, toCompactDate } from '@/lib/date'
import type { GdeltEvent } from '@/lib/gdelt/types'

const EARLIEST_DATE = '2026-07-01'

export default function HomePage() {
  const [dashDate, setDashDate] = useState(toDashDate(todayUtc()))
  const { events, categories, setCategories, status, retry } = useEvents(toCompactDate(dashDate))
  const [selectedEvent, setSelectedEvent] = useState<GdeltEvent | null>(null)

  return (
    <main className="relative bg-background font-body text-foreground">
      <div className="fixed inset-0 z-0">
        <Globe events={events} onSelectEvent={setSelectedEvent} />
      </div>

      <div className="pointer-events-none fixed inset-0 z-10 flex flex-col">
        <header className="pointer-events-auto flex flex-wrap items-center justify-between gap-3 border-b border-white/5 bg-card/70 px-4 py-3 backdrop-blur-md sm:px-6">
          <h1 className="font-heading text-xl font-semibold tracking-tight sm:text-2xl">Pulsatlas</h1>
          <SupportLink />
        </header>

        <div className="pointer-events-auto flex flex-wrap items-center gap-3 border-b border-white/5 bg-card/40 px-4 py-3 backdrop-blur-md sm:px-6">
          <CategoryFilter selected={categories} onChange={setCategories} />
          <TimeScrubber value={dashDate} min={EARLIEST_DATE} max={toDashDate(todayUtc())} onChange={setDashDate} />
        </div>
```

Replace the whole file with:
```tsx
'use client'
import { useState } from 'react'
import { Globe } from '@/components/Globe'
import { CategoryFilter } from '@/components/CategoryFilter'
import { TimeScrubber } from '@/components/TimeScrubber'
import { PlaybackButton } from '@/components/PlaybackButton'
import { ArticlePanel } from '@/components/ArticlePanel'
import { AdSlot } from '@/components/AdSlot'
import { SupportLink } from '@/components/SupportLink'
import { useEvents } from '@/lib/useEvents'
import { usePlayback } from '@/lib/usePlayback'
import { todayUtc, toDashDate, toCompactDate } from '@/lib/date'
import type { GdeltEvent } from '@/lib/gdelt/types'

const EARLIEST_DATE = '2026-07-01'

export default function HomePage() {
  const [dashDate, setDashDate] = useState(toDashDate(todayUtc()))
  const { events, categories, setCategories, status, retry } = useEvents(toCompactDate(dashDate))
  const [selectedEvent, setSelectedEvent] = useState<GdeltEvent | null>(null)
  const { isPlaying, toggle } = usePlayback(dashDate, setDashDate, {
    min: EARLIEST_DATE,
    max: toDashDate(todayUtc()),
    categories,
  })

  function handleDateChange(next: string) {
    if (isPlaying) toggle()
    setDashDate(next)
  }

  return (
    <main className="relative bg-background font-body text-foreground">
      <div className="fixed inset-0 z-0">
        <Globe events={events} onSelectEvent={setSelectedEvent} />
      </div>

      <div className="pointer-events-none fixed inset-0 z-10 flex flex-col">
        <header className="pointer-events-auto flex flex-wrap items-center justify-between gap-3 border-b border-white/5 bg-card/70 px-4 py-3 backdrop-blur-md sm:px-6">
          <h1 className="font-heading text-xl font-semibold tracking-tight sm:text-2xl">Pulsatlas</h1>
          <SupportLink />
        </header>

        <div className="pointer-events-auto flex flex-wrap items-center gap-3 border-b border-white/5 bg-card/40 px-4 py-3 backdrop-blur-md sm:px-6">
          <CategoryFilter selected={categories} onChange={setCategories} />
          <TimeScrubber value={dashDate} min={EARLIEST_DATE} max={toDashDate(todayUtc())} onChange={handleDateChange} />
          <PlaybackButton isPlaying={isPlaying} onToggle={toggle} />
        </div>
```

Leave everything from `{status === 'error' && (` through the end of the file exactly as it is today — only the imports, the two new lines inside the component body (`usePlayback` call and `handleDateChange`), and the `TimeScrubber`/new `PlaybackButton` line in the filter bar change.

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/app/page.test.tsx
```
Expected: PASS — all 3 tests pass.

- [ ] **Step 5: Run the full suite, typecheck, and build**

```bash
npm run test
npx tsc --noEmit
npm run build
```
Expected: full suite passes (should now be 43 + 2 (cacheControl) + 3 (usePlayback) + 3 (PlaybackButton) + 1 new page test = 52 tests across 17 files), zero type errors, build succeeds.

- [ ] **Step 6: Manual verification**

Run `npm run dev`, open the app, click the new ▶ button next to the date picker. Confirm: the date advances once per second, the globe's pins update each tick (hard cut), clicking the button again (now ⏸) stops it, manually changing the date while playing stops playback, and playback auto-stops when it reaches today.

- [ ] **Step 7: Commit**

```bash
git add app/page.tsx tests/app/page.test.tsx
git commit -m "feat: wire time-lapse playback into the home page"
```
