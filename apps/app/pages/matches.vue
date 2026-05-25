<script setup lang="ts">
import { ref, computed, useTemplateRef, watch } from "vue";
import { useInfiniteScroll } from "@vueuse/core";
import { Button } from "@sb/layer-ui/components/ui/button";
import MatchListItem from "~/components/match/MatchListItem.vue";
import { useUserStore } from "~/stores/user";
import { collectLocalMatchIds } from "~/lib/localMatches";

useSeoMeta({ title: "Matches · Scoreboard" });

type MatchRow = {
  id: string;
  sport_preset: string;
  config: { gamesToWin?: number } | null;
  team_name_a: string | null;
  team_name_b: string | null;
  event_name: string | null;
  court_label: string | null;
  updated_at: string;
};

const PAGE_SIZE = 20;

const supabase = useSupabaseClient();
const userStore = useUserStore();
const ownerId = computed(() => userStore.currentUser?.id ?? "");
const isAuthed = computed(() => userStore.isAuthenticated);

const matches = ref<MatchRow[]>([]);
const loading = ref(false);
const done = ref(false);
const error = ref<string | null>(null);

const loadRemote = async () => {
  if (loading.value || done.value || !ownerId.value) return;
  loading.value = true;
  const from = matches.value.length;
  const to = from + PAGE_SIZE - 1;
  const { data, error: err } = await supabase
    .from("matches")
    .select(
      "id, sport_preset, config, team_name_a, team_name_b, event_name, court_label, updated_at",
    )
    .eq("owner_id", ownerId.value)
    .order("updated_at", { ascending: false })
    .range(from, to);
  loading.value = false;
  if (err) {
    error.value = err.message;
    return;
  }
  const rows = (data ?? []) as MatchRow[];
  matches.value.push(...rows);
  if (rows.length < PAGE_SIZE) done.value = true;
};

// Signed-out: filter to match IDs this device scored AND that are still
// anon-owned. The owner_id IS NULL guard keeps wt co-scorers (who scored a
// match they don't own) and anyone who only viewed the match out of the
// list — only your own anon matches show up here. No pagination — local
// lists are tiny and finite.
const loadLocalScoped = async () => {
  loading.value = true;
  const ids = await collectLocalMatchIds();
  if (ids.length === 0) {
    matches.value = [];
    done.value = true;
    loading.value = false;
    return;
  }
  const { data, error: err } = await supabase
    .from("matches")
    .select(
      "id, sport_preset, config, team_name_a, team_name_b, event_name, court_label, updated_at",
    )
    .in("id", ids)
    .is("owner_id", null)
    .order("updated_at", { ascending: false });
  loading.value = false;
  if (err) {
    error.value = err.message;
    return;
  }
  matches.value = (data ?? []) as MatchRow[];
  done.value = true;
};

const reload = () => {
  matches.value = [];
  done.value = false;
  error.value = null;
  if (isAuthed.value) loadRemote();
  else loadLocalScoped();
};

const scroller = useTemplateRef<HTMLElement>("scroller");
useInfiniteScroll(
  scroller,
  () => {
    if (isAuthed.value) loadRemote();
  },
  { distance: 200 },
);

onMounted(reload);
// Re-source the list when auth state flips (sign-in claim → matches return
// from Supabase; sign-out → fall back to localStorage view).
watch(isAuthed, reload);

const onMatchDeleted = (id: string) => {
  matches.value = matches.value.filter((m) => m.id !== id);
};

const emptyLabel = computed(() =>
  isAuthed.value ? "No matches yet." : "No matches on this device yet.",
);
</script>

<template>
  <div
    ref="scroller"
    class="mx-auto h-[calc(100vh-3.5rem)] w-full max-w-3xl overflow-y-auto px-6 py-10"
  >
    <header class="mb-6 flex items-baseline justify-between gap-4">
      <h1 class="text-3xl font-semibold tracking-tight">Matches</h1>
      <NuxtLink
        to="/new"
        class="text-sm font-medium text-brand underline-offset-4 hover:underline"
      >
        Start a match →
      </NuxtLink>
    </header>

    <div
      v-if="!isAuthed"
      class="mb-4 rounded-md border border-dashed border-border-strong bg-surface px-3 py-2 text-xs text-fg-muted"
    >
      <p>
        Showing matches scored on this device.
        <NuxtLink to="/auth/signin" class="underline">Sign in</NuxtLink>
        to sync them to your account and access from anywhere.
      </p>
      <p class="mt-1 text-fg-subtle">
        Anonymous matches expire after 30 days. Signed-in matches are kept
        indefinitely.
      </p>
    </div>

    <div
      v-if="error"
      class="mb-4 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
    >
      Couldn't load matches: {{ error }}
    </div>

    <ul class="flex flex-col gap-2">
      <MatchListItem
        v-for="m in matches"
        :key="m.id"
        :id="m.id"
        :sport-preset="m.sport_preset"
        :games-to-win="m.config?.gamesToWin ?? 1"
        :team-name-a="m.team_name_a"
        :team-name-b="m.team_name_b"
        :event-name="m.event_name"
        :court-label="m.court_label"
        :updated-at="m.updated_at"
        @deleted="onMatchDeleted"
      />
    </ul>

    <div
      v-if="!loading && matches.length === 0 && !error"
      class="rounded-md border border-dashed border-border-strong bg-surface px-4 py-10 text-center text-sm text-fg-muted"
    >
      {{ emptyLabel }}
      <NuxtLink to="/new" class="underline">Start your first match →</NuxtLink>
    </div>

    <div v-if="loading" class="py-4 text-center text-xs text-fg-subtle">
      Loading…
    </div>

    <div
      v-else-if="done && matches.length > 0 && isAuthed"
      class="py-4 text-center text-xs text-fg-subtle"
    >
      End of list
    </div>

    <Button
      v-if="!loading && !done && matches.length > 0 && isAuthed"
      variant="outline"
      size="sm"
      class="mx-auto mt-4 flex"
      @click="loadRemote"
    >
      Load more
    </Button>
  </div>
</template>
