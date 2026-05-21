// @sb/app — the operator-facing PWA hosting control / overlay / scoreboard surfaces.
// Extends shared layers: app-base (theme, composables, stores) + ui (shadcn-vue primitives).

import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
  extends: ["../../layers/app-base", "../../layers/ui"],
  modules: [
    "@nuxtjs/supabase",
    "shadcn-nuxt",
    // "@vite-pwa/nuxt", // Disabled for now — install-prompt UX and final
    // icon set will be revisited closer to launch. See pwa config below.
    "@nuxtjs/color-mode",
  ],
  // Dark-mode handling. Broadcast surfaces (scoreboard / overlay / control)
  // opt out per-page via `definePageMeta({ colorMode: 'light' })` so the
  // user's preference never tints an OBS feed or venue TV.
  colorMode: {
    classSuffix: "",
    storageKey: "sb:theme",
    preference: "system",
    fallback: "light",
  },
  devtools: { enabled: true },
  // Some shadcn-vue components in `layers/ui` import via the bare path
  // `layers/ui/components/ui/...` (a quirk of the shadcn-vue --cwd behavior
  // when the components live inside a Nuxt layer). Map that to the real
  // filesystem path so we don't have to edit the generated component files.
  alias: {
    "layers/ui": fileURLToPath(new URL("../../layers/ui", import.meta.url)),
  },
  // SPA mode — matches/events live behind unique IDs; SSR adds zero value here.
  ssr: false,
  typescript: { strict: true, typeCheck: false },
  css: ["@sb/layer-ui/assets/index.css"],
  vite: {
    plugins: [tailwindcss()],
  },
  // shadcn-vue: no prefix, no auto-import. Components are imported explicitly:
  //   import { Button } from "@sb/layer-ui/components/ui/button"
  // componentDir is still set so the shadcn CLI knows where to drop new components.
  shadcn: {
    prefix: "",
    componentDir: "../../layers/ui/components/ui",
  },
  components: [
    // Auto-import only app-local components (apps/app/components/**).
    // Layer UI components are imported explicitly per-file.
    { path: "~/components", pathPrefix: false },
  ],
  app: {
    head: {
      title: "Scoreboard",
      meta: [
        {
          name: "viewport",
          content:
            "width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover",
        },
        { name: "theme-color", content: "#0d1b4a" },
        { name: "mobile-web-app-capable", content: "yes" },
        { name: "apple-mobile-web-app-capable", content: "yes" },
        {
          name: "apple-mobile-web-app-status-bar-style",
          content: "black-translucent",
        },
      ],
      link: [
        { rel: "icon", type: "image/png", href: "/favicon.png" },
        { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      ],
    },
  },
  // Supabase Auth — anonymous-OK app (Option A). Auth is optional and unlocks ownership;
  // anonymous scoring works against the same DB via permissive RLS for owner_id IS NULL.
  // Middleware handles redirects, not the module's built-in redirect.
  supabase: {
    redirect: false,
    redirectOptions: {
      login: "/auth/signin",
      callback: "/auth/callback",
    },
    cookieOptions: {
      maxAge: 60 * 60 * 24 * 30, // 30 days
      sameSite: "lax" as const, // PKCE requires lax for top-level cross-site OAuth redirects
      secure: process.env.NODE_ENV === "production",
    },
    // Disable the auto-typed-Database expectation. We don't ship generated types yet;
    // supabase calls fall back to `Database = unknown`, which is fine for v1.
    types: false,
  },
  // PWA disabled for now — re-enable once the install-prompt UX + final
  // icon set (favicon + maskable 192/512 from logo.png) are ready.
  // pwa: {
  //   registerType: "autoUpdate",
  //   manifest: {
  //     name: "Scoreboard",
  //     short_name: "Scoreboard",
  //     description: "Live scorecards for racquet sports.",
  //     theme_color: "#0d1b4a",
  //     background_color: "#ffffff",
  //     display: "standalone",
  //     orientation: "any",
  //     icons: [
  //       { src: "/logo.png", sizes: "any", type: "image/png" },
  //     ],
  //   },
  //   workbox: {
  //     navigateFallback: "/",
  //     globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
  //   },
  //   devOptions: { enabled: false },
  // },
  compatibilityDate: "2024-10-01",
});
