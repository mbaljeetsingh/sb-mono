import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";

// Vitest config for `pnpm render-emails` — needs the Vue plugin so the
// `apps/app/emails/generate.test.ts` test can import `.vue` SFC templates
// and render them via `@vue-email/render`.
export default defineConfig({
  plugins: [vue()],
});
