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

## Release

Native versions move only on store uploads, never with the web
`package.json`: iOS `MARKETING_VERSION` + `CURRENT_PROJECT_VERSION` (Xcode
project), Android `versionName` + `versionCode` (`android/app/build.gradle`).
Build number / versionCode must go up on every upload.

```bash
pnpm --filter @sb/mobile-native sync:app     # always: clean production bundle

# iOS: Product → Archive (scheme App, "Any iOS Device") → Distribute → App Store Connect
pnpm --filter @sb/mobile-native open:ios

# Android: signed AAB → Play Console
cd apps/mobile-native/android && JAVA_HOME=$(/usr/libexec/java_home -v 21) ./gradlew bundleRelease
# → app/build/outputs/bundle/release/app-release.aab
```

Release builds on both platforms refuse a bundle that isn't a production
native build (`verify-native-bundle` — Gradle task and Xcode run-script
phase), since neither path goes through `cap`. Android release builds also
refuse to run unsigned (`android/release-signing.gradle`): the upload
keystore lives outside the repo at
`~/.config/beejaysoft/keys/scoreboard-keystore.properties` (setup in
`android/keystore.properties.example`), so it survives worktrees.

Ship to TestFlight / Play internal testing first; real-device QA happens there.

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
- **Deep links** — `/m/*/control` and `/m/*/scoreboard` links on
  `scoreboard.beejaysoft.com` open the app when it's installed (iOS Universal
  Links, Android App Links), and the website otherwise. Claimed in
  `apps/app/public/.well-known/` (served by Netlify), `App.entitlements` and
  `AndroidManifest.xml`; routed by `deepLinkRoute()` in `apps/app/lib/native.ts`.
  Overlay and `/auth/*` links are deliberately left to the browser. iOS ignores
  Universal Links typed into Safari's address bar — test from Messages, Notes
  or a camera QR scan.
- **Splash** is held until the Nuxt app mounts (`plugins/native.client.ts`),
  which also matches status-bar icons to the color mode.

## Open items

- **Android deep-link fingerprint** — replace
  `PLAY_APP_SIGNING_SHA256_REPLACE_ME` in `apps/app/public/.well-known/assetlinks.json`
  with the Play App Signing key's SHA-256 (Play Console → App integrity; add
  the upload/debug key's too for sideloaded builds). Android links fall back to
  the website until then. iOS also needs Associated Domains enabled on the
  App ID in the Apple Developer portal.

- **Signing + store listings** — Apple team / provisioning, Play upload key.
  Signing material is gitignored; never commit it.
- **Social sign-in is out of scope for v1** — email/password only; Google and
  Apple buttons render disabled on both forms. Enabling them needs np-mono's
  `native-auth.ts` deep-link flow (`@capacitor/browser` +
  `com.beejaysoft.scoreboard://auth/callback`, allow-listed in Supabase).
- **Password reset** in the app opens the web `/auth/forgot-password` in the
  system browser: the PKCE verifier lives in the WebView, so a reset link
  (which opens in the browser) can only be completed if it started there.
- **Real-device QA** — keep-awake, keyboard resize on `/new`, landscape
  control layout, offline scoring through a venue WiFi drop.
