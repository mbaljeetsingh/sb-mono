<script setup lang="ts">
definePageMeta({ layout: false });

const route = useRoute();
const tournamentId = computed(() => String(route.params.id ?? ""));

// Demo data — v1.x reads from Supabase tournaments + matches tables.
const tournament = ref({
  name: "Xperience Open 2026",
  date: "Mar 8–10",
  courts: 4,
  totalMatches: 64,
});

type Filter = "live" | "today" | "completed";
const filter = ref<Filter>("live");

const matches = ref([
  {
    court: "Court 1",
    round: "R16 · MS",
    teams: "Karan vs Aman",
    score: "14–11",
    status: "live" as const,
  },
  {
    court: "Court 2",
    round: "QF · WD",
    teams: "Priya/Anu vs Riya/Meera",
    score: "21–18, 14–9",
    status: "live" as const,
  },
  {
    court: "Court 3",
    round: "R16 · MS",
    teams: "Vivek vs Aditya",
    score: "21–15, 21–19",
    status: "completed" as const,
  },
  {
    court: "Court 4",
    round: "R16 · WS",
    teams: "Sara vs Tara",
    score: "15:30",
    status: "today" as const,
  },
]);

const filteredMatches = computed(() =>
  matches.value.filter(
    (m) =>
      m.status === filter.value ||
      (filter.value === "today" && m.status === "live"),
  ),
);
</script>

<template>
  <div class="min-h-screen bg-background text-foreground font-sans">
    <!-- Hero -->
    <header class="bg-brand text-brand-foreground px-6 pt-16 pb-5">
      <div class="text-2xl font-bold tracking-tight">{{ tournament.name }}</div>
      <div class="text-sm opacity-85 mt-1">
        {{ tournament.date }} · {{ tournament.courts }} courts ·
        {{ tournament.totalMatches }} matches
      </div>
    </header>

    <!-- Filters -->
    <div class="px-4 pt-4 flex gap-2 overflow-x-auto">
      <button
        v-for="f in ['live', 'today', 'completed'] as Filter[]"
        :key="f"
        type="button"
        class="px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-colors"
        :class="
          filter === f
            ? 'bg-foreground text-background'
            : 'bg-surface text-foreground border border-border hover:bg-surface-2'
        "
        @click="filter = f"
      >
        {{
          f === "live"
            ? "Live (" + matches.filter((m) => m.status === "live").length + ")"
            : f
        }}
      </button>
    </div>

    <!-- Matches list -->
    <main class="px-4 pt-4 pb-8 flex flex-col gap-2">
      <a
        v-for="m in filteredMatches"
        :key="m.court"
        href="#"
        class="block p-3 bg-surface border border-border rounded-md hover:bg-surface-2 transition-colors no-underline text-foreground"
      >
        <div class="flex justify-between items-center">
          <div class="flex-1 min-w-0">
            <div
              class="flex gap-1.5 text-[10px] text-fg-subtle items-center mb-1"
            >
              <span>{{ m.court }}</span>
              <span>·</span>
              <span>{{ m.round }}</span>
              <span
                v-if="m.status === 'live'"
                class="ml-1 px-1.5 py-0.5 rounded-sm bg-team-a-soft text-team-a text-[9px] font-bold tracking-wider uppercase"
                >LIVE</span
              >
            </div>
            <div class="text-[13px] font-medium truncate">{{ m.teams }}</div>
          </div>
          <div
            class="font-mono text-sm tabular-nums"
            :class="m.status === 'live' ? '' : 'opacity-60'"
          >
            {{ m.score }}
          </div>
        </div>
      </a>
    </main>

    <footer
      class="px-4 pb-8 pt-4 border-t border-border text-xs text-fg-subtle text-center"
    >
      scoreboard.app/t/{{ tournamentId.slice(0, 12) }}
    </footer>
  </div>
</template>
