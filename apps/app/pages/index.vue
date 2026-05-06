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
    class="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-3xl flex-col px-6 py-12"
  >
    <section class="flex flex-1 flex-col justify-center">
      <p class="mb-3 text-sm text-muted-foreground">{{ greeting }}</p>
      <h1 class="mb-3 text-[44px] font-semibold leading-[1.05] tracking-tight">
        A live scorecard for racquet sports.
      </h1>
      <p class="mb-8 text-[17px] leading-relaxed text-muted-foreground">
        Score from your phone. Show on OBS, a TV, or anywhere.
      </p>

      <div class="flex flex-wrap gap-3">
        <Button size="lg" class="h-12 px-6" @click="startMatch">
          Start a match
        </Button>
      </div>
    </section>
  </div>
</template>
