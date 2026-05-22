<script setup lang="ts">
import { computed } from "vue";
import { Play, RefreshCcw, Home } from "lucide-vue-next";
import { Button } from "@sb/layer-ui/components/ui/button";
import { clearError } from "#app";
import AppHeader from "~/components/common/AppHeader.vue";

// App-root error boundary. Nuxt renders this layoutless for any uncaught
// error AND for top-level 404s (paths outside /m/* fall through to here;
// `pages/m/[...notfound].vue` handles match-specific 404s with more context).

const props = defineProps<{
  error: {
    statusCode?: number;
    statusMessage?: string;
    message?: string;
    url?: string;
  };
}>();

const isNotFound = computed(() => props.error?.statusCode === 404);
const isForbidden = computed(() => props.error?.statusCode === 403);

const title = computed(() => {
  if (isNotFound.value) return "Page not found";
  if (isForbidden.value) return "Access denied";
  return "Something went wrong";
});

const body = computed(() => {
  if (isNotFound.value) {
    return "That URL doesn't lead anywhere. Maybe the link was mistyped, or the page moved.";
  }
  if (isForbidden.value) {
    return (
      props.error?.message || "You don't have permission to view this page."
    );
  }
  return (
    props.error?.message ||
    "An unexpected error broke this page. The match data is safe — your scores are stored locally and in the cloud."
  );
});

const statusLabel = computed(() => String(props.error?.statusCode ?? "Error"));

if (typeof console !== "undefined" && !isNotFound.value) {
  console.error("[error.vue]", props.error);
}

const onRetry = () => clearError({ redirect: "/" });
const onHome = () => clearError({ redirect: "/" });
const onNewMatch = () => clearError({ redirect: "/new" });
</script>

<template>
  <div
    class="min-h-screen bg-background text-foreground font-sans flex flex-col"
  >
    <AppHeader />

    <div
      class="flex flex-1 flex-col items-center justify-center text-center px-6"
    >
      <div
        class="score text-[96px] text-border-strong leading-none tracking-tight mb-2"
      >
        {{ statusLabel }}
      </div>
      <h1 class="text-2xl font-semibold tracking-tight mb-2">{{ title }}</h1>
      <p class="text-fg-muted text-sm leading-relaxed max-w-sm mb-7">
        {{ body }}
      </p>

      <div class="flex flex-col gap-2 w-full max-w-xs">
        <template v-if="isNotFound">
          <Button size="lg" class="h-11 font-semibold" @click="onNewMatch">
            <Play class="size-4" />
            Start a new match
          </Button>
          <Button variant="ghost" @click="onHome">
            <Home class="size-4" />
            Go to home
          </Button>
        </template>
        <template v-else>
          <Button size="lg" class="h-11 font-semibold" @click="onRetry">
            <RefreshCcw class="size-4" />
            Try again
          </Button>
          <Button variant="ghost" @click="onHome">
            <Home class="size-4" />
            Go to home
          </Button>
        </template>
      </div>
    </div>

    <div
      class="flex h-14 shrink-0 items-end justify-center pb-4 text-[11px] text-fg-subtle"
    >
      scoreboard.app
    </div>
  </div>
</template>
