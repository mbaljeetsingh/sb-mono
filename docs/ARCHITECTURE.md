# Scoreboard — Architecture

**Status:** v1.0 draft
**Companion:** [BRD.md](./BRD.md), [PRD.md](./PRD.md)
**Last updated:** 2026-05-04

This document captures the *how*: the engineering decisions, data flow, and architectural primitives that the BRD's *why* and PRD's *what* depend on. Read this before contributing code.

---

## 1. Architectural principles

These are not negotiable in v1. Every other decision follows from them.

1. **Event-sourced.** Match state is *always* computed from an append-only event log. Never store state directly.
2. **Local-first.** Every score tap writes to local storage (IndexedDB) before the network. UI reads from local state synchronously.
3. **Sport-pluggable.** Each sport family is a self-contained module under `packages/engine/src/sports/<family>/` with its own event vocabulary and reducer. Cricket sits as a sibling of badminton, not a config hack.
4. **Three rendering surfaces from one match state.** Control / overlay / scoreboard are different views over the same data; the data layer doesn't know about presentation.
5. **Themes are user-replaceable.** Plain HTML + CSS files with `data-bind` attributes hydrated at runtime. No build step required to author a theme.
6. **Framework-free engine.** `@sb/engine` is pure TypeScript with zero runtime dependencies. It runs in Nuxt, Capacitor, Tauri, Node, Cloudflare Workers — anywhere.

If a proposed change violates one of these, it's wrong. Update the principles deliberately, not the implementation incidentally.

## 2. System diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          USER DEVICES                                │
│                                                                     │
│  ┌───────────────┐   ┌───────────────┐   ┌───────────────┐          │
│  │  Phone        │   │  Laptop / OBS │   │  Tablet / TV  │          │
│  │  /m/[id]/     │   │  /m/[id]/     │   │  /m/[id]/     │          │
│  │   control     │   │   overlay     │   │   scoreboard  │          │
│  └──────┬────────┘   └──────┬────────┘   └──────┬────────┘          │
│         │                   │                   │                   │
│         │  Pinia ← engine ← Dexie (IndexedDB) ← BroadcastChannel    │
│         │                   │                   │                   │
└─────────┼───────────────────┼───────────────────┼───────────────────┘
          │                   │                   │
          │       ▲           │       ▲           │       ▲
          │       │           │       │           │       │
          ▼       │           ▼       │           ▼       │
     ┌────────────────────────────────────────────────────────┐
     │            Supabase Realtime (WebSocket)               │
     │   matches table  ◄─────►  events table (append-only)   │
     │   Row-Level Security                                   │
     └────────────────────────────────────────────────────────┘
