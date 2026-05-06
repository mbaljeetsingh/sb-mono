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
| **E1.2 · Cricket-ready architecture** | Sports-as-siblings under `packages/engine/src/sports/`, cricket folder with placeholder README. | ✅ done |
| **E1.3 · Monorepo + tooling** | pnpm workspaces, Turbo, Biome, layers (`ui`, `app-base`), shadcn-vue (16 components), Tailwind v4, Vue overrides. | ✅ done |
| **E1.4 · Design tokens** | Court-green palette, warm parchment background, all chrome + domain tokens via `@theme inline`. | ✅ done |
| **E1.5 · Themes registry** | 5 v1 themes (broadcast-classic, minimal-bug, top-ribbon, filmable, minimal-typographic) via `@sb/themes` registry. | ✅ done |
| **E1.6 · Pages + routes** | Routes implemented: landing, new match, result entry, dashboard, control, overlay, scoreboard, saved, tournament home + ticker, dynamic URL setup + overlay, auth (signin/signup/forgot/reset/callback), profile, 404. (`/themes` moved to `apps/web` — see E1.26.) | ✅ done |
| **E1.7 · Control surface** | Two tap zones, server indicator, glow on game/match point, undo, long-press events sheet, match-state sheet, score-correction modal, match-over modal differentiating walkover/retirement/default. Wake-lock + haptics. | ✅ done |
| **E1.8 · Local-first sync** | localStorage + BroadcastChannel cross-tab. Tab 1 scores → tab 2 overlay updates. | ✅ done |
| **E1.9 · Supabase schema + seed** | matches + events tables, full RLS (auth-owner writes + anonymous-match path), realtime publication, avatars bucket. 4 migrations: initial schema, users profile, roles + permissions + handle_new_user, avatars storage. Seed: 4 auth users (admin/coach/streamer/player) with profile + role rows + 3 demo matches. | ✅ done |
| **E1.10 · Docs + decision log** | BRD (28 locked decisions), PRD (~50 surfaces specced), ARCHITECTURE.md (12 sections including threat model). | ✅ done |
| **E1.0 · Auth + accounts (pulled forward from E2.1)** | Email/password signin/signup/forgot/reset (5 auth pages + auth layout), email confirmation on, custom branded email templates (6 in `supabase/templates/`), custom_access_token JWT claim hook, roles (`admin`/`free`/`pro`) + permissions + v-permission directive + `useRolePermissions` composable, public.users profile + handle_new_user trigger (OAuth-aware: pulls full_name/avatar_url from Google metadata), avatars storage bucket + ProfilePhotoUpload, profile page, AppHeader with NavUser dropdown, auth.global middleware, RLS: authenticated owners gate writes; **anonymous matches still allowed** (Option A — owner_id NULL path). Google OAuth wired but UI button disabled. Public scoreboards (`/m/[id]/scoreboard\|overlay`) un-gated. Per-match write-tokens (delegated scoring) deferred to **E2.8**. | ✅ done |

### Epics — PENDING ⏳

