# Scoreboard — Product Requirements Document (PRD)

**Status:** v1.0 draft
**Owner:** Baljeet Singh
**Last updated:** 2026-05-04
**Companion:** [BRD.md](./BRD.md)

---

## 1. Product summary

Scoreboard is an open-source, mobile-first live scorecard for racquet sports. The scorekeeper controls the match from a phone courtside; the score appears as a live overlay in OBS / Streamlabs / Streamyard, or as a fullscreen scoreboard on a TV/tablet at the venue. Players can also log final results without scoring live.

**Tagline (v1):** _A live scorecard that goes wherever you stream._
**Tagline (v3):** _Score it. Log it. Run your tournament. Build your community._

## 2. Scope summary

| Scope | v1 | v2 | v3 | v4 |
|---|---|---|---|---|
| Live scoring (badminton 21/15) | ✅ | | | |
| Live scoring (tennis, pickleball, table tennis basic) | ✅ | | | |
| Three rendering surfaces (control / overlay / scoreboard) | ✅ | | | |
| Three default themes (HTML+CSS) | ✅ | | | |
| Dynamic-URL feature | ✅ | | | |
| Local-first storage (Dexie + BroadcastChannel) | ✅ | | | |
| Supabase Realtime sync | ✅ | | | |
| Single-device offline | ✅ | | | |
| Result logging (no live scoring needed) | ✅ | | | |
| Tournament *grouping* (matches under a `/t/[id]` container) | ✅ | | | |
| PWA install + service worker | ✅ | | | |
| Anonymous matches (no account required) | ✅ | | | |
| Doubles support (4 players per match, BWF service rotation) | ✅ | | | |
| Match metadata (court number, round, category, scheduled time, venue) | ✅ | | | |
| Multi-step undo + score correction (typo fix flow) | ✅ | | | |
| Match-state events (walkover, retirement, default, time-out, suspension) | ✅ | | | |
| Auto-generated match cards (og:image with live score) | ✅ | | | |
| Privacy policy + DPDP / GDPR compliance | ✅ | | | |
| Accessibility baseline (WCAG 2.1 AA, keyboard nav, screen reader, color-blind safe) | ✅ | | | |
| Demo match on landing page (auto-scoring) | ✅ | | | |
| Practice / trial mode (no match record) | ✅ | | | |
| Theme manifest + contribution guide | ✅ | | | |
| Error tracking (Sentry) + privacy-first analytics (Plausible) | ✅ | | | |
| "Deploy to Netlify / Vercel" buttons + self-hosting docs | ✅ | | | |
| Match lifecycle policy (24h auto-archive, 30d anonymous expiry) | ✅ | | | |
| User accounts (Pro tier) | | ✅ | | |
| Cloud match history | | ✅ | | |
| Player profiles + lifetime stats | | ✅ | | |
| Theme marketplace + paid theme packs | | ✅ | | |
| Custom branding / sponsor logos | | ✅ | | |
| Multi-scorekeeper per match | | ✅ | | |
| Capacitor mobile app (iOS + Android) | | ✅ | | |
| Post-production video burn-in (FFmpeg) | | ✅ | | |
| Networks / academies / clubs (multi-tenant) | | | ✅ | |
| Player registration for events | | | ✅ | |
| Bracket / draw generation | | | ✅ | |
| Match scheduling across courts | | | ✅ | |
| Custom-branded subdomains (`academy.scoreboard.app`) | | | ✅ | |
| Payments (entry fees) via Razorpay / Stripe | | | ✅ | |
| Tournament-day live dashboard | | | ✅ | |
| White-label overlays | | | ✅ | |
| Tauri desktop (offline-first venue mode) | | | | ✅ |
| Server-side stream composition (Cloudflare Stream / Mux) | | | | ✅ |
| Multi-court tournament-day-of dashboard | | | | ✅ |

## 3. v1 detailed requirements

### 3.1 Personas & primary flows

#### Persona A — _Priya, the Sunday-tournament phone streamer_
Streams local club tournaments to Facebook Live from her phone. No laptop, no production crew.

**Flow:**
1. Opens `scoreboard.app` on her phone → "Start a match" → picks Badminton 21-pt.
2. Configures team names, best-of-3, taps "Create."
3. Match dashboard shows three URLs: **Overlay**, **Scoreboard**, **Control**, plus a QR for pairing.
4. Props an old tablet next to the court showing the **Scoreboard URL** fullscreen (high-contrast, filmable theme).
5. Films the court + tablet with her phone via the regular Facebook Live app.
6. Scores from her phone using the **Control URL** (two large tap zones, long-press to undo).

#### Persona B — _Arjun, the OBS-stream league operator_
Runs a city league. Laptop with OBS, two cameras, dedicated scorekeeper.

