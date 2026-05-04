<script setup lang="ts">
definePageMeta({ layout: false });

const route = useRoute();
const tournamentId = computed(() => String(route.params.id ?? ""));

const tournament = ref({
  name: "XPERIENCE OPEN 2026",
  phase: "QF · DAY 2",
});

// Demo data — v1.x subscribes to Supabase realtime per court.
const matches = ref([
  { court: "1", a: "KARAN", sa: 14, b: "AMAN", sb: 11, live: true },
  { court: "2", a: "PRIYA/ANU", sa: 21, b: "RIYA/MEERA", sb: 18, live: false },
  { court: "3", a: "VIVEK", sa: 8, b: "ADITYA", sb: 11, live: true },
  { court: "4", a: "SARA", sa: null, b: "TARA", sb: null, live: false },
]);

useHead({
  bodyAttrs: { class: "bg-black" },
  htmlAttrs: { class: "bg-black" },
});
</script>

<template>
  <div
    class="fixed inset-0 bg-neutral-950 text-neutral-50 font-sans p-6 flex flex-col"
  >
    <!-- Header -->
    <div
      class="flex justify-between items-center pb-2 border-b border-neutral-800 mb-3"
    >
      <span class="text-[13px] font-bold tracking-[0.16em] uppercase"
        >{{ tournament.name }} · LIVE</span
      >
      <span class="text-[10px] text-neutral-400 tracking-wider uppercase">{{
        tournament.phase
      }}</span>
    </div>

    <!-- Matches ticker -->
    <div class="flex flex-col gap-1.5 flex-1">
      <div
        v-for="(m, i) in matches"
        :key="m.court"
        class="flex items-center gap-3 py-1.5"
        :class="
          i < matches.length - 1 ? 'border-b border-dashed border-white/10' : ''
        "
      >
        <div
          class="size-[22px] rounded-full inline-flex items-center justify-center text-xs font-bold text-white"
          :style="{ background: 'var(--color-team-a)' }"
        >
          {{ m.court }}
        </div>
        <div class="flex-1 text-xs font-semibold uppercase">{{ m.a }}</div>
        <div
          class="font-mono text-lg tabular-nums w-8 text-right"
          :style="{ color: m.live ? 'var(--color-team-a)' : '#fafafa' }"
        >
          {{ m.sa ?? "—" }}
        </div>
        <div class="text-neutral-600 text-[10px]">—</div>
        <div class="font-mono text-lg tabular-nums w-8 text-left">
          {{ m.sb ?? "—" }}
        </div>
        <div class="flex-1 text-xs font-semibold uppercase text-right">
          {{ m.b }}
        </div>
      </div>
    </div>

    <div class="text-[9px] text-neutral-600 text-center mt-2 font-mono">
      scoreboard.app/t/{{ tournamentId.slice(0, 8) }}/overlay
    </div>
  </div>
</template>
