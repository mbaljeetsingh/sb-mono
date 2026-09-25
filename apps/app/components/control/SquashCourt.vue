<script setup lang="ts">
import type { SideId } from '@sb/engine';
import PenaltyCards from '@sb/themes/penalty-cards';
import { computed, ref, watch } from 'vue';

// The /control surface for squash. Every other sport is drawn as two halves
// of one court split by a net, one half per team, so a half is both the tap
// target and the place that team plays. Squash has no net: both players share
// one court in front of the same wall, and the server picks either service
// box. Any layout that made a region of the court a player's tap zone would
// put the lit service box inside the OTHER player's zone on every serve from
// "their" side.
//
// So the two jobs are split. Each player gets a tap panel (as large as a
// half is elsewhere — thumb targets beat realism mid-rally), and between them
// sits a to-scale, non-interactive court diagram: WSF singles court 6.4m ×
// 9.75m, front wall at the top, short line 5.49m from it, half-court line to
// the back wall, 1.6m service boxes in the back corners. WHO serves is the
// pill in their panel; WHERE from is the box lit in their colour.

type Side = 'a' | 'b';

const props = defineProps<{
  /** Panel order, top to bottom — follows the page's visual ends swap. */
  order: SideId[];
  names: { a: string; b: string };
  scores: { a: number; b: number };
  gamesWon: { a: number; b: number };
  totalSlots: number;
  pointChip: { a: string | null; b: string | null };
  glowing: { a: boolean; b: boolean };
  lastWinner: SideId | null;
  servingSide: SideId;
  serverCourt: 'left' | 'right';
  cards: {
    a: { yellow: number; red: number; black: number };
    b: { yellow: number; red: number; black: number };
  };
  matchOver: boolean;
  /** Floor colour — the operator's court-colour choice. */
  surfaceClass: string;
}>();

const emit = defineEmits<(e: 'tap', side: SideId) => void>();

const key = (side: SideId): Side => (side === 'A' ? 'a' : 'b');
const isServing = (side: SideId) =>
  !props.matchOver && props.servingSide === side;
const teamColor = (side: SideId) =>
  side === 'A' ? 'var(--color-team-a)' : 'var(--color-team-b)';

// Same score tick as TeamRow — the numeral is the confirmation a tap landed.
const ticking = ref<{ a: boolean; b: boolean }>({ a: false, b: false });
const timers: Partial<Record<Side, ReturnType<typeof setTimeout>>> = {};
watch(
  () => ({ ...props.scores }),
  (next, prev) => {
    for (const k of ['a', 'b'] as const) {
      if (!prev || next[k] <= prev[k]) continue;
      ticking.value = { ...ticking.value, [k]: true };
      clearTimeout(timers[k]);
      timers[k] = setTimeout(() => {
        ticking.value = { ...ticking.value, [k]: false };
      }, 150);
    }
  }
);

// Court geometry, as fractions of the court (from above, front wall on top).
const SHORT_LINE_FROM_FRONT = '56.3%'; // 5.49 of 9.75m
const BOX_WIDTH = '25%'; // 1.6 of 6.4m
const BOX_DEPTH = '16.4%'; // 1.6 of 9.75m

const boxStyle = (court: 'left' | 'right') => {
  const lit = !props.matchOver && props.serverCourt === court;
  return {
    top: SHORT_LINE_FROM_FRONT,
    height: BOX_DEPTH,
    width: BOX_WIDTH,
    [court]: '0',
    ...(lit
      ? {
          borderColor: teamColor(props.servingSide),
          backgroundColor: `color-mix(in oklab, ${teamColor(props.servingSide)} 28%, transparent)`,
        }
      : {}),
  };
};

const serveLabel = computed(
  () => `Serves · ${props.serverCourt === 'right' ? 'right' : 'left'} box`
);
</script>

