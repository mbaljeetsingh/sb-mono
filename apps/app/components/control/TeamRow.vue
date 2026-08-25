<script setup lang="ts">
import type { Cell } from '@sb/layer-app-base/composables/useCourtCells';
import PenaltyCards from '@sb/themes/penalty-cards';
import { useElementSize } from '@vueuse/core';
import { computed, ref, watch } from 'vue';
import type { SportId } from '~/lib/sports';

// One team's half of the court, drawn as the real playing surface for the
// active sport (green badminton mat, blue TT table, hard court, pickleball
// green) with painted markings. Used twice in control.vue (Team A and Team B).
//
// Two deliberate departures from the previous version:
//
//  1. The half is ONE tap target, not two cells. Both cells used to emit the
//     identical `tap` event, so splitting them halved each target's width and
//     bought no function — they only ever *displayed* court geometry. The
//     service courts are now non-interactive zones drawn on the surface.
//  2. The surface is not tinted by team. It belongs to the sport; team identity
//     is carried by the game pips, the chip colours, and the court boundary,
//     which lights up in the serving team's colour.
//
// Purely presentational apart from the tap target: the pre-match setup actions
// (ends, partner swap, first server) live in control.vue's footer bar, not as
// pills floating over this surface — they used to be live targets sitting
// inside the score button, and they scaled badly to desktop.
//
// `team` drives colour (always tied to identity). `orientation` drives geometry
// — which screen edge this team occupies, derived in the parent from layout +
// sidesSwapped. The net is always the *inner* edge:
//  - "top"    — portrait, screen-top. Net at the bottom, so the service line
//               sits near the bottom and zones flow row-reverse (the right
//               service court reads as screen-left: BWF top-down view from
//               this end).
//  - "bottom" — portrait, screen-bottom. Net at the top; natural flow, so the
//               right court reads as screen-right (mirrors the top team).
//  - "left"   — landscape, screen-left. Net at the right edge.
//  - "right"  — landscape, screen-right. Net at the left edge.

const props = defineProps<{
  team: 'A' | 'B';
  sport: SportId;
  orientation: 'top' | 'bottom' | 'left' | 'right';
  score: number;
  gamesWon: number;
  totalSlots: number;
  /** THIS team is a point away from the match / game (side-attributed —
   * under rally scoring the receiver can be at game point). */
  isMatchPoint: boolean;
  isGamePoint: boolean;
  cells: Cell[];
  matchOver: boolean;
  isGlowing: boolean;
  lastWinner: boolean;
  cellIsServer: (court: 'left' | 'right') => boolean;
  serverCourt?: 'left' | 'right';
  cards?: { yellow: number; red: number; black: number };
  // Feed headerLabel, which is only spoken, not shown: it becomes the tap
  // button's aria-label ("Score a point for <name>"). Singles uses the player
  // name; doubles falls back to "Team A" / "Team B" since naming one partner
  // would misattribute the action. On-screen names come from `cells`.
  isDoubles?: boolean;
  displayName?: string;
  /** Mat color override (operator's court-color choice); defaults to the
   * sport's standard surface. */
  surfaceClass?: string;
}>();

const emit = defineEmits<(e: 'tap') => void>();

const headerLabel = computed(() => {
  if (!props.isDoubles && props.displayName) return props.displayName;
  return `Team ${props.team}`;
});

// Derived, not passed: if either service court holds the server, this team is
// serving. (The old `isServingTeam` prop existed only to gate the game-point
// chip, which the engine now attributes per side.)
const isServing = computed(
  () => props.cellIsServer('left') || props.cellIsServer('right')
);

// BWF service law: the only legal receiver is diagonally opposite the server.
//
// Doubles only, deliberately. With two opponents on court the diagonal-only
// rule is non-obvious and receiving out of turn is a fault, so naming the
// receiving court is worth the ink. In singles there is exactly one opponent —
// "Serves" on one side already tells you who receives, and labelling it is
// redundant noise.
const isReceiverZone = (court: 'left' | 'right') =>
  !!props.isDoubles &&
  !isServing.value &&
  !props.matchOver &&
  court === props.serverCourt;

