<script setup lang="ts">
import type { GameScore, RacquetState, SideId } from '@sb/engine';
import { Trophy } from 'lucide-vue-next';
import { computed } from 'vue';

const props = defineProps<{
  matchOver: boolean;
  displayName: string;
  statusLabel: string;
  teamNames: { a: string; b: string };
  totalSlots: number;
  scoreA: number;
  scoreB: number;
  gamesWonA: number;
  gamesWonB: number;
  games: GameScore[];
  gamesToWin: number;
  winner: SideId | null;
  endReason: RacquetState['endReason'];
}>();

const isSingleGame = computed(() => props.gamesToWin <= 1);

// Who won, and why. The engine already resolves both on state (the reducer sets
// `winner` for walkover / retirement / default, and the retiring or disqualified
// side is always the loser), so nothing here needs to re-read the event log.
const winnerName = computed(() => {
  if (props.winner === 'A') return props.teamNames.a;
  if (props.winner === 'B') return props.teamNames.b;
  return null;
});
const loserName = computed(() => {
  if (props.winner === 'A') return props.teamNames.b;
  if (props.winner === 'B') return props.teamNames.a;
  return null;
});

// Only for the non-normal endings — a match scored to completion needs no
// explanation beyond the scoreline.
const endReasonLabel = computed(() => {
  switch (props.endReason) {
    case 'walkover':
      return 'walkover';
    case 'retirement':
      return `${loserName.value} retired`;
    case 'default':
      return `${loserName.value} disqualified`;
    default:
      return null;
  }
});

// A walkover called before the first rally leaves every game 0–0, and the old
// card rendered that as a 40px "0" on both sides with nothing naming the winner
// — it read as a nil-nil result that was actually never played. Suppress the
// numbers in that case and let the outcome line carry the result. A walkover or
// retirement *mid*-match keeps its partial games, which are worth showing.
const hasScoreline = computed(() =>
  props.games.some((g) => g.a > 0 || g.b > 0)
);
const showHeadlineNumbers = computed(
  () => !props.matchOver || hasScoreline.value
);

// BO1: when the match is over, "games won" is 0/1 which conveys nothing —
// the meaningful number is the final game's point score (e.g. 21–15).
const headlineA = computed(() => {
  if (props.matchOver && isSingleGame.value) {
    return props.games[0]?.a ?? props.scoreA;
  }
  return props.matchOver ? props.gamesWonA : props.scoreA;
});
const headlineB = computed(() => {
  if (props.matchOver && isSingleGame.value) {
    return props.games[0]?.b ?? props.scoreB;
  }
  return props.matchOver ? props.gamesWonB : props.scoreB;
});

// For BO-n, show the per-game point breakdown beneath the headline so prior
// games are visible too. Live: only completed games (the in-progress one is
// already the headline live score). Final: all games are complete.
const completedGames = computed<GameScore[]>(() => {
  if (isSingleGame.value) return [];
  // Suppressed for the same reason as the headline numbers: a pre-rally
  // walkover in a best-of-N still carries one all-zero game, so this strip
  // printed "G1 0–0" directly under the dash that exists to avoid claiming a
  // nil-nil result. `games` is seeded with [{a:0,b:0}] by the engine, so the
  // length check alone doesn't catch it.
  if (props.matchOver) return hasScoreline.value ? props.games : [];
  return props.games.slice(0, -1);
});
</script>

