<script setup lang="ts">
// Match settings sheet — edits team names + tournament meta after match
// creation. Bound live to `useMatchMeta.meta`, which propagates changes via
// the Supabase Realtime UPDATE channel on the matches row. A typo fix here
// on the phone re-renders in OBS overlay on a laptop within ~500ms (one
// debounce window).
//
// Out of scope: changing isDoubles or sport preset post-creation. Doubles
// vs singles is a structural choice (engine treats partnerOnRight only in
// doubles); format changes belong in the /control FormatSheet because
// that's where the operator already is when adjusting mid-match.

import { Trash2, X } from "lucide-vue-next";
import { Button } from "@sb/layer-ui/components/ui/button";
import { Input } from "@sb/layer-ui/components/ui/input";
import { Label } from "@sb/layer-ui/components/ui/label";
import DeleteMatchDialog from "~/components/match/DeleteMatchDialog.vue";
import type { MatchMeta } from "@sb/layer-app-base/composables/useMatchMeta";

const props = defineProps<{ matchId: string }>();

const meta = defineModel<MatchMeta>("meta", { required: true });

const emit = defineEmits<{
  (e: "close"): void;
  (e: "deleted"): void;
}>();

const matchLabel = computed(() => {
  const a = meta.value.teamNames?.a?.trim();
  const b = meta.value.teamNames?.b?.trim();
  if (a && b) return `${a} vs ${b}`;
  return "";
});

const onDeleted = () => emit("deleted");

const updateString = (path: keyof MatchMeta, value: string) => {
  meta.value = { ...meta.value, [path]: value };
};

// In doubles, the player fields are the source of truth, but everything
// downstream that reads `teamNames` (hero card, themes) needs the joined
// "Alice / Bob" string kept in sync. Rewrite both on every player edit.
const updatePlayer = (slot: "a1" | "a2" | "b1" | "b2", value: string) => {
  const current = meta.value.players ?? { a1: "", a2: "", b1: "", b2: "" };
  const players = { ...current, [slot]: value };
  const join = (p1: string, p2: string) =>
    [p1, p2]
      .map((s) => s.trim())
      .filter(Boolean)
      .join(" / ");
  meta.value = {
    ...meta.value,
    players,
    teamNames: {
      a: join(players.a1, players.a2),
      b: join(players.b1, players.b2),
    },
  };
};

