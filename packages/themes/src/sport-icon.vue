<script setup lang="ts">
// Sport glyph for theme headers. Renders nothing for unknown sports.
//
// Emoji rather than the hand-drawn SportGlyph the app uses on /new and
// /control: that component lives in apps/app and this package can't reach it,
// and a broadcast header wants a filled colour mark at small sizes anyway.
//
// Sized via parent's font-size (the emoji inherits via line-height: 1).

import { computed } from 'vue';

const props = defineProps<{ sport: string | null | undefined }>();

const SPORT_EMOJI: Record<string, string> = {
  badminton: '🏸',
  tennis: '🎾',
  pickleball: '🥎',
  // Unicode ships no padel racket, and padel's ball really is a tennis ball
  // with less pressure — so it shares 🎾 rather than borrowing another sport's
  // mark. The two are told apart by the format line, which names the sport.
  padel: '🎾',
  'table-tennis': '🏓',
};

const emoji = computed(() =>
  props.sport ? (SPORT_EMOJI[props.sport] ?? '') : ''
);
</script>

<template>
  <span
    v-if="emoji"
    aria-hidden="true"
    class="inline-block leading-none"
    style="
      font-family:
        'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif;
    "
  >
    {{ emoji }}
  </span>
</template>
