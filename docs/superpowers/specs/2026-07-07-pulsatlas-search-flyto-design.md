# Pulsatlas — Search + Fly-to Camera — Design Spec

Date: 2026-07-07
Status: Approved, pending implementation plan

## 0. Context

This is sub-project #3 of the Pulsatlas feature roadmap (see `docs/superpowers/specs/2026-07-06-pulsatlas-autoplay-scrubber-design.md` §0 for the full list; #1 auto-play scrubber, #2a tone coloring, and #2b GKG themes already shipped). This is a pure frontend feature — no backend/data pipeline changes.

## 1. Overview

A search box in the header lets a user type a place name (city, country, region) and fly the globe's camera there via an animated transition. Ambiguous names (e.g. "Paris") are resolved by showing up to 5 matching results in a dropdown for the user to pick from, rather than guessing.

## 2. Architecture

- **`app/api/geocode/route.ts`** — new thin GET route handler. Reads a `q` query param, forwards it to Nominatim's public search endpoint (`https://nominatim.openstreetmap.org/search?format=json&q=<q>&limit=5`) with a `User-Agent: Pulsatlas (https://pulsatlas.netlify.app)` header (required by Nominatim's usage policy — browsers cannot set a custom `User-Agent` themselves, which is why this goes through a server-side proxy rather than being called directly from the client). Returns the JSON array from Nominatim through unchanged. Untested per the existing project convention (`/api/events` is likewise a thin, untested route — its logic has no branching worth a dedicated test).

- **`components/SearchBox.tsx`** — new component. Renders a text input. On each keystroke, debounces 400ms, then fetches `/api/geocode?q=<encoded query>`. Renders up to 5 results in a dropdown below the input, each showing Nominatim's `display_name` field (e.g. "Paris, Île-de-France, France"). Clicking a result calls the `onSelectPlace(lat: number, lon: number)` prop and closes the dropdown. If the fetch returns an empty array, the dropdown shows a plain "No results" message instead of an empty list. Discards stale responses: if a newer keystroke's debounced fetch has already fired, an older, slower-resolving fetch's response is ignored (tracked via a request-sequence counter) so a late response can't overwrite a newer one.

- **`components/Globe.tsx`** — converted from a plain function component to `forwardRef<GlobeHandle, GlobeProps>`, where `GlobeHandle = { flyTo: (lat: number, lon: number) => void }`. Internally holds a ref to the dynamically-loaded `react-globe.gl` instance (the library already exposes an imperative `pointOfView({ lat, lng, altitude }, transitionMs)` method on that instance for animated camera movement) and exposes `flyTo` via `useImperativeHandle`, calling `pointOfView({ lat, lng: lon, altitude: 0.5 }, 1000)` — a 1-second animated transition to a moderately zoomed-in view (altitude `0.5`, closer than the default overview `~2.5`, so the searched region is actually visible, not just the whole globe). `Globe`'s existing props (`events`, `onSelectEvent`, `colorMode`) are unchanged.

- **`app/page.tsx`** — adds `const globeRef = useRef<GlobeHandle>(null)`, passes `ref={globeRef}` to `<Globe>`, and renders `<SearchBox onSelectPlace={(lat, lon) => globeRef.current?.flyTo(lat, lon)} />` in the header, next to `SupportLink`.

## 3. Data Flow

1. User types into `SearchBox`.
2. After 400ms of no further typing, `SearchBox` fetches `/api/geocode?q=<query>`.
3. The route forwards the request to Nominatim with the required `User-Agent` header and returns the results.
4. `SearchBox` renders up to 5 results as a clickable dropdown list (or "No results" if the array is empty).
5. User clicks a result → `onSelectPlace(lat, lon)` fires → `app/page.tsx` calls `globeRef.current.flyTo(lat, lon)`.
6. `Globe`'s exposed `flyTo` calls the underlying `react-globe.gl` instance's `pointOfView`, animating the camera to the selected location over 1 second.

## 4. Error Handling

- Geocode fetch failure (network error, Nominatim downtime) or zero results: dropdown shows "No results" — no crash, no retry banner. This is a low-stakes, user-initiated lookup, not core data loading, so it doesn't need the same resilience treatment as the main event feed.
- Rapid typing / out-of-order responses: handled by the request-sequence counter described above — only the response matching the most recently fired request is applied.

## 5. Out of Scope

- Auto-selecting or highlighting a nearby event pin after flying to a location.
- Search history / recent searches.
- Keyboard arrow-key navigation within the results dropdown (mouse/tap click only for v1).
- Any change to `useEvents`, the ingest pipeline, or `/api/events`.

## 6. Testing

- `/api/geocode`: untested (thin proxy route, matches `/api/events`'s existing convention for routes with no meaningful branching logic).
- `SearchBox`: component tests for (a) the fetch firing exactly once, 400ms after the last keystroke, not on every keystroke, (b) rendering returned results as clickable items showing `display_name`, (c) calling `onSelectPlace` with the correct `lat`/`lon` when a result is clicked, (d) showing "No results" for an empty response array.
- `Globe`: test that calling `flyTo` via a ref invokes the underlying `react-globe.gl` instance's `pointOfView` with the expected `{ lat, lng, altitude: 0.5 }` argument and `1000`ms transition duration (using the same mocked-instance pattern already used for testing `pointColor` in the existing `Globe.test.tsx`).
