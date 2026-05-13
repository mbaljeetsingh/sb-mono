<script setup lang="ts">
// Shared penalty-card render. BWF Law 16:
//  - yellow = warning
//  - red    = fault (point awarded to opponent — engine handles)
//  - black  = disqualification (engine ends the match)
// One rectangle per card, shaped to read as a real penalty card. Themes
// pick a size token to match their density.

const props = withDefaults(
  defineProps<{
    cards: { yellow: number; red: number; black: number };
    size?: "xs" | "sm" | "md";
  }>(),
  { size: "sm" },
);

const dim =
  props.size === "xs"
    ? "h-[10px] w-[7px]"
    : props.size === "md"
      ? "h-[13px] w-[9px]"
      : "h-[12px] w-[8px]";
</script>

<template>
  <span
    v-if="cards.yellow || cards.red || cards.black"
    class="inline-flex items-center gap-0.5 align-middle"
  >
    <span
      v-for="i in cards.yellow"
      :key="`y${i}`"
      :class="[
        dim,
        'inline-block rounded-[1px] bg-yellow-400 ring-1 ring-yellow-600/60',
      ]"
      title="Yellow card"
    />
    <span
      v-for="i in cards.red"
      :key="`r${i}`"
      :class="[
        dim,
        'inline-block rounded-[1px] bg-red-600 ring-1 ring-red-900/60',
      ]"
      title="Red card"
    />
    <span
      v-for="i in cards.black"
      :key="`b${i}`"
      :class="[
        dim,
        'inline-block rounded-[1px] bg-black ring-1 ring-neutral-300/40',
      ]"
      title="Black card"
    />
  </span>
</template>
