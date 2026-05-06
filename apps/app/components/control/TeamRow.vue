<script setup lang="ts">
import type { Cell } from "@sb/layer-app-base/composables/useCourtCells";

// One team's half of the court — header strip (label + score + pips +
// MATCH/GAME PT) and two service-court cells. Used twice in control.vue
// (Team A and Team B) — extracting cuts ~150 lines of near-duplicate template.
//
// `position` decides the visual orientation:
//  - "a-stacked": Team A in portrait (above B). Header anchors top, cells
//    below; cells flex-row-reverse so cell index 1 (right court) is
//    visually screen-left, matching BWF court geometry.
//  - "b-stacked": Team B in portrait. Column flex-col-reverse so the header
//    sits at the BOTTOM (B's "back of court" in a top-down layout, mirroring
//    A at the top). Cells flow naturally left→right (no reverse).
//  - "a-side"/"b-side": both teams in landscape (umpire view). Headers stay
//    on top, cells stack vertically.

const props = defineProps<{
  team: "A" | "B";
  position: "a-stacked" | "b-stacked" | "a-side" | "b-side";
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
  cellIsServer: (court: "left" | "right") => boolean;
}>();

defineEmits<{ (e: "tap"): void }>();

const colorVar = props.team === "A" ? "team-a" : "team-b";
</script>

<template>
  <div
    class="relative flex flex-1 transition-shadow duration-200"
    :class="[
      position === 'a-stacked' || position === 'a-side'
        ? 'bg-team-a-soft'
        : 'bg-team-b-soft',
      position === 'b-stacked'
        ? 'flex-col-reverse'
        : position === 'a-side' || position === 'b-side'
          ? 'flex-col'
          : 'flex-col',
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
        position === 'a-stacked' || position === 'a-side'
          ? 'border-b border-team-a/20'
          : position === 'b-stacked'
            ? 'border-t border-team-b/20'
            : 'border-b border-team-b/20',
      ]"
    >
      <span
        class="text-[10px] font-bold uppercase tracking-[0.08em]"
        :class="team === 'A' ? 'text-team-a' : 'text-team-b'"
      >
        Team {{ team }}
      </span>
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
        {{ isMatchPoint ? "MATCH PT" : "GAME PT" }}
      </span>
    </div>

    <!-- Cells. Direction flips with layout: cells split left|right when teams
         are stacked, top|bottom when side-by-side. Team A is reversed so the
         right service court reads as screen-left (matching BWF court view);
         Team B is non-reversed for the same reason from the opposite side. -->
    <div
      class="flex flex-1"
      :class="[
        team === 'A'
          ? position === 'a-side'
            ? 'flex-col-reverse'
            : 'flex-row-reverse'
          : position === 'b-side'
            ? 'flex-col'
            : 'flex-row',
      ]"
    >
      <button
        v-for="(cell, idx) in cells"
        :key="cell.key"
        type="button"
        :disabled="matchOver"
        :aria-label="`Tap to score for ${cell.label || `team ${team}`}`"
        class="relative flex flex-1 flex-col items-center justify-center gap-2 px-4 py-4 transition-[background-color] duration-150 active:brightness-95 disabled:cursor-not-allowed disabled:opacity-65"
        :class="[
          // Centerline divider sits between the two cells. For Team A both
          // layouts reverse, so idx 0 is the visually-second cell. For Team
          // B no reverse, so idx 1 is the visually-second cell. Either way
          // the leading edge of the second cell is the centerline.
          (team === 'A' ? idx === 0 : idx > 0)
            ? position.endsWith('-side')
              ? team === 'A'
                ? 'border-t border-team-a/20'
                : 'border-t border-team-b/20'
              : team === 'A'
                ? 'border-l border-team-a/20'
                : 'border-l border-team-b/20'
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
        <div
          v-if="cellIsServer(cell.court)"
          class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
          :class="
            team === 'A'
              ? 'bg-team-a text-team-a-foreground'
              : 'bg-team-b text-team-b-foreground'
          "
        >
          <span class="size-[5px] rounded-full bg-white animate-pulse-soft" />
          Serves
        </div>
      </button>
    </div>
  </div>
</template>
