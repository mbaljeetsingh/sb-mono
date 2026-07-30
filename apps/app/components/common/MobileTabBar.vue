<script setup lang="ts">
import { Separator } from '@sb/layer-ui/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@sb/layer-ui/components/ui/sheet';
import { useWindowScroll } from '@vueuse/core';
import {
  FileText,
  Github,
  Home,
  LogIn,
  LogOut,
  Menu,
  Plus,
  Shield,
  Trophy,
  User as UserIcon,
  UserPlus,
} from 'lucide-vue-next';
import type { Component } from 'vue';
import { computed, ref, watch } from 'vue';
import { useAuth } from '~/composables/useAuth';
import { useUserStore } from '~/stores/user';

const route = useRoute();
const userStore = useUserStore();
const { signOut } = useAuth();

const showMore = ref(false);

type Slot = {
  label: string;
  icon: Component;
  route?: string;
  isPrimary?: boolean;
  isMore?: boolean;
};

const profileTab = computed<Slot>(() =>
  userStore.isAuthenticated
    ? { label: 'Profile', route: '/profile', icon: UserIcon }
    : { label: 'Sign in', route: '/auth/signin', icon: UserIcon }
);

const barSlots = computed<Slot[]>(() => [
  { label: 'Home', route: '/', icon: Home },
  { label: 'Matches', route: '/matches', icon: Trophy },
  { label: 'New', route: '/new', icon: Plus, isPrimary: true },
  profileTab.value,
  { label: 'More', icon: Menu, isMore: true },
]);

const isActive = (tabRoute: string) => {
  if (tabRoute === '/') return route.path === '/';
  return route.path === tabRoute || route.path.startsWith(`${tabRoute}/`);
};

// Hide the bar while scrolling down, reveal on scroll-up (Reddit / iOS Safari
// pattern, same as np-mono) — the floating pill overlays content, so it tucks
// away while reading and returns the moment the user scrolls up. The trigger
// is the distance travelled since the last direction change (not per-event
// deltas, which never accumulate on slow scrolls). Near the top it is always
// shown. Programmatic jumps (route scroll restoration) re-anchor via the
// route watcher instead of counting as gestures.
const { y: scrollY } = useWindowScroll();
const isBarHidden = ref(false);
const SHOW_NEAR_TOP = 80;
const TRIGGER_DISTANCE = 24;
const SETTLE_MS = 700;
let anchorY = 0;
let lastY = 0;
let settleUntil = import.meta.client ? Date.now() + SETTLE_MS : 0;
watch(scrollY, (y) => {
  if (Date.now() < settleUntil) {
    anchorY = y;
    lastY = y;
    return;
  }
  const goingDown = y > lastY;
  const wasGoingDown = lastY > anchorY;
  if (goingDown !== wasGoingDown) anchorY = lastY;
  lastY = y;
  if (y < SHOW_NEAR_TOP) {
    isBarHidden.value = false;
  } else if (y - anchorY > TRIGGER_DISTANCE) {
    isBarHidden.value = true;
  } else if (anchorY - y > TRIGGER_DISTANCE) {
    isBarHidden.value = false;
  }
});
// Route changes are not gestures: show the bar and open a settle window so
// the restored scroll position can't hide it on arrival.
watch(
  () => route.path,
  () => {
    isBarHidden.value = false;
    settleUntil = Date.now() + SETTLE_MS;
  }
);
// Never hide under an open More sheet.
watch(showMore, (open) => {
  if (open) isBarHidden.value = false;
});

// Sliding pill indicator: one absolutely-positioned pill behind the
// equal-width slots, translated to the active index. The primary (New) slot
// keeps its raised circle as its own active state, so the pill skips it.
// While the More sheet is open the pill parks on the More slot; on routes
// that aren't tabs it fades out (pillIndex remembers the last position so
// the fade doesn't jump).
const activeIndex = computed(() => {
  if (showMore.value) return barSlots.value.length - 1;
  return barSlots.value.findIndex(
    (slot) => slot.route && !slot.isPrimary && isActive(slot.route)
  );
});
const pillIndex = ref(0);
watch(
  activeIndex,
  (index) => {
    if (index >= 0) pillIndex.value = index;
  },
  { immediate: true }
);

const closeMore = () => {
  showMore.value = false;
};

const handleSignOut = async () => {
  closeMore();
  await signOut();
};
</script>

