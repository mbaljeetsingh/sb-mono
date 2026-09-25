<script setup lang="ts">
import { Button } from '@sb/layer-ui/components/ui/button';
import { Input } from '@sb/layer-ui/components/ui/input';
import { Label } from '@sb/layer-ui/components/ui/label';
import { computed, ref, watch } from 'vue';

const props = defineProps<{
  initialGames: { a: number; b: number }[];
  initialGamesWon: { a: number; b: number };
  /** Total games needed to win the match. `1` = single-game format; the
   *  games-won concept is meaningless and we hide that input. */
  gamesToWin: number;
  /** What one row of the score is called — "game", or "set" under tennis and
   *  padel scoring, where the rows ARE sets. "G1 / Games won" against a
   *  tennis match invites the operator to correct the wrong tier. */
  unitLabel?: string;
  teamNames: { a: string; b: string };
}>();

/** Row prefix: G1 / G2 for games, S1 / S2 for sets. */
const unitInitial = computed(() =>
  (props.unitLabel ?? 'game').charAt(0).toUpperCase()
);

const emit = defineEmits<{
  (
    e: 'apply',
    payload: {
      games: { a: number; b: number }[];
      gamesWon: { a: number; b: number };
    }
  ): void;
  (e: 'close'): void;
}>();

const games = ref<{ a: string; b: string }[]>([]);
const gamesWon = ref({ a: 0, b: 0 });

// Snapshot props on mount and whenever they change (the parent only opens
// this sheet right after seeding, so this re-syncs cleanly).
watch(
  () => props.initialGames,
  (g) => {
    games.value = g.map((x) => ({ a: String(x.a), b: String(x.b) }));
  },
  { immediate: true, deep: true }
);
watch(
  () => props.initialGamesWon,
  (w) => {
    gamesWon.value = { ...w };
  },
  { immediate: true, deep: true }
);

// Sanitize free-typed numbers: game points clamp to >= 0; games won clamp to
// [0, gamesToWin] so a stray digit can't claim more games than the format has.
const clampPoints = (raw: string) => Math.max(0, Number.parseInt(raw, 10) || 0);
const clampWon = (raw: unknown) => {
  const n =
    typeof raw === 'number' && Number.isFinite(raw) ? Math.trunc(raw) : 0;
  return Math.min(Math.max(n, 0), props.gamesToWin);
};

const apply = () => {
  // Spread into plain objects — Vue reactive proxies aren't
  // structured-cloneable, which breaks BroadcastChannel.postMessage in
  // useEvents.append. Sending plain values keeps the event log clonable.
  emit('apply', {
    games: games.value
      .map((g) => ({ a: clampPoints(g.a), b: clampPoints(g.b) }))
      .filter((g) => g.a > 0 || g.b > 0),
    gamesWon: { a: clampWon(gamesWon.value.a), b: clampWon(gamesWon.value.b) },
  });
};
</script>

<template>
  <div
    class="absolute inset-x-4 top-20 bottom-20 z-50 mx-auto w-auto max-w-lg bg-surface text-foreground rounded-2xl p-5 shadow-[0_24px_60px_rgba(0,0,0,0.2)] flex flex-col"
  >
    <h2 class="text-lg font-semibold">Fix the score</h2>
    <p class="text-[11px] text-fg-subtle mb-3">
      Recorded as a score.correct event · audit-logged
    </p>

    <div
      class="text-[11px] font-bold tracking-wider uppercase text-fg-subtle mb-2"
    >
      Set correct scores
    </div>
    <!-- Team-name header so the operator knows which column is which. The
         per-row inputs reuse the same column geometry + team-color left
         borders so it stays obvious as they scroll through games. -->
    <div class="flex items-center gap-2 mb-1.5">
      <div class="w-8" />
      <div class="flex-1 truncate text-[11px] font-semibold text-team-a">
        {{ teamNames.a || 'Team A' }}
      </div>
      <span class="w-3" />
      <div class="flex-1 truncate text-[11px] font-semibold text-team-b">
        {{ teamNames.b || 'Team B' }}
      </div>
    </div>
    <div class="flex flex-col gap-2 mb-3 flex-1 overflow-y-auto">
      <div v-for="(g, i) in games" :key="i" class="flex items-center gap-2">
        <div class="w-8 text-[11px] font-semibold text-fg-subtle">
          {{ unitInitial }}{{ i + 1 }}
        </div>
        <Input
          v-model="g.a"
          type="number"
          inputmode="numeric"
          class="flex-1 h-10 text-center font-mono text-base font-semibold tabular-nums border-l-4 border-l-team-a"
        />
        <span class="text-fg-muted">—</span>
        <Input
          v-model="g.b"
          type="number"
          inputmode="numeric"
          class="flex-1 h-10 text-center font-mono text-base font-semibold tabular-nums border-l-4 border-l-team-b"
        />
      </div>
    </div>

    <!-- Games-won input only makes sense in best-of formats. Single-game
         matches have one game = one match, so this section is hidden. -->
    <template v-if="props.gamesToWin > 1">
      <Label
        class="text-[11px] font-bold tracking-wider uppercase text-fg-subtle mb-2"
      >
        {{ unitLabel === 'set' ? 'Sets won' : 'Games won' }}
      </Label>
      <div class="flex gap-2 mb-4">
        <Input
          v-model.number="gamesWon.a"
          type="number"
          inputmode="numeric"
          min="0"
          class="flex-1 h-10 text-center font-mono text-base font-semibold tabular-nums border-l-4 border-l-team-a"
        />
        <span class="text-fg-muted self-center">vs</span>
        <Input
          v-model.number="gamesWon.b"
          type="number"
          inputmode="numeric"
          min="0"
          class="flex-1 h-10 text-center font-mono text-base font-semibold tabular-nums border-l-4 border-l-team-b"
        />
      </div>
    </template>

    <div class="flex gap-2">
      <Button variant="outline" class="flex-1 h-10" @click="emit('close')">
        Cancel
      </Button>
      <Button class="flex-[2] h-10 font-semibold" @click="apply">
        Apply correction
      </Button>
    </div>
  </div>
</template>
