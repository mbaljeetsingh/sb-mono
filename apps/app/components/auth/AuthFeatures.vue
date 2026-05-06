<script setup lang="ts">
import { useCycleList, useIntervalFn } from "@vueuse/core";
import { Trophy, Tv, Smartphone, Share2, Palette, Wifi } from "lucide-vue-next";
import AppLogo from "~/components/common/AppLogo.vue";

const features = [
  {
    icon: Trophy,
    title: "Score badminton like a pro",
    description:
      "BWF rules built-in: 21pt / 15pt, deuce, cap-30, interval-11, server court — every nuance, no guesswork.",
  },
  {
    icon: Tv,
    title: "Stream-ready overlays",
    description:
      "Drop a transparent overlay URL into OBS. Five broadcast themes ship in v1, more on the way.",
  },
  {
    icon: Smartphone,
    title: "Tap to score, anywhere",
    description:
      "Phone-first control surface with two tap zones, undo, server indicator, and wake-lock that holds.",
  },
  {
    icon: Share2,
    title: "Share a link, share the score",
    description:
      "Public scoreboard URLs anyone can open. Update live as you tap. Nothing to install.",
  },
  {
    icon: Palette,
    title: "Themes that look right on broadcast",
    description:
      "Hand-picked color palettes, typographic ribbons, minimal bug. Pick one, looks polished out of the box.",
  },
  {
    icon: Wifi,
    title: "Offline-first PWA",
    description:
      "Venue Wi-Fi flaky? Score offline; events sync the moment you reconnect.",
  },
];

const {
  state: currentFeature,
  index: currentIndex,
  go,
} = useCycleList(features);

const { pause, resume } = useIntervalFn(() => {
  go((currentIndex.value + 1) % features.length);
}, 5000);

const goToSlide = (i: number) => {
  pause();
  go(i);
  resume();
};
</script>

<template>
  <div
    class="hidden min-h-screen items-center justify-center bg-muted md:flex md:w-1/2"
  >
    <div class="flex flex-col items-center px-12 text-center">
      <AppLogo link-to="/" size="xl" emphasized class="mb-20" />
      <div
        class="flex h-14 w-14 items-center justify-center rounded-xl bg-background shadow-sm"
      >
        <component :is="currentFeature.icon" class="h-7 w-7 text-foreground" />
      </div>

      <h2 class="mt-6 text-2xl font-bold tracking-tight">
        {{ currentFeature.title }}
      </h2>
      <p class="mt-2 max-w-sm text-base text-muted-foreground">
        {{ currentFeature.description }}
      </p>

      <div class="mt-8 flex items-center gap-2">
        <button
          v-for="(_, i) in features"
          :key="i"
          :aria-label="`Go to slide ${i + 1}`"
          class="h-2 w-2 rounded-full transition-colors"
          :class="
            i === currentIndex
              ? 'bg-foreground'
              : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
          "
          @click="goToSlide(i)"
        />
      </div>
    </div>
  </div>
</template>
