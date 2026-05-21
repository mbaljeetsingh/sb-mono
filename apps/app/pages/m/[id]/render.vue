<script setup lang="ts">
// Post-game render — admin-only for now. Upload a recorded gameplay video,
// align it against the match's event log via "Mark match start here", then
// the broadcast overlay tracks the video's playback time. v1 stops at the
// alignment surface — operator does OS-level screen recording to capture
// the composited output. In-browser canvas+MediaRecorder render comes
// later (current themes are DOM, not canvas, so in-browser compositing
// needs html2canvas-class machinery or a theme-renderer port).

import { ref, computed, watch } from "vue";
import { Download, Film, Upload } from "lucide-vue-next";
import { getTheme } from "@sb/themes";
import { Button } from "@sb/layer-ui/components/ui/button";
import { useRolePermissions } from "~/composables/useRolePermissions";
import { useVideoRender } from "~/composables/useVideoRender";
import { createError } from "#app";
import { toast } from "vue-sonner";

definePageMeta({ layout: false, requiresAuth: true });
useSeoMeta({ title: "Render · Scoreboard" });

const { isAdmin } = useRolePermissions();
if (!isAdmin.value) {
  throw createError({
    statusCode: 403,
    statusMessage: "Render is admin-only while in beta",
    fatal: true,
  });
}

const route = useRoute();
const matchId = computed(() => String(route.params.id ?? ""));

const videoFile = ref<File | null>(null);
const videoUrl = ref<string | null>(null);
const videoEl = ref<HTMLVideoElement | null>(null);
const overlayEl = ref<HTMLElement | null>(null);

const onPickVideo = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  videoFile.value = file;
  if (videoUrl.value) URL.revokeObjectURL(videoUrl.value);
  videoUrl.value = URL.createObjectURL(file);
};

// Current video playhead in ms — drives the overlay state.
const videoTimeMs = ref(0);
const onTimeUpdate = () => {
  if (videoEl.value) videoTimeMs.value = videoEl.value.currentTime * 1000;
};

// Per-game anchors. BO-N matches can be assembled from multiple recordings
// concatenated with inter-game breaks trimmed — so the gap between game N
// and game N+1 in the events log (5+ minutes of real time) won't match the
// gap in the video (zero). Each game gets its own anchor; the active one
// is whichever anchor's videoMs is most recently <= current playhead.
type Anchor = { videoMs: number; eventTs: number };
const anchors = ref<Record<number, Anchor | null>>({});

// First `point` event of each game in the match. Game 0 = events before any
// game.end. Game N (N>0) = events after the Nth game.end. We use the first
// point of each game as the natural anchor (first visible rally outcome).
const firstPointPerGame = computed<((typeof events.value)[number] | null)[]>(
  () => {
    const result: ((typeof events.value)[number] | null)[] = [];
    let currentGame = 0;
    let needFirstPoint = true;
    for (const ev of events.value) {
      if (ev.type === "point" && needFirstPoint) {
        result[currentGame] = ev;
        needFirstPoint = false;
      } else if (ev.type === "game.end") {
        currentGame += 1;
        needFirstPoint = true;
      }
    }
    return result;
  },
);

const totalGames = computed(() => firstPointPerGame.value.length);

const replayTimeMs = ref(0);
const { state, config, loaded, events } = useReplayState(matchId, replayTimeMs);

// Active anchor = the latest anchor whose videoMs is <= current playhead.
// Used so each game-segment of the video drives the overlay with its own
// calibration. Falls back to game 0's anchor when scrubbing inside game 0,
// or null (no overlay updates) before any anchor is set.
const activeAnchor = computed<Anchor | null>(() => {
  const list = Object.values(anchors.value).filter(
    (a): a is Anchor => !!a && a.videoMs <= videoTimeMs.value,
  );
  if (list.length === 0) {
    // Before any anchor is reached — fall back to whichever anchor exists
    // (typically game 0) so the overlay still updates while user scrubs
    // backwards through the file.
    const any = Object.values(anchors.value).find(Boolean) as
      | Anchor
      | undefined;
    return any ?? null;
  }
  return list.reduce((latest, a) => (a.videoMs > latest.videoMs ? a : latest));
});

watch([videoTimeMs, activeAnchor], () => {
  const a = activeAnchor.value;
  if (!a) return;
  replayTimeMs.value = a.eventTs + (videoTimeMs.value - a.videoMs);
});

// Anchors map "this video moment" → "this event's ts" directly, so the
// match.started_at column isn't on the critical path. As long as events
// have loaded and we have a video mounted, sync is available.
const canSync = computed(
  () => loaded.value && !!videoEl.value && totalGames.value > 0,
);

