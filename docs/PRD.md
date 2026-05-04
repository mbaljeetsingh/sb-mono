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
| User accounts (Pro tier) | | ✅ | | |
| Cloud match history | | ✅ | | |
| Player profiles + lifetime stats | | ✅ | | |
| Theme marketplace + paid theme packs | | ✅ | | |
| Custom branding / sponsor logos | | ✅ | | |
| Multi-scorekeeper per match | | ✅ | | |
| Capacitor mobile app (iOS + Android) | | ✅ | | |
| Cricket sport family | | ✅ | | |
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
| **Control** | `/m/[id]/control` | Scorekeeper's phone | Two huge tap zones, server indicator, swipe-up advanced. Wake-lock, haptics. |
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

Each sport is a `RacquetConfig` object — pure data, not code. Adding a sport is a config file in `packages/engine/src/sports/<sport>/config.ts`, not a fork. Cricket is a separate sport family with its own event vocabulary, deferred to v2.

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
  sport_family: 'racquet' | 'cricket'  // cricket is v2
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
- **Sport-pluggable** — cricket, chess, etc. add new event types without disturbing existing sports

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

### 3.12 Pages / routes (v1)

```
/                             # Landing — "Start a match" / "Log a result"
/new                          # Sport picker + match config
/new/result                   # Result-only entry form
/m/[id]                       # Match dashboard (URLs, theme picker, branding)
/m/[id]/control               # Scorekeeper control surface (phone)
/m/[id]/overlay               # OBS / Streamlabs browser source (transparent)
/m/[id]/scoreboard            # Fullscreen scoreboard (TVs, sharing, filmable)
/d/[dynamicId]                # Dynamic URL → resolves to current bound match
/t/[id]                       # Tournament home page (list of matches)
/t/[id]/overlay               # Combined overlay (multi-court ticker)
/themes                       # Theme gallery (preview each)
/about                        # About + GitHub link + contributors
```

### 3.13 Out of scope for v1, with explicit deferrals

| Feature | Deferred to | Why |
|---|---|---|
| User accounts / sign-in | v2 | Adds friction; v1 validates without it |
| Cloud match history | v2 | Requires accounts |
| Lifetime stats / head-to-head | v2 | Requires accounts + significant UI |
| Player profiles | v2 | Out of scope for the streamer wedge |
| Custom branding / sponsor logos | v2 | Pro feature |
| Theme marketplace / paid themes | v2 | Validate v1 first |
| Multi-scorekeeper per match | v2 | Edge case in v1 — one phone is enough |
| Native mobile app | v2 (Capacitor) | PWA covers 95% of need |
| Cricket | v2 | Different sport family, real engineering |
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
- **Cricket sport family** — innings/overs/balls model in `packages/engine/src/sports/cricket/`
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
2. **Default match expiry on free tier.** 30 days? 90 days? Forever for anonymous? Affects Supabase storage cost.
3. **Whether to ship a Capacitor stub at v1** (zero feature gain, but reserves the App Store name).
4. **OBS / Streamlabs setup walkthrough** — interactive doc page or short YouTube videos? Probably YouTube, but who records them?
5. **Demo match URL** for the home page CTA — pre-seeded match that any visitor can watch live (we'd auto-score it on a loop).

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
| Cricket | ❌ | ❌ | ❌ | ❌ | ✅ |
| Mobile native app | ❌ | ❌ | ⚠️ Expo Web only | ❌ (PWA only) | ✅ Capacitor |