```

**Reading top-down:** user devices each render a different surface, share a Pinia store, share local Dexie storage on the same device, sync across same-device tabs via BroadcastChannel, sync across devices via Supabase Realtime.

**Local-first invariant:** every device's UI reads from its local store. Network is a sync layer, not the source of truth. A device with no internet still works.

## 3. The engine (`packages/engine`)

### 3.1 Sport families

Each sport family is a top-level concept with its own:
- Event vocabulary (`MatchEvent` discriminated union)
- State shape (`MatchState`)
- Configuration shape (e.g., `RacquetConfig`, future `CricketConfig`)
- Reducer: `(events, config) => state`

**v1 ships:** the racquet family, with badminton 21pt + 15pt presets. Tennis, pickleball, table tennis are config additions to the racquet reducer.

**v2 adds:** cricket as a sibling family. Cricket's events (`ball`, `over.end`, `innings.start`, `wicket`) and state shape are completely different from racquet. They share only the `BaseEvent` (id, ts, type) and `BaseState` (matchOver, winner) interfaces.

### 3.2 Why event-sourced

We chose event-sourcing over mutable state for these specific properties — each one would require significant work in a stored-state architecture:

| Property | How event-sourcing gives it for free |
|---|---|
| Multi-step undo | Trim the event list and re-reduce |
| Match replay (`?at=<ms>`) | Replay events up to the timestamp, return state |
| Conflict resolution across offline devices | Merge two event lists by `[ts, deviceId]`; reduce |
| Video burn-in (v2) | Replay events at each frame timestamp; render scoreboard |
| Stats and analytics | Aggregate over the event stream |
| Audit log | The event log *is* the audit log |
| No hardcoded game limits | Best-of-N is a config field; events are unbounded |

OpenScoreboard's mutable-state model has none of these properties. Their loops over `for (let gameN = 1; gameN <= 9; gameN++)` are the surface symptom of the deeper problem: stored state forces structural decisions into every consumer.

### 3.3 Reducer contract

```ts
type Reducer<E extends BaseEvent, C, S extends BaseState> = (events: E[], config: C) => S
```

The reducer is **pure**. Same inputs always return the same outputs. No side effects, no time-of-day dependencies (use event timestamps, not `Date.now()` inside the reducer), no I/O.

This purity is what makes `?at=<ms>` work — passing a slice of events through the reducer at any time produces the deterministic state at that moment.

### 3.4 Adding a sport (the contributor path)

1. Create `packages/engine/src/sports/<sport>/` (for racquet variants) or `packages/engine/src/sports/<family>/<sport>/` (for new families)
2. Write a `config.ts` with one or more presets (e.g., `pickleball-classic`, `pickleball-rally`)
3. If the sport fits an existing family, you're done — the family's reducer handles your config
4. If it's a new family, write a `reducer.ts` and a `__tests__/` folder
5. Open a PR with tests passing

Cricket is the first sport that requires a new family. Its `reducer.ts` will be ~500 lines (vs badminton's ~150) because of innings, overs, partnerships, and bowling figures.

## 4. Data layer

### 4.1 Storage targets

Three layers, in order of authority:

1. **Pinia store** (in-memory, reactive UI state) — derived from the local event log
2. **IndexedDB via Dexie** (local persistence) — append-only event log per match
3. **Supabase Postgres** (remote sync target) — same shape, source of truth across devices

Writes go local-first: Dexie → Pinia (synchronous), then a background sync job pushes to Supabase. Reads are local-first: Pinia is the UI's source.

### 4.2 Schema (Postgres + matching Dexie schema)

```sql
-- matches: metadata + config + theme + branding
matches(
  id text primary key,                 -- ULID
  created_at timestamptz,
  updated_at timestamptz,
  owner_id uuid?,                      -- null for anonymous; user_id arrives v2
  sport_family text,                   -- 'racquet' | 'cricket'
  sport_preset text,                   -- 'badminton-21', 'badminton-15', ...
  config jsonb,                        -- RacquetConfig or family-specific
  theme_id text,
  colors jsonb,                        -- { a: '#dc2626', b: '#2563eb' }
  started_at bigint?,                  -- ms since epoch
  tournament_id text?,                 -- forward-compat for grouping
  court_label text?, round text?, category text?, scheduled_at bigint?, venue text?
);

-- events: append-only log
events(
  id text primary key,                 -- ULID
  match_id text references matches,
  device_id text,                      -- offline merge tie-break
  ts bigint,                           -- ms since epoch (Date.now() at write)
  type text,                           -- 'point' | 'undo' | 'walkover' | ...
  payload jsonb,                       -- everything except id, ts, type
  inserted_at timestamptz
);

