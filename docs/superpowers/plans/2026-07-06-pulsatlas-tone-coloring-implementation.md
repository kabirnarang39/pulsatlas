# Pulsatlas Tone Coloring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Category / Tone" toggle that recolors every globe pin by sentiment (using the already-stored `avgTone` field) instead of category, and always show the tone value in the article panel.

**Architecture:** A pure `toneColor(avgTone)` function maps a clamped tone value to a hex color via linear RGB interpolation through three existing theme colors. `Globe` gains an optional `colorMode` prop (defaulting to `'category'`, so existing callers/tests are unaffected) that branches its point-coloring logic. A new `ColorModeToggle` component (styled like the existing `CategoryFilter` pills) drives a new `colorMode` state in `app/page.tsx`. `ArticlePanel` gets one new always-visible line showing the tone value and a plain-language label.

**Tech Stack:** Next.js (App Router, TypeScript), Tailwind CSS, Vitest + `@testing-library/react`. No new dependencies.

## Global Constraints

- Color stops (exact, from spec): `#EF4444` (destructive) at `avgTone <= -10`, `#94A3B8` (muted) at `avgTone === 0`, `#22C55E` (cooperation) at `avgTone >= 10`. Linear RGB interpolation between adjacent stops, clamped to `[-10, 10]`.
- Tone label thresholds (exact): `avgTone < -1` → "Negative", `-1 <= avgTone <= 1` → "Neutral", `avgTone > 1` → "Positive".
- `Globe`'s `colorMode` prop must default to `'category'` so existing behavior and existing tests are unaffected when the prop is omitted.
- `ArticlePanel`'s tone line is always shown, regardless of which `colorMode` the globe is currently in.
- No changes to `useEvents`, the ingest/finalize scheduled functions, or `/api/events` — this feature only recolors data already fetched.
- No `localStorage` persistence for `colorMode` (resets to `'category'` on reload, matching current category-filter behavior).

---

### Task 1: `toneColor` pure function

**Files:**
- Create: `lib/gdelt/toneColor.ts`
- Test: `tests/gdelt/toneColor.test.ts`

**Interfaces:**
- Produces: `toneColor(avgTone: number): string` (lowercase hex, e.g. `'#ef4444'`) — used by Task 3 (`Globe`).

- [ ] **Step 1: Write the failing test**

Create `tests/gdelt/toneColor.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { toneColor } from '@/lib/gdelt/toneColor'

describe('toneColor', () => {
  it('returns the destructive red stop at the most negative end (-10)', () => {
    expect(toneColor(-10)).toBe('#ef4444')
  })

  it('returns the muted gray stop at neutral (0)', () => {
    expect(toneColor(0)).toBe('#94a3b8')
  })

  it('returns the cooperation green stop at the most positive end (10)', () => {
    expect(toneColor(10)).toBe('#22c55e')
  })

  it('clamps values beyond -10 to the same color as -10', () => {
    expect(toneColor(-50)).toBe(toneColor(-10))
  })

  it('clamps values beyond 10 to the same color as 10', () => {
    expect(toneColor(50)).toBe(toneColor(10))
  })

  it('interpolates a value between stops rather than snapping to one', () => {
    const midColor = toneColor(-5)
    expect(midColor).not.toBe(toneColor(-10))
    expect(midColor).not.toBe(toneColor(0))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/gdelt/toneColor.test.ts
```
Expected: FAIL — cannot find module `@/lib/gdelt/toneColor`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/gdelt/toneColor.ts`:
```ts
const STOPS = [
  { tone: -10, color: [239, 68, 68] as const }, // #EF4444 destructive
  { tone: 0, color: [148, 163, 184] as const }, // #94A3B8 muted
  { tone: 10, color: [34, 197, 94] as const }, // #22C55E cooperation
]

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function toHex(channel: number): string {
  return Math.round(channel).toString(16).padStart(2, '0')
}

