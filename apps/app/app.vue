<script setup lang="ts">
import "vue-sonner/style.css";
import { Toaster } from "@sb/layer-ui/components/ui/sonner";
import { TooltipProvider } from "@sb/layer-ui/components/ui/tooltip";

useHead({
  htmlAttrs: { lang: "en" },
});
</script>

<template>
  <TooltipProvider>
    <!-- Toaster lives at the root (not inside default layout) so layoutless
         scorer surfaces — control, overlay, scoreboard, saved, /d/*/overlay —
         can also show toasts for copy-to-clipboard, errors, etc. -->
    <Toaster
      position="top-right"
      rich-colors
      class="pointer-events-auto z-[9999]"
    />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </TooltipProvider>
</template>
