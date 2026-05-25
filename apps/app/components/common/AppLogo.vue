<script setup lang="ts">
// App logo. Renders the icon mark (public/logo.png) + the "Scoreboard"
// wordmark next to it. np-mono pattern: image is height-driven, width auto.

import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    linkTo?: string;
    size?: "sm" | "md" | "lg" | "xl";
    emphasized?: boolean;
  }>(),
  { linkTo: "/", size: "md", emphasized: false },
);

const appVersion = __APP_VERSION__;

const sizeClasses = computed(() => {
  const sizes = {
    sm: { gap: "gap-2", img: "h-6", text: "text-sm" },
    md: { gap: "gap-2", img: "h-8", text: "text-lg" },
    lg: { gap: "gap-3", img: "h-12", text: "text-xl" },
    xl: { gap: "gap-4", img: "h-16", text: "text-2xl" },
  };
  const base = sizes[props.size];
  if (props.emphasized) {
    const emphasizedText = {
      sm: "text-base",
      md: "text-xl",
      lg: "text-2xl",
      xl: "text-3xl",
    }[props.size];
    return { ...base, text: emphasizedText };
  }
  return base;
});
</script>

<template>
  <NuxtLink
    :to="linkTo"
    class="inline-flex items-center font-semibold tracking-tight text-foreground"
    :class="sizeClasses.gap"
  >
    <img
      src="/logo.png"
      alt="Scoreboard"
      class="w-auto rounded-lg"
      :class="sizeClasses.img"
    />
    <div class="relative">
      <p :class="[sizeClasses.text, emphasized ? 'font-bold' : 'font-medium']">
        Scoreboard
      </p>
      <span
        class="absolute -bottom-1.5 right-0 whitespace-nowrap leading-none text-fg-muted"
        style="font-size: 9px"
      >
        v{{ appVersion }}
      </span>
    </div>
  </NuxtLink>
</template>