export function toneColor(avgTone: number): string {
  const clamped = Math.max(-10, Math.min(10, avgTone))
  const [from, to] = clamped <= 0 ? [STOPS[0], STOPS[1]] : [STOPS[1], STOPS[2]]
  const t = (clamped - from.tone) / (to.tone - from.tone)
  const [r, g, b] = from.color.map((channel, i) => lerp(channel, to.color[i], t))
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/gdelt/toneColor.test.ts
```
Expected: PASS — all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/gdelt/toneColor.ts tests/gdelt/toneColor.test.ts
git commit -m "feat: add toneColor for sentiment-based pin coloring"
```

---

### Task 2: `ColorModeToggle` component

**Files:**
- Create: `components/ColorModeToggle.tsx`
- Test: `tests/components/ColorModeToggle.test.tsx`

**Interfaces:**
- Produces: `ColorMode` type (`'category' | 'tone'`), `<ColorModeToggle mode={ColorMode} onChange={(next: ColorMode) => void} />` — used by Task 3 (`Globe` reuses the `ColorMode` type) and Task 5 (`app/page.tsx` wiring).

- [ ] **Step 1: Write the failing test**

Create `tests/components/ColorModeToggle.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ColorModeToggle } from '@/components/ColorModeToggle'

describe('ColorModeToggle', () => {
  it('renders both pills', () => {
    render(<ColorModeToggle mode="category" onChange={() => {}} />)
    expect(screen.getByText('Category')).toBeInTheDocument()
    expect(screen.getByText('Tone')).toBeInTheDocument()
  })

  it('marks the active mode as pressed', () => {
    render(<ColorModeToggle mode="tone" onChange={() => {}} />)
    expect(screen.getByText('Tone')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Category')).toHaveAttribute('aria-pressed', 'false')
  })

  it('calls onChange with the other mode when clicked', () => {
    const onChange = vi.fn()
    render(<ColorModeToggle mode="category" onChange={onChange} />)
    screen.getByText('Tone').click()
    expect(onChange).toHaveBeenCalledWith('tone')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/components/ColorModeToggle.test.tsx
```
Expected: FAIL — cannot find module `@/components/ColorModeToggle`.

- [ ] **Step 3: Write minimal implementation**

Create `components/ColorModeToggle.tsx`:
```tsx
'use client'
export type ColorMode = 'category' | 'tone'

interface ColorModeToggleProps {
  mode: ColorMode
  onChange: (next: ColorMode) => void
}

const OPTIONS: { mode: ColorMode; label: string }[] = [
  { mode: 'category', label: 'Category' },
  { mode: 'tone', label: 'Tone' },
]

export function ColorModeToggle({ mode, onChange }: ColorModeToggleProps) {
  return (
    <div role="group" aria-label="Color mode" className="flex items-center gap-2">
      {OPTIONS.map((option) => {
        const isActive = option.mode === mode
        return (
          <button
            key={option.mode}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(option.mode)}
            className={
              isActive
                ? 'rounded-full border border-accent bg-accent/20 px-3 py-1.5 text-sm font-medium text-foreground transition duration-150 ease active:scale-[0.97]'
                : 'rounded-full border border-white/10 bg-card px-3 py-1.5 text-sm font-medium text-muted transition duration-150 ease hover:border-white/25 hover:text-foreground active:scale-[0.97]'
            }
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/components/ColorModeToggle.test.tsx
```
Expected: PASS — all 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/ColorModeToggle.tsx tests/components/ColorModeToggle.test.tsx
git commit -m "feat: add ColorModeToggle component"
```

---

### Task 3: `Globe` gains a `colorMode` prop

**Files:**
- Modify: `components/Globe.tsx`
- Test: `tests/components/Globe.test.tsx` (full replacement)

**Interfaces:**
- Consumes: `toneColor` (Task 1), `ColorMode` type (Task 2, re-used not re-declared).
- Produces: `<Globe events onSelectEvent colorMode?: ColorMode />` — `colorMode` optional, defaults to `'category'`. Used by Task 5 (`app/page.tsx` wiring).

- [ ] **Step 1: Write the failing tests**

Current `components/Globe.tsx`:
```tsx
'use client'
import dynamic from 'next/dynamic'
import type { GdeltEvent } from '@/lib/gdelt/types'

const ReactGlobe = dynamic(() => import('react-globe.gl'), { ssr: false })

const CATEGORY_COLORS: Record<GdeltEvent['category'], string> = {
  conflict: '#EF4444',
  protest: '#F59E0B',
  cooperation: '#22C55E',
  politics: '#3B82F6',
  other: '#94A3B8',
}

interface GlobeProps {
  events: GdeltEvent[]
  onSelectEvent: (event: GdeltEvent) => void
}

export function Globe({ events, onSelectEvent }: GlobeProps) {
  return (
    <ReactGlobe
      backgroundColor="#0B0B10"
      globeImageUrl="//unpkg.com/three-globe/example/img/earth-dark.jpg"
      pointsData={events}
      pointLat="lat"
      pointLng="lon"
      pointColor={(e: object) => CATEGORY_COLORS[(e as GdeltEvent).category]}
      pointRadius={0.4}
      onPointClick={(point: object) => onSelectEvent(point as GdeltEvent)}
    />
  )
}
```

Replace `tests/components/Globe.test.tsx` entirely with (the mock now exposes `pointColor`'s output per point so tests can assert exact colors, not just point count):
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Globe } from '@/components/Globe'
import { toneColor } from '@/lib/gdelt/toneColor'
import type { GdeltEvent } from '@/lib/gdelt/types'

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
})
```

- [ ] **Step 2: Run tests to verify the new ones fail**

```bash
npx vitest run tests/components/Globe.test.tsx
```
Expected: the two new "colors points by..." tests FAIL (no `pointColor` branching yet); the two pre-existing tests still PASS unchanged.

- [ ] **Step 3: Add the `colorMode` prop**

Replace `components/Globe.tsx` entirely with:
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

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/components/Globe.test.tsx
```
Expected: PASS — all 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/Globe.tsx tests/components/Globe.test.tsx
git commit -m "feat: add colorMode prop to Globe for tone-based pin coloring"
```

---

### Task 4: `ArticlePanel` shows the tone value

**Files:**
- Modify: `components/ArticlePanel.tsx`
- Test: `tests/components/ArticlePanel.test.tsx` (full replacement)

**Interfaces:**
- Consumes: `GdeltEvent.avgTone` (already exists on the type).

- [ ] **Step 1: Write the failing tests**

Current `components/ArticlePanel.tsx`:
```tsx
'use client'
import { useEffect, useState } from 'react'
import type { GdeltEvent } from '@/lib/gdelt/types'
import { CATEGORY_LABELS } from '@/lib/gdelt/categoryMap'

interface ArticlePanelProps {
  event: GdeltEvent | null
  onClose: () => void
}

export function ArticlePanel({ event, onClose }: ArticlePanelProps) {
  const [renderedEvent, setRenderedEvent] = useState<GdeltEvent | null>(event)
  const [isOpen, setIsOpen] = useState(Boolean(event))

  useEffect(() => {
    if (event) {
      setRenderedEvent(event)
      const id = requestAnimationFrame(() => setIsOpen(true))
      return () => cancelAnimationFrame(id)
    }
    setIsOpen(false)
  }, [event])

  if (!renderedEvent) return null

  const actors = [renderedEvent.actor1Name, renderedEvent.actor2Name].filter(Boolean).join(' & ')

  return (
    <aside
      role="complementary"
      aria-label="Event details"
      onTransitionEnd={(e) => {
        if (e.target === e.currentTarget && !isOpen) setRenderedEvent(null)
      }}
      className={`fixed right-4 top-24 z-20 w-[min(90vw,22rem)] rounded-xl border border-white/10 bg-card/90 p-4 shadow-xl backdrop-blur-md transition-[opacity,transform] ease-out sm:right-6 ${
        isOpen ? 'duration-200 translate-y-0 opacity-100' : 'pointer-events-none duration-[160ms] -translate-y-1 opacity-0'
      }`}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-3 top-3 text-lg leading-none text-muted transition duration-150 ease hover:text-foreground active:scale-[0.97]"
      >
        ×
      </button>
      <p className="pr-6 font-heading text-sm font-semibold uppercase tracking-wide text-accent">
        {CATEGORY_LABELS[renderedEvent.category]}
      </p>
      <p className="mt-2 text-base font-medium">{renderedEvent.locationName}</p>
      {actors && <p className="mt-1 text-sm text-muted">{actors}</p>}
      <a
        href={renderedEvent.sourceUrl}
        target="_blank"
        rel="noreferrer noopener"
        className="mt-3 inline-block text-sm font-medium text-accent transition-colors duration-150 ease hover:underline"
      >
        Read full story →
      </a>
    </aside>
  )
}
```

Replace `tests/components/ArticlePanel.test.tsx` entirely with (adds `avgTone` to the shared fixture and three new tests for the tone label thresholds):
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ArticlePanel } from '@/components/ArticlePanel'
import type { GdeltEvent } from '@/lib/gdelt/types'

