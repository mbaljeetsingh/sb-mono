<script setup lang="ts">
import AuthFeatures from "~/components/auth/AuthFeatures.vue";
import ThemeToggle from "~/components/common/ThemeToggle.vue";
</script>

<template>
  <div class="relative flex min-h-screen w-full flex-col md:flex-row">
    <div
      class="absolute top-[max(1rem,env(safe-area-inset-top))] right-[max(1rem,env(safe-area-inset-right))] z-50"
    >
      <ThemeToggle />
    </div>
    <AuthFeatures />
    <div
      class="flex flex-1 items-center justify-center pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]"
    >
      <div class="w-full max-w-md">
        <slot />
      </div>
    </div>
  </div>
</template>
