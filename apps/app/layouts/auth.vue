<script setup lang="ts">
import { ArrowLeft } from 'lucide-vue-next';
import AuthFeatures from '~/components/auth/AuthFeatures.vue';
import ThemeToggle from '~/components/common/ThemeToggle.vue';
</script>

<template>
  <div class="relative flex min-h-screen w-full flex-col md:flex-row">
    <!-- Escape hatch — auth pages have no header/tab bar, so without this the
         only way back into the app is the browser back button. -->
    <NuxtLink
      to="/"
      class="absolute top-[max(1rem,env(safe-area-inset-top))] left-[max(1rem,env(safe-area-inset-left))] z-50 flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      <ArrowLeft class="size-4" />
      Back
    </NuxtLink>
    <div
      class="absolute top-[max(1rem,env(safe-area-inset-top))] right-[max(1rem,env(safe-area-inset-right))] z-50"
    >
      <ThemeToggle />
    </div>
    <AuthFeatures />
    <div
      class="flex flex-1 items-center justify-center pl-[max(1.5rem,env(safe-area-inset-left))] pr-[max(1.5rem,env(safe-area-inset-right))] pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] sm:pl-[max(1rem,env(safe-area-inset-left))] sm:pr-[max(1rem,env(safe-area-inset-right))]"
    >
      <div class="w-full max-w-md">
        <slot />
      </div>
    </div>
  </div>
</template>
