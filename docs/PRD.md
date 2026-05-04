# ScoreYard — Product Requirements Document (PRD)

**Status:** v0 draft
**Owner:** Baljeet Singh
**Last updated:** 2026-05-04

---

## 1. Product summary

ScoreYard is an **open-source, mobile-first live scorecard** for racquet sports — badminton first, then tennis, pickleball, table tennis, squash, volleyball. The scorekeeper controls the match from a phone courtside; the score appears as a live overlay in OBS / Streamlabs / Streamyard, or as a fullscreen scoreboard on a TV/tablet at the venue.

**Tagline:** _A live scorecard that goes wherever you stream._

## 2. Goals & non-goals

### Goals (v1)

- **Best-in-class badminton scoring** with full BWF rules (21-pt rally scoring, win-by-2, cap-at-30, interval-at-11, service-court tracking).
- **Mobile-first control panel** that a non-technical scorekeeper can use one-handed courtside.
- **Three rendering surfaces** from one match: control, OBS overlay, fullscreen scoreboard.
- **Local-first architecture** so a flaky venue WiFi never breaks a match.
- **Theme system using plain HTML+CSS files** — designers can contribute themes without learning Vue.
- **Multi-sport from day one:** badminton (15/21), tennis, pickleball, table tennis (rules data-driven).
- **Free, MIT-licensed core.** Self-hostable in one click.

### Non-goals (v1)

- ❌ Native mobile app — PWA only. Capacitor wrap deferred to v2.
- ❌ Visual / drag-and-drop theme editor — themes are hand-coded HTML files.
- ❌ Tauri desktop app — deferred to v2 (only if WiFi-less venues become a real complaint).
- ❌ Tournament management (brackets, multi-court dashboard) — deferred to Pro tier.
- ❌ Cloud-side video composition — deferred (post-production burn-in is v2).
- ❌ Account system at v1 — anonymous matches, browser-stored. Accounts arrive with Pro.
- ❌ Paid theme packs at launch — open the gate after v1 has real users.

## 3. Personas & primary flows

### Persona A — _Priya, the Sunday-tournament phone streamer_
Streams local club tournaments to Facebook Live from her phone. No laptop, no production crew.

**Flow:**
1. Opens `scoreyard.app` on her phone → "Start a match" → picks Badminton 21-pt.
2. Configures team names, best-of-3, taps "Create."
3. Match dashboard shows three URLs: **Overlay**, **Scoreboard**, **Control**, plus a QR for pairing.
4. Props an old tablet next to the court showing the **Scoreboard URL** fullscreen (high-contrast, filmable theme).
5. Films the court + tablet with her phone via the regular Facebook Live app.
6. Scores from her phone using the **Control URL** (two large tap zones, long-press to undo).

### Persona B — _Arjun, the OBS-stream league operator_
Runs a city league. Laptop with OBS, two cameras, dedicated scorekeeper.

**Flow:**
1. Creates the match on his laptop.
2. Pastes the **Overlay URL** into OBS as a Browser Source (1920×1080, transparent background).
3. Scans the QR on the dashboard from his scorekeeper's phone → scorekeeper now controls the match.
4. Customizes team colors and logos from the dashboard. Overlay updates live in OBS.
5. Goes live to YouTube via OBS. Streamlabs/Restream multistream optional, downstream of OBS.
6. Between matches, swaps the active match via the **Dynamic URL** feature (one OBS browser source, swap which match feeds it).

### Persona C — _Karan, the in-venue club scoreboard operator_
Sunday club tournament, no streaming, just wants a TV in the hall showing the live score.

**Flow:**
1. Creates a match on his phone.
2. Opens the **Scoreboard URL** on the club's TV/laptop browser, hits fullscreen.
3. Scores from his phone. Setup time: under 60 seconds.

## 4. The three rendering surfaces

| Surface | Route | Audience | Notes |
|---|---|---|---|
| **Control** | `/m/[id]/control` | Scorekeeper's phone | Two huge tap zones, server indicator, swipe-up advanced. Wake-lock, haptics. |
| **Overlay** | `/m/[id]/overlay` | OBS / Streamlabs / Streamyard browser source | Transparent background, no chrome. Lower-third or corner-bug layouts. |
| **Scoreboard** | `/m/[id]/scoreboard` | Tablet/TV at venue, sharing link | Opaque background, fullscreen, designed to be **filmed** as much as displayed. |

All three surfaces support `?theme=<id>` and `?at=<ms>` (render score as of timestamp — powers replay scrubbing and v2 video burn-in).

## 5. Dynamic URL (lifted from OpenScoreboard)

A user-owned **Dynamic URL** that points to a target match, swappable from the dashboard without changing the OBS browser source. Operators paste once, swap matches all day. Format: `/d/[dynamicId]` → resolves to whichever match is currently bound.

## 6. Sports & rules (v1 scope)

