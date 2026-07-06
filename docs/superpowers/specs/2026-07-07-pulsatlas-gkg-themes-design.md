# Pulsatlas — GKG Themes — Design Spec

Date: 2026-07-07
Status: Approved, pending implementation plan

## 0. Context

This is sub-project #2b of the Pulsatlas feature roadmap (see `docs/superpowers/specs/2026-07-06-pulsatlas-autoplay-scrubber-design.md` §0 for the full list; #1 auto-play scrubber and #2a tone coloring already shipped). The original roadmap item #2 ("Tone + GKG themes") was split during #2a's brainstorming — this spec covers the GKG half, deferred at the time because GDELT's Global Knowledge Graph (GKG) is a genuinely separate dataset from the Events table Pulsatlas currently ingests, with no reliable shared join key between the two (Events has no GKG record reference; GKG's `DocumentIdentifier` could theoretically be URL-matched against an Event's `SOURCEURL`, but that join is lossy and unreliable — many events share one article, some articles produce zero events, and URL variants don't match cleanly).

Given that, this spec does **not** attempt to enrich existing CAMEO-derived event pins with GKG data. Instead, GKG records are ingested as **independent pins in their own right**, using new categories that fill a real, previously-documented gap: GDELT's Events table (CAMEO-coded political events) structurally cannot represent "disaster" or "business" as categories — the original v1 design spec noted this explicitly and deferred it to GKG. This spec delivers that.

## 1. Overview

Every 15-minute ingest cycle additionally fetches GDELT's GKG file (from the same `lastupdate.txt` manifest already being read for the Events export) and parses it into the same `GdeltEvent` shape already used throughout the app, tagged with four new categories — `disaster`, `economy`, `health`, `environment` — that CAMEO-derived events can never produce. These blend into the existing category system: same `CategoryFilter`, same `ColorModeToggle`, same `ArticlePanel`, same globe rendering. No frontend code changes are needed; only the set of category *values* flowing through the existing pipes grows.

## 2. Architecture

