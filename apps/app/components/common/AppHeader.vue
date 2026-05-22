<script setup lang="ts">
import AppLogo from "~/components/common/AppLogo.vue";
import NavUser from "~/components/common/NavUser.vue";
import SyncStatusPill from "~/components/common/SyncStatusPill.vue";
import ThemeToggle from "~/components/common/ThemeToggle.vue";
import { Separator } from "@sb/layer-ui/components/ui/separator";
import { useUserStore } from "~/stores/user";

const userStore = useUserStore();
</script>

<template>
  <header
    class="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b bg-background/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60"
  >
    <AppLogo link-to="/" size="md" />

    <div class="flex items-center gap-3">
      <SyncStatusPill />
      <NuxtLink
        to="/matches"
        class="text-sm font-medium text-fg-muted underline-offset-4 hover:text-foreground hover:underline"
      >
        Matches
      </NuxtLink>
      <Separator orientation="vertical" class="h-5" />
      <template v-if="userStore.isAuthenticated">
        <NavUser />
      </template>
      <template v-else>
        <NuxtLink
          to="/auth/signin"
          class="text-sm font-medium underline-offset-4 hover:underline"
        >
          Sign in
        </NuxtLink>
      </template>
      <ThemeToggle />
    </div>
  </header>
</template>
