# ScoreYard — Business Requirements Document (BRD)

**Status:** v0 draft
**Owner:** Baljeet Singh
**Last updated:** 2026-05-04

---

## 1. The problem

Amateur and semi-pro racquet-sport streamers — local badminton tournaments, club tennis leagues, pickleball Sunday meets — have **no good scoring overlay tool**. The available options each fail in a specific way:

| Tool | Limitation |
|---|---|
| **KeepTheScore** | Closed-source SaaS, freemium with watermark on free tier, generic feel, no mobile-first control. |
| **OBScoreboard** | Self-host only (clone+npm), table-tennis focused, no mobile-first control, dated tech, GPLv3 limits commercial reuse. |
| **OpenScoreboard** (jackbmccarthy) | Used by USA Table Tennis but only 6 stars; table-tennis + pickleball only, no badminton, mutable-state architecture limits future features (no proper undo, hardcoded 9-game max, sport rules in switch statements), GPLv3. |
| **Singular.live, vMix titles** | Pro broadcast tools, paid SaaS, learning curve too steep for amateurs. |
| **StreamElements / Streamlabs widgets** | General-purpose, sports widgets are thin afterthoughts. |

**The unmet need:** a polished, open-source, sport-aware, mobile-controlled, theme-swappable scorecard for streamers and venue operators who don't have a broadcast budget.

## 2. The opportunity

Three trends converge:

1. **Amateur streaming is exploding.** Badminton, pickleball, tennis local-tournament streams on Facebook Live and YouTube grow every quarter. Most use phones and free tools.
2. **Streamers expect "real product" UX.** Streamlabs, Restream, and OBS plugins have raised the bar. Hand-coded scoreboards from 2018 don't cut it anymore.
3. **OSS distribution works.** OpenScoreboard reached real broadcasters (USA Table Tennis) despite tiny marketing — pure GitHub + word of mouth. The space rewards a well-architected open project.

**Sizing (rough):** GitHub repos in this space have low single-digit hundreds of stars at the top. The category is small but real, and the audience for an MIT-licensed badminton-first version with mobile control has not been served at all.

## 3. Strategic positioning

> ScoreYard is the open-source live scorecard for the streamer who scores from their phone.

**Wedge:** badminton + mobile-first control. Both gaps in every existing tool.

**Expansion:** every other racquet sport, then court sports broadly. Sport-rules-as-data architecture means each new sport is a config PR from the community, not a fork.

**Differentiation vs each competitor:**

- **vs KeepTheScore:** open-source, no watermarks, badminton-aware, mobile-first.
- **vs OBScoreboard / OpenScoreboard:** hosted (zero-install), MIT (not GPL), badminton-first, event-sourced (real undo, real replay, future video burn-in).
- **vs Singular.live / vMix:** free, open, learnable in 5 minutes.

## 4. Target users

| Persona | Volume | Willingness to pay |
|---|---|---|
| **Sunday phone streamer** (Persona A) | Largest. Local club tournaments, casual streams. | Low. Wants free + good. Will not pay subscription. |
| **OBS-stream league operator** (Persona B) | Medium. Recurring leagues, semi-pro setups. | Medium. Will pay one-time for premium themes / branding. |
| **In-venue scoreboard operator** (Persona C) | Large but invisible. Doesn't stream — just wants a TV scoreboard at the club. | Low. Free tier serves them entirely. |
| **Tournament director** (future) | Small but high-value. Multi-court events. | High. Will pay for multi-court dashboards, custom branding. |

## 5. Business model

### v1 — open & free

Build trust, build the community, prove the product. **Zero monetization at launch.** No watermarks, no feature gates, no account requirement.

### v1.x — paid theme packs (one-time, $9–15)

Premium themes: BWF broadcast style, ESPN style, neon esports, retro arcade, custom team-branded. Sold via Gumroad or Lemon Squeezy. Low operational cost, high margin, pairs naturally with OSS goodwill (free product, paid polish).

