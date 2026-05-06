<script setup lang="ts">
import { Play } from "lucide-vue-next";
import { Button } from "@sb/layer-ui/components/ui/button";

definePageMeta({ layout: false });

const route = useRoute();

const reasons = {
  expired: {
    title: "Match expired",
    body: "Anonymous matches are kept for 30 days. This one's been archived.",
  },
  deleted: {
    title: "Match deleted",
    body: "The owner deleted this match. There's no recovering it.",
  },
  bad: {
    title: "Match not found",
    body: "Double-check the URL — IDs are case-sensitive.",
  },
};

const reason = computed(() => {
  const r = String(route.query.reason ?? "bad") as keyof typeof reasons;
  return reasons[r] ?? reasons.bad;
});
</script>

<template>
  <div
    class="min-h-screen bg-background text-foreground font-sans flex flex-col items-center justify-center text-center px-6"
  >
    <div
      class="absolute top-16 left-6 font-bold text-2xl font-[var(--font-accent)]"
    >
      scoreboard
    </div>

    <div
      class="score text-[96px] text-border-strong leading-none tracking-tight mb-2"
    >
      404
    </div>
    <h1 class="text-2xl font-semibold tracking-tight mb-2">
      {{ reason.title }}
    </h1>
    <p class="text-fg-muted text-sm leading-relaxed max-w-xs mb-7">
      {{ reason.body }}
    </p>

    <div class="flex flex-col gap-2 w-full max-w-xs">
      <Button size="lg" class="h-11 font-semibold" @click="navigateTo('/new')">
        <Play class="size-4" />
        Start a new match
      </Button>
      <Button variant="ghost" @click="navigateTo('/')">Go to home</Button>
    </div>

    <div class="absolute bottom-8 text-[11px] text-fg-subtle">
      scoreboard.app
    </div>
  </div>
</template>