// Capture current video moment as the anchor for game `gameIndex`. The
// anchor maps "this point in the video" to "this point's event ts".
const syncGame = (gameIndex: number) => {
  if (!videoEl.value) return;
  const ev = firstPointPerGame.value[gameIndex];
  if (!ev) return;
  anchors.value = {
    ...anchors.value,
    [gameIndex]: {
      videoMs: videoEl.value.currentTime * 1000,
      eventTs: ev.ts,
    },
  };
};

const clearAnchor = (gameIndex: number) => {
  const next = { ...anchors.value };
  delete next[gameIndex];
  anchors.value = next;
};

// Render — sync-gated. Snapshot every event whose game has an anchor, and
// composite via ffmpeg.wasm. If only G1 is synced, the render covers only
// G1's events (G2/G3 won't be drawn).
const { render, progress, outputUrl } = useVideoRender({ videoEl, overlayEl });

// Map an event's ts to its position in the video using the anchor for the
// game it belongs to. Events in games without anchors return null and are
// skipped from the render.
const eventToVideoTimeSec = (
  ev: { ts: number },
  gameIndex: number,
): number | null => {
  const a = anchors.value[gameIndex];
  if (!a) return null;
  return (a.videoMs + (ev.ts - a.eventTs)) / 1000;
};

const renderableSnapshotTimes = computed<number[]>(() => {
  const times: number[] = [];
  let currentGame = 0;
  for (const ev of events.value) {
    if (ev.type === "game.end") {
      currentGame += 1;
      continue;
    }
    if (ev.type !== "point" && ev.type !== "match.start") continue;
    const t = eventToVideoTimeSec(ev, currentGame);
    if (t !== null && t >= 0) times.push(t);
  }
  return times;
});

const canRender = computed(
  () => !!videoFile.value && renderableSnapshotTimes.value.length > 0,
);

const onRender = async () => {
  if (!videoFile.value) return;
  try {
    await render({
      videoBlob: videoFile.value,
      snapshotTimes: renderableSnapshotTimes.value,
    });
    toast.success("Render complete");
  } catch (err) {
    console.warn("[render] failed", err);
    toast.error(`Render failed: ${(err as Error).message}`);
  }
};

const downloadOutput = () => {
  if (!outputUrl.value || !videoFile.value) return;
  const a = document.createElement("a");
  a.href = outputUrl.value;
  a.download = videoFile.value.name.replace(/\.[^.]+$/, "") + "-overlay.mp4";
  document.body.appendChild(a);
  a.click();
  a.remove();
};

const formatTime = (ms: number) => {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
};

// Theme — reuse the overlay theme the operator chose for this match.
const { overlay: overlayTheme } = useThemeChoice(matchId);
const { teamNames, meta: matchMeta } = useMatchMeta(matchId);
const themeEntry = computed(() =>
  getTheme(overlayTheme.value || "broadcast-classic", "overlay"),
);
const meta = computed(() => ({
  sportLabel: (
    matchMeta.value.eventName ||
    config.value.sport ||
    "badminton"
  ).toUpperCase(),
  courtLabel: matchMeta.value.courtLabel?.trim() || null,
  round: matchMeta.value.round?.trim() || null,
  category: matchMeta.value.category?.trim() || null,
  venue: null as string | null,
  sponsorName: null as string | null,
}));
</script>

