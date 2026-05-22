<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import { useClipboard } from "@vueuse/core";
import { Film, QrCode, RefreshCw, Settings } from "lucide-vue-next";
import { toast } from "vue-sonner";
import { type ThemeSurface } from "@sb/themes";
import type { MatchMeta } from "@sb/layer-app-base/composables/useMatchMeta";
import { Button } from "@sb/layer-ui/components/ui/button";
import MatchHeroCard from "~/components/match/MatchHeroCard.vue";
import LookAndFeelCards from "~/components/match/LookAndFeelCards.vue";
import SettingsSheet from "~/components/match/SettingsSheet.vue";
import ThemePickerDialog from "~/components/match/ThemePickerDialog.vue";
import QrDialog from "~/components/match/QrDialog.vue";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@sb/layer-ui/components/ui/alert-dialog";
import { useUserStore } from "~/stores/user";

useSeoMeta({ title: "Match" });

const route = useRoute();
const matchId = computed(() => String(route.params.id ?? ""));
const { state, config, events } = useMatchState(matchId);
const { meta, teamNames, flush: flushMeta } = useMatchMeta(matchId);

// Explicit handler — relying on `v-model:meta="meta"` to auto-translate
// `meta = $event` to `meta.value = $event` is unreliable in template event
// handlers for top-level setup refs. Wiring the setter from setup-script
// JS removes the ambiguity: meta.value gets reassigned, the watch fires.
const onMetaUpdate = (v: MatchMeta) => {
  meta.value = v;
};

const settingsOpen = ref(false);

// Flushing the debounced upsert here means closing the sheet awaits the
// Supabase write — so the matches list (or any other reader fetched right
// after) reflects the new team names instead of the "Team A / Team B"
// placeholder fallback.
const onSettingsClose = async () => {
  try {
    await flushMeta();
  } finally {
    settingsOpen.value = false;
  }
};

// useMatchMeta debounces writes by 500ms. If the user edits names in the
// settings sheet and navigates away (or closes the tab) before the timer
// fires, the upsert is silently dropped because watchDebounced is torn down
// with the component. Closing the sheet already calls flushMeta(); this
// covers the nav-away-without-closing case.
onBeforeUnmount(() => {
  void flushMeta();
});

const userStore = useUserStore();
const onMatchDeleted = () => {
  settingsOpen.value = false;
  navigateTo(userStore.isAuthenticated ? "/matches" : "/");
};
const {
  overlay: overlayTheme,
  scoreboard: scoreboardTheme,
  overlayName,
  scoreboardName,
} = useThemeChoice(matchId);
const urls = useMatchUrls(matchId);

const themeSheetOpen = ref(false);

// Shared QR enlarge dialog. Each Get Setup row opens it with the right URL +
// per-surface description; the dialog itself shows the big scannable QR + copy.
const qrOpen = ref(false);
const qrUrl = ref("");
const qrTitle = ref("");
const qrDescription = ref<string | undefined>(undefined);
const qrSensitive = ref(false);
const openQr = (opts: {
  url: string;
  title: string;
  description?: string;
  sensitive?: boolean;
}) => {
  qrUrl.value = opts.url;
  qrTitle.value = opts.title;
  qrDescription.value = opts.description;
  qrSensitive.value = !!opts.sensitive;
  qrOpen.value = true;
};

const score = (side: "a" | "b") => {
  const last = state.value.games[state.value.games.length - 1];
  return last ? last[side] : 0;
};

const displayName = computed(
  () =>
    `${config.value.displayName}${
      config.value.gamesToWin > 1
        ? ` · BO${config.value.gamesToWin * 2 - 1}`
        : " · Single"
    }`,
);

const statusLabel = computed(() => {
  if (state.value.matchOver) return "Final";
  if (events.value.length === 0) return "Ready · 0 events";
  return `Game ${state.value.games.length} · ${score("a")}–${score("b")}`;
});

const { copy: clipboardCopy } = useClipboard({ legacy: true });
const copy = async (text: string, label = "URL") => {
  await clipboardCopy(text);
  toast.success(`${label} copied`);
};

const onPickTheme = ({
  surface,
  id,
}: {
  surface: ThemeSurface;
  id: string;
}) => {
  if (surface === "overlay") overlayTheme.value = id;
  if (surface === "scoreboard") scoreboardTheme.value = id;
};

