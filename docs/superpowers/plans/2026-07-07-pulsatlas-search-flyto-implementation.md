# Pulsatlas Search + Fly-to Camera Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user type a place name in the header, pick from up to 5 matching results, and have the globe camera animate to that location.

**Architecture:** A new `/api/geocode` route proxies Nominatim (OpenStreetMap) with a required custom `User-Agent` header. A new `SearchBox` component owns the debounced input/fetch/dropdown. `Globe` is converted to a `forwardRef` component exposing an imperative `flyTo(lat, lon)` that drives `react-globe.gl`'s own `pointOfView` camera API. `app/page.tsx` wires a `globeRef` between the two.

**Tech Stack:** Next.js (App Router, TypeScript), React `forwardRef`/`useImperativeHandle`, Vitest + `@testing-library/react` + `vi.useFakeTimers()`/`vi.advanceTimersByTimeAsync()`. No new dependencies — `react-globe.gl` already exposes `pointOfView` on its instance ref.

## Global Constraints

- Nominatim request: `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=<query>` with header `User-Agent: Pulsatlas (https://pulsatlas.netlify.app)` — required by Nominatim's usage policy; browsers can't set a custom `User-Agent`, which is why this goes through a server-side route rather than a direct client fetch.
- Debounce: 400ms after the last keystroke before firing the geocode fetch.
- `flyTo(lat, lon)` calls `pointOfView({ lat, lng: lon, altitude: 0.5 }, 1000)` — exact values.
- `/api/geocode` is untested per the existing `/api/events` convention (thin proxy route with no branching logic worth a dedicated test).
- No changes to `useEvents`, the ingest pipeline, or `/api/events`.
- Out of scope: auto-selecting a nearby event pin after flying, search history, keyboard arrow-key navigation in the results dropdown (click/tap only).

---

### Task 1: `/api/geocode` proxy route

**Files:**
- Create: `app/api/geocode/route.ts`

**Interfaces:**
- Produces: `GET /api/geocode?q=<query>` → JSON array of Nominatim results (each with at least `display_name`, `lat`, `lon` as strings) — consumed by Task 2 (`SearchBox`).

This task has no dedicated test file, matching the existing `/api/events` route's convention for thin, low-branching routes.

- [ ] **Step 1: Create the route**

Create `app/api/geocode/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server'

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
const USER_AGENT = 'Pulsatlas (https://pulsatlas.netlify.app)'

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q')
  if (!query) {
    return NextResponse.json({ error: 'q must be provided' }, { status: 400 })
  }

  const url = `${NOMINATIM_URL}?format=json&limit=5&q=${encodeURIComponent(query)}`
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  const results = await response.json()

  return NextResponse.json(results)
}
```

- [ ] **Step 2: Verify it builds and typechecks**

```bash
npx tsc --noEmit
npm run build
```
Expected: zero type errors, build succeeds (the new route appears in the build output route list).

- [ ] **Step 3: Manual verification**

```bash
npm run dev
```
In another terminal: `curl "http://localhost:3000/api/geocode?q=Paris"` — expect a JSON array of results, each with a `display_name` field. `curl "http://localhost:3000/api/geocode"` (no `q`) — expect `{"error":"q must be provided"}` with a 400 status.

- [ ] **Step 4: Commit**

```bash
git add app/api/geocode/route.ts
git commit -m "feat: add /api/geocode proxy route for Nominatim place search"
```

---

### Task 2: `SearchBox` component

**Files:**
- Create: `components/SearchBox.tsx`
- Test: `tests/components/SearchBox.test.tsx`

**Interfaces:**
- Produces: `<SearchBox onSelectPlace={(lat: number, lon: number) => void} />` — used by Task 4 (`app/page.tsx` wiring).

- [ ] **Step 1: Write the failing tests**

