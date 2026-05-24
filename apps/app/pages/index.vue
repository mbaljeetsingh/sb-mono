<script setup lang="ts">
import { computed } from "vue";
import { Button } from "@sb/layer-ui/components/ui/button";
import { useUserStore } from "~/stores/user";

useSeoMeta({ title: "Scoreboard" });

const userStore = useUserStore();
const startMatch = () => navigateTo("/new");

const greeting = computed(() => {
  const name = userStore.currentUser?.profile?.display_name;
  return name ? `Welcome back, ${name}` : "Welcome back";
});
</script>

<template>
  <div
    class="mx-auto flex min-h-[calc(100dvh-3.5rem-3.5rem)] max-w-3xl flex-col items-center justify-center px-6 text-center md:min-h-[calc(100dvh-3.5rem)]"
  >
    <p class="mb-3 text-sm text-muted-foreground">{{ greeting }}</p>
    <h1 class="mb-3 text-[44px] font-semibold leading-[1.05] tracking-tight">
      A live scorecard for racquet sports.
    </h1>
    <p class="mb-8 text-[17px] leading-relaxed text-muted-foreground">
      Score from your phone. Show on OBS, a TV, or anywhere.
    </p>

    <Button size="lg" class="h-12 px-6" @click="startMatch">
      Start a match
    </Button>
  </div>
</template>
