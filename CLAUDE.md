# Scoreboard — repo guide for Claude

This file is loaded automatically into every Claude session in this repo. Treat it as durable instructions, not a single-conversation note.

## Project at a glance

Scoreboard is a free, OSS-first live scoring tool for racquet sports (badminton first; tennis / pickleball / table-tennis sharing the engine). Two surfaces:

- **`apps/app`** — operator-facing PWA. `/new`, `/m/[id]/{control,scoreboard,overlay}`, `/d/[id]/overlay`, `/t/[id]/overlay`, `/profile`, `/auth/*`. Anonymous scoring is allowed (Option A). Sign-in is optional and unlocks ownership / history / Pro features later.
- **`apps/web`** — marketing site (currently empty). Plan: public landing, theme gallery, free anonymous scorer alongside marketing. See ROADMAP §"Marketing site".

Shared layers + packages:

- `packages/engine` — pure TS scoring engine (badminton 21pt / 15pt etc.). Sport-pluggable, fully tested.
- `packages/themes` — broadcast theme registry. Surface-grouped (overlay vs scoreboard).
- `packages/shared` — small shared utilities.
- `layers/ui` — shadcn-vue primitives + design tokens. Imported explicitly per-file (no `Ui` prefix, no auto-import).
- `layers/app-base` — shared composables (`useEvents`, `useMatchState`), pinia, `@vueuse/nuxt`.

Backend: Supabase (Postgres + Auth + Realtime + Storage). RLS-gated. Anonymous matches via `owner_id IS NULL` policies.

## Authoritative docs

Read these before doing substantial work:

- `docs/BRD.md` — business goals + locked decisions.
- `docs/PRD.md` — surface inventory + behavior specs.
- `docs/ARCHITECTURE.md` — technical structure, threat model, data flow.
- `docs/ROADMAP.md` — phase / epic sequencing.

## Doc maintenance policy

**BRD/PRD are the spec — code follows them, not vice versa. Update docs only when you pivot.**

If the work in front of you is "implement what BRD/PRD already say," the docs don't change. Iterating on layout, alignment, classes, animations, label text, button positions — none of that is a pivot, it's implementation. Don't touch the docs.

A pivot is:
- A locked business decision changing → `BRD.md` (rare; a few times a year).
- A surface added, removed, or fundamentally repurposed → `PRD.md`.
- A new technical concept (new package, new schema, new auth flow, new sync strategy, new third-party service) → `ARCHITECTURE.md`.
- An epic added, completed, moved between phases, or rescoped → `ROADMAP.md`.

If you're not sure whether something is a pivot, default to **no doc update**. Over-updated docs become a changelog no one reads; that's worse than slightly stale docs.

When you do update, do it in the same commit as the code, and keep the entry concise (one sentence per decision, not a paragraph of implementation detail). Implementation details live in code.

## Coding conventions

- **No shadcn `Ui` prefix.** Components are in `layers/ui/components/ui/<name>/index.ts` and imported explicitly: `import { Button } from "@sb/layer-ui/components/ui/button"`.
- **Limit Nuxt component auto-imports** to `apps/app/components/**`. Layer UI is explicit. Composables / Nuxt framework imports (`useRoute`, `definePageMeta`, `useSeoMeta`, `useSupabaseClient`) stay auto-imported — they're framework standard.
- **Layouts:** `apps/app/layouts/default.vue` is the app shell with header. `auth.vue` is the signin/signup carousel layout. Pages that should render bare (`/m/*/scoreboard`, `/m/*/overlay`, `/m/*/control`, `/d/*/overlay`, `/t/*/overlay`) opt out via `definePageMeta({ layout: false })`.
- **Auth model — Option A.** Anonymous-OK scoring is the default. RLS allows `owner_id IS NULL` matches with permissive insert/update for both `anon` and `authenticated`. Per-match URL is the only access protection for anonymous matches; per-match write tokens (E2.8) come in Phase 2 for delegated scoring.
- **Engine config** lives in `packages/engine/src/sports/badminton/config.ts`. Two presets ship: `badminton21` (BWF, default) and `badminton15` (classic). Format selection persists per-match via `localStorage:sb:format:{matchId}`.
- **Event sync.** `useEvents` writes locally first (localStorage + BroadcastChannel for same-device cross-tab) then to Supabase, and subscribes to Realtime INSERT + DELETE for cross-device sync. Match rows are created lazily on first event with `owner_id` from current auth state.

## When in doubt

Ask one question at a time when scope is ambiguous. The user prefers incremental decisions over batched plans on architecture-level forks.