<template>
  <!-- The finished card used to invert (bg-foreground / text-background), which
       made it read as a light card in dark mode and vice versa. Worse, every
       child kept using tokens computed against the *page* background: the FINAL
       badge (success on success-soft) landed at 1.63:1 on the inverted card in
       dark mode and 3.27:1 in light — illegible in both. The card now stays on
       the normal surface and signals "done" with the badge plus a success-tinted
       border, so every token inside it means what it says again. -->
  <div
    class="rounded-lg p-4 border bg-surface text-foreground transition-colors"
    :class="matchOver ? 'border-success/40' : 'border-border'"
  >
    <div class="flex justify-between items-center mb-3">
      <span class="inline-flex gap-1.5 items-center">
        <span
          v-if="matchOver"
          class="px-2 py-0.5 rounded text-[10px] font-bold tracking-[0.06em] uppercase bg-success-soft text-success"
        >
          Final
        </span>
        <!-- LIVE is a status, not a competitor: it used to be painted with
             team-a, which read as "team A is live" next to team B's score. -->
        <span
          v-else
          class="inline-flex items-center gap-1 text-[10px] font-bold tracking-[0.1em] uppercase text-live"
        >
          <span class="size-1.5 rounded-full bg-live animate-pulse-soft" />
          LIVE
        </span>
        <span class="text-sm text-fg-muted">{{ displayName }}</span>
      </span>
      <span v-if="!matchOver" class="text-sm text-fg-subtle">
        {{ statusLabel }}
      </span>
    </div>
    <div class="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
      <div>
        <div
          class="text-sm mb-0.5"
          :class="
            matchOver && winner === 'A'
              ? 'font-semibold text-foreground'
              : 'text-fg-muted'
          "
        >
          {{ teamNames.a }}
        </div>
        <!-- Keep the score font either way so both halves stay on the same
             baseline; the dash is just muted, since it marks an absent score
             rather than a result. -->
        <div
          class="score text-[40px]"
          :class="showHeadlineNumbers ? '' : 'text-fg-subtle'"
        >
          {{ showHeadlineNumbers ? headlineA : '—' }}
        </div>
        <div v-if="!isSingleGame" class="flex gap-1 mt-1">
          <span
            v-for="i in totalSlots"
            :key="`a-${i}`"
            class="size-1.5 rounded-full"
            :style="{
              background:
                i <= gamesWonA
                  ? 'var(--color-team-a)'
                  : 'var(--color-border-strong)',
            }"
          />
        </div>
      </div>
      <span class="text-sm text-fg-subtle">vs</span>
      <div class="text-right">
        <div
          class="text-sm mb-0.5"
          :class="
            matchOver && winner === 'B'
              ? 'font-semibold text-foreground'
              : 'text-fg-muted'
          "
        >
          {{ teamNames.b }}
        </div>
        <div
          class="score text-[40px]"
          :class="showHeadlineNumbers ? '' : 'text-fg-subtle'"
        >
          {{ showHeadlineNumbers ? headlineB : '—' }}
        </div>
        <div v-if="!isSingleGame" class="flex gap-1 mt-1 justify-end">
          <span
            v-for="i in totalSlots"
            :key="`b-${i}`"
            class="size-1.5 rounded-full"
            :style="{
              background:
                i <= gamesWonB
                  ? 'var(--color-team-b)'
                  : 'var(--color-border-strong)',
            }"
          />
        </div>
      </div>
    </div>
    <!-- Names the winner outright. The scoreline alone can't: a walkover has no
         scoreline at all, and even a normal result leaves the reader to compare
         two numbers. No verb — the trophy supplies it, which also sidesteps
         "Kumar wins" vs "Kumar / Rao win" without needing to know the mode. -->
    <div
      v-if="matchOver && winnerName"
      class="mt-3 flex flex-wrap items-center gap-x-1.5 text-sm"
    >
      <Trophy class="size-3.5 shrink-0 text-success" />
      <span class="font-semibold">{{ winnerName }}</span>
      <span v-if="endReasonLabel" class="text-fg-muted">
        · {{ endReasonLabel }}
      </span>
    </div>

    <div
      v-if="completedGames.length > 0"
      class="mt-3 flex flex-wrap gap-1.5 text-[11px] font-medium tabular-nums text-fg-muted"
    >
      <span
        v-for="(g, i) in completedGames"
        :key="`g-${i}`"
        class="px-1.5 py-0.5 rounded border border-border bg-surface-2"
      >
        G{{ i + 1 }} {{ g.a }}–{{ g.b }}
      </span>
    </div>
  </div>
</template>
