# @sb/mobile-native

Capacitor 8 shell that wraps `apps/app` for the App Store and Play Store
(ROADMAP E2.9). No Vue code lives here — `apps/app` is the product; this
package holds only the native projects and the tooling that builds them.
Modeled on `~/Code/np-mono/apps/mobile-native`, single-brand.

| | |
|---|---|
| Bundle / application id | `com.beejaysoft.scoreboard` (permanent after first store upload) |
| iOS project | `ios/App/App.xcodeproj` (Swift Package Manager, no CocoaPods) |
| Android project | `android/` (JDK 21) |

## Workflow

The web bundle and the native copy must move together — `cap sync` copies
whatever `apps/app/.output/public` currently holds. Use the paired script:

```bash
pnpm --filter @sb/mobile-native sync:app       # NUXT_NATIVE=1 build → cap sync
pnpm --filter @sb/mobile-native open:ios       # then ⌘R in Xcode
pnpm --filter @sb/mobile-native open:android
```

`capacitor.config.ts` refuses to sync a web build or a bundle pointed at a
local Supabase (checked via the `native-build.json` stamp). For an on-device
loop against local Supabase, build with `NATIVE_DEV=1` on both steps.

Icons and splash come from `assets/` (`pnpm assets` regenerates them). The
current sources were upscaled from the 512px PWA icon — replace
`assets/icon-*.png` and `splash*.png` with 1024px / 2732px masters before
submission.

## How the native build differs from web

`NUXT_NATIVE=1` is an additive branch in `apps/app/nuxt.config.ts`:

- `nitro.preset: 'static'` → `.output/public` is a plain SPA bundle.
- `@vite-pwa/nuxt` dropped — assets are in the binary; WKWebView can't
  register a service worker on `capacitor://` anyway.
- `supabase.useSsrCookies: false` — the cookie session doesn't survive a cold
  start on `capacitor://`; localStorage does.
- Production Supabase / PostHog / app URL baked from `apps/app/native-env.ts`,
  written straight into the config with `nitro.envPrefix` moved off `NUXT_`,
  because dotenv re-applies `apps/app/.env` (local Supabase) after the config
  is evaluated.
- `__NUXT_NATIVE__` (read via `isNativePlatform()`) gates every
  `@capacitor/*` import, so the web bundle stays Capacitor-free.

`NUXT_NATIVE` / `NATIVE_DEV` are in `turbo.json`'s `globalEnv` so turbo never
serves a cached web build for the native task.

## App behavior in the shell

- **Shareable URLs** (overlay, scoreboard, control, QR codes, auth emails) use
  `publicOrigin()` → `https://scoreboard.beejaysoft.com`. The WebView's own
  origin is the phone itself, useless to OBS on another machine.
- **Screen stays on** on `/m/[id]/control` and `/m/[id]/scoreboard` via
  `@capacitor-community/keep-awake` (OS idle-timer flag), through
  `useKeepAwake()`. On web the same composable uses the Wake Lock API and
  re-acquires on every tap / visibility change.
- **Splash** is held until the Nuxt app mounts (`plugins/native.client.ts`),
  which also matches status-bar icons to the color mode.

## Open items

- **Signing + store listings** — Apple team / provisioning, Play upload key.
  Signing material is gitignored; never commit it.
- **Social sign-in is out of scope for v1** — email/password only. Adding
  Google means adding Sign in with Apple too (App Store 4.8), plus np-mono's
  `native-auth.ts` deep-link flow (`@capacitor/browser` +
  `com.beejaysoft.scoreboard://auth/callback`, allow-listed in Supabase).
- **In-app account deletion** — required by App Store 5.1.1(v) for any app
  that lets users create accounts; not built yet.
- **Real-device QA** — keep-awake, keyboard resize on `/new`, landscape
  control layout, offline scoring through a venue WiFi drop.
