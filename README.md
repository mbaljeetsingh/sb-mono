# Scoreboard

Open-source live scorecards for badminton, tennis, pickleball, table tennis, and any racquet sport. Score from your phone courtside, show the overlay in OBS, Streamlabs, Streamyard, or fullscreen on a TV.

> **Status:** v1 in active development. Hosted at [scoreboard.baljeetsingh.in](https://scoreboard.baljeetsingh.in). See [docs/PRD.md](docs/PRD.md) and [docs/ROADMAP.md](docs/ROADMAP.md) for the plan.

## Design principles

- **Mobile-first control.** The scorekeeper is courtside on a phone, not at a streaming PC.
- **Offline-tolerant.** Every score tap writes to IndexedDB first, then syncs to Supabase. Venue WiFi can flake and you won't lose a point.
- **Event-sourced.** State is computed by replaying events. Free undo, free history, free video burn-in later.
- **Sport rules as data, not code.** Adding a sport is a config file, not a fork.
- **Themes are plain HTML + CSS.** Anyone can write one. No build step required.

## What's inside

| Surface | Path | Use |
| --- | --- | --- |
| Control | `/m/[id]/control` | Phone-friendly tap-to-score |
| Overlay | `/m/[id]/overlay` | Transparent OBS Browser Source |
| Scoreboard | `/m/[id]/scoreboard` | Full-screen TV view |
| Dynamic overlay | `/d/[id]/overlay` | Stable URL that swaps between matches |
| Tournament ticker | `/t/[id]/overlay` | Court-by-court current scores |

Stack: Nuxt 4 · Vue 3 · TypeScript · Tailwind v4 · shadcn-vue · Supabase (Postgres + Auth + Realtime + Storage) · pnpm workspaces · Turbo.

## Self-host

Scoreboard is MIT-licensed and self-hostable. Two pieces:

1. **Supabase project** — for database, auth, and realtime sync. You can use [supabase.com](https://supabase.com) (free tier works) or [self-host Supabase](https://supabase.com/docs/guides/self-hosting).
2. **The Nuxt app** — any static host that supports SSR-disabled Nuxt builds. Netlify, Vercel, Cloudflare Pages, your own VPS — all work.

### Quick deploy

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/mbaljeetsingh/sb-mono)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/mbaljeetsingh/sb-mono&project-name=scoreboard&repository-name=scoreboard)

After deploying, set the environment variables in your host's dashboard:

```
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_KEY=YOUR-ANON-KEY
```

Then run the migrations against your Supabase project (see [Setup](#setup) below).

### Setup (local dev or self-host)

```bash
# 1. Clone + install
git clone https://github.com/mbaljeetsingh/sb-mono.git
cd sb-mono
pnpm install

# 2. Create a Supabase project at supabase.com (or start a local one with `supabase start`)
#    Copy the project URL + anon key.

# 3. Configure env
cp apps/app/.env.example apps/app/.env
# edit SUPABASE_URL and SUPABASE_KEY

# 4. Apply migrations to your Supabase project
supabase link --project-ref YOUR-PROJECT-REF
supabase db push

# 5. Run
pnpm --filter @sb/app dev
```

The app boots at `http://localhost:3000`.

### Supabase Cloud one-time activations

The hosted Scoreboard relies on two Supabase features that need to be enabled in the dashboard:

- **`pg_cron` extension** — Dashboard → Database → Extensions → enable `pg_cron`. Drives the empty-match cleanup job (matches with zero events are deleted after a short window).
- **Custom Access Token hook** — Dashboard → Authentication → Hooks → set "Custom Access Token" to the `custom_access_token_hook` Postgres function (created by the migrations). Injects the `user_role` JWT claim used by RLS.

## OBS / Streamlabs

The overlay surface is designed to be dropped into OBS as a **Browser Source**:

- Width 1920, Height 1080
- URL: the overlay link from the in-app share dialog
- Custom CSS: empty
- Transparency is baked into the overlay themes

A full setup guide with screenshots is on the roadmap (E1.37).

## Inspired by

[OpenScoreboard](https://github.com/jackbmccarthy/OpenScoreboard) by Jack McCarthy — for the dynamic-URL pattern and proving real broadcasters use OSS scoring tools.

## Docs

- [PRD](docs/PRD.md) — surface inventory + behavior specs
- [BRD](docs/BRD.md) — business goals + locked decisions
- [Architecture](docs/ARCHITECTURE.md) — technical structure, threat model, data flow
- [Roadmap](docs/ROADMAP.md) — phase / epic sequencing

## License

**Code:** MIT — see [LICENSE](./LICENSE). Fork it, self-host it, build on it.

**Brand assets:** The "Scoreboard" name, the Scoreboard logo, and the visual identity of the hosted product at scoreboard.baljeetsingh.in are **not** covered by the MIT license. They are © BeeJaySoft, all rights reserved. If you self-host or fork, please use your own name and logo to avoid confusion.

**Premium theme packs** (when they ship) are sold as content, not source. The code that loads them is MIT; the theme files themselves are commercial assets.
