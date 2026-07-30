<script setup lang="ts">
import { Separator } from '@sb/layer-ui/components/ui/separator';
import AppLogo from '~/components/common/AppLogo.vue';
import NavUser from '~/components/common/NavUser.vue';
import SyncStatusPill from '~/components/common/SyncStatusPill.vue';
import ThemeToggle from '~/components/common/ThemeToggle.vue';
import { useUserStore } from '~/stores/user';

const userStore = useUserStore();
const route = useRoute();

const isMatchesActive = computed(
  () => route.path === '/matches' || route.path.startsWith('/matches/')
);
</script>

<template>
  <header
    class="sticky top-0 z-30 flex h-[calc(3.5rem+env(safe-area-inset-top))] w-full items-center justify-between border-b bg-background/80 pt-[env(safe-area-inset-top)] pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] sm:pl-[max(1rem,env(safe-area-inset-left))] sm:pr-[max(1rem,env(safe-area-inset-right))] backdrop-blur supports-[backdrop-filter]:bg-background/60"
  >
    <AppLogo link-to="/" size="md" />

    <div class="flex items-center gap-3">
      <SyncStatusPill />
      <NuxtLink
        to="/matches"
        class="hidden text-sm font-medium underline-offset-4 hover:text-foreground hover:underline md:inline"
        :class="isMatchesActive ? 'text-foreground' : 'text-fg-muted'"
        :aria-current="isMatchesActive ? 'page' : undefined"
      >
        Matches
      </NuxtLink>
      <Separator orientation="vertical" class="hidden h-5 md:block" />
      <template v-if="userStore.isAuthenticated">
        <NavUser />
      </template>
      <template v-else>
        <NuxtLink
          to="/auth/signin"
          class="hidden text-sm font-medium underline-offset-4 hover:underline md:inline"
        >
          Sign in
        </NuxtLink>
      </template>
      <ThemeToggle />
    </div>
  </header>
</template>