const updateTeamName = (side: "a" | "b", value: string) => {
  const current = meta.value.teamNames ?? { a: "", b: "" };
  meta.value = { ...meta.value, teamNames: { ...current, [side]: value } };
};
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-end justify-center bg-overlay font-sans"
    @click.self="$emit('close')"
  >
    <div
      class="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-surface text-foreground rounded-t-2xl px-4 pt-3 pb-8 shadow-[0_-12px_40px_rgba(0,0,0,0.18)]"
    >
      <div class="size-1 w-10 bg-border-strong rounded-full mx-auto mb-3" />
      <div class="flex items-baseline justify-between mb-1">
        <h2 class="text-lg font-semibold">Match settings</h2>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Close"
          @click="$emit('close')"
        >
          <X class="size-4" />
        </Button>
      </div>
      <p class="text-[11px] text-fg-subtle mb-5">
        Changes save automatically as you type · synced live to every device.
      </p>

      <!-- Names -->
      <section class="mb-5">
        <div
          class="text-[11px] font-bold tracking-wider uppercase text-fg-subtle mb-2"
        >
          Names
        </div>

        <template v-if="!meta.isDoubles">
          <Label
            for="settings-team-a"
            class="text-[11px] font-semibold text-fg-subtle mb-1 block"
          >
            Team A
          </Label>
          <Input
            id="settings-team-a"
            :model-value="meta.teamNames?.a ?? ''"
            type="text"
            placeholder="Player 1"
            class="h-11 mb-3"
            @update:model-value="(v) => updateTeamName('a', String(v))"
          />
          <Label
            for="settings-team-b"
            class="text-[11px] font-semibold text-fg-subtle mb-1 block"
          >
            Team B
          </Label>
          <Input
            id="settings-team-b"
            :model-value="meta.teamNames?.b ?? ''"
            type="text"
            placeholder="Player 2"
            class="h-11"
            @update:model-value="(v) => updateTeamName('b', String(v))"
          />
        </template>

        <template v-else>
          <Label class="text-[11px] font-semibold text-fg-subtle mb-1 block">
            Team A
          </Label>
          <div class="grid grid-cols-2 gap-2 mb-3">
            <Input
              :model-value="meta.players?.a1 ?? ''"
              type="text"
              placeholder="Player 1"
              class="h-11"
              @update:model-value="(v) => updatePlayer('a1', String(v))"
            />
            <Input
              :model-value="meta.players?.a2 ?? ''"
              type="text"
              placeholder="Player 2"
              class="h-11"
              @update:model-value="(v) => updatePlayer('a2', String(v))"
            />
          </div>

          <Label class="text-[11px] font-semibold text-fg-subtle mb-1 block">
            Team B
          </Label>
          <div class="grid grid-cols-2 gap-2">
            <Input
              :model-value="meta.players?.b1 ?? ''"
              type="text"
              placeholder="Player 3"
              class="h-11"
              @update:model-value="(v) => updatePlayer('b1', String(v))"
            />
            <Input
              :model-value="meta.players?.b2 ?? ''"
              type="text"
              placeholder="Player 4"
              class="h-11"
              @update:model-value="(v) => updatePlayer('b2', String(v))"
            />
          </div>
        </template>
      </section>

      <!-- Tournament meta -->
      <section class="mb-5">
        <div
          class="text-[11px] font-bold tracking-wider uppercase text-fg-subtle mb-2"
        >
          Tournament
        </div>
        <Label
          for="settings-event"
          class="text-[11px] font-semibold text-fg-subtle mb-1 block"
        >
          Event
        </Label>
        <Input
          id="settings-event"
          :model-value="meta.eventName ?? ''"
          type="text"
          placeholder="e.g. Club Championship"
          class="h-11 mb-3"
          @update:model-value="(v) => updateString('eventName', String(v))"
        />
        <div class="grid grid-cols-2 gap-2 mb-3">
          <div>
            <Label
              for="settings-round"
              class="text-[11px] font-semibold text-fg-subtle mb-1 block"
            >
              Round
            </Label>
            <Input
              id="settings-round"
              :model-value="meta.round ?? ''"
              type="text"
              placeholder="Quarterfinal"
              class="h-11"
              @update:model-value="(v) => updateString('round', String(v))"
            />
          </div>
          <div>
            <Label
              for="settings-category"
              class="text-[11px] font-semibold text-fg-subtle mb-1 block"
            >
              Category
            </Label>
            <Input
              id="settings-category"
              :model-value="meta.category ?? ''"
              type="text"
              placeholder="Mixed Doubles"
              class="h-11"
              @update:model-value="(v) => updateString('category', String(v))"
            />
          </div>
        </div>
        <Label
          for="settings-court"
          class="text-[11px] font-semibold text-fg-subtle mb-1 block"
        >
          Court
        </Label>
        <Input
          id="settings-court"
          :model-value="meta.courtLabel ?? ''"
          type="text"
          placeholder="Court 1"
          class="h-11"
          @update:model-value="(v) => updateString('courtLabel', String(v))"
        />
      </section>

      <Button variant="ghost" class="w-full" @click="$emit('close')">
        Done
      </Button>

      <!-- Danger zone -->
      <section class="mt-6 border-t pt-4">
        <div
          class="text-[11px] font-bold tracking-wider uppercase text-fg-subtle mb-2"
        >
          Danger zone
        </div>
        <DeleteMatchDialog
          :match-id="props.matchId"
          :match-label="matchLabel"
          @deleted="onDeleted"
        >
          <template #trigger>
            <Button variant="destructive" class="w-full gap-2">
              <Trash2 class="size-4" />
              Delete match
            </Button>
          </template>
        </DeleteMatchDialog>
      </section>
    </div>
  </div>
</template>
