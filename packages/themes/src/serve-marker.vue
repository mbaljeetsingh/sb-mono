<script setup lang="ts">
// Server indicator. Professional scoring graphics mark the server with a small
// solid glyph beside the name — a dot on a tennis/badminton bug, a caret
// pointing at the serving row on a stacked board. None of them spell out the
// word "SERVE": at broadcast size the word costs more space than the name it
// sits next to, and it re-reads on every rally.
//
// Themes pass the team color in (via `teamColor(side)`) so the marker inherits
// the same identity as the rest of the row.

import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    /** CSS color — normally `teamColor(side)`. */
    color: string;
    size?: 'xs' | 'sm' | 'md' | 'lg';
    /** `dot` for inline use next to a name; `caret` to point at a row. */
    variant?: 'dot' | 'caret';
    /** Which way a caret points. Ignored by `dot`. */
    direction?: 'right' | 'left';
    /** Pulse. Global prefers-reduced-motion already freezes this. */
    animate?: boolean;
  }>(),
  { size: 'sm', variant: 'dot', direction: 'right', animate: true }
);

// Venue boards scale with the viewport, so `lg` is fluid rather than fixed —
// the marker has to stay legible from the back of a hall.
const DOT: Record<string, string> = {
  xs: '5px',
  sm: '8px',
  md: '12px',
  lg: 'clamp(12px,2vmin,22px)',
};

const CARET: Record<string, string> = {
  xs: '4px',
  sm: '6px',
  md: '9px',
  lg: 'clamp(9px,1.6vmin,16px)',
};

const dotStyle = computed(() => ({
  width: DOT[props.size],
  height: DOT[props.size],
  background: props.color,
}));

// Border-trick triangle: keeps the marker a single element with no SVG and no
// font dependency, and it scales cleanly with the clamp sizes above.
const caretStyle = computed(() => {
  const s = CARET[props.size];
  const facing =
    props.direction === 'right' ? 'borderLeftColor' : 'borderRightColor';
  return {
    borderTop: `${s} solid transparent`,
    borderBottom: `${s} solid transparent`,
    [props.direction === 'right' ? 'borderLeft' : 'borderRight']:
      `${s} solid transparent`,
    [facing]: props.color,
  };
});
</script>

<template>
  <span
    v-if="variant === 'dot'"
    class="inline-block shrink-0 rounded-full align-middle"
    :class="animate ? 'animate-pulse-soft' : ''"
    :style="dotStyle"
    role="img"
    aria-label="Serving"
    title="Serving"
  />
  <span
    v-else
    class="inline-block shrink-0 align-middle"
    :class="animate ? 'animate-pulse-soft' : ''"
    :style="caretStyle"
    role="img"
    aria-label="Serving"
    title="Serving"
  />
</template>
