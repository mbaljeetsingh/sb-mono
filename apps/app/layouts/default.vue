<script setup lang="ts">
import { Toaster } from "@sb/layer-ui/components/ui/sonner";
import AppHeader from "~/components/common/AppHeader.vue";
</script>

<template>
  <div class="flex min-h-screen flex-col bg-background text-foreground">
    <AppHeader />
    <main class="mx-auto w-full max-w-6xl flex-1 px-4 sm:px-6 lg:px-8">
      <slot />
    </main>
    <Toaster position="top-right" rich-colors />
  </div>
</template>
