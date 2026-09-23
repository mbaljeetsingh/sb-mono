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

## Dev server

`pnpm dev` runs through [portless](https://portless.sh) (Node 24+, see `.nvmrc`) — the app is served at the stable URL **https://sb-app.localhost** (no fixed port; portless injects `PORT` and `devServer.port` in `nuxt.config.ts` respects it). In a git worktree the branch name is prepended (`https://<branch>.sb-app.localhost`). The machine-wide 443 proxy is a one-time global install (`portless service install`). Troubleshooting: `portless list` shows who holds a hostname; a stale `nuxt dev` child must be killed explicitly (`pkill -f "nuxt dev"`) — stopping the turbo task doesn't kill it. Auth redirect allow-list for these origins lives in `supabase/config.toml` (`[auth].additional_redirect_urls`); restart local Supabase after editing it.

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

### Component & UI

- **No shadcn `Ui` prefix.** Components are in `layers/ui/components/ui/<name>/index.ts` and imported explicitly: `import { Button } from "@sb/layer-ui/components/ui/button"`.
- **Use shadcn primitives over raw HTML.** If a `Button`, `Input`, `Label`, `ToggleGroup`, `Dialog`, etc. exists in `layers/ui`, prefer it over a styled `<button>`/`<input>`. Exceptions: full-area tap zones with custom geometry (the score cells in `control.vue`) and decorative elements with no semantic role (slide-indicator dots).
- **Use shadcn defaults.** Don't override `variant`/`size` with custom Tailwind classes for selected states; use the component's built-in active state. The only exception is when the component lacks a "selected" variant and we explicitly need one — prefer `ToggleGroup` over hand-rolled toggle pairs.
- **Icons from `lucide-vue-next`** — no inline SVGs, no emoji-as-icon. Imported explicitly per-file. One sanctioned exception: `apps/app/components/common/SportGlyph.vue` holds hand-drawn per-sport glyphs (lucide ships no racquet-sport icons); all custom SVG paths live in that single component and nowhere else.

### Imports & state

- **All imports explicit** for VueUse composables (`useStorage`, `useClipboard`, `useVibrate`, `useWakeLock`, `useElementSize`), `vue-sonner`, `lucide-vue-next`, and shadcn components. Auto-imports are flaky during HMR and break SSR; the cost of one explicit `import` line is nothing.
- **Auto-imports are limited** to `apps/app/components/**`, plus Nuxt framework standards (`useRoute`, `definePageMeta`, `useSeoMeta`, `useSupabaseClient`, `navigateTo`, `useHead`, `computed`, `ref`, `onMounted`, `watch`, `watchEffect`).
- **Use VueUse, not raw browser APIs.** `useStorage` over `localStorage.getItem/setItem`. `useClipboard({ legacy: true })` over `navigator.clipboard.writeText`. `useVibrate` over `navigator.vibrate`. `useWakeLock` over the wake-lock API. `useElementSize` over manual `ResizeObserver`. The legacy clipboard fallback matters for HTTP captive portals + in-app webviews.
- **`useStorage` defaults must be plain values, not computeds.** It writes back to apply `mergeDefaults`, which errors on readonly computeds. Pass the literal default; if you need a meta-driven seed, write it from the source (e.g. `/new` writing to the same key) so storage is populated before the consumer mounts.
- **Reactive storage keys.** `useStorage(computed(() => \`sb:control-layout:\${id.value}\`), default)` — the composable swaps which entry it reads/writes when the key changes. Use this whenever the matchId/dynamicId is reactive.

### Vue conventions

- **Composition API + `<script setup lang="ts">` only.** Organize: imports → composables → props/emits → refs/computed → watchers → lifecycle → helpers.
- **Naming:** PascalCase components, camelCase variables, `use` prefix for composables, `is`/`has` prefix for booleans.
- **`import type`** for type-only imports.
- **Don't add new dependencies without explicit user approval.** Adding a tiny utility from npm is rarely worth the lockfile churn — write it inline or extract a helper.

### shadcn-vue maintenance

- **Never edit files in `layers/ui/` by hand.** Update via `pnpm shadcn:update` (full regen) or `pnpm shadcn:patches-only` (re-apply local patches). Local customizations live in `scripts/shadcn/patches.json`; add a patch entry rather than editing the component.
- **Adding a single component:** `pnpm dlx shadcn-vue@2.4.0 add <name>` then run `pnpm shadcn:patches-only` if needed. The components.json `ui` alias is `@sb/layer-ui/components/ui`, so generated files use the workspace path natively.
- **`apps/app/lib/utils.ts`** must exist as a re-export of `cn` from `@sb/layer-ui/lib/utils` — shadcn-vue components in the layer resolve `@/lib/utils` via Nuxt's app-root alias.
- **biome's `useImportType` is off for `.vue` files** (biome.json override) — biome can't see templates, so it rewrites template-called imports (e.g. `toggleVariants` in ToggleGroupItem) into type-only imports, which vue-tsc then rejects. Don't re-enable it for Vue files.

### Layouts & auth

- **Layouts:** `apps/app/layouts/default.vue` is the app shell with header. `auth.vue` is the signin/signup carousel layout. Pages that should render bare (`/m/*/scoreboard`, `/m/*/overlay`, `/m/*/control`, `/d/*/overlay`) opt out via `definePageMeta({ layout: false })`. **Toaster + TooltipProvider live in `app.vue`**, not the default layout, so layoutless pages get them too.
- **Auth model — Option A.** Anonymous-OK scoring is the default. RLS allows `owner_id IS NULL` matches with permissive insert/update for both `anon` and `authenticated`. Per-match URL is the only access protection for anonymous matches; per-match write tokens (E2.8) come in Phase 2 for delegated scoring.

### Engine & sync

- **Engine config** is in `packages/engine/src/registry.ts` — every shipped preset maps to `{ config, reducer, sport, displayName, official }`; each sport has its governing body's ruleset (`official: true`) plus shorter club variants. `RacquetConfig.scoring` picks `rally` / `side-out` / `tennis`. Adding a racquet sport = registry entries. New family = sibling reducer + entries. **Preset ids are data** (stored per match, the log is replayed against them) — add ids, never repurpose one.
- **Reducer shape:** event handlers change only what the event decides; `seat()` (who serves/receives, from which court) and `flags()` (game/set/match point) are recomputed after every event. Don't carry derived serve state forward in a handler. `isDoubles` lives on `match.start` (config `doubles` is the fallback for old logs).
- **Source of truth = the `matches` row in Supabase.** Meta (team names, players, tournament fields), format (sport_preset + config.gamesToWin), and theme choice (overlay_theme_id + scoreboard_theme_id) all live in the row and sync cross-device via Realtime UPDATE. `useMatchMeta`, `useFormat`, and `useThemeChoice` are the consumer composables — none of them write to localStorage.
- **IndexedDB (via `idb-keyval`) is used for:**
  - `sb:events:{matchId}` — the event log (offline-first per E1.11 — durable through tab crashes, no quota anxiety, async transactions). `useEvents` reads/writes through `layers/app-base/lib/eventStore.ts` and mirrors to Supabase + BroadcastChannel for cross-tab. **Do not** swap this for `useStorage` / localStorage — venue WiFi flakes and points must not be lost.
  - `sb:tombstones:{matchId}` — ids of events deleted on this device (undo). Reconcile and realtime handlers must never re-merge these, and the remote delete retries until a fetch confirms it's gone.
- **localStorage is used only for:**
  - `sb:control-layout:{matchId}` — per-device operator UI preference (`'stacked' | 'sideBySide'`). Not synced; each device picks its own.
  - `sb:dynamic:{dynamicId}` — v1 binding for `/d/{id}` dynamic URLs. ARCHITECTURE.md §6 moves this to a `dynamic_urls` table in v1.x.
  - `sb:last-format` — the last format picked on `/new` (sport, singles/doubles, preset, match length). Sticky per browser so a scorer running a bracket doesn't re-pick it every match; validated back against the preset registry on read.
  - `sb:recent-players` — MRU list (cap 20) of player names, offered as tappable suggestion chips under each name field on `/new`. Same club-evening rationale as `sb:last-format`, but names are only ever *suggested*, never prefilled into the fields. Two writers: `/new`'s `createMatch` (after the upsert succeeds) and `/m/[id]`'s `onMetaUpdate` (on Save in SettingsSheet, so a typo corrected there is offered corrected next time). Both must go through `namesInPlay` — partner slots count only in doubles, and each writer leaks phantom names in its own way otherwise. Device-local and never synced: it holds names the operator typed about third parties, so it stays off the server until there's an account-scoped roster to put it in (Phase 2, prerequisite for E2.4 head-to-head, which free-text names can't support). Long-press a chip — or focus it and press Delete/Backspace — to remove a name (undo toast, no confirm dialog) — without removal a mistyped name is permanent in practice, since a stable pool of ~8 regulars never generates the 12 further distinct names needed to evict it under the cap. Logic in `apps/app/lib/recent-players.ts`, bound in `useRecentPlayers`.
  - `sb:recent-players-hint` — boolean, set once the operator first removes a suggestion. Gates the "Long-press a name to remove it" caption under the first chip row, since the gesture is otherwise invisible.

  The chip row is one horizontally-scrolling line on every viewport: touch swipes it natively, and `PlayerChips` adds mouse-only drag-to-pan (a mouse can't otherwise pan a scroll container with the scrollbar hidden). The pan handlers bail on non-mouse pointers so native touch momentum isn't replaced by a worse hand-rolled copy, and on rows that don't overflow — arming the click-swallow there made an ordinary click with a few px of cursor drift silently do nothing. A `moved` flag swallows the trailing click in the capture phase, otherwise a drag ending on a chip would fill the field. Both the pan slop and `onLongPress`'s cancel threshold read `POINTER_SLOP_PX`; if they ever diverge again there's a band where a pan both swallows the tap and fires a removal.
  - `sb:render-anchors:{matchId}` — per-device video↔event sync anchors from `/m/[id]/render`; a map keyed by uploaded-file fingerprint (name+size) so switching files never stomps another recording's saved sync points, and a different recording starts clean instead of inheriting a stale mapping. Restored automatically when the same file is re-picked; device-local because the video file itself is.
  - `sb:court-color` — per-device mat color per sport (`{ badminton: 'blue', ... }`), picked from the palette menu on `/m/[id]/control`. Device-local like `sb:control-layout`: it changes how this operator's screen looks, never other scorers'. Variants live in `apps/app/lib/court-colors.ts`.
  - `sb:device-id` — stable per-browser ULID used for event provenance. Lives in localStorage (not IDB) because it must be read synchronously at module init.
  - `sb:theme` — color-mode user preference (light/dark/system), set by `@nuxtjs/color-mode`.
- **Theme resolution order** in overlay/scoreboard surfaces: `?theme=` query param → `useThemeChoice` (Supabase) → hardcoded baseline (`broadcast-classic` / `filmable`).
- **Event sync.** `useEvents` writes to IDB first → BroadcastChannel (same-device cross-tab) → fire-and-forget Supabase upsert (idempotent: `onConflict: 'id', ignoreDuplicates: true`). Subscribes to Realtime INSERT + DELETE for cross-device sync. Pending count (`localIds − remoteIds`) is reported to the global `useSyncStatus` store, surfaced as a pill in `AppHeader`. Reconciliation runs on mount, on `online` event, and every 10s while pending. **`/new` is the only writer that creates `matches` rows** — every other composable (`useMatchMeta`, `useFormat`, `useThemeChoice`) must use UPDATE, never upsert, so a viewer can't backfill a stub row and a partial payload can't stomp columns it doesn't own (a hardcoded `sport_preset` in an upsert once corrupted non-badminton matches on theme change).

### Pre-merge validation

- **Always run `pnpm --filter @sb/engine test`** after engine or registry changes — it covers every sport's rule set (BWF, ITTF incl. doubles order, USAP side-out, ITF/FIP point tiers and tiebreaks) + match-state events.
- **Boot the dev server and click the surface** for any UI change. Type checks and tests verify code correctness, not feature correctness.

## When in doubt

Ask one question at a time when scope is ambiguous. The user prefers incremental decisions over batched plans on architecture-level forks.