// E2.8 — write token for delegated scoring. Anon matches stay open
// (URL = access); owned matches need a token in the URL for anyone other
// than the signed-in owner to score. We mint the token lazily the first
// time the owner reveals the Control QR, then reuse it; "Regenerate" mints
// a new one and revokes the old (any outstanding scanned links instantly
// stop working). The token doesn't change unless the owner regenerates.
const { isOwner, isAnonMatch } = useWriteAccess(matchId);
const supabaseClient = useSupabaseClient();
const writeToken = ref<string | null>(null);
const fetchOwnerToken = async () => {
  if (!isOwner.value) return;
  const { data } = await supabaseClient
    .from("matches")
    .select("write_token")
    .eq("id", matchId.value)
    .maybeSingle();
  writeToken.value = data?.write_token ?? null;
};
watch(isOwner, fetchOwnerToken, { immediate: true });

// The Control URL to embed in the QR. Owners on an owned match get the
// token baked in so scanning from any device — signed in or not — just
// works. Anon matches don't use tokens; the URL itself is the secret.
const controlShareUrl = computed(() => {
  if (isAnonMatch.value) return urls.value.control;
  if (isOwner.value && writeToken.value) {
    return `${urls.value.control}?wt=${writeToken.value}`;
  }
  return urls.value.control;
});

const ensureToken = async (): Promise<string | null> => {
  if (writeToken.value) return writeToken.value;
  if (!isOwner.value) return null;
  const { data, error } = await supabaseClient.rpc("regenerate_write_token", {
    p_match_id: matchId.value,
  });
  if (error) {
    toast.error("Couldn't create scoring link");
    console.warn("[match] regenerate_write_token failed", error);
    return null;
  }
  writeToken.value = data as string;
  return writeToken.value;
};

const onShowControlQr = async () => {
  // For owned matches, lazy-mint the token at QR-reveal time so the QR
  // works for whoever scans it. For anon matches, just open the bare URL.
  if (isOwner.value) {
    const tok = await ensureToken();
    if (!tok) return;
  }
  openQr({
    url: controlShareUrl.value,
    title: "Control",
    description: isOwner.value
      ? "Scan with the device you want to score on. Anyone who has this link can score — use the rotate icon on the row to revoke."
      : "Scan with the device you want to score on.",
    sensitive: true,
  });
};

// Regenerate is destructive — it kicks any open co-scorer device the moment
// the realtime UPDATE propagates. Gate behind an AlertDialog confirm so an
// accidental tap on the rotate icon doesn't yank scoring out from under
// someone in the middle of a rally.
const regenConfirmOpen = ref(false);
const regenBusy = ref(false);
const openRegenConfirm = () => {
  if (!isOwner.value) return;
  regenConfirmOpen.value = true;
};
const onRegenerateToken = async () => {
  if (!isOwner.value || regenBusy.value) return;
  regenBusy.value = true;
  const { data, error } = await supabaseClient.rpc("regenerate_write_token", {
    p_match_id: matchId.value,
  });
  regenBusy.value = false;
  if (error) {
    toast.error("Couldn't regenerate scoring link");
    return;
  }
  writeToken.value = data as string;
  regenConfirmOpen.value = false;
  toast.success("New scoring link generated — old links are revoked");
};
</script>