<template>
  <!-- Hairline dividers, not the thick band the net-split sports use between
       their halves: there is no net here, and a heavy bar across the middle
       read as one. -->
  <div class="relative flex flex-1 flex-col gap-px bg-border">
    <template v-for="(side, i) in order" :key="side">
      <!-- Tap panel. A raw <button> on purpose: a full-area tap zone with its
           own geometry, the same exception CLAUDE.md makes for TeamRow. -->
      <button
        type="button"
        :disabled="matchOver"
        :aria-label="`Score a point for ${names[key(side)] || `Player ${side}`}`"
        class="relative flex min-h-0 flex-1 flex-col justify-between bg-background px-4 py-3 text-left transition-[box-shadow,background-color] duration-150 active:bg-foreground/10 disabled:cursor-not-allowed disabled:opacity-65"
        :style="
          glowing[key(side)]
            ? { boxShadow: `inset 0 0 0 3px ${teamColor(side)}` }
            : lastWinner === side && !isServing(side) && !matchOver
              ? { boxShadow: `inset 0 0 0 2px ${teamColor(side)}` }
              : undefined
        "
        @click="emit('tap', side)"
      >
        <span class="flex items-start justify-between gap-2">
          <span class="flex min-w-0 items-center gap-1.5">
            <PenaltyCards :cards="cards[key(side)]" size="xs" />
            <span
              v-if="pointChip[key(side)]"
              class="rounded-sm px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
              :class="
                side === 'A'
                  ? 'bg-team-a text-team-a-foreground'
                  : 'bg-team-b text-team-b-foreground'
              "
            >
              {{ pointChip[key(side)] }}
            </span>
          </span>
          <span class="flex flex-shrink-0 gap-1 pt-0.5">
            <span
              v-for="n in totalSlots"
              :key="n"
              class="size-[7px] rounded-full"
              :class="
                n <= gamesWon[key(side)]
                  ? side === 'A'
                    ? 'bg-team-a'
                    : 'bg-team-b'
                  : 'bg-foreground/25'
              "
            />
          </span>
        </span>

        <span class="flex items-end justify-between gap-3">
          <span class="flex min-w-0 flex-col gap-1">
            <span class="truncate text-[15px] font-semibold text-foreground">
              {{ names[key(side)] || `Player ${side}` }}
            </span>
            <span class="flex h-6 items-center">
              <span
                v-if="isServing(side)"
                class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                :class="
                  side === 'A'
                    ? 'bg-team-a text-team-a-foreground'
                    : 'bg-team-b text-team-b-foreground'
                "
              >
                <span class="size-[5px] rounded-full bg-current opacity-70" />
                {{ serveLabel }}
              </span>
            </span>
          </span>
          <span
            class="score text-[clamp(44px,9vh,88px)] leading-none tabular-nums text-foreground transition-transform duration-150 ease-out"
            :class="ticking[key(side)] ? 'scale-[1.08]' : 'scale-100'"
          >
            {{ scores[key(side)] }}
          </span>
        </span>
      </button>

      <!-- The court, between the two panels. -->
      <div
        v-if="i === 0"
        class="pointer-events-none flex flex-shrink-0 justify-center bg-background py-2"
        aria-hidden="true"
      >
        <div
          class="relative h-[clamp(9rem,30vh,17rem)] aspect-[640/975] overflow-hidden rounded-[3px] border border-court-line"
          :class="surfaceClass"
        >
          <!-- Front wall, with the tin along its foot. -->
          <span
            class="absolute inset-x-0 top-0 flex h-[7%] items-center justify-center bg-foreground/15 text-[8px] font-bold uppercase tracking-[0.2em] text-fg-muted"
          >
            Front wall
          </span>
          <span class="absolute inset-x-0 top-[7%] h-[1.5px] bg-court-line" />
          <!-- Short line. -->
          <span
            class="absolute inset-x-0 h-[1.5px] bg-court-line"
            :style="{ top: SHORT_LINE_FROM_FRONT }"
          />
          <!-- Half-court line: short line to the back wall. -->
          <span
            class="absolute bottom-0 left-1/2 w-[1.5px] -translate-x-1/2 bg-court-line"
            :style="{ top: SHORT_LINE_FROM_FRONT }"
          />
          <!-- Service boxes; the one in use is lit in the server's colour. -->
          <span
            v-for="court in ['left', 'right'] as const"
            :key="court"
            class="absolute border-[1.5px] border-court-line transition-colors duration-200"
            :style="boxStyle(court)"
          />
        </div>
      </div>
    </template>
  </div>
</template>
