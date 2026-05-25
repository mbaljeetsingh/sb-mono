import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import { createRequire } from "node:module";

const appPkg = createRequire(import.meta.url)("./package.json");

// Vitest config for `pnpm render-emails` — needs the Vue plugin so the
// `apps/app/emails/generate.test.ts` test can import `.vue` SFC templates
// and render them via `@vue-email/render`. Mirrors nuxt.config.ts's
// `vite.define` so any future component test that imports AppLogo (which
// reads `__APP_VERSION__`) doesn't fail with a ReferenceError.
export default defineConfig({
  plugins: [vue()],
  define: {
    __APP_VERSION__: JSON.stringify(appPkg.version),
  },
});
