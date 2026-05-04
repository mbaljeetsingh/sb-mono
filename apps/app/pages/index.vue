<script setup lang="ts">
import { ulid } from "ulid";

definePageMeta({ layout: false });

const startMatch = () => navigateTo(`/m/${ulid()}/control`);
</script>

<template>
  <div
    class="min-h-screen flex flex-col bg-background text-foreground font-sans p-6"
  >
    <header class="flex items-center justify-between mb-14">
      <div class="text-2xl font-bold font-[var(--font-accent)]">scoreboard</div>
      <nav class="flex gap-4 text-sm text-fg-muted">
        <a href="/themes" class="hover:text-foreground">Themes</a>
        <a href="https://github.com/scoreboard" class="hover:text-foreground"
          >GitHub</a
        >
      </nav>
    </header>

    <main class="flex-1 flex flex-col justify-center max-w-2xl">
      <h1 class="text-[44px] font-semibold tracking-tight leading-[1.05] mb-3">
        A live scorecard for racquet sports.
      </h1>
      <p class="text-[17px] text-fg-muted leading-relaxed mb-8">
        Score from your phone. Show on OBS, a TV, or anywhere.
      </p>

      <div class="flex gap-3 mb-6 flex-wrap">
        <button
          type="button"
          class="h-12 px-6 rounded-md bg-brand text-brand-foreground font-semibold hover:bg-brand-hover transition-colors"
          @click="startMatch"
        >
          Start a match
        </button>
        <button
          type="button"
          class="h-12 px-6 rounded-md bg-transparent border-[1.5px] border-border-strong text-foreground font-semibold hover:bg-surface-2 transition-colors"
        >
          Log a result
        </button>
      </div>

      <ul class="flex gap-2 text-sm text-fg-subtle list-none p-0 m-0">
        <li>No signup</li>
        <li>·</li>
        <li>Open source</li>
        <li>·</li>
        <li>Self-host</li>
      </ul>
    </main>

    <footer class="flex gap-4 text-[11px] text-fg-subtle pt-8 mt-auto">
      <span>MIT · Open source</span>
      <a href="https://github.com/scoreboard" class="hover:text-foreground"
        >github</a
      >
      <a href="/legal/privacy" class="hover:text-foreground">privacy</a>
    </footer>
  </div>
</template>
