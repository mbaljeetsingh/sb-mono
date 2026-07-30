<script setup lang="ts">
import type { Cell } from '@sb/layer-app-base/composables/useCourtCells';
import PenaltyCards from '@sb/themes/penalty-cards';
import { ArrowLeftRight, Repeat } from 'lucide-vue-next';
import { computed } from 'vue';

// One team's half of the court — header strip (label + score + pips +
// MATCH/GAME PT) and two service-court cells. Used twice in control.vue
// (Team A and Team B).
//
// `team` drives color (always tied to identity). `orientation` drives
// geometry — which screen edge this team occupies, derived in the parent
// from layout + sidesSwapped:
//  - "top"    — portrait layout, this team at screen-top. Header anchored
//               top, cells flow flex-row-reverse so the right service court
//               reads as screen-left (BWF top-down view from this end).
//  - "bottom" — portrait layout, this team at screen-bottom. Header anchored
//               bottom (flex-col-reverse on the wrapper); cells flow
//               flex-row, so the right service court reads as screen-right
//               (mirroring the top team).
//  - "left"   — landscape layout, this team at screen-left. Header on top,
//               cells stack flex-col so the right service court reads as
//               screen-bottom (top-down view rotated CCW).
//  - "right"  — landscape layout, this team at screen-right. Header on top,
//               cells stack flex-col-reverse so the right service court
//               reads as screen-top (mirror of the left team across the net).

const props = defineProps<{
  team: 'A' | 'B';
  orientation: 'top' | 'bottom' | 'left' | 'right';
  score: number;
  gamesWon: number;
  totalSlots: number;
  isServingTeam: boolean;
  isMatchPoint: boolean;
  isGamePoint: boolean;
  cells: Cell[];
  matchOver: boolean;
  isGlowing: boolean;
  lastWinner: boolean;
  cellIsServer: (court: 'left' | 'right') => boolean;
  canSwapPlayers?: boolean;
  canChangeServer?: boolean;
  serverCourt?: 'left' | 'right';
  cards?: { yellow: number; red: number; black: number };
  // Singles: cells show the player name only on the active service court (it
  // shifts as service moves), so the header carries the team identity. In
  // doubles each cell labels its own player so the header falls back to
  // "Team A" / "Team B" to avoid duplicating one player's name there.
  isDoubles?: boolean;
  displayName?: string;
}>();

const headerLabel = computed(() => {
  if (!props.isDoubles && props.displayName) return props.displayName;
  return `Team ${props.team}`;
});

defineEmits<{
  (e: 'tap'): void;
  (e: 'swap-players'): void;
  (e: 'change-server'): void;
}>();

const isStacked = (o: typeof props.orientation) =>
  o === 'top' || o === 'bottom';

// Centerline border sits on the visually-SECOND cell. Top/right orientations
// use a reversed flow (right court rendered first), so the second visual
// cell is array index 0; bottom/left use natural flow, so index 1.
const isSecondVisualCell = (idx: number) =>
  props.orientation === 'top' || props.orientation === 'right'
    ? idx === 0
    : idx > 0;
</script>