| Epic | What's needed | Estimate |
|---|---|---|
| **E1.0a · Auto-migrate local matches on first login** | When a logged-out user has scored matches against `localStorage` and then signs in, claim them: write `owner_id = auth.uid()` on those match rows + flush any queued events. One-shot on first authed mount. | 4 hours |
| **E1.0b · Vue Email template gen script** | Port `pnpm email:gen` from np-mono so the 6 `supabase/templates/*.html` files are generated from `.vue` sources rather than maintained as raw HTML. | 4 hours |
| **E1.11 · Supabase Realtime sync** | Replace localStorage in `useEvents` with Supabase Realtime subscription + Dexie offline queue. Cross-device sync per ARCHITECTURE §4.5. | 1 weekend |
| **E1.12 · PWA install + offline** | Verify `@vite-pwa/nuxt` config, add real icon set (192/512/maskable), test offline shell on iOS/Android, "Add to Home Screen" prompt timing. | 1 day |
| **E1.13 · Match-card og:image rendering** | Server route `/m/[id]/card.png` using Satori/`vercel/og`. og:meta tags for social sharing previews. PRD §3.18. | 1-2 days |
| **E1.14 · Privacy policy + ToS + DPDP/GDPR** | Two static legal pages, footer links, cookie-free analytics confirmation. PRD §3.19. | 1 day |
| **E1.15 · Sentry + Plausible** | Wire Sentry SDK with no-PII default scope; Plausible custom events for funnel. PRD §3.21. | 1 day |
| **E1.16 · Theme preview modal** | "Preview" button in `/themes` opens live mini overlay+scoreboard at right. | 1 day |
| **E1.17 · Advanced setup sheet on /new** | Court / round / category / venue / tournament binding (already in match metadata schema). | 1 day |
| **E1.18 · Sheet animations + polish** | Slide-up transition for sheets, modal fade, reduced-motion respected. | 1 day |
| **E1.19 · Landing demo match** | Pre-seeded match auto-scoring on the homepage hero. PRD §3.22. | 1 day |
| **E1.20 · Practice mode** | `/practice` route, never writes to Supabase, "PRACTICE" watermark. | 1 day |
| **E1.21 · Tennis + pickleball + table-tennis presets** | Three more racquet sport configs (engine already supports them — just config files). | 4 hours |
| **~~E1.22 · Doubles service rotation polish~~** ✅ done 2026-05-05 | `partnerOnRight: { a: 1\|2; b: 1\|2 }` added to `RacquetState`. Reducer toggles the serving team's flag on every "won on serve" point; resets to `{ a: 1, b: 1 }` at game start. Control UI derives `currentServerSlot` and shows the `Serves` pill on the correct partner's cell. 29/29 engine tests still passing. | done |
| **E1.23 · Deploy buttons + self-hosting docs** | Netlify / Vercel one-click buttons in README, `docs/SELF_HOSTING.md`. | 1 day |
| **E1.24 · Launch landing page** | About, GitHub link, contributors, change-log. | 1 day |
| **E1.25 · Public domain + production deploy** | Pick brand domain, configure SSL, point at Netlify, hosted Supabase project + migrate. | 1 day |

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
| **E2.5 · Custom branding (Pro)** | Sponsor logo upload, color overrides per match. |
| **E2.6 · Paid theme packs** | Gumroad / Lemon Squeezy integration. 5–10 premium themes at launch. |
| **E2.7 · Pro subscription billing** | Razorpay (India) + Stripe (rest of world). Price tier, billing portal. |
| **E2.8 · Multi-scorekeeper per match** | Operator passes a write-token to a co-scorekeeper. Conflict resolution from event log. |
| **E2.9 · Capacitor mobile app** | Wrap Nuxt PWA, ship to App Store + Play Store. |
| **E2.10 · Cricket sport family** | Innings/overs/balls/wickets data model + reducer + tests. Separate sibling under `packages/engine/src/sports/cricket/`. |
| **E2.11 · Post-production video burn-in** | Upload MP4 → FFmpeg + event log → MP4 with overlay rendered into pixels. |
| **E2.12 · Custom email templates** | Confirmation / magic-link / password-reset templates branded. |

**Phase 2 gate (G2) → unlocks Phase 3 only when:** 1,000+ MAU AND ≥1 academy is asking for tournament features.

---

## Phase 3 · v3 (the real business)

> **Goal:** academy network platform. Cricheroes-for-racquet-sports.

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

## Cross-cutting (any phase, ongoing)

| Track | Description |
|---|---|
| **Bug fixes** | Tag with `bug` label. Triaged weekly. |
| **Community theme PRs** | Tag `theme-pr`. Reviewed for malicious CSS/HTML before merge. |
| **Sport preset PRs** | Tag `sport-pr`. Reviewed for rule correctness. |
| **Docs improvements** | Tag `docs`. README, contributing, self-hosting, brand. |
| **Accessibility audits** | Quarterly WCAG 2.1 AA pass with manual screen-reader testing. |
| **Security review** | Annual threat-model review (ARCHITECTURE §9). |