<template>
  <div class="font-sans pb-8">
    <div class="flex items-center justify-between px-4 pt-4 pb-2">
      <span class="text-[13px] font-semibold text-fg-subtle">
        Match · {{ matchId.slice(0, 8) }}…
      </span>
      <div class="flex items-center gap-1">
        <Button
          v-if="state.matchOver"
          variant="ghost"
          size="icon"
          aria-label="Render video"
          title="Post-game render (beta)"
          @click="navigateTo(`/m/${matchId}/render`)"
        >
          <Film class="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Match settings"
          title="Match settings — edit team names, tournament info"
          @click="settingsOpen = true"
        >
          <Settings class="size-4" />
        </Button>
      </div>
    </div>

    <div class="px-4 pt-2 pb-4">
      <MatchHeroCard
        :match-over="state.matchOver"
        :display-name="displayName"
        :status-label="statusLabel"
        :team-names="teamNames"
        :total-slots="config.gamesToWin + 1"
        :score-a="score('a')"
        :score-b="score('b')"
        :games-won-a="state.gamesWon.a"
        :games-won-b="state.gamesWon.b"
      />
    </div>

    <div class="px-4 pb-4">
      <div
        class="text-[11px] font-semibold tracking-[0.06em] uppercase text-fg-subtle mb-2.5"
      >
        Get set up
      </div>
      <div class="flex flex-col gap-2">
        <div
          class="p-3 bg-surface border border-border rounded-md flex gap-3 items-center"
        >
          <span
            class="size-7 rounded-full bg-surface-2 text-fg-muted inline-flex items-center justify-center text-[13px] font-bold flex-shrink-0"
          >
            1
          </span>
          <span class="flex-1 min-w-0">
            <span class="block text-sm font-semibold">
              Score from your phone
            </span>
            <span class="block text-xs text-fg-muted mt-0.5">
              Open on this device, or scan to score from another
            </span>
          </span>
          <Button
            v-if="isOwner && writeToken"
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Regenerate scoring link (revokes the current one)"
            title="Regenerate scoring link (revokes the current one)"
            @click="openRegenConfirm"
          >
            <RefreshCw class="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Show Control URL as QR code"
            title="Scan with another device to score there"
            @click="onShowControlQr"
          >
            <QrCode class="size-4" />
          </Button>
          <Button
            as="a"
            type="button"
            variant="default"
            size="sm"
            :href="`/m/${matchId}/control`"
          >
            Open Control
          </Button>
        </div>

        <div
          class="p-3 bg-surface border border-border rounded-md flex gap-3 items-center"
        >
          <span
            class="size-7 rounded-full bg-surface-2 text-fg-muted inline-flex items-center justify-center text-[13px] font-bold flex-shrink-0"
          >
            2
          </span>
          <span class="flex-1 min-w-0">
            <span class="block text-sm font-semibold">Show overlay in OBS</span>
            <span class="block text-xs text-fg-muted mt-0.5">
              Paste URL into a Browser source
            </span>
          </span>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            @click="copy(urls.overlay, 'Overlay URL')"
          >
            Copy URL
          </Button>
        </div>

        <div
          class="p-3 bg-surface border border-border rounded-md flex gap-3 items-center"
        >
          <span
            class="size-7 rounded-full bg-surface-2 text-fg-muted inline-flex items-center justify-center text-[13px] font-bold flex-shrink-0"
          >
            3
          </span>
          <span class="flex-1 min-w-0">
            <span class="block text-sm font-semibold">Show on venue TV</span>
            <span class="block text-xs text-fg-muted mt-0.5">
              Scan from a TV/tablet, or open here
            </span>
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Show Scoreboard URL as QR code"
            title="Scan from a TV / second screen"
            @click="
              openQr({
                url: urls.scoreboard,
                title: 'Scoreboard',
                description:
                  'Scan from a TV / second screen to display the live scoreboard.',
              })
            "
          >
            <QrCode class="size-4" />
          </Button>
          <Button
            as="a"
            type="button"
            variant="secondary"
            size="sm"
            :href="urls.scoreboard"
            target="_blank"
            rel="noopener"
          >
            Open
          </Button>
        </div>
      </div>
    </div>

    <div class="px-4 pb-4">
      <LookAndFeelCards
        :overlay-theme-name="overlayName"
        :scoreboard-theme-name="scoreboardName"
        @open-theme="themeSheetOpen = true"
      />
    </div>

    <ThemePickerDialog
      v-model:open="themeSheetOpen"
      :overlay-theme="overlayTheme"
      :scoreboard-theme="scoreboardTheme"
      @pick="onPickTheme"
    />

    <SettingsSheet
      v-if="settingsOpen"
      :match-id="matchId"
      :meta="meta"
      @update:meta="onMetaUpdate"
      @close="onSettingsClose"
      @deleted="onMatchDeleted"
    />

    <QrDialog
      v-model:open="qrOpen"
      :url="qrUrl"
      :title="qrTitle"
      :description="qrDescription"
      :sensitive="qrSensitive"
    />

    <AlertDialog v-model:open="regenConfirmOpen">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Regenerate the scoring link?</AlertDialogTitle>
          <AlertDialogDescription>
            Anyone currently using the old link will be kicked to the scoreboard
            within a second. Share the new link with whoever should keep
            scoring.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="regenBusy">Cancel</AlertDialogCancel>
          <AlertDialogAction :disabled="regenBusy" @click="onRegenerateToken">
            {{ regenBusy ? "Regenerating…" : "Regenerate" }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