-- tournaments: v1 grouping container
tournaments(
  id text primary key,
  name text,
  theme_id text,
  colors jsonb,
  sponsor_logo_url text?,
  created_at timestamptz
);
```

### 4.3 ULID, not UUID

Event and match IDs are **ULIDs**, not UUIDs:
- Sortable by creation time (database scans stay efficient)
- Globally unique (no collision risk across offline devices)
- Lexicographically comparable (string comparison = chronological order)
- 26 characters, URL-safe

This matters for offline-merge: two devices appending events offline can sort their merged streams by ID alone. No clock-skew arbitration needed.

### 4.4 Row-Level Security model

v1 uses RLS optimistically:
- **Anyone** can read any match by ID. The ID itself is the access token (UUID-ish, not enumerable).
- **Anyone** can append events to any match. The match URL is the write capability.
- **Owner** (when set) is the only one who can update match metadata.

This is *intentionally permissive* for v1. The risk: someone discovers a match URL and trolls it with fake events. Mitigation: matches expire in 30 days; owner can correct via `score.correct` events; v2 adds a per-match write token that the operator's device alone holds.

### 4.5 Sync flow

```
Score tap (control surface)
  └──► Append event to Pinia store (synchronous, UI updates)
      └──► Persist to Dexie (async, fire-and-forget)
          └──► Enqueue for sync
              └──► If online, POST to Supabase /events
                   └──► On success, mark event synced in Dexie
              └──► If offline, queue in Dexie until reconnect

Realtime listener (overlay / scoreboard surfaces)
  └──► Subscribe to Supabase Realtime channel `match-{id}`
      └──► On INSERT event row, append to Pinia store
          └──► UI re-renders via reactive computed state
