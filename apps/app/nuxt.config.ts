// @sb/app — the operator-facing PWA hosting control / overlay / scoreboard surfaces.
// Extends shared layers: app-base (theme, composables, stores) + ui (shadcn-vue primitives).

import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import { NATIVE_ENV } from './native-env';

const appPkg = createRequire(import.meta.url)('./package.json');

// Native (Capacitor) build target — `NUXT_NATIVE=1 nuxt generate` emits the
// static bundle apps/mobile-native wraps for the App Store / Play Store.
// Additive: unset, everything below is the Netlify web build unchanged.
const isNative = process.env.NUXT_NATIVE === '1';
// NATIVE_DEV=1 keeps the .env (local Supabase) backend for an on-device dev
// loop. Never for a store build — capacitor.config.ts refuses to sync one.
const isNativeDev = process.env.NATIVE_DEV === '1';

// apps/app/.env points at the local stack, and a bundle built from it ships
// as an app with no data. So a native build resolves its backend here, once:
// any dev-shaped value is replaced with the production one from
// native-env.ts, while a real override (CI, staging) passes through. The
// result is written straight into the config below — NOT back into
// process.env, because dotenv re-applies .env after this file is evaluated
// and the NUXT_* runtime override would bake the local URL right back in
// (that's what the first build here did). See `nitro.envPrefix` below.
const isDevShaped = (value: string | undefined) =>
  !value || /localhost|127\.0\.0\.1|10\.0\.2\.2/.test(value);
const nativeEnv = Object.fromEntries(
  Object.entries(NATIVE_ENV).map(([key, value]) => [
    key,
    isNativeDev || !isDevShaped(process.env[key])
      ? (process.env[key] ?? value)
      : value,
  ])
) as Record<keyof typeof NATIVE_ENV, string>;
// URL and key are a pair: a local publishable key has no loopback host to
// detect, so if the URL resolved to production the key must too — prod URL +
// local key 401s every request with no visible error.
if (
  nativeEnv.NUXT_PUBLIC_SUPABASE_URL === NATIVE_ENV.NUXT_PUBLIC_SUPABASE_URL
) {
  nativeEnv.NUXT_PUBLIC_SUPABASE_KEY = NATIVE_ENV.NUXT_PUBLIC_SUPABASE_KEY;
}
// A dev-loop build must never report into production analytics: the shell
// skips posthog.client.ts's localhost guard (its origin is always localhost),
// so the only thing standing between emulator taps and prod PostHog is the
// key. Use .env's (usually empty) instead of falling back to production's.
if (isNativeDev) {
  nativeEnv.NUXT_PUBLIC_POSTHOG_KEY = process.env.NUXT_PUBLIC_POSTHOG_KEY ?? '';
}