const isStacked = computed(
  () => props.orientation === 'top' || props.orientation === 'bottom'
);

/** Screen edge the net sits on for this team. */
const netEdge = computed(() => {
  switch (props.orientation) {
    case 'top':
      return 'bottom';
    case 'bottom':
      return 'top';
    case 'left':
      return 'right';
    default:
      return 'left';
  }
});

/** Opposite (outer) edge — the baseline / end line. */
const outerEdge = computed(() => {
  switch (netEdge.value) {
    case 'bottom':
      return 'top';
    case 'top':
      return 'bottom';
    case 'right':
      return 'left';
    default:
      return 'right';
  }
});

// Zones flow so the right service court lands on the correct screen edge.
const zoneFlow = computed(() => {
  switch (props.orientation) {
    case 'top':
      return 'flex-row-reverse';
    case 'bottom':
      return 'flex-row';
    case 'left':
      return 'flex-col';
    default:
      return 'flex-col-reverse';
  }
});

// The mat floats on the app background (out-of-court surround) instead of
// flooding the half edge-to-edge: 6px surround on the three outer sides, flush
// against the net edge so the two halves read as one court split by the net.
const MAT_INSET = '6px';
const matStyle = computed(() => {
  const style: Record<string, string> = {
    top: MAT_INSET,
    right: MAT_INSET,
    bottom: MAT_INSET,
    left: MAT_INSET,
  };
  style[netEdge.value] = '0px';
  return style;
});

// Painted-marking geometry per sport, as fractions of the half. These place
// LINES only — the content registers (score/name bands below) deliberately
// stay at shared positions so a sport's line layout can never displace them.
type CourtGeometry = {
  /** Line parallel to the net (short service / kitchen / service line), inset
   * from the net. null = none (table tennis). */
  serviceLineFromNet: string | null;
  /** Centre line span, as insets from each edge (mat surround included). */
  centreLine: { fromNet: string; fromOuter: string } | null;
  /** Side tramlines inset from the long edges. null = none. */
  sidelineInset: string | null;
  /** Second line parallel to the net, inset from the OUTER edge. */
  longServiceFromOuter: string | null;
};

const courtGeometry: Record<SportId, CourtGeometry> = {
  // BWF: short service line 1.98m of a 6.7m half (~30%); tramlines 0.46m of
  // 6.1m width (~7.5%); doubles long service line 0.76m from the back (~13%
  // with the surround folded in); centre line back boundary → short service.
  badminton: {
    serviceLineFromNet: '30%',
    centreLine: { fromNet: '30%', fromOuter: MAT_INSET },
    sidelineInset: '7.5%',
    longServiceFromOuter: '13%',
  },
  // ITF: service line 6.4m of an 11.89m half (~54% from the net); the centre
  // service line runs net → service line only (the back court has no centre
  // line, just the baseline's centre mark — omitted at this scale); singles
  // sidelines 1.37m of 10.97m doubles width (~12.5%).
  tennis: {
    serviceLineFromNet: '54%',
    centreLine: { fromNet: '0px', fromOuter: '46%' },
    sidelineInset: '12.5%',
    longServiceFromOuter: null,
  },
  // USAP: non-volley (kitchen) line 2.13m of a 6.7m half (~32%); centre line
  // baseline → kitchen; no tramlines.
  pickleball: {
    serviceLineFromNet: '32%',
    centreLine: { fromNet: '32%', fromOuter: MAT_INSET },
    sidelineInset: null,
    longServiceFromOuter: null,
  },
  // A table, not a court: white edge boundary plus the doubles centre line
  // along the full length. No service boxes.
  'table-tennis': {
    serviceLineFromNet: null,
    centreLine: { fromNet: '0px', fromOuter: MAT_INSET },
    sidelineInset: null,
    longServiceFromOuter: null,
  },
};