```

**Same-device cross-tab sync** uses BroadcastChannel — instant, no network. Lifted from OpenScoreboard's `getBroadcastChannelName.ts` pattern.

## 5. The three rendering surfaces

All three surfaces:
- Subscribe to the same `match-{id}` data
- Run the same engine reducer
- Render different *views* of the resulting state

### 5.1 Control (`/m/[id]/control`)
- Scorekeeper's phone
- Two huge tap zones (top-half = team A, bottom-half = team B, or left/right depending on orientation)
- Server indicator (court + side)
- Long-press undo, swipe-up advanced sheet
- Wake Lock active, haptic feedback on tap
- Writes events; doesn't read others' writes (it created them)

### 5.2 Overlay (`/m/[id]/overlay`)
- OBS / Streamlabs / Streamyard browser source
- Transparent background
- Renders one of the OSS overlay themes (e.g., Broadcast Classic)
- Read-only; subscribes to events, never writes
- Designed for 1920×1080 output; theme handles smaller sizes

### 5.3 Scoreboard (`/m/[id]/scoreboard`)
- Tablet / TV / sharing link
- Opaque background, fullscreen
- High-contrast typography optimized for being filmed by a camera
- Read-only

### 5.4 Theme runtime

A theme is `index.html` + `index.css` + `theme.manifest.json`. The HTML uses two attribute conventions:

```html
<span data-bind="games.last.a">0</span>
<div data-show="servingSide==A,serverCourt==right">⬤</div>
```

A ~50-line runtime in `apps/app/composables/useTheme.ts`:
1. Loads the theme HTML into the page
2. Walks the DOM for `data-bind` and `data-show` attributes
3. Subscribes those nodes to reactive state changes
4. Updates `textContent` (for `data-bind`) or `display` (for `data-show`)

Themes never load JavaScript. CSP forbids external font/image loads in v1 to prevent malicious themes.

## 6. The dynamic-URL feature

**Inspired by OpenScoreboard.** A single URL (e.g., `/d/abc123`) that resolves to whichever match is currently bound. The OBS browser source URL never changes; the operator binds the next match from the dashboard.

Schema:
```sql
dynamic_urls(
  id text primary key,                 -- ULID
  owner_id uuid?,
  current_match_id text?,
  created_at, updated_at
);
```

Resolution: the overlay route `/d/[id]` reads `dynamic_urls.current_match_id`, then redirects/renders as `/m/[matchId]/overlay`. Realtime subscription on `dynamic_urls` row updates the page when the binding changes.

## 7. Multi-tenancy strategy (v3 forward-compat)

v3 introduces networks/academies. The schema accommodates this without breaking changes:
- Add `networks` table
- Add `network_id text references networks` to `matches`, `tournaments`, `users`
- RLS policies key off `network_id` membership
- Subdomain routing (`xperience.scoreboard.app`) maps to `network_id` via a single lookup at request time

Nothing in v1 needs to know about networks; the column is added in v3 with a default of NULL, which means "global / public match."

## 8. Performance targets (from PRD §3.10)

| Metric | Target |
|---|---|
| p95 score-tap-to-overlay-update (local) | < 300ms |
| p95 cross-device latency (Supabase Realtime) | < 800ms |
| Initial page load on 4G | < 2.5s TTI |
| Engine reducer over a 200-event match | < 5ms |
| Bundle size for engine + control critical path | < 200KB gzipped |
| Lighthouse PWA score (mobile) | ≥ 90 |

**Optimization budget:** if the reducer ever exceeds 5ms for a typical match, we cache the latest reduced state in Dexie keyed on the last event ID. Don't pre-optimize.

## 9. Security model

### 9.1 Threat model

| Threat | v1 mitigation |
|---|---|
| Match URL leaked → unauthorized read | Not a threat; matches are public-by-URL by design |
| Match URL leaked → unauthorized writes (trolling) | Acceptable in v1 (rare, fixable via score.correct, matches expire); v2 adds per-match write token |
| Malicious theme code (XSS) | Themes are HTML+CSS only; no `<script>` allowed; CSP forbids external resources; PR review before merge |
| SQL injection | Not a threat; Supabase client uses parameterized queries; we don't write raw SQL |
| Account takeover (v2+) | Supabase Auth handles password hashing, OAuth, MFA |
| Payment fraud (v3) | Razorpay/Stripe handle PCI; we never see card numbers |
| DDoS on free tier | Supabase tier limits act as natural shedding; Cloudflare in front of `scoreboard.app` |
| PII leakage in error tracking | Sentry configured with no-PII default scope; team names sanitized before send |

### 9.2 What we explicitly do not protect against in v1

- Determined attackers reverse-engineering match URLs (don't put sensitive data in matches)
- Same-device clipboard sniffing (browser security model handles this)
- Targeted social-engineering of an academy admin (v3 adds 2FA)

## 10. Observability

- **Errors:** Sentry, free tier, no PII in default scope
- **Analytics:** Plausible (cookieless), tracks page views + funnel events
- **Performance:** Web Vitals → Plausible custom events
- **Uptime:** UptimeRobot or BetterStack on `scoreboard.app` and Supabase

If `p75 LCP > 4s` for 30 minutes → alert. If error rate > 1% of sessions for 30 minutes → alert. Otherwise stay quiet.

## 11. Deployment

| Component | Where | Why |
|---|---|---|
| `apps/app` | Netlify | Existing pipeline, edge functions, Git-driven deploys |
| `apps/web` (marketing) | Netlify | Same |
| Supabase project | Supabase managed | Postgres + Realtime + Auth as one service |
| `@sb/engine` | npm | Public consumption from third-party apps |
| Theme bundles | Static, served from `apps/app/public/themes/` | No CDN needed at v1 scale |
| og:image rendering | Netlify Edge Functions or Supabase Edge Functions | Satori-based PNG generation |
| Stale-match cleanup cron | Supabase Edge Function, nightly | Cost containment |

## 12. Open architectural questions

1. **Where does the og:image render?** Netlify Edge Function (closer to user) vs Supabase Edge Function (closer to data). Recommendation: Netlify, since most reads are anonymous and don't need DB context beyond the match row.
2. **Bundle splitting strategy.** Each surface (control / overlay / scoreboard) is its own route; Nuxt should code-split automatically. Verify after v1 implementation that the overlay route doesn't pull in control-only code (it shouldn't need haptics, wake-lock, etc.).
3. **Realtime subscription cost at scale.** Supabase Realtime free tier: 200 concurrent connections. Each viewer of an overlay is a connection. For a match with 1,000 viewers, we'd hit limits. Mitigation: read-only viewers can poll the match-card og:image cache (1Hz) instead of subscribing. Implement only if a real match exceeds 100 concurrent viewers.