Create `tests/components/SearchBox.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SearchBox } from '@/components/SearchBox'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('SearchBox', () => {
  it('fetches only once, 400ms after the last keystroke', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({ json: async () => [] } as Response)

    render(<SearchBox onSelectPlace={() => {}} />)
    const input = screen.getByLabelText('Search a place')

    fireEvent.change(input, { target: { value: 'P' } })
    await vi.advanceTimersByTimeAsync(100)
    fireEvent.change(input, { target: { value: 'Pa' } })
    await vi.advanceTimersByTimeAsync(100)
    fireEvent.change(input, { target: { value: 'Paris' } })

    expect(global.fetch).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(400)

    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(global.fetch).toHaveBeenCalledWith('/api/geocode?q=Paris')
  })

  it('renders results as clickable items showing display_name', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      json: async () => [
        { display_name: 'Paris, Île-de-France, France', lat: '48.8566', lon: '2.3522' },
        { display_name: 'Paris, Texas, United States', lat: '33.6609', lon: '-95.5555' },
      ],
    } as Response)

    render(<SearchBox onSelectPlace={() => {}} />)
    fireEvent.change(screen.getByLabelText('Search a place'), { target: { value: 'Paris' } })
    await vi.advanceTimersByTimeAsync(400)

    expect(await screen.findByText('Paris, Île-de-France, France')).toBeInTheDocument()
    expect(screen.getByText('Paris, Texas, United States')).toBeInTheDocument()
  })

  it('calls onSelectPlace with the correct lat/lon when a result is clicked', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      json: async () => [{ display_name: 'Paris, Île-de-France, France', lat: '48.8566', lon: '2.3522' }],
    } as Response)
    const onSelectPlace = vi.fn()

    render(<SearchBox onSelectPlace={onSelectPlace} />)
    fireEvent.change(screen.getByLabelText('Search a place'), { target: { value: 'Paris' } })
    await vi.advanceTimersByTimeAsync(400)

    ;(await screen.findByText('Paris, Île-de-France, France')).click()
    expect(onSelectPlace).toHaveBeenCalledWith(48.8566, 2.3522)
  })

  it('shows "No results" for an empty response array', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({ json: async () => [] } as Response)

    render(<SearchBox onSelectPlace={() => {}} />)
    fireEvent.change(screen.getByLabelText('Search a place'), { target: { value: 'Zzzzz' } })
    await vi.advanceTimersByTimeAsync(400)

    expect(await screen.findByText('No results')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/components/SearchBox.test.tsx
```
Expected: FAIL — cannot find module `@/components/SearchBox`.

- [ ] **Step 3: Write minimal implementation**

