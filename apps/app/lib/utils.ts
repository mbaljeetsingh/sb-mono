// Re-export `cn` so shadcn-vue components in layers/ui that import the
// canonical `@/lib/utils` path resolve correctly without modifying the layer.
// Same pattern np-mono documents in its CLAUDE.md ("Exception: app/lib/utils.ts
// must exist as a re-export of cn because layers/ui shadcn components resolve
// @/lib/utils via Nuxt's alias").
export { cn } from "@sb/layer-ui/lib/utils";