const event = {
  id: '1',
  category: 'conflict',
  locationName: 'Paris, France',
  actor1Name: 'UNITED STATES',
  actor2Name: 'CHINA',
  sourceUrl: 'https://example.com/story',
  avgTone: -4.2,
} as GdeltEvent

describe('ArticlePanel', () => {
  it('renders nothing when no event is selected', () => {
    const { container } = render(<ArticlePanel event={null} onClose={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders event details and a link to the source', () => {
    render(<ArticlePanel event={event} onClose={() => {}} />)
    expect(screen.getByText('Conflict')).toBeInTheDocument()
    expect(screen.getByText('Paris, France')).toBeInTheDocument()
    expect(screen.getByText('UNITED STATES & CHINA')).toBeInTheDocument()
    expect(screen.getByText('Read full story →')).toHaveAttribute('href', 'https://example.com/story')
  })

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn()
    render(<ArticlePanel event={event} onClose={onClose} />)
    screen.getByLabelText('Close').click()
    expect(onClose).toHaveBeenCalled()
  })

  it('keeps content visible during the closing transition, then removes it once the transition ends', () => {
    const { rerender, container } = render(<ArticlePanel event={event} onClose={() => {}} />)
    expect(screen.getByText('Paris, France')).toBeInTheDocument()

    rerender(<ArticlePanel event={null} onClose={() => {}} />)
    expect(screen.getByText('Paris, France')).toBeInTheDocument()

    fireEvent.transitionEnd(container.querySelector('aside')!)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows a negative tone label for a strongly negative avgTone', () => {
    render(<ArticlePanel event={{ ...event, avgTone: -4.2 }} onClose={() => {}} />)
    expect(screen.getByText('Tone: -4.2 · Negative')).toBeInTheDocument()
  })

  it('shows a neutral tone label for an avgTone near zero', () => {
    render(<ArticlePanel event={{ ...event, avgTone: 0.3 }} onClose={() => {}} />)
    expect(screen.getByText('Tone: 0.3 · Neutral')).toBeInTheDocument()
  })

  it('shows a positive tone label for a strongly positive avgTone', () => {
    render(<ArticlePanel event={{ ...event, avgTone: 5.7 }} onClose={() => {}} />)
    expect(screen.getByText('Tone: 5.7 · Positive')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify the new ones fail**

```bash
npx vitest run tests/components/ArticlePanel.test.tsx
```
Expected: the three new "tone label" tests FAIL (no tone line rendered yet); the four pre-existing tests still PASS unchanged (the fixture's added `avgTone` field doesn't affect them).

- [ ] **Step 3: Add the tone line**

Modify `components/ArticlePanel.tsx`: add a `toneLabel` helper above the component, and one new `<p>` after the actors line.

Add above `export function ArticlePanel`:
```tsx
function toneLabel(avgTone: number): string {
  if (avgTone < -1) return 'Negative'
  if (avgTone > 1) return 'Positive'
  return 'Neutral'
}
```

Replace:
```tsx
      {actors && <p className="mt-1 text-sm text-muted">{actors}</p>}
      <a
```
with:
```tsx
      {actors && <p className="mt-1 text-sm text-muted">{actors}</p>}
      <p className="mt-1 text-sm text-muted">
        Tone: {renderedEvent.avgTone.toFixed(1)} · {toneLabel(renderedEvent.avgTone)}
      </p>
      <a
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/components/ArticlePanel.test.tsx
```
Expected: PASS — all 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/ArticlePanel.tsx tests/components/ArticlePanel.test.tsx
git commit -m "feat: show tone value and label in ArticlePanel"
```

---

### Task 5: Wire the toggle into the home page

**Files:**
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `ColorModeToggle`, `ColorMode` (Task 2); `Globe`'s `colorMode` prop (Task 3).

This task is pure composition wiring — no new logic beyond a `useState` and passing props through, so no new test file is added (the toggle and the globe's coloring behavior are already fully covered by Tasks 2 and 3's unit tests).

- [ ] **Step 1: Wire `colorMode` state and the toggle**

Current `app/page.tsx`:
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

Replace with:
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

        <div className="pointer-events-auto flex flex-wrap items-center gap-3 border-b border-white/5 bg-card/40 px-4 py-3 backdrop-blur-md sm:px-6">
          <CategoryFilter selected={categories} onChange={setCategories} />
          <ColorModeToggle mode={colorMode} onChange={setColorMode} />
          <TimeScrubber value={dashDate} min={EARLIEST_DATE} max={toDashDate(todayUtc())} onChange={handleDateChange} />
          <PlaybackButton isPlaying={isPlaying} onToggle={toggle} />
        </div>
```

Leave everything from `{status === 'error' && (` through the end of the file exactly as it is today.

- [ ] **Step 2: Run the full suite, typecheck, and build**

```bash
npm run test
npx tsc --noEmit
npm run build
```
Expected: full suite passes (52 existing + 6 (`toneColor`) + 3 (`ColorModeToggle`) + 2 new `Globe` tests + 3 new `ArticlePanel` tests = 66 tests across 19 files — 17 existing files + 2 new files (`toneColor`, `ColorModeToggle`); `Globe.test.tsx` and `ArticlePanel.test.tsx` gain tests without becoming new files), zero type errors, build succeeds.

- [ ] **Step 3: Manual verification**

Run `npm run dev`, open the app, click "Tone" in the new toggle. Confirm: all pins recolor on a red→gray→green scale, clicking "Category" reverts them, and clicking any pin shows the new "Tone: X.X · Label" line in the side panel regardless of which mode is active.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "feat: wire tone/category color toggle into the home page"
```