<template>
  <!--
    Floating pill bar, detached from the screen edges (One UI / iOS style,
    ported from np-mono). Anchored with `top: calc(100dvh - bar height - gap)`
    rather than `bottom`: dvh tracks the dynamic viewport, so the bar stays at
    the *visible* bottom while the mobile browser toolbar expands/collapses.
    The bottom-[...] is kept as the no-dvh fallback; with top, bottom, and an
    explicit height all set, bottom is ignored when top is valid. Keep the
    calc in sync with h-14 here and the content padding in
    layouts/default.vue.
  -->
  <nav
    class="fixed left-3 right-3 z-40 h-14 rounded-full border border-border bg-background/85 shadow-lg backdrop-blur-xl bottom-[calc(0.75rem+env(safe-area-inset-bottom))] top-[calc(100dvh_-_3.5rem_-_0.75rem_-_env(safe-area-inset-bottom))] md:hidden transition-transform duration-300 ease-out motion-reduce:transition-none"
    :class="isBarHidden && 'translate-y-[200%] pointer-events-none'"
    :inert="isBarHidden"
  >
    <div class="relative flex h-full items-center justify-around">
      <!-- Sliding pill (paints under the slots, which are position:relative) -->
      <div
        class="absolute inset-y-1.5 left-0 transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.34,1.3,0.64,1)] motion-reduce:transition-none"
        :class="activeIndex < 0 ? 'opacity-0' : 'opacity-100'"
        :style="{
          width: `calc(100% / ${barSlots.length})`,
          transform: `translateX(${pillIndex * 100}%)`,
        }"
        aria-hidden="true"
      >
        <div class="mx-1.5 h-full rounded-full bg-primary/10" />
      </div>

      <template v-for="slot in barSlots" :key="slot.label">
        <NuxtLink
          v-if="slot.isPrimary"
          :to="slot.route"
          class="relative flex flex-1 items-center justify-center"
          :aria-label="slot.label"
        >
          <span
            class="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-transform active:scale-95"
          >
            <component :is="slot.icon" class="h-5 w-5" />
          </span>
          <span class="sr-only">{{ slot.label }}</span>
        </NuxtLink>
        <button
          v-else-if="slot.isMore"
          type="button"
          class="relative flex flex-1 flex-col items-center justify-center gap-0.5 py-1 text-muted-foreground transition-colors"
          :class="showMore && 'text-primary'"
          @click="showMore = true"
        >
          <component :is="slot.icon" class="h-5 w-5" />
          <span class="text-[10px] font-medium">{{ slot.label }}</span>
        </button>
        <NuxtLink
          v-else
          :to="slot.route"
          class="relative flex flex-1 flex-col items-center justify-center gap-0.5 py-1 text-muted-foreground transition-colors"
          :class="isActive(slot.route!) && 'text-primary'"
        >
          <component :is="slot.icon" class="h-5 w-5" />
          <span class="text-[10px] font-medium">{{ slot.label }}</span>
        </NuxtLink>
      </template>
    </div>
  </nav>

  <Sheet v-model:open="showMore">
    <SheetContent side="bottom" class="md:hidden">
      <SheetHeader class="px-4 pt-4 pb-2">
        <SheetTitle>More</SheetTitle>
        <SheetDescription class="sr-only">
          Additional navigation options
        </SheetDescription>
      </SheetHeader>

      <div class="px-2 pb-safe">
        <NuxtLink
          to="/privacy"
          class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
          @click="closeMore"
        >
          <Shield class="h-4 w-4 text-muted-foreground" />
          Privacy
        </NuxtLink>
        <NuxtLink
          to="/terms"
          class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
          @click="closeMore"
        >
          <FileText class="h-4 w-4 text-muted-foreground" />
          Terms
        </NuxtLink>
        <a
          href="https://github.com/mbaljeetsingh/sb-mono"
          target="_blank"
          rel="noopener noreferrer"
          class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
          @click="closeMore"
        >
          <Github class="h-4 w-4 text-muted-foreground" />
          GitHub
        </a>

        <Separator class="my-2" />

        <template v-if="userStore.isAuthenticated">
          <button
            type="button"
            class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
            @click="handleSignOut"
          >
            <LogOut class="h-4 w-4" />
            Sign out
          </button>
        </template>
        <template v-else>
          <NuxtLink
            to="/auth/signin"
            class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
            @click="closeMore"
          >
            <LogIn class="h-4 w-4 text-muted-foreground" />
            Sign in
          </NuxtLink>
          <NuxtLink
            to="/auth/signup"
            class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
            @click="closeMore"
          >
            <UserPlus class="h-4 w-4 text-muted-foreground" />
            Create account
          </NuxtLink>
        </template>
      </div>
    </SheetContent>
  </Sheet>
</template>
