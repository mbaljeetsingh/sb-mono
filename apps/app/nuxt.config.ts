// Nuxt 3 config for @scoreboard/app — the PWA that hosts control / overlay / scoreboard surfaces.

export default defineNuxtConfig({
  modules: ["@nuxtjs/tailwindcss", "@vueuse/nuxt", "@pinia/nuxt"],
  devtools: { enabled: true },
  ssr: false, // SPA: matches/events live behind unique IDs; SSR adds zero value here.
  typescript: { strict: true, typeCheck: false },
  app: {
    head: {
      title: "Scoreboard",
      meta: [
        {
          name: "viewport",
          content:
            "width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover",
        },
        { name: "theme-color", content: "#0f172a" },
        { name: "mobile-web-app-capable", content: "yes" },
        { name: "apple-mobile-web-app-capable", content: "yes" },
        {
          name: "apple-mobile-web-app-status-bar-style",
          content: "black-translucent",
        },
      ],
    },
  },
  runtimeConfig: {
    public: {
      supabaseUrl: process.env.NUXT_PUBLIC_SUPABASE_URL ?? "",
      supabaseAnonKey: process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    },
  },
  compatibilityDate: "2024-10-01",
});
