<script setup lang="ts">
import { useClipboard, useStorage } from "@vueuse/core";
import { ArrowLeft } from "lucide-vue-next";
import { toast } from "vue-sonner";
import { Button } from "@sb/layer-ui/components/ui/button";

definePageMeta({ layout: false });

const route = useRoute();
const dynamicId = computed(() => String(route.params.id ?? ""));

// v1: dynamic URL bindings live in localStorage. v1.x will move to a
// dynamic_urls table in Supabase per ARCHITECTURE.md §6.
// useStorage gives us cross-tab sync — operator binds on phone, OBS browser
// source on the laptop swaps automatically.
const boundMatchId = useStorage<string | null>(
  computed(() => `sb:dynamic:${dynamicId.value}`),
  null,
);

const dynamicUrl = computed(() => {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/d/${dynamicId.value}`;
});

const overlayUrl = computed(() => {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/d/${dynamicId.value}/overlay`;
});

// Recent matches from localStorage (anything matching sb:meta:*)
type RecentMatch = { id: string; teamA: string; teamB: string };
const recent = ref<RecentMatch[]>([]);

const refreshRecent = () => {
  if (typeof localStorage === "undefined") return;
  const found: RecentMatch[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith("sb:meta:")) continue;
    try {
      const meta = JSON.parse(localStorage.getItem(key) ?? "{}");
      if (meta?.teamNames) {
        found.push({
          id: key.replace("sb:meta:", ""),
          teamA: meta.teamNames.a,
          teamB: meta.teamNames.b,
        });
      }
    } catch {}
  }
  recent.value = found.slice(-10).reverse();
};

onMounted(refreshRecent);

// useStorage auto-persists assignments — `null` clears the entry as expected.
const bind = (matchId: string) => {
  boundMatchId.value = matchId;
};

const unbind = () => {
  boundMatchId.value = null;
};

const boundTeamNames = computed(() => {
  if (!boundMatchId.value || typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(`sb:meta:${boundMatchId.value}`);
    if (!raw) return null;
    const meta = JSON.parse(raw);
    return meta?.teamNames as { a: string; b: string } | null;
  } catch {
    return null;
  }
});

const { copy: clipboardCopy } = useClipboard({ legacy: true });
const copy = async (text: string, label = "URL") => {
  await clipboardCopy(text);
  toast.success(`${label} copied`);
};
</script>

<template>
  <div class="min-h-screen bg-background text-foreground font-sans">
    <header class="px-4 pt-16 pb-2 flex items-center justify-between">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Back"
        @click="navigateTo('/')"
      >
        <ArrowLeft class="size-4" />
      </Button>
      <span class="font-semibold">Dynamic URL</span>
      <span class="size-9" />
    </header>

    <main class="px-4 pb-8">
      <p class="text-sm text-fg-muted mb-4">
        One OBS link. Swap matches all day.
      </p>

      <!-- Your dynamic URL card -->
      <div class="bg-brand text-brand-foreground rounded-lg p-4 mb-5">
        <div
          class="text-[10px] tracking-[0.1em] uppercase opacity-85 font-semibold"
        >
          Your dynamic OBS URL
        </div>
        <div class="font-mono text-sm mt-1.5 break-all">{{ overlayUrl }}</div>
        <div class="flex gap-2 mt-3 items-center">
          <Button
            type="button"
            size="sm"
            class="bg-white text-brand hover:bg-white/90"
            @click="copy(overlayUrl, 'Overlay URL')"
          >
            Copy
          </Button>
          <span class="text-[11px] opacity-85 font-mono"
            >paste once into OBS</span
          >
        </div>
      </div>

      <!-- Now showing -->
      <div
        class="text-[11px] font-semibold tracking-[0.06em] uppercase text-fg-subtle mb-2"
      >
        Now showing
      </div>
      <div
        v-if="boundMatchId && boundTeamNames"
        class="p-3 mb-2 rounded-md border-[1.5px] border-brand bg-surface"
      >
        <div class="flex justify-between items-baseline">
          <div>
            <span
              class="px-1.5 py-0.5 rounded-sm bg-team-a-soft text-team-a text-[9px] font-bold tracking-wider uppercase"
              >LIVE</span
            >
            <div class="text-[13px] font-semibold mt-1">
              {{ boundTeamNames.a }} vs {{ boundTeamNames.b }}
            </div>
            <div class="text-[11px] text-fg-muted">
              ID: {{ boundMatchId.slice(0, 12) }}…
            </div>
          </div>
          <Button
            type="button"
            variant="link"
            size="sm"
            class="text-brand"
            @click="unbind"
          >
            Unbind
          </Button>
        </div>
      </div>
      <div
        v-else
        class="p-4 mb-2 rounded-md border-[1.5px] border-dashed border-border-strong bg-surface text-center text-fg-muted text-sm"
      >
        No match bound yet. Pick one below.
      </div>

      <!-- Recent matches list -->
      <div
        class="text-[11px] font-semibold tracking-[0.06em] uppercase text-fg-subtle mt-5 mb-2"
      >
        Recent matches — tap to bind
      </div>
      <div class="flex flex-col gap-1.5">
        <div
          v-for="m in recent"
          :key="m.id"
          class="p-2.5 rounded-md border border-border bg-surface flex justify-between items-center"
        >
          <div class="text-[13px] flex-1 min-w-0 truncate">
            {{ m.teamA }} vs {{ m.teamB }}
            <span class="text-[10px] text-fg-subtle ml-1.5">
              {{ m.id.slice(0, 8) }}…
            </span>
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            :class="
              boundMatchId === m.id
                ? 'bg-foreground text-background hover:bg-foreground/90'
                : ''
            "
            @click="bind(m.id)"
          >
            {{ boundMatchId === m.id ? "Bound" : "Bind" }}
          </Button>
        </div>
        <div
          v-if="recent.length === 0"
          class="p-4 rounded-md border border-dashed border-border-strong bg-surface text-center text-fg-muted text-sm"
        >
          No matches yet.
          <a href="/new" class="underline">Create one →</a>
        </div>
      </div>

      <p class="mt-6 text-[11px] text-fg-subtle text-center">
        OBS source URL never changes · feed swaps via Realtime
      </p>
    </main>
  </div>
</template>
