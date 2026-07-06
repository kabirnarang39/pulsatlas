# Pulsatlas GKG Themes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ingest GDELT's GKG (Global Knowledge Graph) file every 15-minute cycle alongside the existing Events export, tagging GKG-derived pins with four new categories (`disaster`, `economy`, `health`, `environment`) that CAMEO-coded Events can never produce, blended into the existing category/color/filter system with no frontend code changes.

**Architecture:** A new `parseGkg.ts` parses GKG rows into the existing `GdeltEvent` shape (every GKG field maps onto an existing property — the type itself doesn't change). A new `themeCategory.ts` maps a GKG record's theme list to one of the four new categories via priority-ordered substring/prefix rules. `EventCategory` grows from 5 to 9 values. `ingestCycle.ts` fetches and parses the GKG file independently of the Events export — a GKG failure never blocks Events ingestion — and merges both event lists into the same per-day/per-category blob storage the app already uses.

**Tech Stack:** TypeScript, Vitest, JSZip (already installed and used for the Events zip). No new dependencies.

## Global Constraints

- `EventCategory` (exact, from spec): `'conflict' | 'protest' | 'cooperation' | 'politics' | 'disaster' | 'economy' | 'health' | 'environment' | 'other'`.
- Theme-to-category priority order (exact, first match wins): `disaster` (theme contains `NATURAL_DISASTER` or starts with `CRISISLEX`) → `health` (contains `HEALTH`, `DISEASE`, or `PANDEMIC`) → `economy` (starts with `ECON_`) → `environment` (starts with `ENV_`) → `other`.
- New category colors (exact hex, added to `Globe.tsx`'s `CATEGORY_COLORS`): `disaster: '#EA580C'`, `economy: '#A855F7'`, `health: '#EC4899'`, `environment: '#06B6D4'`.
- First-location-only: a GKG record's `V2Locations` field can list multiple locations; only the first is used.
- GKG ingestion failure (fetch, unzip, or parse) must be caught and must not prevent Events ingestion from completing in the same cycle — retried on the next 15-minute cycle.
- `GdeltEvent` (the interface itself) does not change — every GKG field maps onto an existing property. Only `EventCategory` (a type it references) grows.
- Storage key format (`${day}/${category}.json` via `BlobStore`) does not change — GKG-derived events merge into the same per-day/per-category blobs via the existing dedup-by-`id` logic.
- No frontend/UI code changes — `CategoryFilter`, `ColorModeToggle`, `ArticlePanel` all iterate `ALL_CATEGORIES`/read `GdeltEvent` fields generically already.

---

### Task 1: Extend `EventCategory` and the category maps

**Files:**
- Modify: `lib/gdelt/types.ts`
- Modify: `lib/gdelt/categoryMap.ts`
- Test: `tests/gdelt/categoryMap.test.ts` (extend, not replace)

**Interfaces:**
- Produces: `EventCategory` (9 values), `ALL_CATEGORIES: EventCategory[]` (9 entries), `CATEGORY_LABELS: Record<EventCategory, string>` (9 entries) — used by Task 2 (`themeCategory`'s return type), Task 4 (`Globe`'s `CATEGORY_COLORS` must cover all 9 keys or TypeScript's `Record<GdeltEvent['category'], string>` fails to compile).

- [ ] **Step 1: Write the failing test**

Current `tests/gdelt/categoryMap.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { categoryForRootCode } from '@/lib/gdelt/categoryMap'

describe('categoryForRootCode', () => {
  it('maps root code 19 to conflict', () => {
    expect(categoryForRootCode('19')).toBe('conflict')
  })
  it('maps root code 14 to protest', () => {
    expect(categoryForRootCode('14')).toBe('protest')
  })
  it('maps root code 07 to cooperation', () => {
    expect(categoryForRootCode('07')).toBe('cooperation')
  })
  it('maps root code 01 to politics', () => {
    expect(categoryForRootCode('01')).toBe('politics')
  })
  it('maps an unrecognized code to other', () => {
    expect(categoryForRootCode('99')).toBe('other')
  })
})
```

Add this new `describe` block at the end of the file (keep everything above unchanged):
```ts

describe('ALL_CATEGORIES and CATEGORY_LABELS', () => {
  it('includes the four GKG-only categories alongside the five CAMEO-derived ones', async () => {
    const { ALL_CATEGORIES, CATEGORY_LABELS } = await import('@/lib/gdelt/categoryMap')
    expect(ALL_CATEGORIES).toEqual([
      'conflict', 'protest', 'cooperation', 'politics',
      'disaster', 'economy', 'health', 'environment', 'other',
    ])
    expect(CATEGORY_LABELS.disaster).toBe('Disaster')
    expect(CATEGORY_LABELS.economy).toBe('Economy')
    expect(CATEGORY_LABELS.health).toBe('Health')
    expect(CATEGORY_LABELS.environment).toBe('Environment')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/gdelt/categoryMap.test.ts
```
Expected: FAIL — `ALL_CATEGORIES` currently has only 5 entries, `CATEGORY_LABELS.disaster` is `undefined`.

- [ ] **Step 3: Extend the type and the maps**

Current `lib/gdelt/types.ts`:
```ts
export type EventCategory = 'conflict' | 'protest' | 'cooperation' | 'politics' | 'other'

export interface GdeltEvent {
  id: string
  day: string // YYYYMMDD
  lat: number
  lon: number
  locationName: string
  eventRootCode: string
  category: EventCategory
  actor1Name: string | null
  actor2Name: string | null
  avgTone: number
  sourceUrl: string
  dateAdded: string // YYYYMMDDHHMMSS
}
```

Replace the `EventCategory` line only (leave `GdeltEvent` untouched) with:
```ts
export type EventCategory =
  | 'conflict'
  | 'protest'
  | 'cooperation'
  | 'politics'
  | 'disaster'
  | 'economy'
  | 'health'
  | 'environment'
  | 'other'
```

Current `lib/gdelt/categoryMap.ts`:
```ts
import type { EventCategory } from './types'

const CONFLICT_CODES = new Set(['18', '19', '20'])
const PROTEST_CODES = new Set(['14'])
const COOPERATION_CODES = new Set(['06', '07', '08'])
const POLITICS_CODES = new Set([
  '01', '02', '03', '04', '05', '09', '10', '11', '12', '13', '15', '16', '17',
])

export function categoryForRootCode(rootCode: string): EventCategory {
  const code = rootCode.padStart(2, '0')
  if (CONFLICT_CODES.has(code)) return 'conflict'
  if (PROTEST_CODES.has(code)) return 'protest'
  if (COOPERATION_CODES.has(code)) return 'cooperation'
  if (POLITICS_CODES.has(code)) return 'politics'
  return 'other'
}

export const ALL_CATEGORIES: EventCategory[] = ['conflict', 'protest', 'cooperation', 'politics', 'other']

export const CATEGORY_LABELS: Record<EventCategory, string> = {
  conflict: 'Conflict',
  protest: 'Protest',
  cooperation: 'Cooperation & Aid',
  politics: 'Politics & Diplomacy',
  other: 'Other',
}
```

Replace the final two exports only (leave `categoryForRootCode` and the CAMEO code sets untouched — they never produce the new categories) with:
```ts
export const ALL_CATEGORIES: EventCategory[] = [
  'conflict',
  'protest',
  'cooperation',
  'politics',
  'disaster',
  'economy',
  'health',
  'environment',
  'other',
]

export const CATEGORY_LABELS: Record<EventCategory, string> = {
  conflict: 'Conflict',
  protest: 'Protest',
  cooperation: 'Cooperation & Aid',
  politics: 'Politics & Diplomacy',
  disaster: 'Disaster',
  economy: 'Economy',
  health: 'Health',
  environment: 'Environment',
  other: 'Other',
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/gdelt/categoryMap.test.ts
```
Expected: PASS — all 6 tests pass (5 pre-existing + 1 new).

- [ ] **Step 5: Confirm nothing else broke**

```bash
npx tsc --noEmit
```
Expected: errors in `components/Globe.tsx` (its `CATEGORY_COLORS` `Record` is now missing 4 keys — this is expected and fixed in Task 4, not this task). Confirm the ONLY errors are in `Globe.tsx`; if anything else fails to compile, stop and investigate before continuing.

- [ ] **Step 6: Commit**

```bash
git add lib/gdelt/types.ts lib/gdelt/categoryMap.ts tests/gdelt/categoryMap.test.ts
git commit -m "feat: extend EventCategory with disaster/economy/health/environment"
```

---

### Task 2: `themeCategory` — GKG theme-to-category mapping

**Files:**
- Create: `lib/gdelt/themeCategory.ts`
- Test: `tests/gdelt/themeCategory.test.ts`

**Interfaces:**
- Consumes: `EventCategory` (Task 1).
- Produces: `themeCategory(themesField: string): EventCategory` — `themesField` is a raw GKG `V2Themes` value (semicolon-separated `THEME_CODE,charOffset` entries). Used by Task 3 (`parseGkg.ts`).

- [ ] **Step 1: Write the failing test**

Create `tests/gdelt/themeCategory.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { themeCategory } from '@/lib/gdelt/themeCategory'

describe('themeCategory', () => {
  it('maps a NATURAL_DISASTER theme to disaster', () => {
    expect(themeCategory('NATURAL_DISASTER_EARTHQUAKE,10')).toBe('disaster')
  })

  it('maps a CRISISLEX-prefixed theme to disaster', () => {
    expect(themeCategory('CRISISLEX_T03_DEAD,5')).toBe('disaster')
  })

  it('maps a theme containing HEALTH to health', () => {
    expect(themeCategory('TAX_HEALTH_MENTAL_HEALTH,20')).toBe('health')
  })

  it('maps a theme containing PANDEMIC to health', () => {
    expect(themeCategory('EPU_CATS_PANDEMIC,15')).toBe('health')
  })

  it('maps an ECON_-prefixed theme to economy', () => {
    expect(themeCategory('ECON_TRADE,30')).toBe('economy')
  })

  it('maps an ENV_-prefixed theme to environment', () => {
    expect(themeCategory('ENV_CLIMATECHANGE,40')).toBe('environment')
  })

  it('falls back to other for an unrecognized theme list', () => {
    expect(themeCategory('TAX_FNCACT_POLITICIAN,5')).toBe('other')
  })

  it('falls back to other for an empty theme field', () => {
    expect(themeCategory('')).toBe('other')
  })

  it('prioritizes disaster over economy when both themes are present', () => {
    expect(themeCategory('ECON_TRADE,10;NATURAL_DISASTER_FLOOD,20')).toBe('disaster')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/gdelt/themeCategory.test.ts
```
Expected: FAIL — cannot find module `@/lib/gdelt/themeCategory`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/gdelt/themeCategory.ts`:
```ts
import type { EventCategory } from './types'

function extractThemeCodes(themesField: string): string[] {
  return themesField
    .split(';')
    .filter(Boolean)
    .map((entry) => entry.split(',')[0])
}

export function themeCategory(themesField: string): EventCategory {
  const codes = extractThemeCodes(themesField)
  if (codes.some((c) => c.includes('NATURAL_DISASTER') || c.startsWith('CRISISLEX'))) return 'disaster'
  if (codes.some((c) => c.includes('HEALTH') || c.includes('DISEASE') || c.includes('PANDEMIC'))) return 'health'
  if (codes.some((c) => c.startsWith('ECON_'))) return 'economy'
  if (codes.some((c) => c.startsWith('ENV_'))) return 'environment'
  return 'other'
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/gdelt/themeCategory.test.ts
```
Expected: PASS — all 9 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/gdelt/themeCategory.ts tests/gdelt/themeCategory.test.ts
git commit -m "feat: add themeCategory for GKG theme-to-category mapping"
```

---

### Task 3: `parseGkg` — GKG CSV row parser

**Files:**
- Create: `lib/gdelt/parseGkg.ts`
- Test: `tests/gdelt/parseGkg.test.ts`

**Interfaces:**
- Consumes: `themeCategory` (Task 2); `GdeltEvent` (Task 1, unchanged shape).
- Produces: `parseGkgCsv(csv: string): GdeltEvent[]` — used by Task 5 (`ingestCycle.ts`).

GDELT GKG 2.1 is tab-delimited with these 0-indexed columns relevant here: `GKGRECORDID`=0, `DATE`=1 (format `YYYYMMDDHHMMSS`), `DocumentIdentifier`=4, `V2Themes`=8 (semicolon-separated `THEME,charOffset` entries), `V2Locations`=10 (semicolon-separated locations, each `Type#FullName#CountryCode#ADM1Code#ADM2Code#Latitude#Longitude#FeatureID` pound-separated), `V2Persons`=12 (semicolon-separated `Name,charOffset` entries), `V2Organizations`=14 (same format as `V2Persons`), `V2Tone`=15 (comma-separated: tone, positiveScore, negativeScore, polarity, activityRefDensity, selfGroupRefDensity, wordCount — the first value is the tone-equivalent of `avgTone`).

- [ ] **Step 1: Write the failing tests**

Create `tests/gdelt/parseGkg.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { parseGkgCsv } from '@/lib/gdelt/parseGkg'

function buildRow(overrides: Record<number, string>): string {
  const fields = new Array(16).fill('')
  for (const [i, v] of Object.entries(overrides)) fields[Number(i)] = v
  return fields.join('\t')
}

describe('parseGkgCsv', () => {
  it('parses a valid row into a GdeltEvent', () => {
    const row = buildRow({
      0: '20260707120000-123',
      1: '20260707120000',
      4: 'https://example.com/article',
      8: 'NATURAL_DISASTER_EARTHQUAKE,10;ECON_TRADE,50',
      10: '4#Tokyo, Japan#JA#JA13##35.6895#139.6917#-2345;3#Osaka#JA#JA27##34.6937#135.5023#-2346',
      12: 'John Smith,20;Jane Doe,60',
      14: 'World Health Organization,30',
      15: '-3.5,2.1,5.6,-3.5,1.2,0.4,500',
    })
    const [event] = parseGkgCsv(row)
    expect(event).toEqual({
      id: '20260707120000-123',
      day: '20260707',
      lat: 35.6895,
      lon: 139.6917,
      locationName: 'Tokyo, Japan',
      eventRootCode: 'NATURAL_DISASTER_EARTHQUAKE',
      category: 'disaster',
      actor1Name: 'John Smith',
      actor2Name: 'World Health Organization',
      avgTone: -3.5,
      sourceUrl: 'https://example.com/article',
      dateAdded: '20260707120000',
    })
  })

  it('skips rows with no parseable location', () => {
    const row = buildRow({ 0: '1', 1: '20260707120000' })
    expect(parseGkgCsv(row)).toEqual([])
  })

  it('skips malformed rows with too few columns', () => {
    expect(parseGkgCsv('a\tb\tc')).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/gdelt/parseGkg.test.ts
```
Expected: FAIL — cannot find module `@/lib/gdelt/parseGkg`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/gdelt/parseGkg.ts`:
```ts
import { themeCategory } from './themeCategory'
import type { GdeltEvent } from './types'

const COL = {
  GKGRECORDID: 0,
  DATE: 1,
  DocumentIdentifier: 4,
  V2Themes: 8,
  V2Locations: 10,
  V2Persons: 12,
  V2Organizations: 14,
  V2Tone: 15,
} as const

function firstListEntry(field: string): string | null {
  if (!field) return null
  const first = field.split(';')[0]
  if (!first) return null
  const name = first.split(',')[0].trim()
  return name || null
}

function firstThemeCode(themesField: string): string {
  if (!themesField) return 'none'
  const first = themesField.split(';')[0]
  if (!first) return 'none'
  return first.split(',')[0] || 'none'
}

export function parseGkgCsv(csv: string): GdeltEvent[] {
  const events: GdeltEvent[] = []
  for (const line of csv.split('\n')) {
    if (!line.trim()) continue
    const fields = line.split('\t')
    if (fields.length < 16) continue

    const locations = fields[COL.V2Locations].split(';').filter(Boolean)
    if (locations.length === 0) continue
    const locationParts = locations[0].split('#')
    if (locationParts.length < 7) continue

    const lat = Number(locationParts[5])
    const lon = Number(locationParts[6])
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || (lat === 0 && lon === 0)) continue

    const date = fields[COL.DATE]
    const avgTone = Number(fields[COL.V2Tone].split(',')[0]) || 0

    events.push({
      id: fields[COL.GKGRECORDID],
      day: date.slice(0, 8),
      lat,
      lon,
      locationName: locationParts[1] || 'Unknown location',
      eventRootCode: firstThemeCode(fields[COL.V2Themes]),
      category: themeCategory(fields[COL.V2Themes]),
      actor1Name: firstListEntry(fields[COL.V2Persons]),
      actor2Name: firstListEntry(fields[COL.V2Organizations]),
      avgTone,
      sourceUrl: fields[COL.DocumentIdentifier],
      dateAdded: date,
    })
  }
  return events
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/gdelt/parseGkg.test.ts
```
Expected: PASS — all 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/gdelt/parseGkg.ts tests/gdelt/parseGkg.test.ts
git commit -m "feat: parse GDELT GKG CSV rows into GdeltEvent records"
```

---

### Task 4: `Globe` — colors for the four new categories

**Files:**
- Modify: `components/Globe.tsx`
- Test: `tests/components/Globe.test.tsx` (extend, not replace)

**Interfaces:**
- Consumes: `EventCategory` (Task 1, 9 values).

This task also fixes the `tsc` errors from Task 1 Step 5 (the `CATEGORY_COLORS` `Record` was missing the 4 new keys).

- [ ] **Step 1: Write the failing test**

Current `tests/components/Globe.test.tsx` ends with a `describe('Globe', ...)` block containing 4 tests (point count, click handler, category-default coloring, tone-mode coloring — from the earlier tone-coloring feature). Add this test inside the same `describe('Globe', ...)` block, after the existing tests (do not remove or modify any existing test):
```ts

  it('colors a disaster-category point with the new disaster color', async () => {
    const disasterEvent = { id: '3', lat: 3, lon: 3, category: 'disaster', avgTone: 0 } as GdeltEvent
    render(<Globe events={[disasterEvent]} onSelectEvent={() => {}} />)
    expect(await screen.findByTestId('point-color-3')).toHaveTextContent('#EA580C')
  })
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/components/Globe.test.tsx
```
Expected: FAIL — `CATEGORY_COLORS['disaster']` is `undefined`, so the rendered text content is empty, not `#EA580C`. (Also, `npx tsc --noEmit` is currently failing from Task 1 Step 5 — this task fixes that too.)

- [ ] **Step 3: Extend `CATEGORY_COLORS`**

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
  other: '#94A3B8',
}
```

Replace the `CATEGORY_COLORS` object only (leave everything else in the file unchanged) with:
```tsx
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
```

- [ ] **Step 4: Run tests and typecheck to verify they pass**

```bash
npx vitest run tests/components/Globe.test.tsx
npx tsc --noEmit
```
Expected: all tests in the file pass (5 total: 4 pre-existing + 1 new); `tsc` is clean (zero errors — the Task 1 errors are now fixed).

- [ ] **Step 5: Commit**

```bash
git add components/Globe.tsx tests/components/Globe.test.tsx
git commit -m "feat: add colors for disaster/economy/health/environment categories"
```

---

### Task 5: Wire GKG ingestion into the scheduled ingest cycle

**Files:**
- Modify: `lib/gdelt/ingestCycle.ts`
- Test: `tests/gdelt/ingestCycle.test.ts` (full replacement)

**Interfaces:**
- Consumes: `parseGkgCsv` (Task 3).

This is the final integration task — it wires the new GKG parsing into the existing 15-minute ingest cycle, which already runs in production.

- [ ] **Step 1: Write the failing tests**

Current `lib/gdelt/ingestCycle.ts`:
```ts
import JSZip from 'jszip'
import { parseEventsCsv } from './parseEvents'
import type { GdeltEvent } from './types'
import type { BlobStore } from '../storage/blobStore'

const LASTUPDATE_URL = 'http://data.gdeltproject.org/gdeltv2/lastupdate.txt'

export async function runIngestCycle(
  fetchFn: typeof fetch,
  blobStore: BlobStore
): Promise<{ ingested: number }> {
  const lastUpdateRes = await fetchFn(LASTUPDATE_URL)
  const lastUpdateText = await lastUpdateRes.text()
  const exportLine = lastUpdateText.split('\n').find((l) => l.includes('.export.CSV.zip'))
  if (!exportLine) return { ingested: 0 }

  const zipUrl = exportLine.trim().split(' ').pop()!
  const zipRes = await fetchFn(zipUrl)
  const zipBuffer = await zipRes.arrayBuffer()
  const zip = await JSZip.loadAsync(zipBuffer)
  const csvFile = Object.values(zip.files)[0]
  const csv = await csvFile.async('string')

  const events = parseEventsCsv(csv)
  const byDayCategory = new Map<string, GdeltEvent[]>()
  for (const event of events) {
    const key = `${event.day}|${event.category}`
    const group = byDayCategory.get(key) ?? []
    group.push(event)
    byDayCategory.set(key, group)
  }

  for (const [key, newEvents] of byDayCategory) {
    const [day, category] = key.split('|')
    const existing = await blobStore.getEvents(day, category)
    const existingIds = new Set(existing.map((e) => e.id))
    const merged = [...existing, ...newEvents.filter((e) => !existingIds.has(e.id))]
    await blobStore.putEvents(day, category, merged)
  }

  return { ingested: events.length }
}
```

Replace `tests/gdelt/ingestCycle.test.ts` entirely with:
```ts
import { describe, it, expect, vi } from 'vitest'
import JSZip from 'jszip'
import { runIngestCycle } from '@/lib/gdelt/ingestCycle'
import { createMemoryBlobStore } from '@/lib/storage/memoryBlobStore'

function buildRow(overrides: Record<number, string>): string {
  const fields = new Array(61).fill('')
  for (const [i, v] of Object.entries(overrides)) fields[Number(i)] = v
  return fields.join('\t')
}

function buildGkgRow(overrides: Record<number, string>): string {
  const fields = new Array(16).fill('')
  for (const [i, v] of Object.entries(overrides)) fields[Number(i)] = v
  return fields.join('\t')
}

async function buildFixtureZip(filename: string, csv: string): Promise<ArrayBuffer> {
  const zip = new JSZip()
  zip.file(filename, csv)
  return zip.generateAsync({ type: 'arraybuffer' })
}

function mockFetch(exportZipBuffer: ArrayBuffer, gkgZipBuffer?: ArrayBuffer) {
  return vi.fn(async (url: string) => {
    if (url.includes('lastupdate.txt')) {
      return {
        text: async () =>
          '123 abc http://data.gdeltproject.org/gdeltv2/20260706123000.export.CSV.zip\n' +
          '456 def http://data.gdeltproject.org/gdeltv2/20260706123000.gkg.csv.zip\n',
      } as unknown as Response
    }
    if (url.includes('.gkg.csv.zip')) {
      if (!gkgZipBuffer) throw new Error('no gkg fixture provided')
      return { arrayBuffer: async () => gkgZipBuffer } as unknown as Response
    }
    return { arrayBuffer: async () => exportZipBuffer } as unknown as Response
  })
}

describe('runIngestCycle', () => {
  it('fetches, parses, and stores new events grouped by day and category', async () => {
    const row = buildRow({
      0: '1', 1: '20260706', 28: '19', 52: 'Paris, France',
      56: '48.8566', 57: '2.3522', 59: '20260706123000', 60: 'https://example.com/a',
    })
    const zipBuffer = await buildFixtureZip('20260706123000.export.CSV', row)
    const blobStore = createMemoryBlobStore()

    const result = await runIngestCycle(mockFetch(zipBuffer) as unknown as typeof fetch, blobStore)

    expect(result.ingested).toBe(1)
    const stored = await blobStore.getEvents('20260706', 'conflict')
    expect(stored).toHaveLength(1)
    expect(stored[0].sourceUrl).toBe('https://example.com/a')
  })

  it('dedupes events already stored from a previous cycle', async () => {
    const row = buildRow({
      0: '1', 1: '20260706', 28: '19', 56: '48.8566', 57: '2.3522',
      59: '20260706123000', 60: 'https://example.com/a',
    })
    const zipBuffer = await buildFixtureZip('20260706123000.export.CSV', row)
    const blobStore = createMemoryBlobStore()
    const fetchFn = mockFetch(zipBuffer) as unknown as typeof fetch

    await runIngestCycle(fetchFn, blobStore)
    const result = await runIngestCycle(fetchFn, blobStore)

    expect(result.ingested).toBe(1)
    const stored = await blobStore.getEvents('20260706', 'conflict')
    expect(stored).toHaveLength(1)
  })

  it('returns zero ingested when lastupdate.txt has no export line', async () => {
    const fetchFn = vi.fn(async () => ({ text: async () => '' }) as unknown as Response)
    const blobStore = createMemoryBlobStore()
    const result = await runIngestCycle(fetchFn as unknown as typeof fetch, blobStore)
    expect(result.ingested).toBe(0)
  })

  it('merges GKG-derived events alongside Events-derived ones in the same cycle', async () => {
    const eventRow = buildRow({
      0: '1', 1: '20260706', 28: '19', 56: '48.8566', 57: '2.3522',
      59: '20260706123000', 60: 'https://example.com/a',
    })
    const gkgRow = buildGkgRow({
      0: '20260706123000-9',
      1: '20260706123000',
      4: 'https://example.com/quake',
      8: 'NATURAL_DISASTER_EARTHQUAKE,10',
      10: '4#Tokyo, Japan#JA#JA13##35.6895#139.6917#-2345',
      15: '-3.5,2.1,5.6,-3.5,1.2,0.4,500',
    })
    const exportZip = await buildFixtureZip('20260706123000.export.CSV', eventRow)
    const gkgZip = await buildFixtureZip('20260706123000.gkg.csv', gkgRow)
    const blobStore = createMemoryBlobStore()

    const result = await runIngestCycle(mockFetch(exportZip, gkgZip) as unknown as typeof fetch, blobStore)

    expect(result.ingested).toBe(2)
    const conflictEvents = await blobStore.getEvents('20260706', 'conflict')
    expect(conflictEvents).toHaveLength(1)
    const disasterEvents = await blobStore.getEvents('20260706', 'disaster')
    expect(disasterEvents).toHaveLength(1)
    expect(disasterEvents[0].sourceUrl).toBe('https://example.com/quake')
  })

  it('still ingests Events data when the GKG fetch fails', async () => {
    const eventRow = buildRow({
      0: '1', 1: '20260706', 28: '19', 56: '48.8566', 57: '2.3522',
      59: '20260706123000', 60: 'https://example.com/a',
    })
    const exportZip = await buildFixtureZip('20260706123000.export.CSV', eventRow)
    const blobStore = createMemoryBlobStore()

    const result = await runIngestCycle(mockFetch(exportZip) as unknown as typeof fetch, blobStore)

    expect(result.ingested).toBe(1)
    const stored = await blobStore.getEvents('20260706', 'conflict')
    expect(stored).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/gdelt/ingestCycle.test.ts
```
Expected: the 3 pre-existing tests still PASS (the current `runIngestCycle` ignores the GKG line in `lastupdate.txt` entirely, so adding it to the fixture doesn't change their behavior); the 2 new tests FAIL (`result.ingested` is `1` instead of `2` in the merge test; the failure-isolation test currently can't fail in a way that matters yet since nothing calls the GKG URL at all — confirm both new tests fail for a GKG-related reason, not a fixture-setup error).

- [ ] **Step 3: Extend `runIngestCycle` to fetch and merge GKG data**

Replace `lib/gdelt/ingestCycle.ts` entirely with:
```ts
import JSZip from 'jszip'
import { parseEventsCsv } from './parseEvents'
import { parseGkgCsv } from './parseGkg'
import type { GdeltEvent } from './types'
import type { BlobStore } from '../storage/blobStore'

const LASTUPDATE_URL = 'http://data.gdeltproject.org/gdeltv2/lastupdate.txt'

async function fetchAndUnzipCsv(fetchFn: typeof fetch, zipUrl: string): Promise<string> {
  const zipRes = await fetchFn(zipUrl)
  const zipBuffer = await zipRes.arrayBuffer()
  const zip = await JSZip.loadAsync(zipBuffer)
  const csvFile = Object.values(zip.files)[0]
  return csvFile.async('string')
}

function findZipUrl(lastUpdateText: string, marker: string): string | null {
  const line = lastUpdateText.split('\n').find((l) => l.includes(marker))
  if (!line) return null
  return line.trim().split(' ').pop() ?? null
}

export async function runIngestCycle(
  fetchFn: typeof fetch,
  blobStore: BlobStore
): Promise<{ ingested: number }> {
  const lastUpdateRes = await fetchFn(LASTUPDATE_URL)
  const lastUpdateText = await lastUpdateRes.text()

  const exportUrl = findZipUrl(lastUpdateText, '.export.CSV.zip')
  if (!exportUrl) return { ingested: 0 }

  const csv = await fetchAndUnzipCsv(fetchFn, exportUrl)
  const events = parseEventsCsv(csv)

  let gkgEvents: GdeltEvent[] = []
  const gkgUrl = findZipUrl(lastUpdateText, '.gkg.csv.zip')
  if (gkgUrl) {
    try {
      const gkgCsv = await fetchAndUnzipCsv(fetchFn, gkgUrl)
      gkgEvents = parseGkgCsv(gkgCsv)
    } catch {
      // GKG fetch/parse failure must not block Events ingestion — retried next cycle
    }
  }

  const allEvents = [...events, ...gkgEvents]
  const byDayCategory = new Map<string, GdeltEvent[]>()
  for (const event of allEvents) {
    const key = `${event.day}|${event.category}`
    const group = byDayCategory.get(key) ?? []
    group.push(event)
    byDayCategory.set(key, group)
  }

  for (const [key, newEvents] of byDayCategory) {
    const [day, category] = key.split('|')
    const existing = await blobStore.getEvents(day, category)
    const existingIds = new Set(existing.map((e) => e.id))
    const merged = [...existing, ...newEvents.filter((e) => !existingIds.has(e.id))]
    await blobStore.putEvents(day, category, merged)
  }

  return { ingested: allEvents.length }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/gdelt/ingestCycle.test.ts
```
Expected: PASS — all 5 tests pass.

- [ ] **Step 5: Run the full suite, typecheck, and build**

```bash
npm run test
npx tsc --noEmit
npm run build
```
Expected: full suite passes (66 existing + 1 (`categoryMap` new test) + 9 (`themeCategory`) + 3 (`parseGkg`) + 1 (`Globe` new test) + 2 (`ingestCycle` new tests) = 82 tests across 21 files — 19 existing files + 2 new files (`themeCategory.test.ts`, `parseGkg.test.ts`); `categoryMap.test.ts`, `Globe.test.tsx`, `ingestCycle.test.ts` gain tests without becoming new files), zero type errors, build succeeds.

- [ ] **Step 6: Commit**

```bash
git add lib/gdelt/ingestCycle.ts tests/gdelt/ingestCycle.test.ts
git commit -m "feat: fetch and merge GKG-derived events into the ingest cycle"
```
