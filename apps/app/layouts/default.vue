<script setup lang="ts">
import AppFooter from "~/components/common/AppFooter.vue";
import AppHeader from "~/components/common/AppHeader.vue";
import MobileTabBar from "~/components/common/MobileTabBar.vue";
</script>

<template>
  <div class="flex min-h-screen flex-col bg-background text-foreground">
    <AppHeader />
    <main
      class="mx-auto w-full max-w-6xl flex-1 pl-[max(0.375rem,env(safe-area-inset-left))] pr-[max(0.375rem,env(safe-area-inset-right))] pb-[calc(3.5rem+env(safe-area-inset-bottom))] sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))] md:pb-[max(0.375rem,env(safe-area-inset-bottom))] lg:pl-[max(2rem,env(safe-area-inset-left))] lg:pr-[max(2rem,env(safe-area-inset-right))]"
    >
      <slot />
    </main>
    <AppFooter class="hidden md:block" />
    <MobileTabBar />
  </div>
</template>