### v2 — Pro subscription (~$5–8/mo or $50/yr)

Cloud match history, multi-scorekeeper, custom branding (sponsor logos), data export, priority support. Targets tournament organizers and recurring leagues, not hobbyists.

### v2 — Self-hosted desktop license (one-time, $25–40)

Tauri app for venue-WiFi-less environments. Includes lifetime theme packs to date. For tournament directors who need offline reliability.

### What is not paywalled, ever

- The scoring engine
- Sport presets (community PRs are free)
- The 3 default themes
- Watermark-free output on the free tier
- Self-hosting the open core

## 6. Why open source

1. **Distribution.** OSS gets recommended on Reddit, GitHub, OBS forums. Closed indie tools don't.
2. **Trust.** Streamers trust software they can see. Tournament directors trust software they can self-host.
3. **Community contributions.** Sport rules and themes are perfect PR-sized chunks of work; OSS turns users into contributors.
4. **Defensibility paradox:** the engine being open doesn't hurt monetization. Theme packs, hosted SaaS, and Pro tier are not in the engine — they're around it.

**License: MIT.** Permissive enough that contributors aren't paranoid about commercial use, restrictive enough to require attribution. GPLv3 was rejected because it forces all derivatives open, which would make our future paid layer (themes, SaaS) legally awkward.

## 7. Competitive risk

| Risk | Mitigation |
|---|---|
| OpenScoreboard adds badminton + mobile control | Architecturally hard for them (mutable state, hardcoded loops). They'd need a partial rewrite. |
| KeepTheScore notices and improves | Their model relies on watermark-coercion, which we never use. We win on UX. |
| A new entrant with same idea | First-mover advantage on GitHub + community + theme ecosystem. Ship in weeks, not quarters. |
| Stack obsolescence (Nuxt, Supabase, etc.) | All chosen for active maintenance and existing operator skill. Engine is framework-free, reusable across stacks. |

## 8. Success metrics

### v1 launch (90 days post-release)

- ≥ 50 GitHub stars
- ≥ 100 unique self-hosted deploys (via Netlify button telemetry)
- ≥ 1 tournament organizer testimonial / case study
- ≥ 3 community-contributed themes or sports

### v2 monetization (12 months post-launch)

- ≥ 100 theme-pack purchases
- ≥ 20 active Pro subscribers
- Net revenue covers domain, Supabase Pro tier, and one Apple Developer account

### Long-term

- Recognized as **the** open badminton scorecard within the global badminton-streaming community
- Tournament-grade adoption (one or more national/regional federations using it)

## 9. Constraints & assumptions

- Solo developer, evenings/weekends.
- ~6 weekends to v1 ship.
- Existing skills: Nuxt 3, Vue, Supabase. No new framework should be required for v1.
- No external funding; product must be sustainable as a side project.
- Hosting cost target: < $25/month at 10× current scale assumption.

## 10. Decision log

| Decision | Rationale |
|---|---|
| Build own (not contribute to OpenScoreboard) | Architecture mismatch is fatal; GPLv3 caps monetization; stack misaligned. |
| MIT license | Maximizes contributor goodwill + future commercial flexibility. |
| Web-only v1 (no native, no desktop) | Faster to ship, validates demand, framework-free engine keeps options open. |
| Capacitor over Expo for v2 | One codebase; PWA UX is sufficient for this product; OpenScoreboard's Expo choice illustrates the cost. |
| Plain HTML+CSS themes (no visual editor) | Designer-friendly contribution model; ship in v1 weeks not v2 months. |
| Event-sourced data model | Free undo, free replay, free video burn-in, no hardcoded game limits. |
| Badminton-first positioning | Clear wedge; existing tools don't cover it; expandable. |
| No accounts in v1 | Zero friction; account system arrives with paid tier. |
| Defer Pro tier and themes until v1 has users | Avoids building unused tiers; validates demand first. |