<template>
  <div class="min-h-screen bg-background text-foreground font-sans">
    <header class="px-4 py-3 border-b flex items-center justify-between gap-3">
      <h1 class="text-base font-semibold">Render · Beta</h1>
      <Button variant="ghost" size="sm" @click="navigateTo(`/m/${matchId}`)">
        ← Back to match
      </Button>
    </header>

    <main class="mx-auto max-w-5xl p-4 space-y-4">
      <!-- File picker -->
      <section
        v-if="!videoUrl"
        class="rounded-lg border border-dashed border-border-strong bg-surface p-10 text-center"
      >
        <Upload class="mx-auto mb-3 size-8 text-fg-subtle" />
        <p class="mb-1 text-sm font-medium">Upload your gameplay video</p>
        <p class="mb-4 text-xs text-fg-muted">
          Stays in your browser — never uploaded anywhere.
        </p>
        <label class="inline-block">
          <input
            type="file"
            accept="video/*"
            class="hidden"
            @change="onPickVideo"
          />
          <span
            class="inline-flex items-center justify-center rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90 cursor-pointer"
          >
            Choose video
          </span>
        </label>
      </section>

      <!-- Stage: video + overlay -->
      <section v-else class="space-y-3">
        <div
          class="relative aspect-video w-full overflow-hidden rounded-lg bg-black"
        >
          <video
            ref="videoEl"
            :src="videoUrl"
            class="absolute inset-0 size-full"
            controls
            @timeupdate="onTimeUpdate"
            @seeked="onTimeUpdate"
          />
          <!-- Overlay layered on top. pointer-events:none so video controls
               stay tappable. `overlayEl` ref is what html-to-image snapshots
               during render. -->
          <div
            v-if="loaded && themeEntry"
            ref="overlayEl"
            class="pointer-events-none absolute inset-0"
          >
            <component
              :is="themeEntry.component"
              :state="state"
              :config="config"
              :team-names="teamNames"
              :meta="meta"
            />
          </div>
        </div>

        <!-- Sync controls — one anchor per game. Single-game matches just
             show the one row. BO3/BO5 matches show a row per game so the
             operator can re-anchor after concatenating game videos (where
             inter-game breaks may have been trimmed). -->
        <div class="rounded-lg border border-border bg-surface p-4 space-y-3">
          <div
            class="text-[11px] font-bold tracking-wider uppercase text-fg-subtle"
          >
            Sync points
          </div>
          <p class="text-xs text-fg-muted">
            Scrub to the moment the first rally of each game ends (shuttle
            lands, score would flip), then tap "Sync." For one continuous
            recording, syncing Game 1 is usually enough.
          </p>
          <div class="flex flex-col gap-2">
            <div
              v-for="(ev, i) in firstPointPerGame"
              :key="i"
              class="flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2"
            >
              <div class="text-[11px] font-semibold text-fg-subtle w-12">
                G{{ i + 1 }}
              </div>
              <Button
                size="sm"
                :disabled="!canSync || !ev"
                :variant="anchors[i] ? 'outline' : 'default'"
                @click="syncGame(i)"
              >
                {{ anchors[i] ? "Re-sync here" : "Sync here" }}
              </Button>
              <div class="text-xs font-mono text-fg-subtle flex-1">
                <template v-if="anchors[i]">
                  video {{ formatTime(anchors[i]!.videoMs) }} ↔ event
                </template>
                <template v-else>not synced</template>
              </div>
              <Button
                v-if="anchors[i]"
                variant="ghost"
                size="sm"
                @click="clearAnchor(i)"
              >
                Clear
              </Button>
            </div>
          </div>
        </div>

        <!-- Render — ffmpeg.wasm + html-to-image composite. Only renders
             events whose game has a sync anchor. -->
        <div class="rounded-lg border border-border bg-surface p-4 space-y-3">
          <div class="flex items-center gap-3 flex-wrap">
            <Button
              :disabled="
                !canRender ||
                (progress.stage !== 'idle' &&
                  progress.stage !== 'done' &&
                  progress.stage !== 'error')
              "
              @click="onRender"
            >
              <Film class="size-4 mr-2" />
              Render video
            </Button>
            <span class="text-xs text-fg-muted">
              {{ renderableSnapshotTimes.length }}
              event{{ renderableSnapshotTimes.length === 1 ? "" : "s" }} from
              synced games will be drawn. Games without a sync row above are
              skipped.
            </span>
            <Button
              v-if="outputUrl"
              variant="secondary"
              class="ml-auto"
              @click="downloadOutput"
            >
              <Download class="size-4 mr-2" />
              Download MP4
            </Button>
          </div>

          <!-- Progress. `ratio` (0..1) drives loading-ffmpeg and encoding
               stages; `currentSnapshot / totalSnapshots` drives snapshotting.
               Without either, the bar shows an indeterminate pulse so users
               know it's working. -->
          <div
            v-if="progress.stage !== 'idle'"
            class="rounded-md border border-border bg-background px-3 py-2 text-xs font-mono text-fg-muted"
          >
            <div>{{ progress.message }}</div>
            <div class="mt-1 h-1 w-full bg-border rounded overflow-hidden">
              <div
                v-if="progress.totalSnapshots"
                class="h-full bg-brand rounded transition-[width]"
                :style="{
                  width: `${
                    ((progress.currentSnapshot ?? 0) /
                      (progress.totalSnapshots || 1)) *
                    100
                  }%`,
                }"
              />
              <div
                v-else-if="progress.ratio !== undefined"
                class="h-full bg-brand rounded transition-[width]"
                :style="{ width: `${progress.ratio * 100}%` }"
              />
              <div v-else class="h-full w-1/3 bg-brand rounded animate-pulse" />
            </div>
          </div>

          <!-- Output preview -->
          <video
            v-if="outputUrl"
            :src="outputUrl"
            controls
            class="w-full rounded-md border border-border bg-black"
          />

          <p class="text-[11px] text-fg-subtle">
            Beta · ffmpeg.wasm runs in your browser. Long matches take real time
            to encode; watch progress above.
          </p>
        </div>
      </section>
    </main>
  </div>
</template>
