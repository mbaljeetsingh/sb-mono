<script setup lang="ts">
import { Button } from '@sb/layer-ui/components/ui/button';
import { Input } from '@sb/layer-ui/components/ui/input';
import { Label } from '@sb/layer-ui/components/ui/label';
import { themes as themeRegistry } from '@sb/themes';
import { useClipboard } from '@vueuse/core';
import { Check, Radio } from 'lucide-vue-next';
import { computed, onMounted, ref, watch } from 'vue';
import { toast } from 'vue-sonner';
import {
  DYNAMIC_URL_NAME_MAX,
  useDynamicUrls,
} from '~/composables/useDynamicUrls';
import { type MatchSummary, fetchMatchSummaries } from '~/lib/matchSummaries';
import { useUserStore } from '~/stores/user';

// Setup + bind surface for one dynamic URL. Signed-in only — the middleware
// gates /d/* (but not /d/*/overlay, which OBS hits anonymously).
useSeoMeta({ title: 'OBS URL' });

const route = useRoute();
const dynamicId = computed(() => String(route.params.id ?? ''));

const supabase = useSupabaseClient();
const userStore = useUserStore();
const {
  urls,
  loaded: urlsLoaded,
  refresh,
  rename,
  bind,
  unbind,
  urlFor,
} = useDynamicUrls();

const url = computed(() => urls.value.find((u) => u.id === dynamicId.value));
const overlayUrl = computed(() => urlFor(dynamicId.value));

// Recent matches to bind. Owner-scoped only: the previous version also
// accepted device-local anonymous matches, which no longer applies now that a
// dynamic URL requires an account.
type RecentMatch = {
  id: string;
  sport_preset: string;
  config: { gamesToWin?: number } | null;
  ended_at: string | null;
  teamA: string;
  teamB: string;
  overlayThemeId: string;
};
const recent = ref<RecentMatch[]>([]);
const summaries = ref<Map<string, MatchSummary>>(new Map());

const refreshRecent = async () => {
  const ownerId = userStore.currentUser?.id;
  if (!ownerId) {
    recent.value = [];
    return;
  }
  const { data, error } = await supabase
    .from('matches')
    .select(
      'id, sport_preset, config, ended_at, team_name_a, team_name_b, overlay_theme_id'
    )
    .eq('owner_id', ownerId)
    .order('updated_at', { ascending: false })
    .limit(10);
  if (error) {
    console.warn('[d/index] recent fetch failed', error);
    return;
  }
  const rows = data ?? [];
  recent.value = rows.map((r) => ({
    id: r.id,
    sport_preset: r.sport_preset,
    config: r.config as { gamesToWin?: number } | null,
    ended_at: r.ended_at,
    teamA: r.team_name_a ?? '',
    teamB: r.team_name_b ?? '',
    overlayThemeId: r.overlay_theme_id ?? 'broadcast-classic',
  }));
  summaries.value = await fetchMatchSummaries(
    supabase,
    rows.map((r) => ({
      id: r.id,
      sport_preset: r.sport_preset,
      config: r.config as { gamesToWin?: number } | null,
      ended_at: r.ended_at,
    }))
  );
};

onMounted(async () => {
  await Promise.all([refresh(), refreshRecent()]);
});
watch(() => userStore.isAuthenticated, refreshRecent);

// Theme name per match. Shown in the bind list because the overlay inherits
// the *match's* theme — so binding can change the stream's look and geometry,
// and the operator should see that before it happens rather than watch it
// happen on air.
const themeName = (id: string) => themeRegistry[id]?.manifest.name ?? '—';

const boundMatch = computed(() =>
  recent.value.find((m) => m.id === url.value?.currentMatchId)
);

const onBind = async (matchId: string) => {
  const previous = url.value?.currentMatchId ?? null;
  const ok = await bind(dynamicId.value, matchId);
  if (!ok) {
    toast.error("Couldn't switch — try again");
    return;
  }
  // Undo rather than a confirm dialog: the information that matters (which
  // match is live, at what score) is already on the row you tapped, and a
  // modal between every match is the friction this feature exists to remove.
  toast.success('OBS switched to this match', {
    action: {
      label: 'Undo',
      onClick: () => bind(dynamicId.value, previous),
    },
  });
};

const onUnbind = async () => {
  const previous = url.value?.currentMatchId ?? null;
  await unbind(dynamicId.value);
  toast.success('Overlay cleared', {
    action: {
      label: 'Undo',
      onClick: () => bind(dynamicId.value, previous),
    },
  });
};

// Rename. Local draft so each keystroke isn't a round-trip; committed on blur
// or Enter.
const nameDraft = ref('');
watch(
  url,
  (u) => {
    if (u && nameDraft.value === '') nameDraft.value = u.name;
  },
  { immediate: true }
);

const commitName = async () => {
  const next = nameDraft.value.trim();
  if (!url.value || !next || next === url.value.name) {
    nameDraft.value = url.value?.name ?? '';
    return;
  }
  const ok = await rename(dynamicId.value, next);
  if (!ok) {
    toast.error("Couldn't rename");
    nameDraft.value = url.value.name;
  }
};

const { copy: clipboardCopy } = useClipboard({ legacy: true });
const copy = async (text: string, label = 'URL') => {
  await clipboardCopy(text);
  toast.success(`${label} copied`);
};
</script>

