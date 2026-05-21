<script setup lang="ts">
// Dropdown theme switcher (Light / Dark / System). Sits next to NavUser in
// the operator-app header. Broadcast surfaces opt out of dark mode via
// definePageMeta({ colorMode: 'light' }) so toggling here never affects an
// OBS feed.

import { computed } from "vue";
import { Sun, Moon, Laptop } from "lucide-vue-next";
import { Button } from "@sb/layer-ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@sb/layer-ui/components/ui/dropdown-menu";
import { useThemeStore } from "~/stores/theme";

const themeStore = useThemeStore();
const { THEME_OPTIONS, setTheme } = themeStore;
const currentTheme = computed(() => themeStore.theme);
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="ghost" size="icon-sm" aria-label="Toggle theme">
        <Sun v-if="currentTheme === THEME_OPTIONS.LIGHT" class="size-4" />
        <Moon v-else-if="currentTheme === THEME_OPTIONS.DARK" class="size-4" />
        <Laptop v-else class="size-4" />
        <span class="sr-only">Toggle theme</span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-36">
      <DropdownMenuItem @click="setTheme(THEME_OPTIONS.LIGHT)">
        <Sun class="mr-2 size-4" />
        <span>Light</span>
      </DropdownMenuItem>
      <DropdownMenuItem @click="setTheme(THEME_OPTIONS.DARK)">
        <Moon class="mr-2 size-4" />
        <span>Dark</span>
      </DropdownMenuItem>
      <DropdownMenuItem @click="setTheme(THEME_OPTIONS.SYSTEM)">
        <Laptop class="mr-2 size-4" />
        <span>System</span>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
