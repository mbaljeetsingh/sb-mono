<script setup lang="ts">
import { useClipboard, useStorage } from "@vueuse/core";
import { Clipboard, X } from "lucide-vue-next";
import { toast } from "vue-sonner";
import { Button } from "@sb/layer-ui/components/ui/button";

definePageMeta({ layout: false });

const route = useRoute();
const matchId = computed(() => String(route.params.id ?? ""));

// Reactive read of match metadata via useStorage — same pattern every other
// surface uses, no manual JSON.parse boilerplate.
const meta = useStorage<{
  teamNames?: { a: string; b: string };
  sport?: string;
  sportPreset?: string;
} | null>(
  computed(() => `sb:meta:${matchId.value}`),
  null,
);

const sportLabel = computed(() =>
  (meta.value?.sport ?? "badminton").toUpperCase(),
);

const result = useStorage<{ a: number; b: number }[] | null>(
  computed(() => `sb:result:${matchId.value}`),
  null,
);

const winner = computed(() => {
  if (!result.value) return null;
  let a = 0;
  let b = 0;
  for (const g of result.value) {
    if (g.a > g.b) a++;
    else if (g.b > g.a) b++;
  }
  return {
    aWon: a > b,
    score: a > b ? `${a}–${b}` : `${b}–${a}`,
  };
});

const shareUrl = computed(() => {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/m/${matchId.value}/scoreboard`;
});

const { copy: clipboardCopy } = useClipboard({ legacy: true });
const copy = async (text: string, label = "Link") => {
  await clipboardCopy(text);
  toast.success(`${label} copied`);
};
</script>

<template>
  <div
    class="min-h-screen bg-background text-foreground font-sans flex flex-col"
  >
    <header class="px-4 pt-16 pb-2 flex items-center justify-between">
      <span class="size-9" />
      <span class="font-semibold">Saved</span>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Close"
        @click="navigateTo('/')"
      >
        <X class="size-4" />
      </Button>
    </header>

    <main class="flex-1 px-6 pt-6 text-center">
      <div
        class="size-14 rounded-full mx-auto mb-3.5 inline-flex items-center justify-center bg-success-soft text-success text-2xl"
      >
        ✓
      </div>
      <h1 class="text-[22px] font-semibold tracking-tight mb-2">
        Result saved
      </h1>
      <p
        v-if="meta && winner"
        class="text-sm text-fg-muted mb-7 max-w-xs mx-auto"
      >
        <strong class="text-foreground">{{
          winner.aWon ? meta.teamNames.a : meta.teamNames.b
        }}</strong>
        won {{ winner.score }}.
      </p>

      <!-- Result card preview -->
      <div
        v-if="meta && result"
        class="bg-neutral-950 text-neutral-50 rounded-2xl p-6 mb-6 text-left max-w-md mx-auto"
      >
        <div class="flex justify-between items-baseline mb-4">
          <span
            class="text-[10px] tracking-[0.16em] font-bold text-neutral-400"
          >
            FINAL · {{ sportLabel }} · BO{{ result?.length ?? 3 }}
          </span>
          <span class="text-[10px] font-bold tracking-[0.16em] text-amber-400">
            ★ FINISHED
          </span>
        </div>
        <div class="flex justify-between items-end mb-4">
          <div>
            <div
              v-if="winner?.aWon"
              class="text-[10px] font-bold text-amber-400 tracking-[0.18em] mb-1"
            >
              ★ WINNER
            </div>
            <div class="text-[20px] font-semibold tracking-tight">
              {{ meta.teamNames.a }}
            </div>
          </div>
          <span
            class="score text-[68px]"
            :class="winner?.aWon ? 'text-neutral-50' : 'text-neutral-600'"
            >{{ result.filter((g) => g.a > g.b).length }}</span
          >
        </div>
        <div class="flex justify-between items-end mb-4">
          <div>
            <div
              v-if="!winner?.aWon"
              class="text-[10px] font-bold text-amber-400 tracking-[0.18em] mb-1"
            >
              ★ WINNER
            </div>
            <div
              class="text-lg font-medium"
              :class="winner?.aWon ? 'text-neutral-400' : 'text-neutral-50'"
            >
              {{ meta.teamNames.b }}
            </div>
          </div>
          <span
            class="score text-[48px]"
            :class="!winner?.aWon ? 'text-neutral-50' : 'text-neutral-600'"
            >{{ result.filter((g) => g.b > g.a).length }}</span
          >
        </div>
        <div class="flex gap-2 mb-3">
          <div
            v-for="(g, i) in result"
            :key="i"
            class="px-3 py-2 rounded-md bg-neutral-900 font-mono text-sm font-semibold tabular-nums flex gap-2 items-baseline"
          >
            <span
              class="text-[9px] text-neutral-500 font-bold tracking-widest self-center"
            >
              G{{ i + 1 }}
            </span>
            <span :class="g.a > g.b ? 'text-neutral-50' : 'text-neutral-500'">{{
              g.a
            }}</span>
            <span class="text-neutral-500">–</span>
            <span :class="g.b > g.a ? 'text-neutral-50' : 'text-neutral-500'">{{
              g.b
            }}</span>
          </div>
        </div>
        <div
          class="flex justify-between items-center text-xs text-neutral-500 tracking-wide"
        >
          <span class="font-mono"
            >scoreboard.app/m/{{ matchId.slice(0, 8) }}…</span
          >
          <span class="font-bold text-neutral-400">Scoreboard</span>
        </div>
      </div>

      <div class="flex flex-col gap-2 max-w-md mx-auto">
        <Button
          size="lg"
          class="h-11 font-semibold"
          @click="copy(shareUrl, 'Share link')"
        >
          <Clipboard class="size-4" />
          Copy share link
        </Button>
        <Button variant="ghost" class="h-11" @click="navigateTo('/new')">
          Start another match
        </Button>
      </div>
    </main>
  </div>
</template>