**Flow:**
1. Creates the match on his laptop.
2. Pastes the **Overlay URL** into OBS as a Browser Source (1920×1080, transparent background).
3. Scans the QR on the dashboard from his scorekeeper's phone → scorekeeper now controls the match.
4. Customizes team colors and logos from the dashboard. Overlay updates live in OBS.
5. Goes live to YouTube via OBS. Streamlabs/Restream multistream optional, downstream of OBS.
6. Between matches, swaps the active match via the **Dynamic URL** feature (one OBS browser source, swap which match feeds it).

#### Persona C — _Karan, the in-venue club scoreboard operator_
Sunday club tournament, no streaming, just wants a TV in the hall showing the live score.

**Flow:**
1. Creates a match on his phone.
2. Opens the **Scoreboard URL** on the club's TV/laptop browser, hits fullscreen.
3. Scores from his phone. Setup time: under 60 seconds.

#### Persona D — _Meera, the casual player logging a result_
Just played 3 games at her local club. Wants to record the result and share it.

**Flow:**
1. Opens `scoreboard.app` → "Log a result" → picks Badminton.
2. Enters team names + final scores per game (e.g., 21-19, 18-21, 21-15).
3. Taps "Save."
4. Gets a Scoreboard URL she can share on WhatsApp showing the final result rendered in a chosen theme.

### 3.2 The three rendering surfaces

| Surface | Route | Audience | Notes |
|---|---|---|---|
| **Control** | `/m/[id]/control` | Scorekeeper's phone | Two team rows. Each row has a centered header (team label · score · games-won pips · `MATCH PT`/`GAME PT` badge) above a 2-cell tap area (left court \| right court). Tap any cell of a team to add a point. Doubles: each cell shows whichever partner is currently in that court (via `partnerOnRight`). Singles: name shown only in the active cell — server's court for the serving team, diagonal opposite for the receiver. Serving cell shows a `● Serves` pill. Sub-bar above: previous games, `INTERVAL` badge, tap-to-edit format chip. Sheets via `⋯`: events list (long-press on Undo opens it), match-state actions, format pickers, score correction. Wake-lock + haptics. Desktop caps width to `max-w-md` with side scrim. |
| **Overlay** | `/m/[id]/overlay` | OBS / Streamlabs / Streamyard browser source | Transparent background, no chrome. Lower-third or corner-bug layouts. |
| **Scoreboard** | `/m/[id]/scoreboard` | Tablet/TV at venue, sharing link | Opaque background, fullscreen, designed to be **filmed** as much as displayed. |

All three surfaces support `?theme=<id>` and `?at=<ms>` (render score as of timestamp — powers replay scrubbing and v2 video burn-in).

### 3.3 Dynamic URL (lifted from OpenScoreboard)

A user-owned **Dynamic URL** that points to a target match, swappable from the dashboard without changing the OBS browser source. Operators paste once, swap matches all day. Format: `/d/[dynamicId]` → resolves to whichever match is currently bound.

### 3.4 Tournament grouping (cheap version of the v3 vision)

A **tournament** in v1 is just a *container of matches*. No registration, no brackets, no payments — just grouping with shared branding.

**Data:** add `tournament_id` to `matches`, plus a `tournaments` table with `id, name, theme_id, colors, sponsor_logo_url`.

**Routes:**
- `/t/[id]` — tournament home page listing all matches (live + completed)
- `/t/[id]/overlay` — combined overlay showing all live matches across courts (scrolling ticker)

**v1 explicitly does not include** brackets, draws, registration, payments. Just visual grouping. ~1 weekend of work.

### 3.5 Sports & rules (v1 scope)

Each sport is a `RacquetConfig` object — pure data, not code. Adding a sport is a config file in `packages/engine/src/sports/<sport>/config.ts`, not a fork.

#### Day-one presets

| Sport | Preset | `pointsPerGame` | `winBy` | `cap` | `gamesToWin` | `intervalAt` |
|---|---|---|---|---|---|---|
| Badminton | 21-pt BWF | 21 | 2 | 30 | 2 (BO3) | 11 |
| Badminton | 15-pt traditional | 15 | 2 | 21 | 2 (BO3) | 8 |
| Pickleball | classic | 11 | 2 | null | 2 (BO3) | null |
| Pickleball | rally | 21 | 2 | null | 1 | null |
| Table tennis | standard | 11 | 2 | null | 3 (BO5) | null |
| Tennis | (basic, no tiebreak v1) | 6 (games) | 2 | null | 2 (sets) | null |

Tennis tiebreaks, volleyball, squash, free-form scoring → v1.x.

### 3.6 Themes

Themes are **plain HTML files with CSS** plus `data-bind` attributes hydrated by a tiny runtime in `apps/app`:

```html
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

A ~50-line runtime parses the bindings and updates DOM `textContent` on state changes. No Vue knowledge required to author a theme.

CSS custom properties define theme tokens (`--accent-a`, `--accent-b`, `--font-display`) that the dashboard can override per-match (team colors, sponsor accent).

#### v1 ship: 3 themes

1. **Broadcast Classic** — ESPN/BWF-style lower-third for OBS overlay (transparent bg).
2. **Filmable Scoreboard** — high-contrast, big numbers, designed to be filmed by a camera (Persona A). Dark background, no transparency.
3. **Minimal Bug** — tiny corner overlay for understated streams.

### 3.7 Data model (v1)

Event-sourced. State is **always** computed from events.

```ts
// matches table
type MatchRecord = {
  id: string                    // ULID
  created_at: string
  updated_at: string
  owner_id: string | null       // null for anonymous v1 matches; user_id arrives with Pro
  sport_family: 'racquet'
  sport_preset: string          // 'badminton-21', 'badminton-15', 'pickleball-classic', etc.
  config: jsonb                 // e.g., RacquetConfig
  theme_id: string
  colors: { a: string; b: string }
  started_at: number | null     // ms since epoch; null until first event
  tournament_id: string | null  // forward-compatible, used only by tournament grouping
}

// events table (append-only)
type EventRecord = {
  id: string                    // ULID — sortable, globally unique
  match_id: string
  device_id: string             // for offline-merge tie-breaks
  ts: number                    // ms since epoch (Date.now() at write time)
  type: string                  // discriminator from RacquetEvent or future sport families
  payload: jsonb                // event-specific fields
  inserted_at: timestamptz
}

