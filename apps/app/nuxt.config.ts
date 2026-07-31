// @sb/app — the operator-facing PWA hosting control / overlay / scoreboard surfaces.
// Extends shared layers: app-base (theme, composables, stores) + ui (shadcn-vue primitives).

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';

const appPkg = createRequire(import.meta.url)('./package.json');

export default defineNuxtConfig({
  extends: ['../../layers/app-base', '../../layers/ui'],
  modules: [
    '@nuxtjs/supabase',
    'shadcn-nuxt',
    '@vite-pwa/nuxt',
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
    redirect: false,
    redirectOptions: {
      login: '/auth/signin',
      callback: '/auth/callback',
    },
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
      environment: 'development',
      posthogKey: '',
    },
  },
  compatibilityDate: '2024-10-01',
});