const geometry = computed(() => courtGeometry[props.sport]);
const hasServiceLine = computed(
  () => geometry.value.serviceLineFromNet !== null
);

// Boundary line on the three OUTER sides only — the net edge belongs to the
// net (a real court has no painted line there, and a serving team's tint
// used to overpaint the net band drawn by the parent frame).
const boundaryStyle = computed(() => {
  const edgeProp: Record<string, string> = {
    top: 'borderTopWidth',
    bottom: 'borderBottomWidth',
    left: 'borderLeftWidth',
    right: 'borderRightWidth',
  };
  return {
    ...matStyle.value,
    borderWidth: '1.5px',
    [edgeProp[netEdge.value]!]: '0px',
  };
});

// Serving signal: a solid team-colored bar along the serving half's
// BASELINE. Replaces the tinted boundary — a border with its net edge
// removed dead-ended into the net band and read as clipped, and a tinted
// gradient wash muddied against the mat color (orange over green browned
// out). The baseline is the one edge that can never collide with the net,
// and a crisp bar reads as "possession" at a glance; the SERVES pill stays
// the precise marker.
const servingBarStyle = computed(() => {
  if (!isServing.value || props.matchOver) return null;
  return isStacked.value
    ? {
        left: MAT_INSET,
        right: MAT_INSET,
        height: '5px',
        [outerEdge.value]: MAT_INSET,
      }
    : {
        top: MAT_INSET,
        bottom: MAT_INSET,
        width: '5px',
        [outerEdge.value]: MAT_INSET,
      };
});

const sidelineStyles = computed<Record<string, string>[]>(() => {
  const inset = geometry.value.sidelineInset;
  if (!inset) return [];
  const along: Record<string, string> = {
    [outerEdge.value]: MAT_INSET,
    [netEdge.value]: '0px',
  };
  return isStacked.value
    ? [
        { ...along, width: '1.5px', left: inset },
        { ...along, width: '1.5px', right: inset },
      ]
    : [
        { ...along, height: '1.5px', top: inset },
        { ...along, height: '1.5px', bottom: inset },
      ];
});

const longServiceLineStyle = computed(() => {
  const inset = geometry.value.longServiceFromOuter;
  if (!inset) return null;
  return isStacked.value
    ? {
        left: MAT_INSET,
        right: MAT_INSET,
        height: '1.5px',
        [outerEdge.value]: inset,
      }
    : {
        top: MAT_INSET,
        bottom: MAT_INSET,
        width: '1.5px',
        [outerEdge.value]: inset,
      };
});

/** Short-service / kitchen / service line: parallel to the net. */
const serviceLineStyle = computed(() => {
  const inset = geometry.value.serviceLineFromNet;
  if (!inset) return null;
  return isStacked.value
    ? {
        left: '6px',
        right: '6px',
        height: '1.5px',
        [netEdge.value]: inset,
      }
    : {
        top: '6px',
        bottom: '6px',
        width: '1.5px',
        [netEdge.value]: inset,
      };
});

/** Centre line: perpendicular to the net, spanning the sport's stretch. */
const centreLineStyle = computed(() => {
  const span = geometry.value.centreLine;
  if (!span) return null;
  return isStacked.value
    ? {
        left: '50%',
        width: '1.5px',
        [outerEdge.value]: span.fromOuter,
        [netEdge.value]: span.fromNet,
      }
    : {
        top: '50%',
        height: '1.5px',
        [outerEdge.value]: span.fromOuter,
        [netEdge.value]: span.fromNet,
      };
});

/** All content lives in the back box (outer edge → short-service line), in two
 *  registers: the score upper-centre, the players on a lower line near the
 *  service line — each name in its court column. The front court (service line
 *  → net) stays empty, like a real court between rallies. Two registers rather
 *  than one so a long name can never collide with the score, and content near
 *  the net stopped reading as "floating on the net". Inline styles so they can
 *  override the `inset-0` utility on the overlays. Table tennis has no service
 *  line, so it gets a synthetic split. */
