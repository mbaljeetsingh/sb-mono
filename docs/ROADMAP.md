# Scoreboard — Roadmap

**Status:** v1 in development
**Companion:** [BRD.md](./BRD.md) · [PRD.md](./PRD.md) · [ARCHITECTURE.md](./ARCHITECTURE.md)
**GitHub Project:** [Project Board](https://github.com/users/mbaljeetsingh/projects/9/views/1)

This doc breaks the BRD/PRD scope into **big tasks (epics)** sized for tracking on the GitHub project board. Each epic links to a discoverable GitHub issue once filed.

Phase gates from BRD §13 control progression. Don't start phase N+1 until phase N's gate condition is met.

---

## Phase 1 · v1 ship (the wedge)

> **Goal:** ship the best free OSS scoreboard for badminton streamers in ~7 weekends. Validate before building anything else.

### Epics — DONE ✅

| Epic | What's in | Status |
|---|---|---|
| **E1.1 · Engine: badminton + match-state events** | BWF 21pt/15pt, deuce, cap-30, interval-11, server court, walkover/retirement/default/timeout/suspension/score-correct events. 29/29 tests passing. | ✅ done |
| **E1.2 · Sport-pluggable architecture** | Sports-as-siblings under `packages/engine/src/sports/` so a new racquet sport drops in without touching the existing reducer. | ✅ done |
| **E1.3 · Monorepo + tooling** | pnpm workspaces, Turbo, Biome, layers (`ui`, `app-base`), shadcn-vue (16 components), Tailwind v4, Vue overrides. | ✅ done |
| **E1.4 · Design tokens** | Court-green palette, warm parchment background, all chrome + domain tokens via `@theme inline`. | ✅ done |
| **E1.5 · Themes registry** | 11 themes via the `@sb/themes` registry — overlay: tour-card, score-bug, broadcast-classic, minimal-bug, top-ribbon, vertical-stack; scoreboard: arena-board, vertical-board, filmable, minimal-typographic, scorecard. All share broadcast-convention primitives (`game-cells`, `games-won-plate`, `serve-marker`, `team-code`, `cell-metrics`). | ✅ done |
| **E1.6 · Pages + routes** | Routes implemented: landing, new match, result entry, dashboard, control, overlay, scoreboard, saved, tournament home + ticker, dynamic URL setup + overlay, auth (signin/signup/forgot/reset/callback), profile, 404. (`/themes` moved to `apps/web` — see E1.26.) | ✅ done |
| **E1.7 · Control surface** | Two tap zones, server indicator, glow on game/match point, undo, long-press events sheet, match-state sheet, score-correction modal, match-over modal differentiating walkover/retirement/default. Wake-lock + haptics. | ✅ done |
| **E1.8 · Local-first sync** | localStorage + BroadcastChannel cross-tab. Tab 1 scores → tab 2 overlay updates. | ✅ done |
| **E1.9 · Supabase schema + seed** | matches + events tables, full RLS (auth-owner writes + anonymous-match path), realtime publication, avatars bucket. 4 migrations: initial schema, users profile, roles + permissions + handle_new_user, avatars storage. Seed: 4 auth users (admin/coach/streamer/player) with profile + role rows + 3 demo matches. | ✅ done |
| **E1.10 · Docs + decision log** | BRD (28 locked decisions), PRD (~50 surfaces specced), ARCHITECTURE.md (12 sections including threat model). | ✅ done |
| **E1.0 · Auth + accounts (pulled forward from E2.1)** | Email/password signin/signup/forgot/reset (5 auth pages + auth layout), email confirmation on, custom branded email templates (6 in `supabase/templates/`), custom_access_token JWT claim hook, roles (`admin`/`free`/`pro`) + permissions + v-permission directive + `useRolePermissions` composable, public.users profile + handle_new_user trigger (OAuth-aware: pulls full_name/avatar_url from Google metadata), avatars storage bucket + ProfilePhotoUpload, profile page, AppHeader with NavUser dropdown, auth.global middleware, RLS: authenticated owners gate writes; **anonymous matches still allowed** (Option A — owner_id NULL path). Google OAuth wired but UI button disabled. Public scoreboards (`/m/[id]/scoreboard\|overlay`) un-gated. Per-match write-tokens (delegated scoring) deferred to **E2.8**. | ✅ done |
| **~~E1.0a · Auto-claim local matches on first login~~** ✅ done 2026-05-22 | Anonymous matches list at `/matches` with retention banner. On login, claim flow writes `owner_id = auth.uid()` on `owner_id IS NULL` rows scored by the current device (matched via `sb:device-id`) + flushes queued events; toast confirms count. | done |
| **~~E1.31 · Theme toggle (light/dark/system)~~** ✅ done 2026-05-22 | `@nuxtjs/color-mode` integrated, toggle in `AppHeader`, persists to `sb:theme`. Broadcast surfaces (`/m/*/scoreboard\|overlay`, `/d/*/overlay`, `/t/*/overlay`) opt out — they render in their theme's own palette regardless of operator's app theme. | done |
| **~~E1.32 · QR share dialog~~** ✅ done 2026-05-22 | Share dialog with QR code on Control + Scoreboard surfaces for handing the overlay/scoreboard URL to another device or to OBS. | done |
| **~~E1.33 · Empty-match cleanup cron~~** ✅ done 2026-05-22 | pg_cron job deletes `matches` rows with zero `events` after N hours so abandoned `/new` sessions don't pollute the table. Migration shipped; needs pg_cron extension flipped on in Supabase Cloud. | done |
| **~~E1.34 · Logo + favicon + apple-touch-icon~~** ✅ done 2026-05-22 | Brand image optimized 99%, wired as favicon + apple-touch-icon. | done |
| **~~E1.35 · Global error boundary~~** ✅ done 2026-05-22 | `error.vue` catches uncaught errors and renders a friendly fallback. | done |
| **~~E1.11 · Offline-first event sync (`idb-keyval` + Supabase Realtime)~~** ✅ done 2026-05-22 | Replaced localStorage in `useEvents` with **`idb-keyval`** (used the raw functional API rather than `useIDBKeyval` because `useEvents` needs imperative get/set + `keys()` for enumeration). Storage helpers in `layers/app-base/lib/eventStore.ts`; sync state in `layers/app-base/composables/useSyncStatus.ts`. Diff-based reconciliation (no per-event `synced` flag): pending = `localIds − remoteIds`, re-run on mount + `online` event + every 10s. Idempotent upserts (`onConflict: 'id', ignoreDuplicates: true`) on direct path; RPC path already had `on conflict do nothing`. Offline pill in `AppHeader` via `SyncStatusPill.vue`. BroadcastChannel retained for same-device cross-tab. SQLite via `@capacitor-community/sqlite` stays deferred to E2.9. | done |
| **~~E1.14 · Privacy + Terms (in-app)~~** ✅ done 2026-05-22 | Self-contained `/privacy` and `/terms` Nuxt pages in `apps/app/pages/` adapted from np-mono legal copy (Paddle/Refund sections dropped, Supabase + PostHog substituted). `AppFooter.vue` in the default layout links to both + GitHub. Broadcast surfaces (layout: false) correctly opt out. Marketing-site dependency removed. | done |
| **~~E1.23 · Deploy buttons + self-hosting docs~~** ✅ done 2026-05-22 | README rewritten — Netlify + Vercel one-click deploy buttons, env-var setup, `supabase db push` walkthrough, Supabase Cloud one-time activations (pg_cron + Custom Access Token hook) documented. Self-host instructions inline; no separate `docs/SELF_HOSTING.md` needed. | done |

### Epics — PENDING ⏳

| Epic | What's needed | Estimate |
|---|---|---|
| **E1.0b · Vue Email template gen script** | Port `pnpm email:gen` from np-mono so the 6 `supabase/templates/*.html` files are generated from `.vue` sources rather than maintained as raw HTML. | 4 hours |
| **E1.12 · PWA install + offline** | Re-enable `@vite-pwa/nuxt` (currently disabled), add real icon set (192/512/maskable), test offline shell on iOS/Android, "Add to Home Screen" prompt timing. | 1 day |
| **E1.37 · OBS setup doc** | Short opinionated doc at `/help/obs` (Nuxt page in `apps/app`) — get overlay URL from share dialog, paste into OBS Browser Source (1920×1080), position, pick theme, troubleshooting. Link to [obsproject.com/kb/browser-source](https://obsproject.com/kb/browser-source) for the generic "what is Browser Source" bit. 3 screenshots. Surface a "Use in OBS?" link from the QR share dialog on the scoreboard surface. | 4 hours |
| **E1.38 · Kiosk display mode for /m/[id]/scoreboard** | Fullscreen, landscape-locked, edge-to-edge scaled scoreboard intended for a phone or tablet propped in a camera frame (optical compositing — see `docs/RECORDING-SETUPS.md` Tier 1a). Detect PWA standalone (`matchMedia('(display-mode: standalone)')` + iOS `navigator.standalone`); in standalone, render scaled board with wake-lock + orientation lock + cursor/selection suppression. In regular browser, show install instructions ("Add to Home Screen") so the chrome-free experience is gated to PWA. Pair with at least one filmable scoreboard theme (edge-to-edge, oversized numerals, high contrast). Depends on E1.12. Surface QR entry point from `/new` and `/m/[id]` hub. | 4-6 hours |
| **E1.13 · Match-card og:image rendering** | Server route `/m/[id]/card.png` using Satori/`vercel/og`. og:meta tags for social sharing previews. PRD §3.18. | 1-2 days |
| **~~E1.15 · Analytics + error tracking~~** ✅ done 2026-05-22 | PostHog wired (covers product analytics + error tracking + session replay). Sentry skipped as redundant. Plausible deferred — revisit if PostHog cost/complexity becomes an issue. | done |
| **E1.16 · Theme preview modal** | "Preview" button in `/themes` opens live mini overlay+scoreboard at right. | 1 day |
| **E1.17 · Advanced setup sheet on /new** | Court / round / category / venue / tournament binding (already in match metadata schema). | 1 day |
| **E1.18 · Sheet animations + polish** | Slide-up transition for sheets, modal fade, reduced-motion respected. | 1 day |
| **E1.19 · Landing demo match** | Pre-seeded match auto-scoring on the homepage hero. PRD §3.22. | 1 day |
| **E1.20 · Practice mode** | `/practice` route, never writes to Supabase, "PRACTICE" watermark. | 1 day |
| **E1.21 · Tennis + pickleball + table-tennis presets** | Three more racquet sport configs (engine already supports them — just config files). | 4 hours |
| **~~E1.22 · Doubles service rotation polish~~** ✅ done 2026-05-05 | `partnerOnRight: { a: 1\|2; b: 1\|2 }` added to `RacquetState`. Reducer toggles the serving team's flag on every "won on serve" point; resets to `{ a: 1, b: 1 }` at game start. Control UI derives `currentServerSlot` and shows the `Serves` pill on the correct partner's cell. 29/29 engine tests still passing. | done |
| **E1.24 · Launch landing page** | About, GitHub link, contributors, change-log. | 1 day |
| **E1.26 · Pre-match toss UI** *(needs redesign — paused)* | Original idea: "who serves first?" flow before the first rally, picking serving side (and doubles starting server/receiver) on `/new` or first mount of `/control`. Today control auto-bootstraps `serverSide: A` with a 0-0 swap fallback. The flow needs reimagining — possibly a coin-toss animation, possibly inline on `/new`, possibly post-game-1 retoss; revisit later. Engine already accepts `serverSide` on `match.start`, so it's still UI + storage only when picked up. | TBD |
| **E1.39 · Offline-first match creation** | `/new` currently hard-requires network: the `matches` row upsert is now the only writer (lazy-create removed from `useEvents` so co-scorer surfaces can't stamp a wrong `owner_id`), and on upsert error the operator gets a toast and can't proceed. Restore offline creation by queuing the row to IDB on failure and flushing it via a background sync when online — must preserve the "owner_id frozen at /new time" invariant so a later co-scorer push can't claim it. Surfaces when venue WiFi drops at match start. | 1 day |
| **~~E1.27 · Match-standing indicator for BO5+ themes~~** ✅ done 2026-08-04 | Tennis-style leading "games won" number per team, gated on `config.gamesToWin >= 3` via `showStanding(config)` and rendered by the shared `games-won-plate.vue`. Skipped for single match and BO3 because the per-game cells already convey it. Sits between the per-game cells and the live score. | done |
| **~~E1.29 · Match settings sheet on /m/[id]~~** ✅ done 2026-05-14 | Settings sheet edits team names + tournament meta post-creation; bound to `useMatchMeta` so changes propagate via the Supabase Realtime UPDATE channel on the `matches` row (operator typos fixed on phone re-render on OBS overlay within ~500ms). Doubles mode auto-syncs the joined `teamNames.a/b` from per-player edits. Required-field gating on `/new` prevents empty matches. Locked: `isDoubles` + format (the latter lives in the `/control` FormatSheet for mid-match edits). | done |
| **~~E1.30 · Per-match state to Supabase + Realtime UPDATE sync~~** ✅ done 2026-05-14 | Meta, format (preset + gamesToWin), and theme choice (overlay + scoreboard) all live on the `matches` row in Supabase. Each has a `useXxxChoice`/`useMatchMeta`/`useFormat` composable that fetches on mount + subscribes to a per-instance unique `match-{kind}:{id}:{suffix}` Realtime channel. Echo guard prevents the originator's own UPDATE round-trip from writing back. Means a bare `/m/{id}/overlay` URL on a separate device hydrates the operator's chosen names, format, and theme — `?theme=` query param stays as an optional override. Events keep their existing localStorage-first sync; meta/format/theme are Supabase-only since they're read-once-on-mount + edits propagate live. | done |

**Phase 1 gate (G1) → unlocks Phase 2 only when:** 100+ self-hosted deploys OR 500+ GitHub stars OR 3+ themes contributed.

---

## Phase 2 · v2 (post-traction)

> **Goal:** retain users with accounts, monetize via paid themes + Pro subscription.

### Epics — ALL PENDING

| Epic | What it covers |
|---|---|
| **~~E2.1 · Supabase Auth + accounts~~** | Pulled forward to **E1.0**. Phase 2 retains: enabling Google OAuth, Apple OAuth, magic-link option, account deletion (DPDP/GDPR), per-match write-tokens for delegated scoring. |
| **E2.2 · Cloud match history** | Migrate browser-stored matches to user account on opt-in. Match list, search, filters. |
| **E2.3 · Player profiles** | `/p/[handle]` public profile pages with match history. |
| **E2.4 · Lifetime stats + head-to-head** | Win rate, streaks, head-to-head records derived from event log. |
| **E2.5 · Custom branding (Pro)** | Sponsor logo upload (PNG/SVG to Supabase Storage), color overrides per match. Start with single per-match logo rendered in themes with footer space (filmable, scorecard); evolve into account-level sponsor pool with rotation, then tier hierarchy (title / associate / supplier) in Phase 3 alongside branded theme packs. |
| **E2.6 · Paid theme packs** | Gumroad / Lemon Squeezy integration. 5–10 premium themes at launch. |
| **E2.7 · Pro subscription billing** | Razorpay (India) + Stripe (rest of world). Price tier, billing portal. |
| **E2.8 · Multi-scorekeeper per match** | Operator passes a write-token to a co-scorekeeper. Conflict resolution from event log. |
| **E2.9 · Capacitor mobile app** | Wrap Nuxt PWA, ship to App Store + Play Store. |
| **E2.10 · Post-production video burn-in** | Upload MP4 → FFmpeg + event log → MP4 with overlay rendered into pixels. |
| **E2.11 · Custom email templates** | Confirmation / magic-link / password-reset templates branded. |
| **E2.12 · Broadcast-grade match + per-game timer** | Pulled from E1.28 to here — broadcast convention more than club need. `useMatchTiming(events)` derives total + per-game durations from event timestamps (anchored on `match.start`, boundary on `game.end`, subtracts `suspension.*` windows, keeps `timeout.*` in per TV convention). `formatDuration()` helper in `@sb/shared`. Wire to `MatchOverModal` + saved-result page; optional `<MatchClock />` slot themes opt into. Live ticking via `useNow({ interval: 1000 })`, frozen when `matchEndTs` set or `isSuspended`. Unit-test the suspension subtraction. Premium feature alongside the paid theme packs. |

**Phase 2 gate (G2) → unlocks Phase 3 only when:** 1,000+ MAU AND ≥1 academy is asking for tournament features.

---

## Phase 3 · v3 (the real business)

> **Goal:** academy network platform — vertical SaaS for racquet sports.

### Epics — ALL PENDING

| Epic | What it covers |
|---|---|
| **E3.1 · Networks / academies / clubs** | Multi-tenant container (`networks` table, `network_id` columns, RLS by membership). |
| **E3.2 · Subdomain routing** | `xperience.scoreboard.app` resolves to a network. Dynamic Nuxt layer per academy. |
| **E3.3 · Member registration** | Players join via invite link or code. Roles: admin / coach / player / spectator. |
| **E3.4 · Tournament creation + brackets** | Single-elim, round-robin, Swiss. Auto-seed from player history. |
| **E3.5 · Player registration for events** | Entry form, eligibility rules, optional fee. |
| **E3.6 · Match scheduling** | Courts × time slots, conflict detection, Cal-style. |
| **E3.7 · Tournament-day live dashboard** | Current matches per court, next up, completed, standings. |
| **E3.8 · White-label overlays** | Academy-branded overlay templates. |
| **E3.9 · Payments — entry fees** | Razorpay + Stripe. Platform fee 2-5%. |
| **E3.10 · Notifications** | Email + SMS (Twilio) + web push for match calls. |

**Phase 3 gate (G3) → unlocks Phase 4 only when:** ≥3 paying academies AND venue-WiFi complaint thread.

---

## Phase 4 · v4 (only if v3 succeeds)

> **Goal:** broaden distribution + production-grade tooling.

| Epic | What it covers |
|---|---|
| **E4.1 · Tauri desktop app** | Offline-first venue mode. Local-LAN matches without internet. |
| **E4.2 · Server-side stream composition** | Cloudflare Stream Live / Mux integration for streamers without OBS. |
| **E4.3 · Multi-court tournament-day dashboard** | Tournament directors managing 4–12 courts. |
| **E4.4 · Public API + webhooks** | Third-party integrations — league sites, broadcasters consume scoreboard data. |

---

## Backlog · AI / automation (unscheduled)

> Ideas worth keeping but not committed to a phase. Promote into a phase when validated.

| Idea | What it covers |
|---|---|
| **B-AI.1 · Voice scoring** | `useSpeechRecognition` composable + command grammar ("left", "right", "undo", "service") emitting into `useEvents`. Cheapest hands-free win; ship as opt-in toggle on `control.vue`. Fails in noisy gyms — keep manual taps as fallback. |
| **B-AI.2 · CV-assisted scoring (suggest + confirm)** | Phone-camera rally detector: shuttle + player pose + calibrated top-view court (RallyLens-style, ref `https://www.youtube.com/watch?v=fKwac0CsBLc`). Outputs rally-winner suggestions; operator confirms with a tap when confidence < threshold, auto-commits when high. Never full-auto — one wrong point destroys trust. Needs (1) rally state machine, (2) in/out via point-in-polygon on calibrated court, (3) last-hit attribution (hardest in doubles). |
| **B-AI.3 · Auto-highlights from event log + video** | Pair `events` timestamps with uploaded match video; cut clips around long rallies, game points, match point. Pairs naturally with E2.10 (post-production burn-in). |

---

## Cross-cutting (any phase, ongoing)

| Track | Description |
|---|---|
| **Bug fixes** | Tag with `bug` label. Triaged weekly. |
| **Community theme PRs** | Tag `theme-pr`. Reviewed for malicious CSS/HTML before merge. |
| **Sport preset PRs** | Tag `sport-pr`. Reviewed for rule correctness. |
| **Docs improvements** | Tag `docs`. README, contributing, self-hosting, brand. |
| **Accessibility audits** | Quarterly WCAG 2.1 AA pass with manual screen-reader testing. |
| **Security review** | Annual threat-model review (ARCHITECTURE §9). |
