<script setup lang="ts">
// Sport glyph for theme headers. Uses the same emoji as SportPicker on /new
// so the visual identity is consistent across creation, control, and broadcast
// surfaces. Renders nothing for unknown sports.
//
// Sized via parent's font-size (the emoji inherits via line-height: 1).

import { computed } from "vue";

const props = defineProps<{ sport: string | null | undefined }>();

const SPORT_EMOJI: Record<string, string> = {
  badminton: "🏸",
  tennis: "🎾",
  pickleball: "🥎",
  "table-tennis": "🏓",
};

const emoji = computed(() =>
  props.sport ? (SPORT_EMOJI[props.sport] ?? "") : "",
);
</script>

<template>
  <span
    v-if="emoji"
    aria-hidden="true"
    class="inline-block leading-none"
    style="
      font-family:
        &quot;Apple Color Emoji&quot;, &quot;Segoe UI Emoji&quot;,
        &quot;Noto Color Emoji&quot;, sans-serif;
    "
  >
    {{ emoji }}
  </span>
</template>