const scoreBandStyle = computed(() => ({
  [netEdge.value]: hasServiceLine.value ? '55%' : '60%',
}));

const zonesBandStyle = computed(() => ({
  [outerEdge.value]: hasServiceLine.value ? '42%' : '36%',
  // A shared front inset, NOT the sport's painted service line: tennis's
  // service line sits at 54% from the net, and pinning the name band to it
  // would crush the band to nothing.
  [netEdge.value]: hasServiceLine.value ? '30%' : '45%',
}));

// Score size, derived from the score band's own box rather than the viewport.
//
// It used to be `clamp(40px, 8.5vh, 80px)`, which broke the one layout the size
// matters most in: switch a landscape phone to side-by-side (the umpire view)
// and 8.5vh of a ~390px-tall viewport is 33px, so it pinned to the 40px floor
// while each half was ~420px wide with room for double that. `vh` also can't
// see the card's width cap, so widening it for side-by-side bought the score
// nothing.
//
// Two real constraints, whichever bites first:
//   height — one line at line-height 1, so keep it under ~half the band;
//   width  — a two-digit score (JetBrains Mono digits are ~0.62em) has to fit,
//            hence the /1.6.
// The band spans the outer edge to the short-service line, so it takes ~45% of
// the half along the net axis and the full half across it.
const half = ref<HTMLElement | null>(null);
const { width: halfWidth, height: halfHeight } = useElementSize(half);

const NET_AXIS_FRACTION = 0.45;
const SCORE_MIN_PX = 40;
// Above the old 80px ceiling: with the side-by-side card no longer capped at
// 672px, the binding constraint on a desktop umpire monitor was this number and
// not the box. Two digits at 128px is ~159px against a ~247px band, so the
// width term still has headroom.
const SCORE_MAX_PX = 128;

const scoreFontPx = computed(() => {
  const w = halfWidth.value;
  const h = halfHeight.value;
  // Unmeasured on first paint — fall back to the CSS clamp on the element
  // rather than flashing the 40px floor.
  if (!w || !h) return null;
  const bandWidth = isStacked.value ? w : w * NET_AXIS_FRACTION;
  const bandHeight = isStacked.value ? h * NET_AXIS_FRACTION : h;
  const fromHeight = bandHeight * 0.5;
  const fromWidth = bandWidth / 1.6;
  return Math.round(
    Math.min(
      SCORE_MAX_PX,
      Math.max(SCORE_MIN_PX, Math.min(fromHeight, fromWidth))
    )
  );
});

const courtSurface: Record<SportId, string> = {
  badminton: 'bg-court-badminton',
  'table-tennis': 'bg-court-tabletennis',
  tennis: 'bg-court-tennis',
  pickleball: 'bg-court-pickleball',
};

// Score tick — a brief scale-pop when a point lands. The score is now the
// primary confirmation that a tap registered: `active:brightness-95` on a cell
// was a 5% shift for an action that costs a real point, and `useVibrate` is
// silently unavailable on iOS Safari. Transition-driven, so the global
// prefers-reduced-motion rule in theme.css zeroes it automatically.
const ticking = ref(false);
let tickTimer: ReturnType<typeof setTimeout> | undefined;
watch(
  () => props.score,
  (next, prev) => {
    if (next <= (prev ?? 0)) return;
    ticking.value = true;
    clearTimeout(tickTimer);
    tickTimer = setTimeout(() => {
      ticking.value = false;
    }, 150);
  }
);
</script>

