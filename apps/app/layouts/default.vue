<script setup lang="ts">
import AppFooter from "~/components/common/AppFooter.vue";
import AppHeader from "~/components/common/AppHeader.vue";
</script>

<template>
  <div class="flex min-h-screen flex-col bg-background text-foreground">
    <AppHeader />
    <main
      class="mx-auto w-full max-w-6xl flex-1 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))] sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))] lg:pl-[max(2rem,env(safe-area-inset-left))] lg:pr-[max(2rem,env(safe-area-inset-right))]"
    >
      <slot />
    </main>
    <AppFooter />
  </div>
</template>
