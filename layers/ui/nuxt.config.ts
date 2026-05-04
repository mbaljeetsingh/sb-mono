// @sb/layer-ui — exposes shadcn-vue primitives.
// Apps extend this layer; components/ui auto-import via Nuxt.

export default defineNuxtConfig({
  components: [
    {
      path: "./components/ui",
      prefix: "Ui",
      pathPrefix: false,
    },
  ],
});
