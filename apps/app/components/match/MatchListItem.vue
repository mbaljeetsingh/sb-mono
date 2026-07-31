<script setup lang="ts">
// Single row in the signed-in user's match list. Owns the row layout, the
// kebab-menu actions, and the delete-confirmation flow — so the parent
// `/matches` page stays a thin list shell that just fetches + paginates.

import { Button } from '@sb/layer-ui/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@sb/layer-ui/components/ui/dropdown-menu';
import { MoreVertical, Trash2, Trophy } from 'lucide-vue-next';
import { computed } from 'vue';
import SportGlyph from '~/components/common/SportGlyph.vue';
import DeleteMatchDialog from '~/components/match/DeleteMatchDialog.vue';
import type { MatchSummary } from '~/lib/matchSummaries';
import {
  type SportId,
  presetDisplayName,
  sportIdFromPreset,
} from '~/lib/sports';

const props = defineProps<{
  id: string;
  sportPreset: string;
  gamesToWin: number;
  teamNameA: string | null;
  teamNameB: string | null;
  eventName: string | null;
  courtLabel: string | null;
  updatedAt: string;
  /** Status + scoreline from lib/matchSummaries. Optional — rows render
   *  fine without it while summaries load. */
  summary?: MatchSummary | null;
}>();

const formatBadge = computed(() => {
  if (props.gamesToWin <= 1) return null;
  return `BO${props.gamesToWin * 2 - 1}`;
});

const emit = defineEmits<(e: 'deleted', id: string) => void>();

const nameA = computed(() => props.teamNameA?.trim() || 'Team A');
const nameB = computed(() => props.teamNameB?.trim() || 'Team B');
// Plain string for the delete dialog's confirmation copy; the row itself
// renders the two names as separate spans so it can mark the winner.
const label = computed(() => `${nameA.value} vs ${nameB.value}`);

// Which side won, once the match is final. The summary already resolves this
// from the engine — the row just never read it, so a finished match showed
// "FINAL 21–15" and left you to work out which number belonged to whom.
const winnerSide = computed(() =>
  props.summary?.status === 'final' ? props.summary.winner : null
);
// The winner is emphasised by letting the loser recede — at 15px, medium vs
// semibold alone is too small a step to read at a glance down a list.
const sideClass = (side: 'A' | 'B') => {
  if (!winnerSide.value) return '';
  return side === winnerSide.value
    ? 'font-semibold'
    : 'font-normal text-fg-muted';
};

// Registry display name ("Badminton 21"), not a de-slugged id — the old
// `replace(/-/g, ' ')` surfaced internal preset ids to users as "badminton 21".
const sportLabel = computed(() => presetDisplayName(props.sportPreset));
const sportId = computed(() => sportIdFromPreset(props.sportPreset));

// Per-sport accent (not the --court-* surface, which is a dark mat and
// unreadable as a foreground) so a sport reads the same colour everywhere.
const sportChip: Record<SportId, string> = {
  badminton: 'bg-court-badminton-accent/12 text-court-badminton-accent',
  'table-tennis':
    'bg-court-tabletennis-accent/12 text-court-tabletennis-accent',
  tennis: 'bg-court-tennis-accent/12 text-court-tennis-accent',
  pickleball: 'bg-court-pickleball-accent/12 text-court-pickleball-accent',
};

const formattedDate = computed(() => {
  const d = new Date(props.updatedAt);
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString();
});

const onDeleted = () => emit('deleted', props.id);
</script>

<template>
  <li
    class="rounded-lg border border-border bg-surface transition hover:border-border-strong"
  >
    <div class="flex items-center gap-2 pr-2">
      <NuxtLink
        :to="`/m/${id}`"
        class="flex min-w-0 flex-1 items-center gap-3 px-4 py-3"
      >
        <!-- Sport glyph on its court tint: twenty text-only rows are
             unscannable, and the icon makes the preset legible at a glance. -->
        <span
          class="flex size-8 shrink-0 items-center justify-center rounded-lg"
          :class="sportChip[sportId]"
        >
          <SportGlyph :sport="sportId" class="size-[18px]" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="flex items-center gap-2">
            <!-- Wraps on mobile rather than truncating. On a 375px screen the
                 status chip and scoreline leave so little room that a single
                 truncated line rendered "Axelsen …" — the opponent gone
                 entirely, which also threw away the winner emphasis. No
                 line-clamp either: capping at two lines still cut the opponent
                 off in doubles-vs-doubles, and a taller row costs less than a
                 hidden name. Desktop has the width to stay on one line. -->
            <span class="text-[15px] font-medium md:truncate">
              <!-- The trophy sits against the winning name rather than in the
                   status chip, so *which* side won is carried by its position.
                   Weight alone (semibold vs muted) was too small a step to read
                   scanning down a list. -->
              <Trophy
                v-if="winnerSide === 'A'"
                class="mr-1 inline size-3.5 -translate-y-px text-success"
              />
              <span :class="sideClass('A')">{{ nameA }}</span>
              <span class="font-normal text-fg-subtle"> vs </span>
              <Trophy
                v-if="winnerSide === 'B'"
                class="mr-1 inline size-3.5 -translate-y-px text-success"
              />
              <span :class="sideClass('B')">{{ nameB }}</span>
            </span>
            <span
              v-if="formatBadge"
              class="shrink-0 rounded-sm bg-brand/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-brand"
            >
              {{ formatBadge }}
            </span>
          </span>
          <span
            class="mt-0.5 flex items-center gap-2 truncate text-xs text-fg-muted"
          >
            <span>{{ sportLabel }}</span>
            <span v-if="eventName">· {{ eventName }}</span>
            <span v-if="courtLabel">· {{ courtLabel }}</span>
            <span>· {{ formattedDate }}</span>
          </span>
        </span>
      </NuxtLink>

      <!-- Status + scoreline — answers "which match is live and what's the
           score?" without opening the match. -->
      <div
        v-if="summary && summary.status !== 'ready'"
        class="flex shrink-0 items-center gap-2"
      >
        <span
          v-if="summary.status === 'live'"
          class="flex items-center gap-1.5 rounded-full bg-live-soft px-2 py-0.5 text-[10px] font-bold tracking-wider text-live"
        >
          <span class="relative flex h-1.5 w-1.5">
            <span
              class="absolute inline-flex h-full w-full animate-ping rounded-full bg-live opacity-75"
            />
            <span
              class="relative inline-flex h-1.5 w-1.5 rounded-full bg-live"
            />
          </span>
          LIVE
        </span>
        <span
          v-else
          class="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold tracking-wider text-fg-muted"
        >
          FINAL
        </span>
        <span
          v-if="summary.scoreline"
          class="font-mono text-sm font-semibold tabular-nums"
        >
          {{ summary.scoreline }}
        </span>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Match actions"
            @click.stop
          >
            <MoreVertical class="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-44">
          <DeleteMatchDialog
            :match-id="id"
            :match-label="label"
            @deleted="onDeleted"
          >
            <template #trigger>
              <DropdownMenuItem
                class="text-destructive focus:text-destructive"
                @select.prevent
              >
                <Trash2 class="mr-2 size-4" />
                Delete
              </DropdownMenuItem>
            </template>
          </DeleteMatchDialog>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </li>
</template>
