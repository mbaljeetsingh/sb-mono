<script setup lang="ts">
import { Button } from '@sb/layer-ui/components/ui/button';
import { ArrowRight } from 'lucide-vue-next';
import { computed, onMounted, ref } from 'vue';
import { collectLocalMatchIds } from '~/lib/localMatches';
import { type MatchSummary, fetchMatchSummaries } from '~/lib/matchSummaries';
import { useUserStore } from '~/stores/user';

useSeoMeta({ title: 'Scoreboard' });

const supabase = useSupabaseClient();
const userStore = useUserStore();
const startMatch = () => navigateTo('/new');

// "Welcome back" only means something to a signed-in user; for anonymous
// visitors lead with the value prop instead of pretending to know them.
const greeting = computed(() => {
  const name = userStore.currentUser?.profile?.display_name;
  if (userStore.isAuthenticated) {
    return name ? `Welcome back, ${name}` : 'Welcome back';
  }
  return 'Free & open source · no sign-up needed';
});

// Most recent match (owned when signed in, scored-on-this-device when
// anonymous) — a returning scorer's most likely destination is the match
// they were just scoring, not the /new form. Rendered only once resolved so
// the hero never flashes a placeholder.
type RecentMatch = {
  id: string;
  sport_preset: string;
  config: { gamesToWin?: number } | null;
  is_doubles: boolean | null;
  team_name_a: string | null;
  team_name_b: string | null;
  ended_at: string | null;
};
const recent = ref<RecentMatch | null>(null);
const recentSummary = ref<MatchSummary | null>(null);

const recentCardLabel = computed(() => {
  switch (recentSummary.value?.status) {
    case 'final':
      return 'Last match';
    case 'live':
      return 'Continue scoring';
    default:
      return 'Ready to score';
  }
});

const recentLabel = computed(() => {
  const a = recent.value?.team_name_a?.trim() || 'Team A';
  const b = recent.value?.team_name_b?.trim() || 'Team B';
  return `${a} vs ${b}`;
});

onMounted(async () => {
  const cols =
    'id, sport_preset, config, is_doubles, team_name_a, team_name_b, ended_at';
  let row: RecentMatch | null = null;
  if (userStore.isAuthenticated && userStore.currentUser?.id) {
    const { data } = await supabase
      .from('matches')
      .select(cols)
      .eq('owner_id', userStore.currentUser.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    row = data as RecentMatch | null;
  } else {
    const ids = await collectLocalMatchIds();
    if (!ids.length) return;
    const { data } = await supabase
      .from('matches')
      .select(cols)
      .in('id', ids)
      .is('owner_id', null)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    row = data as RecentMatch | null;
  }
  if (!row) return;
  recent.value = row;
  recentSummary.value =
    (await fetchMatchSummaries(supabase, [row])).get(row.id) ?? null;
});
</script>

<template>
  <div
    class="mx-auto flex min-h-[calc(100dvh-3.5rem-3.5rem)] max-w-3xl flex-col items-center justify-center px-6 text-center md:min-h-[calc(100dvh-3.5rem)]"
  >
    <p class="mb-3 text-sm text-muted-foreground">{{ greeting }}</p>
    <!-- Fluid rather than a fixed 44px: at 320px the fixed size wrapped this
         to four tight lines. -->
    <h1
      class="mb-3 text-[clamp(30px,8vw,46px)] font-semibold leading-[1.08] tracking-tight text-balance"
    >
      A live scorecard for racquet sports.
    </h1>
    <p class="mb-8 text-[17px] leading-relaxed text-muted-foreground">
      Score from your phone. Show on OBS, a TV, or anywhere.
    </p>

    <Button size="lg" class="h-12 px-6" @click="startMatch"> New match </Button>

    <!-- Shortcut back into the most recent match — the likeliest destination
         for a returning scorer. -->
    <NuxtLink
      v-if="recent"
      :to="`/m/${recent.id}`"
      class="mt-8 flex w-full max-w-sm items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-left transition hover:border-border-strong"
    >
      <div class="min-w-0">
        <!-- Three cases, not two. `ready` used to fall through to "Continue
             scoring", which is what a match you created but never scored a
             rally in showed — inviting you to continue something that hadn't
             started. -->
        <div
          class="text-[11px] font-bold uppercase tracking-wider text-fg-subtle"
        >
          {{ recentCardLabel }}
        </div>
        <div class="mt-0.5 flex items-center gap-2">
          <span class="truncate text-sm font-medium">{{ recentLabel }}</span>
          <span
            v-if="recentSummary?.status === 'live'"
            class="flex shrink-0 items-center gap-1 rounded-full bg-live-soft px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-live"
          >
            <span class="h-1 w-1 rounded-full bg-live" />
            LIVE
          </span>
          <span
            v-if="recentSummary?.scoreline"
            class="shrink-0 font-mono text-sm font-semibold tabular-nums"
          >
            {{ recentSummary.scoreline }}
          </span>
        </div>
      </div>
      <ArrowRight class="size-4 shrink-0 text-fg-muted" />
    </NuxtLink>
  </div>
</template>