// tournaments table (v1)
type TournamentRecord = {
  id: string
  name: string
  theme_id: string
  colors: { a: string; b: string }
  sponsor_logo_url: string | null
  created_at: string
}
```

#### Why event-sourced

- **Free undo** — drop the last event, re-reduce
- **Free replay** — render score at any timestamp (`?at=<ms>`)
- **Free conflict resolution** — merge two event streams by `[ts, deviceId]`
- **Free video burn-in (v2)** — FFmpeg overlay at any frame timestamp
- **No game-count hardcode** — best-of-N is just a config field
- **Sport-pluggable** — new racquet sports add their config without disturbing existing ones

### 3.8 Local-first sync

- Every score tap writes to **IndexedDB first** (via Dexie), UI reads local state synchronously.
- Background worker pushes events to **Supabase Realtime** when online.
- Tabs on the same device sync via **BroadcastChannel** (cheap, instant).
- Brief disconnects → events queue locally, sync on reconnect.
- Single-device offline: fully supported. Multi-device offline: deferred to v2 (workaround: phone hotspot, then Tauri in v4).

### 3.9 PWA & install

- `@vite-pwa/nuxt` or equivalent — service worker caches app shell + assets.
- Web App Manifest with icons, theme color.
- "Add to Home Screen" prompt at the right moment in the flow.
- Wake Lock API on the control surface.
- Vibration API for haptic confirmation on score events.

### 3.10 Non-functional requirements (v1)

- p95 score-tap-to-overlay-update latency: **< 300ms** (local) / **< 800ms** (cross-device via Supabase Realtime)
- Initial page load on 4G: **< 2.5s** to interactive
- Overlay must run at 60fps with no jank during score change animations
- App shell must work fully offline after first load
- Bundle size: **< 200KB gzipped** for the engine + control panel critical path
- Lighthouse PWA score: **≥ 90** on mobile

### 3.11 Tech stack (v1, locked)

| Layer | Choice | Reason |
|---|---|---|
| Web app | **Nuxt 3** (SPA mode) | Vue 3, PWA, existing skill set |
| Styling | Tailwind CSS + CSS variables | Theme tokens via custom properties |
| State | Pinia | Standard Nuxt pattern |
| Mobile APIs | VueUse (wake-lock, vibrate, network) | Saves boilerplate |
| PWA | `@vite-pwa/nuxt` | Offline shell, install prompt |
| Local DB | **Dexie.js** (IndexedDB) | Typed schemas, indexed queries on `(match_id, ts)` |
| Backend | **Supabase** (Postgres + Realtime + Auth + RLS) | Postgres > Firebase Realtime DB for event-sourced data; OSS-friendly |
| Engine | `@scoreboard/engine` (pure TS) | Framework-free; runs in Nuxt, Capacitor, Tauri, Node |
| Tests | **Vitest** (engine), Playwright (one E2E) | Engine coverage is the core asset |
| Lint/format | Biome | Single tool, fast |
| Monorepo | pnpm workspaces + Turbo | Mirrors np-mono pattern |
| Hosting | Netlify (web) + Supabase managed (DB) | Existing pipeline |
| Mobile (v2) | **Capacitor** wrapping Nuxt | One codebase. Expo deferred unless Capacitor proves limiting. |

### 3.12 Pages / routes (v1) *(refined 2026-05-05)*

**`apps/app` — auth-aware product (anonymous-OK):**

```
/                             # Authenticated dashboard / anonymous "Start a match" landing
/new                          # Sport picker + match config (anonymous-OK)
/new/result                   # Result-only entry form (anonymous-OK)
/m/[id]                       # Match hub — live status, overlay/scoreboard URLs, theme picker
/m/[id]/control               # Court control surface (phone) — anonymous-OK
/m/[id]/overlay               # OBS / Streamlabs browser source (transparent)
/m/[id]/scoreboard            # Fullscreen scoreboard (TVs, sharing, filmable)
/d/[dynamicId]                # Dynamic URL → resolves to current bound match
/t/[id]                       # Tournament home page (list of matches)
/t/[id]/overlay               # Combined overlay (multi-court ticker)
/auth/signin                  # Sign in (email/password; Google button rendered but disabled in v1)
/auth/signup                  # Sign up (display name + email + password)
/auth/forgot-password         # Password reset request
/auth/reset-password          # Password reset form (linked from email)
/auth/callback                # OAuth / email-confirmation landing
/profile                      # Display name, avatar (drag-drop upload), change password — sign-in required
```

Auth gating: only `/profile` (and future `/history`, `/admin`) require sign-in. All scorer surfaces are anonymous-OK.

**`apps/web` — marketing site (planned, currently empty):**

```
/                             # Landing page (theme previews, GitHub link, OSS messaging)
/themes                       # Theme gallery + live previews — moved from apps/app
/score                        # Free anonymous scorer (subset of apps/app surfaces)
/legal/privacy                # Privacy policy
/legal/terms                  # Terms of service
```

**Removed in 2026-05-05 sweep:** `/themes` and `/about` left `apps/app` — both belong on the marketing site.

### 3.13 Out of scope for v1, with explicit deferrals

| Feature | Deferred to | Why |
|---|---|---|
| ~~User accounts / sign-in~~ *(pulled into v1 as **E1.0**, optional)* | — | Auth scaffolding (Supabase email/password, custom-claims, RLS for `owner_id IS NULL`) shipped in v1. Anonymous remains the default. Per BRD #9 *(2026-05-05)*. |
| Cloud match history | v2 | Requires accounts (now optional, but the history UI itself is v2) |
| Lifetime stats / head-to-head | v2 | Requires accounts + significant UI |
| Player profiles | v2 | Out of scope for the streamer wedge |
| Custom branding / sponsor logos | v2 | Pro feature |
| Theme marketplace / paid themes | v2 | Validate v1 first |
| Multi-scorekeeper per match | v2 | Edge case in v1 — one phone is enough |
| Native mobile app | v2 (Capacitor) | PWA covers 95% of need |
| Tennis tiebreaks, volleyball, squash | v1.x | Add as community PRs |
| Visual / drag-and-drop theme editor | v3 (or never) | Ship 3 great themes; let demand pull editor work |
| Tournament brackets / draws | v3 | Real product category, months of work |
| Player registration / forms | v3 | Same as above |
| Match scheduling across courts | v3 | Same |
| Payments / entry fees | v3 | Same |
| Network / academy multi-tenancy | v3 | The real business; needs v1+v2 traction first |
| White-label subdomains | v3 | Tied to networks |
| Tournament-day live dashboard | v3 | Tied to scheduling |
| Tauri desktop app | v4 | Only if WiFi-less venue complaints become real |
| Server-side video composition | v4 | Heavy infra, unclear demand |
| Native iOS/Android Expo apps | Likely never | Capacitor covers it |

### 3.14 Doubles support (v1, must)

Half of all real badminton matches are doubles. The data model and engine accommodate this from day one.

**Match config additions:**
```ts
type RacquetConfig = {
  // ...existing fields...
  isDoubles: boolean              // false = singles, true = doubles
}
```

**Match state additions:**
```ts
type RacquetState = {
  // ...existing fields...
  players: { a: [string, string?]; b: [string, string?] }  // two per side max
  serverPlayer: 'a1' | 'a2' | 'b1' | 'b2' | null           // doubles only
}
```

**Doubles scoring rules (BWF):**
- Service alternates between partners *within* a team only when serve is regained
- The serving team's score parity determines server court (right when even, left when odd)
- The receiving partner who returns is fixed for that point — not tracked at v1, exposed at v2 if needed
- Singles matches set `isDoubles: false` and `players: { a: [name], b: [name] }`

**UI implications:**
- Match-config form has "Singles / Doubles" toggle that swaps the player-name input fields (2 vs 4)
- Themes render `players.a.join(' / ')` for doubles, `players.a[0]` for singles
- Control surface is unchanged — tap zones still represent *teams* not players

### 3.15 Match metadata for tournaments (v1)

The `matches` table grows to support tournament context even when `tournament_id` is null:

```ts
type MatchRecord = {
  // ...existing fields...
  court_label: string | null      // e.g., "Court 3", "Centre Court"
  round: string | null            // e.g., "R16", "QF", "SF", "F", "Group A"
  category: string | null         // e.g., "Men's Singles U-15", "Mixed Doubles Open"
  scheduled_at: number | null     // ms since epoch — separate from started_at
  venue: string | null            // free-text, e.g., "Xperience Academy"
}
```

These are optional; anonymous quick matches leave them null. Tournament-grouped matches use them to render readable list pages and overlays.

### 3.16 Multi-step undo + score correction (v1)

**Multi-step undo** is free with event-sourcing — the control surface exposes it explicitly:
- Single tap on Undo button → undo last point
- Long-press on Undo → opens "Recent events" sheet with up to 20 last events; user can undo to any prior state
- Each undo emits an `undo` event for audit trail (the trim-and-replay pattern means `undo` is recorded as a meta-event)

**Score correction (post-hoc):**
- From the dashboard, "Correct score" opens a flow: shows current score, lets operator type the corrected score per game, emits a `score.correct` event with the new state
- Replay treats `score.correct` as an authoritative reset to the named scores at the named point
- Audit log shows who corrected what and when (in v1 just by `device_id`; in v2 by user account)

### 3.17 Match-state events (v1)

Events beyond plain scoring that real matches need. Each is its own event type so the engine and UI can handle it correctly.

```ts
type RacquetEvent =
  // ...existing events...
  | { type: 'walkover'; winner: SideId }                    // opponent didn't show
  | { type: 'retirement'; retiring: SideId; reason?: string } // injury mid-match
  | { type: 'default'; defaulted: SideId; reason?: string }   // disqualification
  | { type: 'timeout.start'; side: SideId; kind: 'standard' | 'medical' | 'injury' }
  | { type: 'timeout.end'; side: SideId }
  | { type: 'suspension.start'; reason?: string }            // rain, power, crowd
  | { type: 'suspension.end' }
  | { type: 'score.correct'; games: GameScore[]; gamesWon: { a: number; b: number } }
