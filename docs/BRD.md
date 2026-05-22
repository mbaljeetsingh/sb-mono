# Scoreboard — Business Requirements Document (BRD)

**Status:** v1.0 draft
**Owner:** Baljeet Singh
**Last updated:** 2026-05-04
**Working name:** Scoreboard (public brand TBD before launch — likely Rally, Crest, or similar)
**Repo:** `sb-mono` · `@sb/*` packages
**License:** MIT (locked — see Decision #2 in §12)

---

## 1. Executive summary

Scoreboard is an open-source live scorecard for racquet sports — badminton first, then tennis, pickleball, table tennis, squash, volleyball. The wedge is **mobile-first scoring with broadcast-quality overlays for streamers and in-venue scoreboards for clubs**.

The long-term vision is to grow into a **network platform for amateur and academy-level racquet sports** — where academies, leagues, and clubs run their tournaments, players track their results, and the scoring engine is the connective tissue.

**v1 is intentionally narrow:** ship the best-in-class open-source scoring tool for badminton in 7 weekends. Everything else — accounts, profiles, registrations, networks, payments — is gated behind explicit phase milestones tied to v1 traction. This BRD's most important job is preventing scope creep into the bigger vision before the wedge proves itself.

## 2. The problem

Three distinct user pains converge into one product opportunity:

### 2.1 Streamers have no good scoring overlay
Amateur and semi-pro racquet-sport streamers — local badminton tournaments, club tennis, pickleball Sunday meets — have no polished, OSS, sport-aware overlay. KeepTheScore feels generic and watermarks free output. OBScoreboard is self-host-only and table-tennis-focused. OpenScoreboard (jackbmccarthy) has 6 stars, real broadcasters, but no badminton, no mobile-first control, and a state model that limits future features. Singular.live and vMix titles are pro broadcast tools too expensive and complex for amateurs.

### 2.2 Players have no place to log results
Most matches that happen in the world are never streamed. Two friends play, a coach runs a session, a club hosts a Sunday round-robin — the results live in a WhatsApp message and disappear. There's no lightweight way to record "we played 3 games, here are the scores" and share or save it.

### 2.3 Academies and clubs lack affordable tooling
Badminton academies in India and similar markets ("Xperience Academy" is the kind of place we mean) run weekly internal events, monthly tournaments, sometimes leagues. Their tools today are WhatsApp + Excel + manual brackets on a whiteboard. Vertical-SaaS networks have proven this model in other amateur sports; nothing equivalent exists for badminton at affordable price points.

**The opportunity:** one product that solves these three pains progressively, starting with the streamer wedge (where the best tool wins via GitHub + word of mouth), expanding to the player log (massive audience), and eventually to the academy network (the real long-term business).

## 3. Long-term vision

Scoreboard is the **player and academy platform for racquet sports**. In 2-3 years it should be:

- **The default scoring tool** for badminton/tennis/pickleball streamers worldwide
- **The default match-logging app** for amateur players in India and similar markets
- **The default tournament platform** for badminton academies and small-to-mid-size leagues
- **A live data layer** that other apps and broadcasters can plug into

The strategic shape is **vertical SaaS for racquet sports**. The scoring engine is the wedge that lets us own the racquet-sports vertical end-to-end.

## 4. The competitive landscape

| Competitor | What they do | Where they fall short for our user |
|---|---|---|
| **KeepTheScore** | Hosted SaaS scoreboard for many sports | Closed-source, watermarks free output, generic feel, no mobile-first control |
| **OBScoreboard.com** | Hosted overlay for OBS streams | Closed-source, freemium, OBS-locked |
| **OpenScoreboard** (jackbmccarthy) | OSS scoreboard suite, table tennis + pickleball | No badminton, dated tech, mutable-state architecture, GPLv3 limits commercial reuse, self-host only |
| **Singular.live, vMix titles** | Pro broadcast tools | Paid SaaS, steep learning curve, overkill |
| **StreamElements / Streamlabs widgets** | General-purpose stream overlays | Sports widgets are thin afterthoughts |
| **TournamentSoftware** (BWF) | Pro badminton tournament management | Heavy, federation-targeted, no mobile-first scoring, no overlay, expensive |

**The gap:** an OSS, mobile-first, badminton-aware, theme-swappable, hosted-but-self-hostable scorecard that grows into a player + academy platform. No competitor occupies this exact position.

## 5. Strategic positioning

> **The open-source live scoreboard for racquet sports — score from your phone, show it anywhere, log it forever.**

Three sequential product positions, each unlocking the next:

| Phase | Position | Audience |
|---|---|---|
| **v1** | "The OBS overlay for badminton streamers" | Streamers, in-venue scorekeepers, club operators |
| **v2** | "The match log for amateur players" | Players, coaches, casual streamers |
| **v3** | "The tournament platform for academies" | Badminton academies, small leagues, clubs |

Each phase is a complete product on its own. None is a stepping stone that depends on a future phase to be useful — but each compounds the audience and product value of the previous one.

## 6. Target users (long-term)

| Persona | Role | Phase first served |
|---|---|---|
| **Streamer** | Records and broadcasts tournaments | v1 |
| **In-venue scorekeeper** | Runs the live score for spectators in the hall | v1 |
| **Club operator / OBS streamer** | Produces league streams with proper graphics | v1 |
| **Casual player** | Plays matches, wants to log results | v2 |
| **Coach** | Tracks student matches and progression | v2 |
| **Tournament director** | Runs amateur tournaments at academies/clubs | v3 |
| **Academy admin** | Manages a network of players, courts, events | v3 |
| **League commissioner** | Runs a multi-event recurring league | v3+ |
| **Spectator / parent** | Follows a player or academy's results | v2-v3 |

## 7. Business model

### 7.1 v1 — Open and free

Zero monetization at launch. No watermarks, no feature gates, no account requirement. **Goal: trust + traction.** OSS distribution rewards generosity at the start.

### 7.2 v2 — Optional Pro accounts (~$5/month or $50/year)

Account-based features that don't make sense free:
- Cloud match history (anonymous v1 history stays in browser; Pro syncs to cloud)
- Lifetime stats, head-to-head records
- Custom branding (sponsor logos on overlay)
- Multiple scorekeepers per match
- Priority support

**Target:** semi-pro streamers, league operators, coaches.

### 7.3 v2 — Paid theme packs (one-time, $9–15 each)

Premium animated themes (BWF broadcast style, ESPN style, neon esports). Sold via Gumroad / Lemon Squeezy. Low ops burden. Pairs naturally with OSS goodwill.

### 7.4 v3 — Network / academy plans (~$15–50/month per academy, tiered by player count)

The real business:
- Academy / club / league dashboards
- Player registration management
- Tournament management (brackets, scheduling)
- Custom-branded subdomain (`xperience.scoreboard.app`)
- Analytics for academy admins
- White-label overlays

**Target:** the 5,000+ badminton academies in India alone, plus tens of thousands more across racquet sports globally.

### 7.5 v3 — Tournament entry fees as platform fee

When tournaments charge entry fees, take a 2-5% platform fee + Razorpay/Stripe processing.

### 7.6 v4 — Self-hosted desktop license (one-time, $25-40)

Tauri app for venue-WiFi-less environments. Lifetime theme packs included. For tournament directors who need offline reliability.

### 7.7 What is never paywalled

- The scoring engine itself
- Sport presets (community contributions stay free)
- The default themes that ship with v1
- Watermark-free output on the free tier
- Self-hosting the open core
- Anonymous, browser-stored result logging (free forever)

### 7.8 Under consideration (not locked)

Parking lot for revenue ideas worth revisiting at phase gates. None of these are decisions yet.

- Raise Pro band to $8–12/mo (current $5 likely undersold for streamers already paying for OBS plugins / Restream).
- Hosted SaaS upsell — "self-host free, or use scoreboard.app for $X/mo zero-setup." Slots between Pro and Academy. Plausible / Cal.com model.
- GitHub Sponsors / Open Collective from v1 launch — small but free signal.
- Overlay sponsor-rotation widget — tournament organizers pay a small fee to run a sponsor logo rotation on the overlay.
- Productized academy onboarding ($200–500 one-time) at v3 — paid setup is more reliable than self-serve in target markets.
- Live data API at v3+ — broadcasters / aggregators pay for a feed.

## 8. Why open source

1. **Distribution:** OSS gets recommended on Reddit, GitHub, OBS forums. Closed indie tools don't.
2. **Trust:** Streamers trust software they can see. Tournament directors trust software they can self-host.
3. **Community contributions:** Sport rules and themes are PR-sized chunks of work; OSS turns users into contributors.
4. **Defensibility paradox:** the engine being open doesn't hurt monetization. Themes, hosted SaaS, Pro tier, academy plans are not in the engine — they're around it.
5. **Vertical SaaS works on top of OSS:** see Supabase (Postgres), Cal.com (scheduling), PostHog (analytics).

**License: MIT.** Permissive enough for contributors, flexible enough for our future paid layer. GPLv3 was rejected because it forces all derivatives open, which would make Pro / academy / SaaS legally awkward.

## 9. Success metrics

### v1 launch (90 days post-release)

- ≥ 50 GitHub stars
- ≥ 100 unique self-hosted deploys (via deploy-button telemetry)
- ≥ 1 tournament organizer testimonial / case study
- ≥ 3 community-contributed themes or sport configs
- p95 score-tap-to-overlay-update latency < 300ms
- 1 academy or league piloting it for an event

### v2 (6-12 months)

- ≥ 500 GitHub stars
- ≥ 1,000 monthly active users
- ≥ 100 theme-pack purchases
- ≥ 20 active Pro subscribers

### v3 (12-24 months)

- ≥ 10 paying academies / clubs / leagues
- ≥ 50 tournaments hosted on the platform
- ≥ 10,000 player accounts
- Net revenue covers domain, Supabase Pro, Apple Developer account, plus a part-time contractor

### Long-term (24-36 months)

- Recognized as **the** open badminton + racquet-sports scoring/registration platform
- Tournament-grade adoption (one or more national/regional federations using it)
- Sustainable indie business OR plausible candidate for funding

## 10. Risks & mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Scope creep into network/academy in v1 | High (already pushing) | This BRD's explicit phase gates; PRD's "out of scope, deferred to phase X" sections |
| OpenScoreboard adds badminton + mobile control | Low | Architecturally hard for them (mutable state); we have a 6+ month head start anyway |
| A vertical-SaaS competitor enters racquet sports | Medium | First-mover advantage on OSS; community + theme ecosystem are durable |
| Academy market in India is harder than expected | Medium | v1 doesn't depend on academy traction; pivot point is v3 if v2 stalls |
| Solo developer burnout | Medium | 7-weekend v1 is small enough to ship; phase 2+ only after validation |
| Paid Indian streamers churn quickly | Medium | Theme-pack model (one-time payments) softens churn; subscriptions arrive only with Pro |

## 11. Constraints & assumptions

- Solo developer (Baljeet Singh) working evenings and weekends.
- ~7 weekends to v1 ship.
- Existing skill set: Nuxt 3, Vue 3, TypeScript, Supabase. No new framework adopted in v1.
- No external funding; product must be sustainable as a side project until v3 traction.
- Hosting cost target: < $25/month at 10× initial scale assumption.
- Primary launch market: global GitHub-discoverable streamers (English) + Indian amateur badminton (Hindi/English) for v2-v3.

## 12. Decision log

Decisions made and locked. Re-opening any of these requires explicit reason in this document.

| # | Decision | Rationale |
|---|---|---|
| 1 | Build own product, do **not** contribute badminton to OpenScoreboard | Architecture mismatch is fatal; GPLv3 caps monetization; stack misaligned |
| 2 | MIT license | Maximizes contributor goodwill + future commercial flexibility |
| 3 | Web-only v1 (no native, no desktop) | Faster to ship, validates demand, framework-free engine keeps options open |
| 4 | **Capacitor** over Expo for v2 mobile | One codebase; PWA UX is sufficient; OpenScoreboard's Expo path proves the cost |
| 5 | **Plain HTML+CSS themes** (no visual editor in v1) | Designer-friendly contribution model; ships in v1 weeks not v2 months |
| 6 | **Event-sourced** data model | Free undo, free replay, free video burn-in, no hardcoded game limits — sidesteps OpenScoreboard's traps |
| 7 | **Sports as first-class siblings** under `packages/engine/src/sports/` | New racquet sports drop in as siblings of badminton, not a config hack — explicit fix to OpenScoreboard's switch-statement trap |
| 8 | **Badminton-first** positioning | Clear wedge; existing tools don't cover it; expandable across racquet sports |
| 9 | **Optional accounts in v1** | Anonymous scoring is the default. Sign-in (E1.0) is optional and unlocks profile + ownership + multi-device. Per-match URL is the access token for anonymous matches. Per-match write tokens for delegated scoring stay in E2.8. |
| 10 | **Defer Pro tier and themes until v1 has users** | Avoids building unused tiers; validates demand first |
| 11 | **Result logging is in v1** | ~1 weekend; expands TAM 5-10×; natural funnel to live scoring |
| 12 | **Tournament *grouping* is in v1** | One column on `matches` table (`tournament_id`) and one route; near-free architectural keep-the-door-open |
| 13 | **Player registration / brackets / payments are v3+** | Real product category that needs months of work; would derail the wedge |
| 14 | **Network/academy platform is v3** | The real business, but earned only after v1 + v2 prove the product |
| 15 | **Repo name is `scoreboard`, brand TBD** | Decoupled; package names are internal, brand is marketing |
| 16 | Stack: Nuxt 4 + Supabase + Dexie + Capacitor (v2) | Aligned with np-mono; OSS-friendly; scales to v3 |
| 17 | Doubles support is **v1**, not deferred | BWF doubles is half of real badminton matches; retrofit cost is high |
| 18 | Match metadata (court, round, category, venue) is **v1** | Cheap to add; tournament grouping page is unusable without these |
| 19 | Match-state events (walkover, retirement, time-out, suspension, score correction) are **v1** | Real matches have these; faking them produces misleading records |
| 20 | Auto-generated match-card og:image is **v1** | Growth-critical; every shared link becomes free advertising |
| 21 | WCAG 2.1 AA accessibility is **v1**, not nice-to-have | Risk mitigation + design discipline; not optional for a public web app |
| 22 | Privacy policy + DPDP/GDPR compliance is **v1** | Required from day 1 for any app processing personal data |
| 23 | Cookieless analytics (Plausible / Cloudflare) over PostHog/GA at v1 | Avoids cookie banner; respects user privacy; reduces legal surface |
| 24 | Anonymous match retention: 30 days from last activity | Cost containment; "session" semantics for tools that don't require an account |
| 25 | Theme moderation: PR review for malicious code; CSP forbids external font/image loads in v1 | Security; reputation; reduces attack surface |
| 26 | **Open source decision re-locked: MIT, full app + engine.** Not BSL, not closed, not partial. | Distribution > forking risk for a product this size; OSS purity protects v3 academy trust; monetization paths (SaaS, themes, Pro, academy) all work without closed code |
| 27 | `@sb/engine` published to npm at v1 ship | Concretizes the OSS claim; enables Capacitor / Tauri / third-party builds against the same engine |
| 28 | No closed-source / open-core split in v1 | All v1 features ship as MIT; gating happens via hosted services + accounts in v2, not via license |
| 29 | **Two apps in the monorepo** | `apps/app` = auth-aware product. `apps/web` = marketing + free anonymous scorer + theme gallery. Lets the marketing surface deploy without auth code; Pro features get a clean home in `apps/app`. |
| 30 | **Anonymous scoring is DB-backed** | Free scorer writes to Supabase with `owner_id = null` so cross-device sync works via Realtime. One backend for free + Pro; no separate relay. |

## 13. Phase gates — explicit

A phase doesn't start until its gate condition is met. This protects against premature investment.

| Gate | Condition | What it unlocks |
|---|---|---|
| **G1 → v2** | v1 has 100+ self-hosted deploys OR 500+ GitHub stars OR 3+ themes contributed | Pro tier, theme packs, cloud accounts |
| **G2 → v3** | v2 has 1,000+ MAU AND 1+ academy is asking for tournament features | Network/academy, brackets, registration |
| **G3 → v4** | v3 has ≥3 paying academies AND a venue-WiFi complaint thread | Tauri desktop, white-label subdomains |

**No gate-skipping.** If v1 launches and hits 30 stars in 6 months, we don't move to v2 — we either fix v1 positioning or wind down. Building v2 features for a v1 nobody used is the most common indie product death.
