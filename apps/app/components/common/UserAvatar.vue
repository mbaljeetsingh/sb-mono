<script setup lang="ts">
// Minimal avatar — image when avatar_url is set, otherwise initial of display_name (or email).
const props = withDefaults(
  defineProps<{
    name?: string | null;
    email?: string | null;
    src?: string | null;
    size?: number;
  }>(),
  { size: 32 },
);

const initial = computed(() => {
  const source = (props.name || props.email || "?").trim();
  return (source.charAt(0) || "?").toUpperCase();
});
</script>

<template>
  <span
    class="inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-primary/10 font-medium text-primary"
    :style="{
      width: `${size}px`,
      height: `${size}px`,
      fontSize: `${Math.round(size * 0.42)}px`,
    }"
    :aria-label="name || email || 'User'"
  >
    <img
      v-if="src"
      :src="src"
      :alt="name || email || 'User'"
      class="h-full w-full object-cover"
    />
    <template v-else>{{ initial }}</template>
  </span>
</template>