```

The reducer treats `walkover`/`retirement`/`default` as terminal: `matchOver: true`, `winner` set per the event, no further events accepted.
Timeouts and suspensions don't change scoring state; they exist for the overlay to display ("⏸ Timeout — A · 0:42 remaining") and for stats.

### 3.18 Match cards / og:image (v1, growth-critical)

When a scoreboard URL is shared on WhatsApp / Twitter / Facebook, the link preview must render **the actual current score as an image**, not a generic logo.

**Implementation:**
- Add a server route `/m/[id]/card.png` that renders an SVG of the match's current state (using Satori or `vercel/og` or similar) and rasterises to PNG
- The match dashboard's `<head>` includes `<meta property="og:image" content="/m/[id]/card.png" />`
- Cache aggressively — invalidate on any new event for that match (Supabase trigger calls a Netlify rebuild webhook, or just use ETag based on `events.length`)
- Same approach for tournament pages (`/t/[id]/card.png`) — shows leaderboard or live ticker

**Why it matters:**
Vertical-SaaS competitors attribute a meaningful share of growth to share-preview-with-live-score. Every shared link is a free, contextual ad.

### 3.19 Privacy & legal (v1, required for any public deployment)

- **Privacy policy** at `/legal/privacy` linked in footer
- **Terms of service** at `/legal/terms` linked in footer
- **Data Protection Act (DPDP, India 2023)** compliance:
  - Explicit consent at account creation (v2)
  - Right to access / delete data
  - Indian users' data stored in Supabase region with appropriate clauses
- **GDPR (EU)** compliance:
  - Cookie consent (or use cookieless analytics — see §3.21)
  - Right to be forgotten
  - Data Processing Agreement template for any team/academy admin
- **Data retention policy:**
  - Anonymous matches: 30 days from last activity, then deleted
  - Account-owned matches: kept until user deletes
  - Event logs retained for the lifetime of the match record
- **No data sold or shared** with third parties beyond essential infrastructure (Supabase, hosting, payment processor)

### 3.20 Accessibility (v1, non-negotiable)

Target: **WCAG 2.1 AA** across all surfaces.

- **Color contrast 4.5:1** for text, 3:1 for UI elements
- **Color-blind safe defaults:** the default team colors use orange + blue (distinguishable for protanopia/deuteranopia/tritanopia; moved off red so the LIVE/destructive status colors can never be mistaken for a team); themes that pair red+green must include a colorblind alternative
- **Keyboard navigation** for all dashboard / config / result-entry forms with visible focus indicators (`:focus-visible`)
- **Screen reader labels** on the control surface ("Team A score, 5 points, tap to add point")
- **Reduced-motion** preference honored — score-change animations switch to instant transitions
- **Text scaling** up to 200% without layout breakage
- **Sufficient tap targets** on the control surface (≥ 88×88px per Apple HIG, ≥ 48dp per Material)
- **No essential information conveyed by color alone** — server indicator combines color + icon + text

### 3.21 Observability (v1)

- **Error tracking:** Sentry (free tier 5k events/month). Captures unhandled exceptions, includes user device + browser context. No PII in default scope.
- **Analytics:** Plausible or Cloudflare Web Analytics (cookieless; no banner needed). Track: page views per route, match-creation funnel, theme-picker usage. No identifiable user tracking on free tier.
- **Performance monitoring:** Web Vitals reported to Plausible custom events. Alert on p75 LCP > 4s.
- **Uptime:** UptimeRobot or BetterStack on `scoreboard.app` and the Supabase REST endpoint.

### 3.22 Demo match + practice mode (v1)

**Demo match (homepage):**
A pre-seeded match at `/demo` (or auto-loaded on the homepage hero) that auto-scores points every 5 seconds in a deterministic loop. Visitors see a live, updating scoreboard the moment they land. No clicks, no signup, no copy needed — the product *is* the demo.

**Practice mode:**
`/practice` opens a transient match that's never written to Supabase, only kept in memory + localStorage. Operators can tap around the control surface, see the overlay update, get a feel for the product before committing to a real match. Discarded on tab close.

### 3.23 Theme manifest + contribution model (v1)

Each theme folder contains a `theme.manifest.json`:

```json
{
  "id": "broadcast-classic",
  "name": "Broadcast Classic",
  "description": "ESPN/BWF-style lower-third for OBS overlay.",
  "author": "Scoreboard core team",
  "license": "MIT",
  "version": "1.0.0",
  "preview": "preview.png",
  "supports": ["overlay", "scoreboard"],
  "supportedSports": ["badminton", "tennis", "pickleball", "table-tennis"],
  "bundleSizeBytes": 12450
}
```

`packages/themes/CONTRIBUTING.md` walks contributors through:
- Where to put files (`packages/themes/<id>/`)
- How `data-bind` works
- Bundle size limit (50KB per theme)
- Preview screenshot at 1920×1080 transparent
- Theme moderation: PRs are reviewed for malicious CSS/HTML before merge; CSP forbids external font/image loads in v1

### 3.24 Match lifecycle policy (v1)

- **Active match**: in-progress or last-event < 24 hours ago
- **Stale match** (no events for 24h, not match.over): auto-archives — UI marks "abandoned"; operator can resume by clicking "Continue match"
- **Anonymous match**: hard-deleted 30 days after last activity (cron job in Supabase Edge Function)
- **Account-owned match (v2+)**: kept until user deletes

This is essential for cost containment as anonymous matches accumulate.

### 3.25 Self-hosting docs + deploy buttons (v1)

The README ships with one-click deploy buttons:
- "Deploy to Netlify"
- "Deploy to Vercel"
- "Deploy to Railway"

Plus `docs/SELF_HOSTING.md` covering:
- Supabase project creation (managed or self-hosted)
- Environment variables (`NUXT_PUBLIC_SUPABASE_URL`, `NUXT_PUBLIC_SUPABASE_KEY`)
- Custom domain setup
- Theme customization
- Migration application

This makes the open-source claim real and material — a tournament organizer can run their own instance in 15 minutes.

### 3.26 Auth surfaces (v1, optional) *(added 2026-05-05 — E1.0)*

Auth is **optional**. Anonymous scoring is the default. Sign-in unlocks profile, ownership, multi-device-as-same-user, and primes Pro features for v2.

| Surface | Route | Behavior |
|---|---|---|
| Sign in | `/auth/signin` | Email + password. Redirects to `?redirect=…` after success, defaults to `/`. Google button rendered but disabled in v1; flip `[auth.external.google].enabled = true` in `supabase/config.toml` to activate. |
| Sign up | `/auth/signup` | Display name (optional) + email + password + confirm. Email confirmation **on** — Supabase sends a branded confirmation link before sign-in works. |
| Forgot password | `/auth/forgot-password` | Email-only form; sends a reset link via Supabase. |
| Reset password | `/auth/reset-password` | Linked from email; new + confirm password fields. |
| OAuth callback | `/auth/callback` | Auto-detects PKCE `?code=…`; re-syncs the user store and redirects to `?redirect=…`. |
| Profile | `/profile` | Display name + avatar (drag-drop upload or URL paste) + change password. **Sign-in required.** Account deletion (DPDP/GDPR) deferred — see E1.14. |

**Auth layout** (`layouts/auth.vue`): rotating features carousel (`AuthFeatures` — 6 sb-flavored slides) on the left at `md+`, form pane on the right.

**Header dropdown** (NavUser, in `default.vue`): avatar with display-name initial → Profile / Admin (admin-role-only) / Sign out. When signed-out, header shows a "Sign in" link instead.

**Email templates** (rebranded from np-mono, in `supabase/templates/`): confirmation, recovery, invite, magic-link, email-change, reauthentication. Wired in `supabase/config.toml`.

**Roles + permissions** (scaffolding only in v1):

- `app_role` ENUM: `admin`, `free` (default), `pro` (reserved for v2).
- `app_permission` ENUM: 8 permissions including `match.create`, `match.update.own`, `theme.use.free`, `theme.use.pro`, `branding.custom`, `admin.users.manage_roles`.
- `custom_access_token_hook` injects `user_role` into JWT claims on every token issuance.
- `authorize(permission)` SQL helper for RLS; `get_my_permissions()` RPC for the client.
- `useRolePermissions().hasPermission(...)` composable + `v-permission="'…'"` directive (hides the element when the role lacks the permission).
- New signups get the `free` role via `handle_new_user` trigger which also populates `public.users` with `display_name` + `avatar_url` from `raw_user_meta_data` (so Google sign-in pre-populates name + picture).

### 3.27 Per-match theme picker (v1) *(added 2026-05-05 — partial E1.16)*

A `🎨 Theme` button on `/m/[id]` opens a Sheet listing the 5 themes from `@sb/themes`, grouped by surface (overlay vs scoreboard). Click to select. Persisted to `localStorage:sb:theme:{matchId}`. The button label updates to show the chosen overlay theme; a sub-label shows the chosen scoreboard theme. Overlay/scoreboard URLs (the ones the operator copies into OBS / opens on the venue TV) include `?theme=X` so the existing surfaces pick up the choice.

Live in-modal preview (true E1.16) is still pending. Custom team colors (`🖌 Colors` button) and match settings (`⚙` button) are disabled with "soon" tooltips until E1.17 lands.

### 3.28 Format pickers — points-per-game + match length (v1) *(added 2026-05-05)*

Format is set during match creation on `/new` AND can be changed mid-match from `/m/[id]/control`. Both surfaces persist to the same `localStorage:sb:format:{matchId}` key, so creating with a format and then editing it from control just overwrites.

**Two dimensions:**

- **Points per game:** `15 BWF` (default — cap 21, interval 8 — current BWF format since 2025) or `21 classic` (cap 30, interval 11 — BWF 2006–24, still common in amateur leagues).
- **Match length:** `Single match` (default — `gamesToWin: 1`, first game decides the match) or `Best of N` (a stepper N ∈ {3, 5, 7, 9, 11}, → `gamesToWin: (N+1)/2`). Engine `RacquetConfig.gamesToWin` is a plain number, so any odd N from 3 upward works.

Engine recomputes match-over from the event log on every reduce, so the operator can flip these mid-match — including extending a single match into a best-of-3 retroactively. Switching format never invalidates past points.

### 3.29 Theme gallery — moves to `apps/web` *(2026-05-05)*

The `/themes` route was deleted from `apps/app`. The theme gallery (with live previews + contribute CTA) is a marketing-site responsibility — it goes in `apps/web` once that ships. Per-match theme selection inside the product app uses the per-match picker (§3.27).

## 4. v2 detailed requirements (preview, ~6 months post-v1)

**Trigger gate:** v1 hits 100+ self-hosted deploys OR 500+ stars OR 3+ themes contributed.

### 4.1 New personas

- **Account holder** — Pro user who wants cloud history, lifetime stats, custom branding
- **Casual player** — Persona D from v1 graduates to logging matches under their identity
- **Theme buyer** — pays $9-15 for a premium theme

### 4.2 Major features

- **Auth via Supabase Auth** (email + OAuth: Google, Apple)
- **Cloud match history** — opt-in sync of anonymous v1 matches to user account
- **Player profiles** (`/p/[handle]`)
- **Lifetime stats** — match count, win rate, avg game length, head-to-head records
- **Custom branding** on overlays (sponsor logo upload, color overrides)
- **Multi-scorekeeper per match** (assistant on second phone, same control surface)
- **Theme marketplace** — paid theme packs via Gumroad/Lemon Squeezy
- **Capacitor mobile app** — iOS + Android wrap of the existing PWA
- **Post-production video burn-in** — upload an MP4 of a recorded match, get back the same MP4 with the scoreboard overlay rendered into the pixels using FFmpeg + the event log

### 4.3 v2 stack additions

- Supabase Auth (already available, just turned on)
- Capacitor for iOS/Android wrapping
- FFmpeg WASM or server-side worker for video burn-in
- Gumroad / Lemon Squeezy for paid theme purchases
- Cloudflare Workers or Supabase Edge Functions for theme delivery / payment webhooks

## 5. v3 detailed requirements (preview, ~12 months post-v1)

**Trigger gate:** v2 has 1,000+ MAU AND 1+ academy is asking for tournament features.

### 5.1 New personas

- **Academy admin** (e.g., Xperience Academy owner) — runs the network for their players
- **Tournament director** — runs amateur tournaments at academies/clubs
- **League commissioner** — runs multi-event recurring leagues
- **Spectator / parent** — follows a player or academy's results

### 5.2 The network/academy model

A **network** is a multi-tenant container with its own:
- Subdomain (`xperience.scoreboard.app`)
- Branding (logo, colors, theme overrides)
- Members (players, coaches, admins, with role-based permissions)
- Events (tournaments, ladders, leagues)
- Analytics (player counts, match counts, leaderboards)

The network owner pays a monthly subscription based on player count.

### 5.3 Major features

- **Network creation** — academy admin signs up, claims subdomain, configures branding
- **Member registration** — players join a network via invite link or code
- **Roles & permissions** — admin / coach / player / spectator
- **Tournament creation** — name, dates, sport, format (single-elim, round-robin, Swiss)
- **Player registration for events** — entry form, eligibility rules, fee (optional)
- **Bracket / draw generation** — automatic seeding based on player history
- **Match scheduling** — courts × time slots × matches, with conflict detection
- **Tournament-day live dashboard** — current matches across courts, upcoming, completed
- **Standings / leaderboards** — per network, per event, all-time
- **White-label overlays** — network-branded overlay templates for streamed matches
- **Payments** — Razorpay (India) + Stripe (rest of world), platform fee 2-5%

### 5.4 v3 stack additions

- Multi-tenancy via Supabase RLS + subdomain routing
- Razorpay for India, Stripe for international
- Bracket generation library (or hand-rolled — there are well-known algorithms for single-elim/round-robin/Swiss)
- Email / SMS notifications via Postmark / Twilio (or Supabase Edge Functions calling them)
- Public network pages with SSR (re-enable SSR for these routes)

## 6. v4 (long-term, only if v3 succeeds)

- **Tauri desktop app** for venue-WiFi-less environments (offline-first networks)
- **Server-side stream composition** (Cloudflare Stream Live / Mux) for streamers without OBS knowledge
- **Multi-court tournament-day dashboard** for tournament directors managing 4-12 courts
- **API for third-party integrations** — scoreboard data feeds for league sites, broadcasters

## 7. Open questions (to resolve before v1 ship)

1. **Public brand name.** Decoupled from repo. Decide ~2 weeks before launch with a domain check.
2. **Match expiry on free tier — confirmed.** 30 days for anonymous, kept-while-account-active for Pro. (See §3.24.)
3. **Whether to ship a Capacitor stub at v1** (zero feature gain, but reserves the App Store name).
4. **OBS / Streamlabs setup walkthrough** — interactive doc page or short YouTube videos? Probably YouTube, but who records them?
5. **Demo match URL — confirmed in §3.22.** Pre-seeded auto-scoring match on landing page.
6. **Privacy policy authorship.** Use a template (TermsFeed, Iubenda) or hand-write? Recommendation: template + lawyer review pre-launch (~$200 one-time).
7. **Cron for stale-match cleanup.** Supabase Edge Function? Or external cron via cron-job.org? Recommendation: Supabase Edge Function, runs nightly.
8. **og:image rendering — Satori vs Puppeteer vs static SVG.** Satori (used by `vercel/og`) is fastest; Puppeteer is heavyweight; static SVG is most flexible. Recommendation: Satori on Cloudflare Workers or Supabase Edge Functions.
9. **Doubles partner UI — visible on overlay or hidden?** Tournament streams want both names; casual streams want just the team. Recommendation: theme-controlled via `data-bind="players.a.join(' / ')"` so themes choose.
10. **Match-deletion abuse.** Anonymous matches can be deleted by anyone with the URL? Recommendation: anonymous matches editable only from the device that created them (browser-stored token); shared URLs are read-only for everyone else.

## 8. Appendix — competitive feature matrix

| Feature | KeepTheScore | OBScoreboard | OpenScoreboard | Scoreboard v1 | Scoreboard v3 |
|---|---|---|---|---|---|
| Badminton | ⚠️ generic | ❌ | ❌ | ✅ BWF rules | ✅ |
| Mobile-first control | ❌ | ❌ | ❌ | ✅ | ✅ |
| Open source | ❌ | ❌ | ✅ GPLv3 | ✅ MIT | ✅ MIT |
| Hosted (zero install) | ✅ | ✅ | ❌ | ✅ | ✅ |
| Self-hostable | ❌ | ❌ | ✅ | ✅ | ✅ |
| Watermark-free free tier | ❌ | ❌ | ✅ | ✅ | ✅ |
| Theme system | ⚠️ limited | ⚠️ limited | ✅ visual editor | ✅ HTML+CSS | ✅ HTML+CSS + marketplace |
| Result logging | ❌ | ❌ | ❌ | ✅ | ✅ |
| Tournament grouping | ❌ | ❌ | ❌ | ✅ | ✅ |
| Player profiles | ❌ | ❌ | ❌ | ❌ | ✅ |
| Tournament brackets | ❌ | ❌ | ❌ | ❌ | ✅ |
| Network / academy | ❌ | ❌ | ❌ | ❌ | ✅ |
| Payments | ❌ | ❌ | ❌ | ❌ | ✅ |
| Mobile native app | ❌ | ❌ | ⚠️ Expo Web only | ❌ (PWA only) | ✅ Capacitor |
