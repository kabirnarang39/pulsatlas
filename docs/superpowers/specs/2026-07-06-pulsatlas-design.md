# Pulsatlas — Design Spec

Date: 2026-07-06
Status: Approved, pending implementation plan

## 1. Overview

Pulsatlas is a web app that lets people explore world news on a 3D globe instead of a scrolling feed. Live and historical news events render as pulsing pins on a dark, mission-control-styled globe. Users spin/zoom the globe, filter by category, scrub back through time, and click a pin to read the story.

- Domain: `pulsatlas.com` (confirmed available via whois)
- Platform: web app (responsive, PWA-installable later, not required for v1)
- No user accounts in v1 — fully anonymous, prefs in `localStorage`

## 2. Architecture

**Frontend:** Next.js (static-friendly) + `react-globe.gl` (three.js-based 3D globe) for the map surface, deployed on Netlify.

**Backend:** No traditional app server or database. A Netlify Scheduled Function is the only backend component:

- Runs every 15 minutes, matching GDELT's own update cadence.
- Fetches GDELT's free raw Events export (CSV, no API key, no BigQuery — avoids any Google Cloud billing risk).
- Maps each event's CAMEO event code to a friendly category (conflict, disaster, politics, business, protest, etc.).
- Appends processed events to **today's** cache file.
- A second nightly scheduled function finalizes/compresses the day that just ended into an immutable snapshot (once GDELT has fully published that day), so the historical scrubber always reads small, stable, pre-aggregated files.

**Storage:** Netlify Blobs — one compact JSON blob per (day, category) pair. No relational DB, no ORM, no auth service. This is the "static-cache pipeline" approach: cost ceiling is effectively $0 regardless of traffic, because expensive aggregation happens once per 15 minutes server-side, not per user request.

**Why not BigQuery:** GDELT's BigQuery tables give convenient SQL access to history, but the free tier (1TB scanned/month) can be exceeded by real usage, creating open-ended Google Cloud billing exposure for a side project. The raw CSV export + scheduled aggregation avoids BigQuery (and its billing risk) entirely while still covering full history.

**Why not a hosted DB:** Bounding-box/relational queries aren't needed — the globe only ever needs "events for day X, category Y," which flat cached JSON serves directly. Adding Postgres/Supabase would be a service to run and pay for with no v1 benefit (YAGNI).

## 3. Data Flow

1. **Ingest (every 15 min):** scheduled function downloads new GDELT Events rows → maps CAMEO codes to categories → appends to today's per-category JSON blob.
2. **Finalize (nightly):** once a day's GDELT data is fully published, a scheduled function locks that day's blobs as immutable historical snapshots.
3. **Load (client):** on page load, frontend fetches today's + last few days' blobs, renders pins/heat-intensity on the globe for the selected category filter(s).
4. **Scrub (client):** dragging the time-scrubber to an earlier date lazily fetches that day's cached blob (browser also caches it), re-renders the globe for that day. Scrubber range is not artificially capped — full GDELT history (back to whenever finalized snapshots exist) is reachable, since cost is bounded by the ingestion side, not by how far users scrub.
5. **Read:** clicking a pin opens a side panel with headline, snippet, source, and a link to the original article (from GDELT's source URL field).

## 4. Globe UX

- Dark 3D globe (`react-globe.gl`), pulsing dot per event, clustered/heat-blended at low zoom to avoid clutter, individual pins revealed on zoom-in.
- Category filter bar (conflict, disaster, politics, business, protest, etc.) — multi-select, persisted in `localStorage`.
- Time-scrubber control for historical playback, distinct from the live/recent default view.
- Click pin → side panel article card (headline, snippet, source, timestamp, link out). No in-app full article reader — Pulsatlas links out to the original publisher (respects publisher traffic/ad revenue, avoids copyright issues of rehosting content).

## 5. Monetization

- **Google AdSense:** one persistent banner slot (footer or side rail, positioned so it never overlaps the globe interaction area) + one slot inside the article side-panel. Ad slot rendered as its own component so a future "sponsored region/pin" native placement can slot in later without touching layout code.
- **Donate (UPI):** persistent icon/link in the header, plus a dedicated mention in an About/Support panel. A plain `upi://pay` deep link to the operator's VPA — no payment platform, no custom payment code, no platform cut. (Originally planned as Buy Me a Coffee; switched because BMC doesn't support India payouts.)
- No subscriptions, no paywall, no accounts tying to payment in v1.

## 6. Branding

- **Name:** Pulsatlas (`pulsatlas.com`)
- **Personality:** bold explorer / mission-control — a discovery tool, not a typical news feed.
- **Style:** dark-mode-primary, blending Space-Tech/Aerospace and Cinematic-Dark influences — deep near-black background, glassy elevated cards, launch-blue accent for pins/highlights, subtle glow on live/pulsing events. Deliberately avoids full neon-cyberpunk styling, which fails WCAG contrast for long-form article text.
- **Color tokens:**
  - Background: `#0B0B10`
  - Foreground/text: `#F8FAFC`
  - Card/elevated surface: `#1E1E23`
  - Accent (pins, links, highlights): `#3B82F6`
  - Muted text: `#94A3B8`
  - Destructive/alert: `#EF4444`
- **Typography:** Space Grotesk (headings) + DM Sans (body) — bold/futuristic display character with a highly readable body face for article cards.
- **Icons:** SVG icon set only (no emoji), consistent stroke weight, per ui-ux-pro-max accessibility guidance.

## 7. Error Handling

- Ingest function failure (GDELT fetch error/timeout): retry on next 15-min run; frontend simply shows the last successfully cached day — no user-facing error for a single missed cycle.
- Frontend blob fetch failure: show inline "couldn't load this day's events, retry" state on the globe, not a blank/broken globe.
- AdSense script failure: fails silently (ad slot collapses) — never blocks core globe functionality.

## 8. Explicitly Out of Scope (v1)

- User accounts, login, cross-device sync
- Push notifications
- In-app article reading (always links out)
- Native/sponsored ad placements (slot is reserved, not built)
- Mobile native app (web-first, PWA install optional later)
- Multi-language UI (GDELT content itself is multilingual/translated; app chrome is English-only for v1)

## 9. Testing

- Ingest function: unit test CAMEO-code → category mapping, and CSV-parsing against a sample GDELT export fixture.
- Finalize function: test that a day's blob is only locked once fully published, not mid-day.
- Frontend: component tests for globe pin rendering given a fixture blob, category filter toggling, and scrubber date-change fetching the right blob.
- Manual: verify AdSense slots render without blocking layout when ad-blocked; verify UPI link opens the device's payment-app picker correctly.
