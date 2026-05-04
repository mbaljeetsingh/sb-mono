// @sb/layer-app-base — shared modules, composables, stores, theme.
// Apps extend this layer.

export default defineNuxtConfig({
  modules: ["@pinia/nuxt", "@vueuse/nuxt"],
  css: ["@sb/layer-app-base/assets/theme.css"],
  imports: {
    dirs: ["composables", "stores"],
  },
});