<template>
  <div class="mx-auto max-w-2xl px-4 pb-10">
    <div v-if="urlsLoaded && !url" class="py-16 text-center">
      <p class="text-sm text-fg-muted">
        This OBS URL doesn't exist, or belongs to another account.
      </p>
      <Button class="mt-4" @click="navigateTo('/profile')">
        Go to your OBS URLs
      </Button>
    </div>

    <template v-else-if="url">
      <div class="pt-4 pb-5">
        <h1 class="text-xl font-semibold">{{ url.name }}</h1>
        <p class="mt-1 text-sm text-fg-muted">
          One OBS link. Point it at whichever match should be on air.
        </p>
      </div>

      <!-- The permanent URL -->
      <div class="mb-5 rounded-lg bg-brand p-4 text-brand-foreground">
        <div
          class="text-[10px] font-semibold uppercase tracking-[0.1em] opacity-85"
        >
          Your permanent OBS URL
        </div>
        <div class="mt-1.5 break-all font-mono text-sm">{{ overlayUrl }}</div>
        <div class="mt-3 flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            class="bg-white text-brand hover:bg-white/90"
            @click="copy(overlayUrl, 'OBS URL')"
          >
            Copy
          </Button>
          <span class="font-mono text-[11px] opacity-85">
            paste once into OBS — never again
          </span>
        </div>
      </div>

      <!-- Rename -->
      <div class="mb-6">
        <Label for="dynamic-url-name" class="text-xs text-fg-muted">
          Name
        </Label>
        <Input
          id="dynamic-url-name"
          v-model="nameDraft"
          :maxlength="DYNAMIC_URL_NAME_MAX"
          class="mt-1.5"
          placeholder="e.g. MacBook Air 13 stream"
          @blur="commitName"
          @keyup.enter="commitName"
        />
        <p class="mt-1.5 text-xs text-fg-subtle">
          Only you see this. Renaming doesn't change the URL, so what's already
          in OBS keeps working.
        </p>
      </div>

      <!-- Now showing -->
      <div
        class="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-fg-subtle"
      >
        Now showing
      </div>
      <div
        v-if="boundMatch"
        class="mb-6 rounded-md border-[1.5px] border-brand bg-surface p-3"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <span
                v-if="summaries.get(boundMatch.id)?.status === 'live'"
                class="rounded-sm bg-live-soft px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-live"
              >
                LIVE
              </span>
              <span
                v-if="summaries.get(boundMatch.id)?.scoreline"
                class="font-mono text-sm font-semibold tabular-nums"
              >
                {{ summaries.get(boundMatch.id)?.scoreline }}
              </span>
            </div>
            <div class="mt-1 truncate text-[13px] font-semibold">
              {{ boundMatch.teamA || 'Team A' }} vs
              {{ boundMatch.teamB || 'Team B' }}
            </div>
            <div class="text-[11px] text-fg-muted">
              {{ themeName(boundMatch.overlayThemeId) }} theme
            </div>
          </div>
          <Button type="button" variant="link" size="sm" @click="onUnbind">
            Clear
          </Button>
        </div>
      </div>
      <div
        v-else
        class="mb-6 rounded-md border-[1.5px] border-dashed border-border-strong bg-surface p-4 text-center text-sm text-fg-muted"
      >
        Nothing bound — the overlay is transparent. Pick a match below.
      </div>

      <!-- Bind list -->
      <div
        class="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-fg-subtle"
      >
        Your matches — tap to put on air
      </div>
      <div class="flex flex-col gap-1.5">
        <div
          v-for="m in recent"
          :key="m.id"
          class="flex items-center gap-3 rounded-md border border-border bg-surface p-3"
        >
          <span
            class="inline-flex size-8 flex-shrink-0 items-center justify-center rounded-lg bg-surface-2 text-fg-muted"
          >
            <Radio class="size-4" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="flex items-center gap-2">
              <span class="truncate text-sm font-medium">
                {{ m.teamA || 'Team A' }} vs {{ m.teamB || 'Team B' }}
              </span>
              <span
                v-if="summaries.get(m.id)?.status === 'live'"
                class="flex shrink-0 items-center gap-1 rounded-full bg-live-soft px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-live"
              >
                <span class="h-1 w-1 rounded-full bg-live" />
                LIVE
              </span>
              <span
                v-if="summaries.get(m.id)?.scoreline"
                class="shrink-0 font-mono text-xs font-semibold tabular-nums"
              >
                {{ summaries.get(m.id)?.scoreline }}
              </span>
            </span>
            <span class="mt-0.5 block text-xs text-fg-muted">
              {{ themeName(m.overlayThemeId) }} theme
            </span>
          </span>
          <span
            v-if="m.id === url.currentMatchId"
            class="flex shrink-0 items-center gap-1 text-xs font-semibold text-brand"
          >
            <Check class="size-4" /> On air
          </span>
          <Button
            v-else
            type="button"
            variant="secondary"
            size="sm"
            @click="onBind(m.id)"
          >
            Put on air
          </Button>
        </div>

        <p
          v-if="urlsLoaded && recent.length === 0"
          class="py-6 text-center text-sm text-fg-muted"
        >
          No matches yet. Create one and it'll appear here.
        </p>
      </div>
    </template>
  </div>
</template>