Each sport is a `SportConfig` object — pure data, not code. Adding a sport is a config file, not a fork. (This is the explicit fix to OpenScoreboard's `switch (sportName)` trap.)

### Day-one presets

| Sport | Preset | `pointsPerGame` | `winBy` | `cap` | `gamesToWin` | `intervalAt` |
|---|---|---|---|---|---|---|
| Badminton | 21-pt BWF | 21 | 2 | 30 | 2 (BO3) | 11 |
| Badminton | 15-pt traditional | 15 | 2 | 21 | 2 (BO3) | 8 |
| Pickleball | classic | 11 | 2 | null | 2 (BO3) | null |
| Pickleball | rally | 21 | 2 | null | 1 | null |
| Table tennis | standard | 11 | 2 | null | 3 (BO5) | null |
| Tennis | (basic, no tiebreak v1) | 6 (games) | 2 | null | 2 (sets) | null |

Tennis tiebreaks, volleyball, squash, free-form scoring → v1.x.

## 7. Data model

### Event-sourced. Two tables, append-only event log.

```ts
type MatchEvent =
  | { id: string; ts: number; type: 'match.start'; serverSide: 'A' | 'B'; serverCourt: 'right' | 'left' }
  | { id: string; ts: number; type: 'point'; side: 'A' | 'B' }
  | { id: string; ts: number; type: 'undo' }
  | { id: string; ts: number; type: 'game.end' }
  | { id: string; ts: number; type: 'sides.swap' }
  | { id: string; ts: number; type: 'team.rename'; side: 'A' | 'B'; name: string }
```

- `id` is a ULID (sortable, globally unique → conflict-free merges).
- `ts` is `Date.now()` at write time (powers replay-by-timestamp / video burn-in).
- State is **always** `reduce(events, sportConfig)`. Never stored directly.

### Why this matters

- **Free undo** — drop the last event.
- **Free replay** — render score at any timestamp.
- **Free conflict resolution** — merge two event streams by `[ts, deviceId]`.
- **Free video burn-in (v2)** — FFmpeg overlay at any frame timestamp.
- **No 9-game hardcode** — best-of-N is just a config field.

## 8. Local-first sync

- Every score tap writes to **IndexedDB first** (via Dexie), UI reads local state synchronously.
- Background worker pushes events to **Supabase Realtime** when online.
- Tabs on the same device sync via **BroadcastChannel** (cheap, instant, lifted from OpenScoreboard).
- Brief disconnects → events queue locally, sync on reconnect.
- Single-device offline: fully supported. Multi-device offline: deferred to v2 (workaround: phone hotspot).

## 9. Theme system

Themes are **plain HTML files with CSS** plus `data-bind` attributes:

```html
<!-- packages/themes/broadcast-classic/index.html -->
<div class="scorecard">
  <div class="team team-a">
    <span class="name" data-bind="names.a">Team A</span>
    <span class="score" data-bind="games.last.a">0</span>
    <span class="games-won" data-bind="gamesWon.a">0</span>
  </div>
  <div class="server-indicator" data-show="servingSide==A,serverCourt==right">⬤</div>
  <div class="team team-b">…</div>
</div>
```

A ~50-line runtime in `apps/web` parses the bindings and updates DOM `textContent` on state changes. No Vue knowledge required to author a theme — designer-friendly.

CSS custom properties define theme tokens (`--accent-a`, `--accent-b`, `--font-display`) that the dashboard can override per-match (team colors, sponsor accent).

### v1 ship: 3 themes

1. **Broadcast Classic** — ESPN/BWF-style lower-third for OBS overlay.
2. **Filmable Scoreboard** — high-contrast, big numbers, designed to be filmed by a camera (Persona A). Dark background, no transparency.
3. **Minimal Bug** — tiny corner overlay for understated streams.

## 10. Tech stack

| Layer | Choice | Reason |
|---|---|---|
| Web app | **Nuxt 3** | Vue 3, SSR, PWA, your existing skill set |
| Styling | Tailwind CSS v4 + CSS variables | Theme tokens via custom properties |
| State | Pinia | Standard Nuxt pattern |
| Mobile APIs | VueUse (wake-lock, vibrate, network) | Saves boilerplate |
| PWA | `@vite-pwa/nuxt` | Offline shell, install prompt |
| Local DB | Dexie.js (IndexedDB) | Event store; primary write target |
| Backend | **Supabase** (Postgres + Realtime + Auth + RLS) | One service, your existing stack |
| Engine | `@scoreyard/engine` (pure TS) | Framework-free; runs in Nuxt, Capacitor, Tauri, Node |
| Tests | Vitest (engine), Playwright (one E2E) | Engine coverage is the core asset |
| Lint/format | Biome | Single tool, fast |
| Monorepo | pnpm workspaces | Standard, light |
| Hosting | Netlify (web) + Supabase managed (DB) | Existing pipeline |
| Mobile (v2) | **Capacitor** wrapping Nuxt | One codebase. Expo deferred unless Capacitor proves limiting. |

## 11. Roadmap

### v1.0 — "Badminton, beautifully" (target: ~6 weekends)

- Scoring engine: badminton 21/15 + tests
- Pickleball, table tennis, tennis basic configs
- 3 rendering surfaces wired to Supabase Realtime
- 3 themes (Broadcast Classic / Filmable / Minimal)
- Dynamic URL feature
- PWA + single-device offline
- Landing page + GitHub release + 1-click Netlify deploy

### v1.1–1.5 — community + polish

- More sport presets (volleyball, squash, free-form)
- More themes (community PRs)
- Stats: rally count, longest streak, time-to-win
- "Replay this match" scrubber

### v2 — paid layer

- Cloud match history (account required)
- Custom branding / sponsor logos (paid)
- Theme packs ($9–15 each)
- Capacitor mobile app
- Post-production video burn-in via FFmpeg (event log → MP4 with overlay)

### v3 — only if v2 has demand

- Tauri desktop app for venue-WiFi-less tournaments
- Multi-court tournament dashboard
- Server-side live overlay (Cloudflare Stream / Mux integration)

## 12. Success metrics (v1)

- 50+ GitHub stars within 30 days of launch
- 100+ matches scored across users in month 1
- 1+ tournament organizer using it for a real event
- 3+ community-contributed themes within 60 days
- p95 score-tap-to-overlay-update latency < 300ms

## 13. Out of scope, explicit

- Tournament brackets, draws, seeding
- Player profiles / lifetime stats
- Coach/training tooling
- Live stream ingest/distribution (we are not a streaming service)
- Score validation by referees / officials (single-source-of-truth is the operator)