- **`lib/gdelt/parseGkg.ts`** — new module, parallel in structure to the existing `lib/gdelt/parseEvents.ts`. Exports `parseGkgCsv(csv: string): GdeltEvent[]`, parsing GDELT's tab-delimited GKG 2.1 row format. Relevant columns:
  - `GKGRECORDID` → `GdeltEvent.id` (format always contains a `-`, e.g. `20260707123000-123`, structurally distinct from Events' purely numeric `GlobalEventID`, so no collision risk when merged into the same storage).
  - `DATE` (format `YYYYMMDDHHMMSS`) → first 8 characters become `GdeltEvent.day`; the full value becomes `GdeltEvent.dateAdded`.
  - `V2Locations` (semicolon-separated list of `type#fullname#countrycode#adm1code#lat#lon#featureid` entries) → only the **first** location entry is used (per approved design decision) — its `fullname` becomes `locationName`, its `lat`/`lon` become `GdeltEvent.lat`/`lon`. Rows with no parseable location are skipped (same policy as `parseEvents.ts` skipping events with missing coordinates).
  - `V2Themes` (semicolon-separated theme codes) → fed into `themeCategory()` (see below) to produce `GdeltEvent.category`; the first matched theme code (or the literal string `'none'` if nothing matched) is stored in `GdeltEvent.eventRootCode`, repurposing that field as a general "source classification code" across both CAMEO and GKG records rather than adding a new field to the type.
  - `V2Tone` (comma-separated: tone, positive score, negative score, polarity, activity reference density, self/group reference density, word count) → its first value becomes `GdeltEvent.avgTone`.
  - `V2Persons` (semicolon-separated names) → first entry becomes `GdeltEvent.actor1Name`, or `null` if empty.
  - `V2Organizations` (semicolon-separated names) → first entry becomes `GdeltEvent.actor2Name`, or `null` if empty.
  - `DocumentIdentifier` → `GdeltEvent.sourceUrl` directly (this is the article URL, exactly analogous to Events' `SOURCEURL`).

- **`lib/gdelt/themeCategory.ts`** — new module, parallel to `categoryMap.ts`'s `categoryForRootCode`. Exports `themeCategory(themesField: string): EventCategory`, checking the semicolon-split theme list against rules **in this priority order** (first match wins):
  1. `disaster` — any theme containing `NATURAL_DISASTER`, or starting with `CRISISLEX`
  2. `health` — any theme containing `HEALTH`, `DISEASE`, or `PANDEMIC`
  3. `economy` — any theme starting with `ECON_`
  4. `environment` — any theme starting with `ENV_`
  5. `other` — no rule matched (shared catch-all with unmatched CAMEO codes)

- **`lib/gdelt/types.ts`** — `EventCategory` extended from 5 to 9 values: `'conflict' | 'protest' | 'cooperation' | 'politics' | 'disaster' | 'economy' | 'health' | 'environment' | 'other'`. `GdeltEvent` itself is **unchanged** — every GKG field maps onto an existing property.

- **`lib/gdelt/categoryMap.ts`** — `ALL_CATEGORIES` and `CATEGORY_LABELS` extended with the four new values and human-readable labels ("Disaster", "Economy", "Health", "Environment"). Every consumer that iterates `ALL_CATEGORIES` generically (`CategoryFilter`, the events-query route's category validation) picks up the new values with no code change.

- **`components/Globe.tsx`** — `CATEGORY_COLORS` gains four new entries: `disaster: '#EA580C'`, `economy: '#A855F7'`, `health: '#EC4899'`, `environment: '#06B6D4'` (chosen visually distinct from the existing five: `#EF4444`, `#F59E0B`, `#22C55E`, `#3B82F6`, `#94A3B8`).

- **`lib/gdelt/ingestCycle.ts`** — `runIngestCycle` additionally extracts the GKG URL from `lastupdate.txt` (the same manifest, which lists the Events export, mentions file, and GKG file on three lines), fetches and unzips it the same way as the Events export, and parses it via `parseGkgCsv`. GKG-derived events are merged into the **same** `byDayCategory` grouping and written through the **same** existing dedup-by-`id`-merge-write loop — no change to `BlobStore` or its storage key format (`${day}/${category}.json`).

## 3. Error Handling

GKG fetching/parsing is wrapped independently of the Events fetch/parse: if the GKG file is missing from `lastupdate.txt`, fails to download, or fails to parse, that failure is caught and the cycle proceeds with Events ingestion only (returning whatever Events data it successfully processed) — matching the existing "no user-facing error for a single missed cycle" resilience policy from the original ingest design. GKG simply retries on the next 15-minute cycle.

## 4. Out of Scope

- Per-event enrichment of existing CAMEO events with GKG themes/entities (rejected during brainstorming — the URL-based join is unreliable).
- Multi-location explosion (one pin per location mentioned in a GKG record) — first-location-only per approved design.
- Any frontend/UI code changes — `CategoryFilter`, `ColorModeToggle`, `ArticlePanel`, and `Globe`'s point-click handling all already operate generically over `ALL_CATEGORIES`/`GdeltEvent` fields and require no modification.
- A separate scheduled function for GKG — folded into the existing 15-minute `ingest-gdelt` function per approved design.
- Trending-themes aggregate views/tickers (a plausible future addition, not part of this spec).

## 5. Testing

- **`parseGkgCsv`**: unit tests for a valid row (correct field extraction across `id`, `day`, `lat`/`lon`, `locationName`, `category`, `avgTone`, `actor1Name`/`actor2Name`, `sourceUrl`, `dateAdded`), a row with no parseable `V2Locations` entry (skipped), and a malformed/too-short row (skipped) — mirroring `parseEvents.test.ts`'s existing structure.
- **`themeCategory`**: unit tests for each of the four new categories' matching rules, a test confirming priority order when a theme list matches multiple rules (e.g. a list containing both a `NATURAL_DISASTER` theme and an `ECON_` theme resolves to `disaster`, not `economy`), and a fallback-to-`other` test for an unrecognized theme list.
- **`runIngestCycle`**: extend the existing test suite to verify (a) a GKG-derived event and a CAMEO-derived event for the same day end up correctly merged/deduped when they land in the same category bucket, (b) a simulated GKG fetch failure still allows Events ingestion to complete and return a non-zero `ingested` count.
- Manual: after deployment, confirm the four new category pills appear in `CategoryFilter` and that at least one pin renders in each new color within a day or two of real ingestion (natural disasters and economic news are frequent enough in GDELT's global coverage to appear quickly).
