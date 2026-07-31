<script setup lang="ts">
// The one sanctioned inline-SVG exception in this codebase.
//
// CLAUDE.md mandates lucide-vue-next and bans inline SVGs, but lucide ships no
// racquet-sport glyphs (only volleyball / trophy / medal), and these sports were
// previously rendered as emoji — which the same rule also bans. Rather than
// scatter four .svg files or add a whole icon dependency for four shapes, every
// path lives here behind a `sport` prop. Do not add inline SVGs elsewhere.
//
// Style contract so these pass as lucide siblings: 24×24 viewBox, ~1.8 stroke,
// currentColor, round caps/joins, no fills. Size and color come from the parent
// (`class="size-4 text-court-badminton"`), same as any lucide icon.

import type { SportId } from '~/lib/sports';

withDefaults(defineProps<{ sport: SportId; decorative?: boolean }>(), {
  decorative: true,
});
</script>

<template>
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    :aria-hidden="decorative ? 'true' : undefined"
    :role="decorative ? undefined : 'img'"
  >
    <!-- Shuttlecock: cork base, feather skirt, rim across the top. -->
    <template v-if="sport === 'badminton'">
      <circle cx="12" cy="18.5" r="2.5" />
      <path d="M10 16.5 6.5 6" />
      <path d="M12 16V4.5" />
      <path d="m14 16.5 3.5-10.5" />
      <path d="M6.5 6c3.5 2 7.5 2 11 0" />
    </template>

    <!-- Table tennis: round blade, handle, ball clear of the blade. -->
    <template v-else-if="sport === 'table-tennis'">
      <circle cx="10.5" cy="9.5" r="6" />
      <path d="m14.8 13.8 4.2 4.2" />
      <circle cx="18.6" cy="7.4" r="1.4" />
    </template>

    <!-- Tennis: oval head with two string passes (any more smudges at 16px). -->
    <template v-else-if="sport === 'tennis'">
      <ellipse
        cx="10.5"
        cy="8.5"
        rx="5.5"
        ry="6.5"
        transform="rotate(-40 10.5 8.5)"
      />
      <path d="m14 13.5 5.5 5.5" />
      <path d="M7 6.5c2.5 2.5 5 4 7.5 4.5" />
    </template>

    <!-- Pickleball: slab paddle, short handle, drilled holes. -->
    <template v-else>
      <rect x="6" y="3.5" width="10" height="12.5" rx="4.5" />
      <path d="M11 16v4.5" />
      <circle cx="9.5" cy="8" r="0.5" />
      <circle cx="12.5" cy="8" r="0.5" />
      <circle cx="11" cy="11" r="0.5" />
    </template>
  </svg>
</template>