export default defineNuxtConfig({
  extends: ['../../layers/app-base', '../../layers/ui'],
  modules: [
    '@nuxtjs/supabase',
    'shadcn-nuxt',
    // No service worker in the shell: every asset is already in the binary,
    // and WKWebView refuses SW registration on capacitor:// anyway.
    ...(isNative ? [] : ['@vite-pwa/nuxt']),
    '@nuxtjs/color-mode',
  ],
  // Dark-mode handling. Broadcast surfaces (scoreboard / overlay / control)
  // opt out per-page via `definePageMeta({ colorMode: 'light' })` so the
  // user's preference never tints an OBS feed or venue TV.
  // Dark is the default: operators score in dim halls and evening leagues, and
  // OBS users composite against dark scenes. `system` still wins when the OS
  // states a preference; `dark` only decides the no-preference case. Users who
  // already picked light keep it (stored in sb:theme).
  colorMode: {
    classSuffix: '',
    storageKey: 'sb:theme',
    preference: 'system',
    fallback: 'dark',
  },
  devtools: { enabled: true },
  // Under portless (dev), PORT is injected (random 4xxx) and wins; otherwise the
  // base port. portless serves the app at a stable https://sb-app.localhost URL
  // (branch-prefixed in git worktrees, e.g. https://my-branch.sb-app.localhost).
  devServer: { port: Number(process.env.PORT) || 3000 },
  // Some shadcn-vue components in `layers/ui` import via the bare path
  // `layers/ui/components/ui/...` (a quirk of the shadcn-vue --cwd behavior
  // when the components live inside a Nuxt layer). Map that to the real
  // filesystem path so we don't have to edit the generated component files.
  alias: {
    'layers/ui': fileURLToPath(new URL('../../layers/ui', import.meta.url)),
    // Self-reference: layer components import their own package by name
    // (`@sb/layer-ui/lib/utils`). pnpm doesn't link a package into its own
    // node_modules and the layer has no `exports` map, so without this alias
    // vue-tsc can't resolve those imports (Vite resolves them from the app's
    // node_modules and doesn't care).
    '@sb/layer-ui': fileURLToPath(new URL('../../layers/ui', import.meta.url)),
  },
  // SPA mode — matches/events live behind unique IDs; SSR adds zero value here.
  ssr: false,
  typescript: { strict: true, typeCheck: false },
  css: ['@sb/layer-ui/assets/index.css'],
  vite: {
    // @tailwindcss/vite bundles its own vite Plugin type, which TS treats as
    // distinct from Nuxt's — runtime-identical, so bridge with a cast
    // (through nuxt/schema since `vite` itself isn't a declared dep here).
    plugins: [
      tailwindcss(),
    ] as unknown as import('nuxt/schema').ViteConfig['plugins'],
    // Pre-bundle heavy client deps so cold dev starts don't hit "Outdated
    // Optimize Dep" 504s / mid-session reloads when Vite discovers them late.
    optimizeDeps: {
      include: [
        // Reached only behind isNativePlatform(); listed so Vite doesn't
        // discover them lazily and re-optimise mid-session (np-mono saw that
        // reload bundle a second vue-router instance and kill app init).
        '@capacitor-community/keep-awake',
        '@capacitor/core',
        '@capacitor/splash-screen',
        'idb-keyval',
        'lucide-vue-next',
        'modern-screenshot',
        'mp4-muxer',
        'mp4box',
        'posthog-js',
        'qrcode.vue',
        'ulid',
        'vue-sonner',
      ],
    },
    define: {
      __APP_VERSION__: JSON.stringify(appPkg.version),
      // Build-target constants, not runtime detection — see lib/native.ts.
      __NUXT_NATIVE__: JSON.stringify(isNative),
      __PUBLIC_APP_URL__: JSON.stringify(
        isNative ? nativeEnv.NUXT_PUBLIC_APP_URL : ''
      ),
    },
  },
  // shadcn-vue: no prefix, no auto-import. Components are imported explicitly:
  //   import { Button } from "@sb/layer-ui/components/ui/button"
  // componentDir is still set so the shadcn CLI knows where to drop new components.
  shadcn: {
    prefix: '',
    componentDir: '../../layers/ui/components/ui',
  },
  components: [
    // Auto-import only app-local components (apps/app/components/**).
    // Layer UI components are imported explicitly per-file.
    { path: '~/components', pathPrefix: false },
  ],
  app: {
    head: {
      title: 'Scoreboard',
      meta: [
        {
          name: 'viewport',
          content:
            'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover',
        },
        { name: 'theme-color', content: '#0d1b4a' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        {
          name: 'apple-mobile-web-app-status-bar-style',
          content: 'black-translucent',
        },
        // Link previews. Without these, every share of a scoreboard URL
        // renders as a bare card with just the domain.
        {
          name: 'description',
          content:
            'Live scorecards for badminton, tennis, pickleball and table tennis. Score from your phone courtside and show the overlay in OBS, Streamlabs or full screen on a TV.',
        },
        { property: 'og:type', content: 'website' },
        { property: 'og:site_name', content: 'Scoreboard' },
        {
          property: 'og:title',
          content: 'Scoreboard — live scorecards for racquet sports',
        },
        {
          property: 'og:description',
          content:
            'Score from your phone courtside. Show the overlay in OBS, Streamlabs or full screen on a TV. Free and open source, no sign-up needed.',
        },
        { property: 'og:url', content: 'https://scoreboard.beejaysoft.com/' },
        {
          property: 'og:image',
          content: 'https://scoreboard.beejaysoft.com/og-image.png',
        },
        { property: 'og:image:width', content: '1200' },
        { property: 'og:image:height', content: '630' },
        {
          property: 'og:image:alt',
          content: 'Scoreboard — a live scorecard for racquet sports',
        },
        { name: 'twitter:card', content: 'summary_large_image' },
        {
          name: 'twitter:title',
          content: 'Scoreboard — live scorecards for racquet sports',
        },
        {
          name: 'twitter:description',
          content:
            'Score from your phone courtside. Show the overlay in OBS, Streamlabs or full screen on a TV.',
        },
        {
          name: 'twitter:image',
          content: 'https://scoreboard.beejaysoft.com/og-image.png',
        },
      ],
      link: [
        { rel: 'icon', type: 'image/png', href: '/favicon.png' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      ],
    },
  },
  // Supabase Auth — anonymous-OK app (Option A). Auth is optional and unlocks ownership;
  // anonymous scoring works against the same DB via permissive RLS for owner_id IS NULL.
  // Middleware handles redirects, not the module's built-in redirect.
  supabase: {
    ...(isNative
      ? {
          url: nativeEnv.NUXT_PUBLIC_SUPABASE_URL,
          key: nativeEnv.NUXT_PUBLIC_SUPABASE_KEY,
        }
      : {}),
    redirect: false,
    redirectOptions: {
      login: '/auth/signin',
      callback: '/auth/callback',
    },
    // Native: the session cookie doesn't survive a cold start on
    // capacitor://, so the shell came back signed out. `false` switches to
    // localStorage-backed storage, which persists in the WebView. A plain
    // createClient defaults to the implicit flow, so pin PKCE explicitly
    // (web's browser client forces PKCE regardless).
    useSsrCookies: !isNative,
    clientOptions: { auth: { flowType: 'pkce' } },
    cookieOptions: {
      maxAge: 60 * 60 * 24 * 30, // 30 days
      sameSite: 'lax' as const, // PKCE requires lax for top-level cross-site OAuth redirects
      secure: process.env.NODE_ENV === 'production',
    },
    // Generated schema types (pnpm supabase:types → packages/shared). Gives
    // every useSupabaseClient() call typed tables instead of `unknown`.
    types: fileURLToPath(
      new URL('../../packages/shared/src/types/supabase.ts', import.meta.url)
    ),
  },
  pwa: {
    registerType: 'autoUpdate',
    includeAssets: ['favicon.png', 'apple-touch-icon.png', 'icon.svg'],
    manifest: {
      name: 'Scoreboard',
      short_name: 'Scoreboard',
      description: 'Live scorecards for racquet sports.',
      theme_color: '#0d1b4a',
      background_color: '#ffffff',
      display: 'standalone',
      orientation: 'any',
      id: '/',
      start_url: '/',
      categories: ['sports', 'productivity'],
      icons: [
        {
          src: '/pwa-64x64.png',
          sizes: '64x64',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: '/pwa-192x192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: '/pwa-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: '/maskable-icon-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
        {
          src: '/apple-touch-icon.png',
          sizes: '180x180',
          type: 'image/png',
          purpose: 'any',
        },
      ],
    },
    workbox: {
      navigateFallback: '/',
      globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
    },
    devOptions: { enabled: false },
  },
  runtimeConfig: {
    public: {
      environment: isNative ? nativeEnv.NUXT_PUBLIC_ENVIRONMENT : 'development',
      posthogKey: isNative ? nativeEnv.NUXT_PUBLIC_POSTHOG_KEY : '',
    },
    // Native: the values above are final. Moving the env-override prefix off
    // NUXT_ stops apps/app/.env's NUXT_PUBLIC_* from replacing them when the
    // static bundle is prerendered.
    ...(isNative ? { nitro: { envPrefix: 'SB_NATIVE_UNUSED_' } } : {}),
  },
  // Native: a plain static SPA bundle for Capacitor's webDir, plus a stamp
  // capacitor.config.ts checks so a web build (or a dev-backend build) can
  // never be synced into the store app by accident.
  ...(isNative
    ? {
        nitro: { preset: 'static' },
        hooks: {
          'nitro:build:public-assets'(nitro: {
            options: { output: { publicDir: string } };
          }) {
            const dir = nitro.options.output.publicDir;
            mkdirSync(dir, { recursive: true });
            writeFileSync(
              `${dir}/native-build.json`,
              JSON.stringify({
                native: true,
                version: appPkg.version,
                supabaseUrl: nativeEnv.NUXT_PUBLIC_SUPABASE_URL,
              })
            );
          },
        },
      }
    : {}),
  compatibilityDate: '2024-10-01',
});