<template>
  <div
    class="relative flex flex-1 transition-shadow duration-200"
    :class="[
      team === 'A' ? 'bg-team-a-soft' : 'bg-team-b-soft',
      orientation === 'bottom' ? 'flex-col-reverse' : 'flex-col',
      isGlowing
        ? team === 'A'
          ? 'shadow-[inset_0_0_0_3px_var(--color-team-a)] animate-glow-a'
          : 'shadow-[inset_0_0_0_3px_var(--color-team-b)] animate-glow-b'
        : lastWinner && !matchOver
          ? team === 'A'
            ? 'shadow-[inset_0_0_0_2px_var(--color-team-a)]'
            : 'shadow-[inset_0_0_0_2px_var(--color-team-b)]'
          : '',
    ]"
  >
    <!-- Header strip — team label, score, pips, MATCH/GAME PT chip. -->
    <div
      class="flex items-center justify-center gap-3 px-3 py-2.5"
      :class="[
        orientation === 'bottom'
          ? team === 'A'
            ? 'border-t border-team-a/20'
            : 'border-t border-team-b/20'
          : team === 'A'
            ? 'border-b border-team-a/20'
            : 'border-b border-team-b/20',
      ]"
    >
      <span
        class="max-w-[40%] truncate text-[10px] font-bold uppercase tracking-[0.08em]"
        :class="team === 'A' ? 'text-team-a' : 'text-team-b'"
      >
        {{ headerLabel }}
      </span>
      <!-- Persistent penalty cards. Same component as the broadcast themes
           so the visual language stays consistent across control + overlay
           + scoreboard surfaces. -->
      <PenaltyCards v-if="cards" :cards="cards" size="xs" />
      <span
        class="score text-[clamp(32px,6vh,52px)] font-bold leading-none tabular-nums text-foreground"
      >
        {{ score }}
      </span>
      <div class="flex gap-1">
        <span
          v-for="i in totalSlots"
          :key="i"
          class="size-[7px] rounded-full"
          :class="
            i <= gamesWon
              ? team === 'A'
                ? 'bg-team-a'
                : 'bg-team-b'
              : 'bg-border-strong'
          "
        />
      </div>
      <span
        v-if="isServingTeam && (isMatchPoint || isGamePoint)"
        class="rounded-sm px-1.5 py-0.5 text-[10px] font-bold tracking-wider"
        :class="
          team === 'A'
            ? 'bg-team-a text-team-a-foreground'
            : 'bg-team-b text-team-b-foreground'
        "
      >
        {{ isMatchPoint ? 'MATCH PT' : 'GAME PT' }}
      </span>
    </div>

    <!-- Cells. Direction flips with orientation so the right service court
         reads correctly in BWF top-down geometry. -->
    <div
      class="relative flex flex-1"
      :class="[
        orientation === 'top'
          ? 'flex-row-reverse'
          : orientation === 'bottom'
            ? 'flex-row'
            : orientation === 'left'
              ? 'flex-col'
              : 'flex-col-reverse',
      ]"
    >
      <div
        v-for="(cell, idx) in cells"
        :key="cell.key"
        class="relative flex flex-1"
      >
        <button
          type="button"
          :disabled="matchOver"
          :aria-label="`Tap to score for ${cell.label || `team ${team}`}`"
          class="flex size-full flex-col items-center justify-center gap-2 px-4 py-4 transition-[background-color] duration-150 active:brightness-95 disabled:cursor-not-allowed disabled:opacity-65"
          :class="[
            isSecondVisualCell(idx)
              ? isStacked(orientation)
                ? team === 'A'
                  ? 'border-l border-team-a/20'
                  : 'border-l border-team-b/20'
                : team === 'A'
                  ? 'border-t border-team-a/20'
                  : 'border-t border-team-b/20'
              : '',
          ]"
          @click="$emit('tap')"
        >
          <span
            v-if="cell.label"
            class="max-w-full truncate text-[15px] font-semibold leading-tight text-foreground"
          >
            {{ cell.label }}
          </span>
          <!-- Service-over cue: when the pill moves between cells (partner
               swap on serve) or jumps teams (receiver won the rally), a fade
               + slight slide draws the operator's eye. Without this the pill
               teleports and is easy to miss in fast rallies. -->
          <Transition
            enter-active-class="transition duration-200 ease-out"
            enter-from-class="opacity-0 scale-90"
            enter-to-class="opacity-100 scale-100"
            leave-active-class="transition duration-150 ease-in"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
          >
            <div
              v-if="cellIsServer(cell.court)"
              class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
              :class="
                team === 'A'
                  ? 'bg-team-a text-team-a-foreground'
                  : 'bg-team-b text-team-b-foreground'
              "
            >
              <span
                class="size-[5px] rounded-full bg-white animate-pulse-soft"
              />
              Serves
            </div>
          </Transition>
        </button>

        <!-- Pre-match only, non-serving team, diagonal cell: tap to put the
             serve on this player instead. Diagonal of the current server is
             the only legal receiver in BWF, so this is the only cell on the
             non-serving team that could become the server. -->
        <ControlPill
          v-if="canChangeServer && cell.court === serverCourt"
          ariaLabel="Make this player serve first"
          class="absolute left-1/2 top-[62%] z-10 -translate-x-1/2"
          @click.stop="$emit('change-server')"
        >
          <Repeat />
          Serve first
        </ControlPill>
      </div>

      <!-- Doubles-only: swap of which partner starts on the right (server)
           court. Sits on the centerline between the two cells. Distinct
           icon (Users) so it's visually disambiguated from the sides-swap
           button on the row centerline. -->
      <ControlPill
        v-if="canSwapPlayers"
        ariaLabel="Swap players on this side"
        class="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2"
        @click.stop="$emit('swap-players')"
      >
        <ArrowLeftRight :class="isStacked(orientation) ? '' : 'rotate-90'" />
        Swap
      </ControlPill>
    </div>
  </div>
</template>