Create `components/SearchBox.tsx`:
```tsx
'use client'
import { useEffect, useRef, useState } from 'react'

interface GeocodeResult {
  display_name: string
  lat: string
  lon: string
}

interface SearchBoxProps {
  onSelectPlace: (lat: number, lon: number) => void
}

const DEBOUNCE_MS = 400

export function SearchBox({ onSelectPlace }: SearchBoxProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GeocodeResult[] | null>(null)
  const requestIdRef = useRef(0)

  useEffect(() => {
    if (!query.trim()) {
      setResults(null)
      return
    }

    const currentRequestId = ++requestIdRef.current
    const timeoutId = setTimeout(async () => {
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`)
        const data: GeocodeResult[] = await res.json()
        if (currentRequestId === requestIdRef.current) {
          setResults(data)
        }
      } catch {
        if (currentRequestId === requestIdRef.current) {
          setResults([])
        }
      }
    }, DEBOUNCE_MS)

    return () => clearTimeout(timeoutId)
  }, [query])

  function handleSelect(result: GeocodeResult) {
    onSelectPlace(Number(result.lat), Number(result.lon))
    setQuery('')
    setResults(null)
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search a place..."
        aria-label="Search a place"
        className="rounded-full border border-white/10 bg-card px-3 py-1.5 text-sm text-foreground transition duration-150 ease focus:border-accent focus:outline-none"
      />
      {results !== null && (
        <div
          role="listbox"
          aria-label="Search results"
          className="absolute right-0 top-full z-30 mt-1 w-64 rounded-lg border border-white/10 bg-card/95 p-1 shadow-xl backdrop-blur-md"
        >
          {results.length === 0 ? (
            <p className="px-2 py-1.5 text-sm text-muted">No results</p>
          ) : (
            results.map((result, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSelect(result)}
                className="block w-full rounded-md px-2 py-1.5 text-left text-sm text-foreground transition duration-150 ease hover:bg-accent/20"
              >
                {result.display_name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/components/SearchBox.test.tsx
```
Expected: PASS — all 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/SearchBox.tsx tests/components/SearchBox.test.tsx
git commit -m "feat: add SearchBox component with debounced Nominatim search"
```

---

### Task 3: `Globe` gains an imperative `flyTo`

**Files:**
- Modify: `components/Globe.tsx`
- Test: `tests/components/Globe.test.tsx` (extend, not replace — but the `vi.mock('react-globe.gl', ...)` factory at the top must be replaced with a ref-forwarding version)

**Interfaces:**
- Produces: `GlobeHandle` type (`{ flyTo: (lat: number, lon: number) => void }`), `Globe` becomes `forwardRef<GlobeHandle, GlobeProps>` — used by Task 4 (`app/page.tsx` wiring).

- [ ] **Step 1: Write the failing test**

Current `tests/components/Globe.test.tsx` mock (the part that changes):
```tsx
vi.mock('react-globe.gl', () => ({
  default: (props: {
    pointsData: GdeltEvent[]
    pointColor: (e: object) => string
    onPointClick: (p: GdeltEvent) => void
  }) => (
    <div data-testid="globe-stub" data-point-count={props.pointsData.length}>
      {props.pointsData.map((point) => (
        <span key={point.id} data-testid={`point-color-${point.id}`}>
          {props.pointColor(point)}
        </span>
      ))}
      <button onClick={() => props.onPointClick(props.pointsData[0])}>simulate-click</button>
    </div>
  ),
}))
```

Replace `tests/components/Globe.test.tsx` entirely with (the mock now forwards a ref exposing a mocked `pointOfView`, and a new test exercises `flyTo`; all 5 pre-existing tests are otherwise unchanged):
```tsx
import { describe, it, expect, vi } from 'vitest'
import { forwardRef, useImperativeHandle, createRef } from 'react'
import { render, screen } from '@testing-library/react'
import { Globe, type GlobeHandle } from '@/components/Globe'
import { toneColor } from '@/lib/gdelt/toneColor'
import type { GdeltEvent } from '@/lib/gdelt/types'

const { mockPointOfView } = vi.hoisted(() => ({ mockPointOfView: vi.fn() }))

vi.mock('react-globe.gl', () => ({
  default: forwardRef(function MockGlobe(
    props: {
      pointsData: GdeltEvent[]
      pointColor: (e: object) => string
      onPointClick: (p: GdeltEvent) => void
    },
    ref: React.Ref<{ pointOfView: (coords: object, ms: number) => void }>
  ) {
    useImperativeHandle(ref, () => ({ pointOfView: mockPointOfView }))
    return (
      <div data-testid="globe-stub" data-point-count={props.pointsData.length}>
        {props.pointsData.map((point) => (
          <span key={point.id} data-testid={`point-color-${point.id}`}>
            {props.pointColor(point)}
          </span>
        ))}
        <button onClick={() => props.onPointClick(props.pointsData[0])}>simulate-click</button>
      </div>
    )
  }),
}))

const events = [
  { id: '1', lat: 1, lon: 1, category: 'conflict', avgTone: -8 } as GdeltEvent,
  { id: '2', lat: 2, lon: 2, category: 'protest', avgTone: 3 } as GdeltEvent,
]

describe('Globe', () => {
  it('passes all events to the underlying globe as points', async () => {
    render(<Globe events={events} onSelectEvent={() => {}} />)
    expect(await screen.findByTestId('globe-stub')).toHaveAttribute('data-point-count', '2')
  })

  it('calls onSelectEvent when a point is clicked', async () => {
    const onSelectEvent = vi.fn()
    render(<Globe events={events} onSelectEvent={onSelectEvent} />)
    ;(await screen.findByText('simulate-click')).click()
    expect(onSelectEvent).toHaveBeenCalledWith(events[0])
  })

  it('colors points by category when colorMode is omitted (defaults to category)', async () => {
    render(<Globe events={events} onSelectEvent={() => {}} />)
    expect(await screen.findByTestId('point-color-1')).toHaveTextContent('#EF4444')
    expect(await screen.findByTestId('point-color-2')).toHaveTextContent('#F59E0B')
  })

  it('colors points by tone when colorMode is "tone"', async () => {
    render(<Globe events={events} onSelectEvent={() => {}} colorMode="tone" />)
    expect(await screen.findByTestId('point-color-1')).toHaveTextContent(toneColor(-8))
    expect(await screen.findByTestId('point-color-2')).toHaveTextContent(toneColor(3))
  })

  it('colors a disaster-category point with the new disaster color', async () => {
    const disasterEvent = { id: '3', lat: 3, lon: 3, category: 'disaster', avgTone: 0 } as GdeltEvent
    render(<Globe events={[disasterEvent]} onSelectEvent={() => {}} />)
    expect(await screen.findByTestId('point-color-3')).toHaveTextContent('#EA580C')
  })

  it('calls the underlying pointOfView with the right coordinates and transition when flyTo is invoked via ref', async () => {
    const ref = createRef<GlobeHandle>()
    render(<Globe ref={ref} events={events} onSelectEvent={() => {}} />)
    await screen.findByTestId('globe-stub')

    ref.current?.flyTo(48.8566, 2.3522)

    expect(mockPointOfView).toHaveBeenCalledWith({ lat: 48.8566, lng: 2.3522, altitude: 0.5 }, 1000)
  })
})
```

- [ ] **Step 2: Run tests to verify the new one fails**

```bash
npx vitest run tests/components/Globe.test.tsx
```
Expected: the 5 pre-existing tests still PASS (the mock's rendered markup is unchanged, only ref-forwarding was added to the mock, which existing tests don't exercise); the new `flyTo` test FAILS (`Globe` doesn't forward a ref or expose `flyTo` yet).

- [ ] **Step 3: Convert `Globe` to `forwardRef`**

Current `components/Globe.tsx`:
```tsx
'use client'
import dynamic from 'next/dynamic'
import type { GdeltEvent } from '@/lib/gdelt/types'
import { toneColor } from '@/lib/gdelt/toneColor'
import type { ColorMode } from './ColorModeToggle'

const ReactGlobe = dynamic(() => import('react-globe.gl'), { ssr: false })

const CATEGORY_COLORS: Record<GdeltEvent['category'], string> = {
  conflict: '#EF4444',
  protest: '#F59E0B',
  cooperation: '#22C55E',
  politics: '#3B82F6',
  disaster: '#EA580C',
  economy: '#A855F7',
  health: '#EC4899',
  environment: '#06B6D4',
  other: '#94A3B8',
}

interface GlobeProps {
  events: GdeltEvent[]
  onSelectEvent: (event: GdeltEvent) => void
  colorMode?: ColorMode
}

export function Globe({ events, onSelectEvent, colorMode = 'category' }: GlobeProps) {
  return (
    <ReactGlobe
      backgroundColor="#0B0B10"
      globeImageUrl="//unpkg.com/three-globe/example/img/earth-dark.jpg"
      pointsData={events}
      pointLat="lat"
      pointLng="lon"
      pointColor={(e: object) => {
        const event = e as GdeltEvent
        return colorMode === 'tone' ? toneColor(event.avgTone) : CATEGORY_COLORS[event.category]
      }}
      pointRadius={0.4}
      onPointClick={(point: object) => onSelectEvent(point as GdeltEvent)}
    />
  )
}
```

Replace it entirely with:
```tsx
'use client'
import { forwardRef, useImperativeHandle, useRef } from 'react'
import dynamic from 'next/dynamic'
import type { GdeltEvent } from '@/lib/gdelt/types'
import { toneColor } from '@/lib/gdelt/toneColor'
import type { ColorMode } from './ColorModeToggle'

const ReactGlobe = dynamic(() => import('react-globe.gl'), { ssr: false })

const CATEGORY_COLORS: Record<GdeltEvent['category'], string> = {
  conflict: '#EF4444',
  protest: '#F59E0B',
  cooperation: '#22C55E',
  politics: '#3B82F6',
  disaster: '#EA580C',
  economy: '#A855F7',
  health: '#EC4899',
  environment: '#06B6D4',
  other: '#94A3B8',
}

export interface GlobeHandle {
  flyTo: (lat: number, lon: number) => void
}

interface GlobeProps {
  events: GdeltEvent[]
  onSelectEvent: (event: GdeltEvent) => void
  colorMode?: ColorMode
}

interface GlobeInstance {
  pointOfView: (coords: { lat: number; lng: number; altitude: number }, transitionMs: number) => void
}

export const Globe = forwardRef<GlobeHandle, GlobeProps>(function Globe(
  { events, onSelectEvent, colorMode = 'category' },
  ref
) {
  const globeInstanceRef = useRef<GlobeInstance | null>(null)

  useImperativeHandle(ref, () => ({
    flyTo(lat: number, lon: number) {
      globeInstanceRef.current?.pointOfView({ lat, lng: lon, altitude: 0.5 }, 1000)
    },
  }))

  return (
    <ReactGlobe
      ref={globeInstanceRef}
      backgroundColor="#0B0B10"
      globeImageUrl="//unpkg.com/three-globe/example/img/earth-dark.jpg"
      pointsData={events}
      pointLat="lat"
      pointLng="lon"
      pointColor={(e: object) => {
        const event = e as GdeltEvent
        return colorMode === 'tone' ? toneColor(event.avgTone) : CATEGORY_COLORS[event.category]
      }}
      pointRadius={0.4}
      onPointClick={(point: object) => onSelectEvent(point as GdeltEvent)}
    />
  )
})
```

**Known type-check risk:** `react-globe.gl` (loaded through `next/dynamic`) may not export precise TypeScript types for its ref, so `npx tsc --noEmit` might report a type mismatch on the `ref={globeInstanceRef}` line passed to `ReactGlobe`. If that happens, resolve it with a cast on that one line only: `ref={globeInstanceRef as never}` — this matches the file's existing precedent of casting loosely-typed `react-globe.gl` callback parameters (e.g. `pointColor={(e: object) => ...}` already casts `e as GdeltEvent` internally). Do not add any other workaround.

- [ ] **Step 4: Run tests and typecheck to verify they pass**

```bash
npx vitest run tests/components/Globe.test.tsx
npx tsc --noEmit
```
Expected: all 6 tests pass; `tsc` is clean (apply the cast noted above if needed).

- [ ] **Step 5: Commit**

```bash
git add components/Globe.tsx tests/components/Globe.test.tsx
git commit -m "feat: expose imperative flyTo on Globe via forwardRef"
```

---

### Task 4: Wire search into the home page

**Files:**
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `SearchBox` (Task 2), `GlobeHandle` + `Globe`'s ref support (Task 3).

This task is pure composition wiring — no new logic beyond a `useRef` and a one-line callback, so no new test file is added (matching the precedent set by the tone-coloring feature's equivalent final wiring task).

- [ ] **Step 1: Wire `globeRef` and `SearchBox`**

Current `app/page.tsx`:
```tsx
'use client'
import { useState } from 'react'
import { Globe } from '@/components/Globe'
import { CategoryFilter } from '@/components/CategoryFilter'
import { ColorModeToggle, type ColorMode } from '@/components/ColorModeToggle'
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
  const [colorMode, setColorMode] = useState<ColorMode>('category')
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
        <Globe events={events} onSelectEvent={setSelectedEvent} colorMode={colorMode} />
      </div>

      <div className="pointer-events-none fixed inset-0 z-10 flex flex-col">
        <header className="pointer-events-auto flex flex-wrap items-center justify-between gap-3 border-b border-white/5 bg-card/70 px-4 py-3 backdrop-blur-md sm:px-6">
          <h1 className="font-heading text-xl font-semibold tracking-tight sm:text-2xl">Pulsatlas</h1>
          <SupportLink />
        </header>
```

Replace with:
```tsx
'use client'
import { useRef, useState } from 'react'
import { Globe, type GlobeHandle } from '@/components/Globe'
import { CategoryFilter } from '@/components/CategoryFilter'
import { ColorModeToggle, type ColorMode } from '@/components/ColorModeToggle'
import { TimeScrubber } from '@/components/TimeScrubber'
import { PlaybackButton } from '@/components/PlaybackButton'
import { ArticlePanel } from '@/components/ArticlePanel'
import { AdSlot } from '@/components/AdSlot'
import { SearchBox } from '@/components/SearchBox'
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
  const [colorMode, setColorMode] = useState<ColorMode>('category')
  const globeRef = useRef<GlobeHandle>(null)
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
        <Globe ref={globeRef} events={events} onSelectEvent={setSelectedEvent} colorMode={colorMode} />
      </div>

      <div className="pointer-events-none fixed inset-0 z-10 flex flex-col">
        <header className="pointer-events-auto flex flex-wrap items-center justify-between gap-3 border-b border-white/5 bg-card/70 px-4 py-3 backdrop-blur-md sm:px-6">
          <h1 className="font-heading text-xl font-semibold tracking-tight sm:text-2xl">Pulsatlas</h1>
          <div className="flex items-center gap-3">
            <SearchBox onSelectPlace={(lat, lon) => globeRef.current?.flyTo(lat, lon)} />
            <SupportLink />
          </div>
        </header>
```

Leave everything from the filter-bar `<div>` (the one containing `CategoryFilter`) through the end of the file exactly as it is today.

- [ ] **Step 2: Run the full suite, typecheck, and build**

```bash
npm run test
npx tsc --noEmit
npm run build
```
Expected: full suite passes (82 existing + 4 (`SearchBox`) + 1 (`Globe` new `flyTo` test) = 87 tests across 22 files — 21 existing files + 1 new file, `SearchBox.test.tsx`; `Globe.test.tsx` gains a test without becoming a new file), zero type errors, build succeeds.

- [ ] **Step 3: Manual verification**

```bash
npm run dev
```
Open the app, type a place name (e.g. "Tokyo") into the new search box in the header, confirm a dropdown of results appears, click one, confirm the globe animates its camera to that location over about a second. Type a nonsense string (e.g. "zzzqqxx") and confirm "No results" appears instead of a crash.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "feat: wire place search and fly-to camera into the home page"
```
