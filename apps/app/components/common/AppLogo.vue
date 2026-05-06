<script setup lang="ts">
// Minimal app logo. Click → navigate to linkTo (defaults to "/").
withDefaults(
  defineProps<{
    linkTo?: string;
    size?: "sm" | "md" | "lg" | "xl";
    emphasized?: boolean;
  }>(),
  { linkTo: "/", size: "md", emphasized: false },
);

const sizeClasses: Record<string, string> = {
  sm: "text-base",
  md: "text-lg",
  lg: "text-xl",
  xl: "text-2xl",
};
</script>

<template>
  <NuxtLink
    :to="linkTo"
    class="inline-flex items-center gap-2 font-semibold tracking-tight"
    :class="[
      sizeClasses[size],
      emphasized ? 'text-foreground' : 'text-foreground/90',
    ]"
  >
    <span
      class="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground shadow-sm"
      aria-hidden="true"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.4"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M7 9v6M17 9v6M12 5v14" />
      </svg>
    </span>
    <span>Scoreboard</span>
  </NuxtLink>
</template>
