<script setup lang="ts">
import { Github } from "lucide-vue-next";

const year = new Date().getFullYear();
</script>

<template>
  <footer
    class="mt-12 border-t bg-background/60 pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-sm text-fg-muted sm:pl-[max(1rem,env(safe-area-inset-left))] sm:pr-[max(1rem,env(safe-area-inset-right))]"
  >
    <div
      class="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 sm:flex-row"
    >
      <div class="flex items-center gap-2">
        <span>© {{ year }} Scoreboard</span>
        <span aria-hidden="true">·</span>
        <span>MIT-licensed open source</span>
      </div>
      <nav class="flex items-center gap-4">
        <NuxtLink
          to="/privacy"
          class="underline-offset-4 hover:text-foreground hover:underline"
        >
          Privacy
        </NuxtLink>
        <NuxtLink
          to="/terms"
          class="underline-offset-4 hover:text-foreground hover:underline"
        >
          Terms
        </NuxtLink>
        <a
          href="https://github.com/mbaljeetsingh/sb-mono"
          target="_blank"
          rel="noopener noreferrer"
          class="flex items-center gap-1.5 underline-offset-4 hover:text-foreground hover:underline"
        >
          <Github class="size-3.5" />
          GitHub
        </a>
      </nav>
    </div>
  </footer>
</template>