<template>
  <div
    ref="half"
    class="relative flex flex-1 overflow-hidden bg-background transition-shadow duration-200"
    :class="[
      isGlowing
        ? team === 'A'
          ? 'shadow-[inset_0_0_0_3px_var(--color-team-a)] animate-glow-a'
          : 'shadow-[inset_0_0_0_3px_var(--color-team-b)] animate-glow-b'
        : // Only when it adds information. Under rally scoring the rally winner
          // always serves next, so in badminton this ring was permanently
          // duplicating the serving boundary tint — same colour, same half, two
          // borders. It still earns its place in table tennis, where serve
          // alternates every two points and the last winner may not be serving.
          lastWinner && !isServing && !matchOver
          ? team === 'A'
            ? 'shadow-[inset_0_0_0_2px_var(--color-team-a)]'
            : 'shadow-[inset_0_0_0_2px_var(--color-team-b)]'
          : '',
    ]"
  >
    <!-- Court mat. Painted below the tap layer so the button's active
         highlight still reads on top of it. -->
    <span
      class="pointer-events-none absolute rounded-[2px]"
      :class="surfaceClass ?? courtSurface[sport]"
      :style="matStyle"
    />

    <!-- Tap layer: the entire half, one target per team. Sits beneath the
         read-only overlays (pointer-events-none) and the setup pills (which
         opt back in), so it stays a real button rather than wrapping one. -->
    <button
      type="button"
      :disabled="matchOver"
      :aria-label="`Score a point for ${headerLabel}`"
      class="absolute inset-0 z-0 transition-colors duration-150 active:bg-foreground/10 disabled:cursor-not-allowed disabled:opacity-65"
      @click="emit('tap')"
    />

    <!-- Court markings: boundary, service line, centre line. The boundary
         itself carries the serving signal — it lights up in the serving team's
         colour. This replaced a full-bleed 4px edge bar, whose square ends were
         sliced by the court frame's rounded corners (the frame is
         `rounded-lg overflow-hidden`), so the accent read as a clipped strip. -->
    <span
      class="pointer-events-none absolute z-[1] rounded-[2px] border-court-line"
      :style="boundaryStyle"
    />
    <span
      v-if="servingBarStyle"
      class="pointer-events-none absolute z-[2] rounded-full transition-colors"
      :class="team === 'A' ? 'bg-team-a' : 'bg-team-b'"
      :style="servingBarStyle"
    />
    <span
      v-if="serviceLineStyle"
      class="pointer-events-none absolute z-[1] bg-court-line"
      :style="serviceLineStyle"
    />
    <span
      v-if="centreLineStyle"
      class="pointer-events-none absolute z-[1] bg-court-line"
      :style="centreLineStyle"
    />
    <span
      v-for="(style, i) in sidelineStyles"
      :key="i"
      class="pointer-events-none absolute z-[1] bg-court-line"
      :style="style"
    />
    <span
      v-if="longServiceLineStyle"
      class="pointer-events-none absolute z-[1] bg-court-line"
      :style="longServiceLineStyle"
    />

    <!-- Read-only content, laid out along the court's own axis so the score
         takes the backcourt and names sit in their service courts. -->
    <div
      class="pointer-events-none relative z-10 flex flex-1"
      :class="[
        isStacked
          ? orientation === 'bottom'
            ? 'flex-col-reverse'
            : 'flex-col'
          : orientation === 'right'
            ? 'flex-row-reverse'
            : 'flex-row',
      ]"
    >
      <!-- Status strip along the outer edge. Pure match state — cards +
           game-point chip in one slot, game pips in the other, with
           justify-between spreading them along the edge. Fixed slots, so
           nothing shifts when the chip or cards appear mid-rally. The strip
           follows the court's orientation: a row across the top edge when
           stacked, a column down the outer side in landscape — without the
           direction flip, a row inside the landscape flex-row parent collapses
           to content width and justify-between has nothing to distribute. -->
      <div
        class="flex flex-shrink-0 justify-between gap-2 px-3 py-2"
        :class="isStacked ? 'items-start' : 'flex-col items-center'"
      >
        <span class="flex min-w-0 items-center gap-1.5">
          <!-- Same component as the broadcast themes, so penalty state reads
               identically across control / overlay / scoreboard. -->
          <PenaltyCards v-if="cards" :cards="cards" size="xs" />
          <span
            v-if="isMatchPoint || isGamePoint"
            class="rounded-sm px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
            :class="
              team === 'A'
                ? 'bg-team-a text-team-a-foreground'
                : 'bg-team-b text-team-b-foreground'
            "
          >
            {{ isMatchPoint ? 'MATCH PT' : 'GAME PT' }}
          </span>
        </span>
        <span class="flex flex-shrink-0 gap-1 pt-0.5">
          <span
            v-for="i in totalSlots"
            :key="i"
            class="size-[7px] rounded-full"
            :class="
              i <= gamesWon
                ? team === 'A'
                  ? 'bg-team-a'
                  : 'bg-team-b'
                : 'bg-foreground/25'
            "
          />
        </span>
      </div>

      <!-- The score, centred in the service-court band (outer edge → short-
           service line). The strip between that line and the net is where
           nobody serves from, so centring across the full half sat everything
           ~15% too close to the net. -->
      <div
        class="pointer-events-none absolute inset-0 flex items-center justify-center px-3"
        :style="scoreBandStyle"
      >
        <span
          class="score text-[clamp(40px,8.5vh,80px)] leading-none tabular-nums text-foreground transition-transform duration-150 ease-out"
          :class="ticking ? 'scale-[1.08]' : 'scale-100'"
          :style="scoreFontPx ? { fontSize: `${scoreFontPx}px` } : undefined"
        >
          {{ score }}
        </span>
      </div>

      <!-- The players' strip (service line → net), identical in singles and
           doubles. Names sit centred in the court column they currently occupy
           under badminton's serving rules — the server by their score's parity,
           the receiver diagonally opposite — and hop courts as that changes.
           useCourtCells derives this for both modes, so the layout has one
           rule, not two. Non-interactive: the whole half is the tap target. -->
      <div
        class="pointer-events-none absolute inset-0 flex"
        :class="zoneFlow"
        :style="zonesBandStyle"
      >
        <!-- Fixed two-row grid in every court: a name row on a constant
             baseline and a reserved pill row beneath it. The rows exist even
             when empty, so a pill appearing/leaving (serve hand-off, receives,
             pre-match actions) never displaces a name, and all four courts'
             names share one baseline. -->
        <div
          v-for="cell in cells"
          :key="cell.key"
          class="relative flex flex-1 flex-col items-center justify-center px-2"
        >
          <span class="flex h-6 max-w-full items-center">
            <span
              v-if="cell.label"
              class="truncate text-[15px] font-semibold leading-tight text-foreground"
            >
              {{ cell.label }}
            </span>
          </span>
          <span class="flex h-7 items-center">
            <!-- Service-over cue: when the pill moves between courts (partner
                 swap on serve) or jumps teams (receiver won the rally), the
                 fade draws the operator's eye; without it the pill teleports. -->
            <Transition
              enter-active-class="transition duration-200 ease-out"
              enter-from-class="opacity-0 scale-90"
              enter-to-class="opacity-100 scale-100"
              leave-active-class="transition duration-150 ease-in"
              leave-from-class="opacity-100"
              leave-to-class="opacity-0"
            >
              <span
                v-if="cellIsServer(cell.court)"
                class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                :class="
                  team === 'A'
                    ? 'bg-team-a text-team-a-foreground'
                    : 'bg-team-b text-team-b-foreground'
                "
              >
                <span class="size-[5px] rounded-full bg-current opacity-70" />
                Serves
              </span>
            </Transition>
            <!-- Doubles only: with two opponents on court the diagonal-only
                 receiving rule is non-obvious and receiving out of turn is a
                 fault. Singles needs no label — one opponent, so "Serves"
                 opposite already says who receives. -->
            <span
              v-if="isReceiverZone(cell.court)"
              class="inline-flex items-center gap-1 rounded-full border border-foreground/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-fg-muted"
            >
              Receives
            </span>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
