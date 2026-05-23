<script setup lang="ts">
import type { Component } from "vue";
import { computed, ref } from "vue";
import {
  Home,
  Trophy,
  Plus,
  User as UserIcon,
  Menu,
  LogOut,
  LogIn,
  UserPlus,
  Sun,
  Moon,
  Laptop,
  Shield,
  FileText,
  Github,
} from "lucide-vue-next";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@sb/layer-ui/components/ui/sheet";
import { Separator } from "@sb/layer-ui/components/ui/separator";
import { useUserStore } from "~/stores/user";
import { useAuth } from "~/composables/useAuth";
import { useThemeStore } from "~/stores/theme";

const route = useRoute();
const userStore = useUserStore();
const { signOut } = useAuth();
const themeStore = useThemeStore();
const { THEME_OPTIONS, setTheme } = themeStore;
const currentTheme = computed(() => themeStore.theme);

const showMore = ref(false);

type Tab = {
  label: string;
  route: string;
  icon: Component;
  isPrimary?: boolean;
};

const profileTab = computed<Tab>(() =>
  userStore.isAuthenticated
    ? { label: "Profile", route: "/profile", icon: UserIcon }
    : { label: "Sign in", route: "/auth/signin", icon: UserIcon },
);

const tabs = computed<Tab[]>(() => [
  { label: "Home", route: "/", icon: Home },
  { label: "Matches", route: "/matches", icon: Trophy },
  { label: "New", route: "/new", icon: Plus, isPrimary: true },
  profileTab.value,
]);

const isActive = (tabRoute: string) => {
  if (tabRoute === "/") return route.path === "/";
  return route.path === tabRoute || route.path.startsWith(tabRoute + "/");
};

const closeMore = () => {
  showMore.value = false;
};

const handleSignOut = async () => {
  closeMore();
  await signOut();
};
</script>

<template>
  <nav
    class="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 pb-safe backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden"
  >
    <div class="flex h-14 items-center justify-around">
      <template v-for="tab in tabs" :key="tab.route">
        <NuxtLink
          v-if="tab.isPrimary"
          :to="tab.route"
          class="flex flex-1 items-center justify-center"
          :aria-label="tab.label"
        >
          <span
            class="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-transform active:scale-95"
          >
            <component :is="tab.icon" class="h-5 w-5" />
          </span>
          <span class="sr-only">{{ tab.label }}</span>
        </NuxtLink>
        <NuxtLink
          v-else
          :to="tab.route"
          class="flex flex-1 flex-col items-center justify-center gap-0.5 py-1 text-muted-foreground transition-colors"
          :class="isActive(tab.route) && 'text-foreground'"
        >
          <component :is="tab.icon" class="h-5 w-5" />
          <span class="text-[10px] font-medium">{{ tab.label }}</span>
        </NuxtLink>
      </template>

      <button
        type="button"
        class="flex flex-1 flex-col items-center justify-center gap-0.5 py-1 text-muted-foreground transition-colors"
        :class="showMore && 'text-foreground'"
        @click="showMore = true"
      >
        <Menu class="h-5 w-5" />
        <span class="text-[10px] font-medium">More</span>
      </button>
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
        <div
          class="px-2 pb-2 text-xs font-medium uppercase text-muted-foreground"
        >
          Theme
        </div>
        <div class="grid grid-cols-3 gap-2 px-2 pb-2">
          <button
            type="button"
            class="flex flex-col items-center justify-center gap-1 rounded-lg border border-border py-2 text-xs transition-colors hover:bg-accent"
            :class="
              currentTheme === THEME_OPTIONS.LIGHT
                ? 'border-foreground/40 bg-accent'
                : ''
            "
            @click="setTheme(THEME_OPTIONS.LIGHT)"
          >
            <Sun class="h-4 w-4" />
            Light
          </button>
          <button
            type="button"
            class="flex flex-col items-center justify-center gap-1 rounded-lg border border-border py-2 text-xs transition-colors hover:bg-accent"
            :class="
              currentTheme === THEME_OPTIONS.DARK
                ? 'border-foreground/40 bg-accent'
                : ''
            "
            @click="setTheme(THEME_OPTIONS.DARK)"
          >
            <Moon class="h-4 w-4" />
            Dark
          </button>
          <button
            type="button"
            class="flex flex-col items-center justify-center gap-1 rounded-lg border border-border py-2 text-xs transition-colors hover:bg-accent"
            :class="
              currentTheme === THEME_OPTIONS.SYSTEM
                ? 'border-foreground/40 bg-accent'
                : ''
            "
            @click="setTheme(THEME_OPTIONS.SYSTEM)"
          >
            <Laptop class="h-4 w-4" />
            System
          </button>
        </div>

        <Separator class="my-2" />

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
