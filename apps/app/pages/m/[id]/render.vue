<script setup lang="ts">
// Post-game render. Upload a recorded gameplay video, align it against the
// match's event log via "Mark match start here", then the broadcast overlay
// tracks the video's playback time. Compositing is fully client-side
// (WebCodecs) — no server cost — so it's open to anyone whose match has
// finished. The /m/[id] hub only surfaces the entry point once state.matchOver
// is true.

import { getPreset } from '@sb/engine';
import { Button } from '@sb/layer-ui/components/ui/button';
import { Progress } from '@sb/layer-ui/components/ui/progress';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@sb/layer-ui/components/ui/toggle-group';
import { getErrorMessage } from '@sb/shared/errors';
import { getTheme } from '@sb/themes';
import { useElementSize, useMouseInElement, useStorage } from '@vueuse/core';
import {
  ArrowLeft,
  Download,
  Film,
  Pause,
  Play,
  Plus,
  Upload,
} from 'lucide-vue-next';
import { domToCanvas } from 'modern-screenshot';
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { toast } from 'vue-sonner';
import AppLogo from '~/components/common/AppLogo.vue';
import ThemeToggle from '~/components/common/ThemeToggle.vue';
import { useRolePermissions } from '~/composables/useRolePermissions';
import {
  type OverlaySnapshot,
  useVideoRenderWebCodecs,
} from '~/composables/useVideoRenderWebCodecs';
import {
  type ClipKind,
  buildHighlightClips,
  clipsToVideo,
  formatClockMs,
} from '~/lib/highlight-clips';
import {
  type Anchor,
  type SnapshotPlanEntry,
  buildSnapshotPlan,
} from '~/lib/snapshot-plan';
import {
  type RecordingTime,
  assessRecordingFit,
  rankRecordings,
  readRecordingTime,
} from '~/lib/video-metadata';

definePageMeta({ layout: false });
useSeoMeta({ title: 'Render · Scoreboard' });

const route = useRoute();
const matchId = computed(() => String(route.params.id ?? ''));

// Admin-only for now — BETA, browser-dependent, compute-heavy. Future broader
// access lines up with E2.10 (post-production burn-in) in the roadmap.
// Non-admins get bounced to the match hub on mount. Auth.global middleware
// already redirects unauthenticated visitors to /auth/signin.
const { isAdmin } = useRolePermissions();
onMounted(() => {
  if (!isAdmin.value) {
    navigateTo(`/m/${matchId.value}`, { replace: true });
  }
});

const videoFile = ref<File | null>(null);
const videoUrl = ref<string | null>(null);
const videoEl = ref<HTMLVideoElement | null>(null);
const overlayEl = ref<HTMLElement | null>(null);
const stageEl = ref<HTMLElement | null>(null);
// Hidden shared file input: the initial dropzone button and the post-mount
// "Change video" button both open it, so a wrong auto-pick is always
// recoverable without a page reload.
const filePickerEl = ref<HTMLInputElement | null>(null);

// "Is this the right file for this match?" — the camera's own timestamp
// (container metadata, survives any copy; filesystem mtime as fallback)
// checked against the match's event window. A hint, never a blocker: clocks
// skew and metadata gets stripped, so mismatches warn instead of rejecting.
const recordingTime = ref<RecordingTime | null>(null);
// Event bounds via min/max, not first/last: the log is ULID-ordered, and a
// device-clock skew can make id order disagree with ts order.
const matchWindow = computed(() => {
  if (!loaded.value || events.value.length === 0) return null;
  let startMs = Number.POSITIVE_INFINITY;
  let endMs = Number.NEGATIVE_INFINITY;
  for (const ev of events.value) {
    if (ev.ts < startMs) startMs = ev.ts;
    if (ev.ts > endMs) endMs = ev.ts;
  }
  return { startMs, endMs };
});
const recordingFit = computed(() =>
  assessRecordingFit(
    recordingTime.value,
    videoDurationMs.value,
    matchWindow.value?.startMs ?? null,
    matchWindow.value?.endMs ?? null
  )
);

// Per-game anchors. BO-N matches can be assembled from multiple recordings
// concatenated with inter-game breaks trimmed — so the gap between game N
// and game N+1 in the events log (5+ minutes of real time) won't match the
// gap in the video (zero). Each game gets its own anchor; the active one
// is whichever anchor's videoMs is most recently <= current playhead.
const anchors = ref<Record<number, Anchor | null>>({});

// Anchors survive revisits: syncing means frame-hunting the end of the first
// rally of every game, and losing that to a reload makes re-renders miserable.
// Device-local (the video file itself lives on this device) and keyed per
// file fingerprint (name+size) — a map, so switching files can never stomp
// another recording's saved sync points. v1 stored a single {videoKey,
// anchors} pair; toAnchorMap migrates it on read.
type AnchorMap = Record<number, Anchor>;
type StoredAnchorMap = Record<string, AnchorMap>;
type LegacyStoredAnchors = { videoKey: string; anchors: AnchorMap };
const isLegacyStore = (
  v: StoredAnchorMap | LegacyStoredAnchors
): v is LegacyStoredAnchors =>
  typeof (v as LegacyStoredAnchors).videoKey === 'string';
const toAnchorMap = (
  v: StoredAnchorMap | LegacyStoredAnchors
): StoredAnchorMap =>
  isLegacyStore(v) ? (v.videoKey ? { [v.videoKey]: v.anchors } : {}) : v;
const storedAnchors = useStorage<StoredAnchorMap | LegacyStoredAnchors>(
  computed(() => `sb:render-anchors:${matchId.value}`),
  {} as StoredAnchorMap
);
const videoKey = computed(() =>
  videoFile.value ? `${videoFile.value.name}|${videoFile.value.size}` : null
);
watch(anchors, (a) => {
  if (!videoKey.value) return;
  const kept: AnchorMap = {};
  for (const [i, anchor] of Object.entries(a)) {
    if (anchor) kept[Number(i)] = anchor;
  }
  storedAnchors.value = {
    ...toAnchorMap(storedAnchors.value),
    [videoKey.value]: kept,
  };
});

// Everything derived from the mounted file. Restores saved anchors for a
// file we've synced before; otherwise starts clean — thumbnails, manual
// clips, and anchors from another recording must never leak across files.
const resetPerVideoState = (key: string) => {
  manualClips.value = [];
  excluded.value = new Set();
  activeCardId.value = null;
  thumbnails.value = {};
  isPlaying.value = false;
  videoTimeMs.value = 0;
  videoDurationMs.value = 0;
  if (outputUrl.value) {
    URL.revokeObjectURL(outputUrl.value);
    outputUrl.value = null;
  }
  const saved = toAnchorMap(storedAnchors.value)[key];
  anchors.value = saved ? { ...saved } : {};
  if (saved && Object.keys(saved).length > 0) {
    toast.info('Restored sync points from your last session');
  }
};

const mountVideo = (file: File, knownTime?: RecordingTime | null) => {
  const previousKey = videoKey.value;
  videoFile.value = file;
  if (videoUrl.value) URL.revokeObjectURL(videoUrl.value);
  videoUrl.value = URL.createObjectURL(file);
  if (videoKey.value !== previousKey) resetPerVideoState(videoKey.value!);
  if (knownTime !== undefined) {
    // Multi-file pick already parsed this file during ranking — reuse it.
    recordingTime.value = knownTime;
    return;
  }
  recordingTime.value = null;
  void readRecordingTime(file).then((t) => {
    // Only publish if this file is still the mounted one.
    if (videoFile.value === file) recordingTime.value = t;
  });
};

// Guards the ranking await: a newer pick (single or multi) supersedes any
// still-in-flight one, so a slow rank can't mount a stale file over it.
let pickSeq = 0;

const onPickVideo = async (e: Event) => {
  const input = e.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  // Clear the input's own selection so re-picking the same file later still
  // fires a change event.
  input.value = '';
  if (files.length === 0) return;
  const gen = ++pickSeq;
  if (files.length === 1) {
    mountVideo(files[0]!);
    return;
  }
  // Whole-session pick: with several files, load the one whose recording
  // window covers this match's event window best. Container timestamps rank
  // in milliseconds per file; nothing is decoded.
  if (!matchWindow.value) {
    // Events haven't loaded (or the match has none) — ranking has nothing to
    // compare against. Never pretend files[0] was chosen by timing.
    mountVideo(files[0]!);
    toast.warning(
      `Match data is still loading, so the ${files.length} files couldn't be ranked — loaded ${files[0]!.name}. Use "Change video" to re-pick.`
    );
    return;
  }
  const ranked = await rankRecordings(
    files,
    matchWindow.value.startMs,
    matchWindow.value.endMs
  );
  if (gen !== pickSeq) return;
  const best = ranked[0]!;
  mountVideo(best.file, best.time);
  if (best.fit && best.fit.verdict !== 'unlikely') {
    toast.success(
      `${best.file.name} fits this match's timing best of ${files.length} files.`
    );
  } else {
    toast.warning(
      `None of the ${files.length} files clearly match this match's timing — loaded ${best.file.name}. Check the banner below.`
    );
  }
};

const openFilePicker = () => filePickerEl.value?.click();

const fmtStamp = (ms: number) =>
  new Date(ms).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
const fmtClockOnly = (ms: number) =>
  new Date(ms).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });

// Timing banner, one string per verdict. Hedged when the window came from
// the filesystem's modified date — copying can reset it, so a mismatch there
// deserves less confidence than a camera-written container timestamp.
const fitBanner = computed(() => {
  const fit = recordingFit.value;
  const win = matchWindow.value;
  if (!fit || !win) return null;
  const rec = `${fmtStamp(fit.recStartMs)}–${fmtClockOnly(fit.recEndMs)}`;
  const match = `${fmtStamp(win.startMs)}–${fmtClockOnly(win.endMs)}`;
  const hedge =
    fit.source === 'file'
      ? ' (going by the file’s modified date, which copying can reset)'
      : '';
  if (fit.verdict === 'likely') {
    return {
      tone: 'success' as const,
      text: `Timing checks out — filmed ${rec}, this match ran ${match}${hedge}.`,
    };
  }
  if (fit.verdict === 'partial') {
    return {
      tone: 'warning' as const,
      text: `This recording covers ~${Math.round(fit.coverage * 100)}% of the match — filmed ${rec}, match ran ${match}${hedge}. Fine if the camera stopped early; suspicious if the number is small.`,
    };
  }
  return {
    tone: 'warning' as const,
    text: `This may be the wrong file — it was filmed ${rec}, but this match was played ${match}${hedge}.`,
  };
});

// Current video playhead in ms — drives the overlay state.
const videoTimeMs = ref(0);
const onTimeUpdate = () => {
  if (videoEl.value) videoTimeMs.value = videoEl.value.currentTime * 1000;
};

// The score bug visually sits on top of the video's native control bar
// (clicks pass through — the overlay is pointer-events-none — but you can't
// SEE the play button under it). Fade the overlay while the mouse is over
// the controls strip; touch pointers are ignored (touch: false) — a touch
// operator uses the timeline strip's play/pause instead, and fading on
// touch-drag would hide the bug they're inspecting. The zone scales with the
// stage so it never swallows half a small-viewport frame. Preview-only by
// construction: the fade lives on a wrapper AROUND overlayEl, and
// domToCanvas snapshots overlayEl's subtree, so ancestor opacity can never
// leak into an export.
const CONTROLS_ZONE_PX = 90;
const {
  elementY: stagePointerY,
  elementHeight: stagePointerHeight,
  isOutside: isPointerOutsideStage,
} = useMouseInElement(stageEl, { touch: false });
const isControlsZoneHovered = computed(() => {
  if (isPointerOutsideStage.value) return false;
  const h = stagePointerHeight.value;
  if (h <= 0) return false;
  const zone = Math.min(CONTROLS_ZONE_PX, h * 0.25);
  return h - stagePointerY.value < zone;
});

// The timeline strip carries its own play/pause — always visible, never
// under the overlay — which is what touch operators use.
const isPlaying = ref(false);
const togglePlay = () => {
  const v = videoEl.value;
  if (!v) return;
  if (v.paused) void v.play();
  else v.pause();
};

// First `point` event of each game in the match. Game 0 = events before any
// game.end. Game N (N>0) = events after the Nth game.end. We use the first
// point of each game as the natural anchor (first visible rally outcome).
const firstPointPerGame = computed<((typeof events.value)[number] | null)[]>(
  () => {
    const result: ((typeof events.value)[number] | null)[] = [];
    let currentGame = 0;
    let needFirstPoint = true;
    for (const ev of events.value) {
      if (ev.type === 'point' && needFirstPoint) {
        result[currentGame] = ev;
        needFirstPoint = false;
      } else if (ev.type === 'game.end') {
        currentGame += 1;
        needFirstPoint = true;
      }
    }
    return result;
  }
);

const totalGames = computed(() => firstPointPerGame.value.length);

const replayTimeMs = ref(0);
// Declared up here rather than beside the other theme/meta plumbing below,
// because the replay reducer needs `isDoubles` in its config — see useFormat.
const { teamNames, players, meta: matchMeta } = useMatchMeta(matchId);
const isDoublesRef = computed(() => matchMeta.value.isDoubles ?? false);
const { state, config, preset, loaded, events } = useReplayState(
  matchId,
  replayTimeMs,
  { isDoubles: isDoublesRef }
);

// Active anchor = the latest anchor whose videoMs is <= current playhead.
// Used so each game-segment of the video drives the overlay with its own
// calibration. Falls back to game 0's anchor when scrubbing inside game 0,
// or null (no overlay updates) before any anchor is set.
const activeAnchor = computed<Anchor | null>(() => {
  const list = Object.values(anchors.value).filter(
    (a): a is Anchor => !!a && a.videoMs <= videoTimeMs.value
  );
  if (list.length === 0) {
    // Before any anchor is reached — fall back to whichever anchor exists
    // (typically game 0) so the overlay still updates while user scrubs
    // backwards through the file.
    const any = Object.values(anchors.value).find(Boolean) as
      Anchor | undefined;
    return any ?? null;
  }
  return list.reduce((latest, a) => (a.videoMs > latest.videoMs ? a : latest));
});

watch([videoTimeMs, activeAnchor], () => {
  // The snapshot loop owns replayTimeMs while it runs — a timeupdate or a
  // card preview mid-render would otherwise overwrite the state between
  // "set replay time" and "rasterize", burning the playhead's score into
  // random frames of the export.
  if (snapshotting.value) return;
  const a = activeAnchor.value;
  if (!a) return;
  replayTimeMs.value = a.eventTs + (videoTimeMs.value - a.videoMs);
});

// Anchors map "this video moment" → "this event's ts" directly, so the
// match.started_at column isn't on the critical path. As long as events
// have loaded and we have a video mounted, sync is available.
const canSync = computed(
  () => loaded.value && !!videoEl.value && totalGames.value > 0
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

// ── Highlights mode ─────────────────────────────────────────────────────────
// Same page, same anchors: "Full match" renders the whole file with the
// overlay burned in; "Highlight reel" derives clips from the event log
// (long rallies, game winners, match point — see lib/highlight-clips) plus
// manually marked moments, and renders each selected clip as its own MP4.

const mode = ref<'full' | 'highlights'>('full');

const videoDurationMs = ref(0);
const onLoadedMetadata = () => {
  if (videoEl.value) {
    videoDurationMs.value = (videoEl.value.duration || 0) * 1000;
  }
};

const seekTo = (ms: number) => {
  if (!videoEl.value) return;
  videoEl.value.currentTime = ms / 1000;
  videoTimeMs.value = ms;
};

const highlightClips = computed(() => {
  if (!loaded.value) return [];
  const entry = getPreset(preset.value);
  return buildHighlightClips(events.value, entry.reducer, config.value);
});

const videoClips = computed(() =>
  clipsToVideo(highlightClips.value, anchors.value)
);

// Manual clips live in video time only — they mark moments the log can't see
// (the funny ones), so there is no event to anchor them to. Device-local and
// session-local by design: marking happens while reviewing the file.
type ManualClip = { id: string; videoStartMs: number; videoEndMs: number };
const manualClips = ref<ManualClip[]>([]);
let manualClipSeq = 0;
const MANUAL_LOOKBACK_MS = 15_000;
const MANUAL_POST_MS = 5_000;
const addClipAtPlayhead = () => {
  const at = videoTimeMs.value;
  const end = Math.min(
    videoDurationMs.value || at + MANUAL_POST_MS,
    at + MANUAL_POST_MS
  );
  manualClips.value = [
    ...manualClips.value,
    {
      // Counter, not just the timestamp: two taps on a paused playhead
      // would otherwise mint the same id (duplicate v-for keys, shared
      // selection/thumbnail state).
      id: `manual-${manualClipSeq++}-${Math.round(at)}`,
      videoStartMs: Math.max(0, at - MANUAL_LOOKBACK_MS),
      videoEndMs: end,
    },
  ];
};

const removeManualClip = (id: string) => {
  const removed = manualClips.value.find((m) => m.id === id);
  if (!removed) return;
  manualClips.value = manualClips.value.filter((m) => m.id !== id);
  // Drop the card's residue so a later clip can't inherit it: its exclusion
  // entry and its focus (a removed card must not stay the active band).
  if (excluded.value.has(id)) {
    const next = new Set(excluded.value);
    next.delete(id);
    excluded.value = next;
  }
  if (activeCardId.value === id) activeCardId.value = null;
  // Same pattern as recent-player chip removal: no confirm dialog, an undo
  // toast instead. Restoring reuses the id — the thumbnail cache entry is
  // still keyed to it, so undo doesn't re-trigger a capture.
  toast('Clip removed', {
    action: {
      label: 'Undo',
      onClick: () => {
        if (manualClips.value.some((m) => m.id === removed.id)) return;
        manualClips.value = [...manualClips.value, removed];
      },
    },
  });
};

// Clips can carry the score bug or ship as clean footage — a reel edited in
// Instagram often wants the clean cut, with the score added as a caption.
const clipOverlay = ref(true);

// "Someone's highlights": every point event knows which side won it, so
// filtering by side is free — no video analysis. Manual clips have no side
// and always pass. Doubles can't attribute a point to one partner (the log
// doesn't know who hit it), so the filter is per team there.
const sideFilter = ref<'all' | 'A' | 'B'>('all');
const sideFilterLabel = (side: 'A' | 'B') => {
  const name = teamNames.value[side === 'A' ? 'a' : 'b'];
  return name || `Team ${side}`;
};

// Selection: everything is in by default; only explicit exclusions are
// stored, so a recomputed clip list (new anchor, new manual clip) doesn't
// reset choices already made.
const excluded = ref(new Set<string>());
const toggleCard = (id: string) => {
  const next = new Set(excluded.value);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  excluded.value = next;
};

type ClipCard = {
  id: string;
  kind: ClipKind;
  title: string;
  meta: string;
  videoStartMs: number;
  videoEndMs: number;
  durationLabel: string;
  thumbnail: string | null;
  selected: boolean;
};

const cards = computed<ClipCard[]>(() => {
  const filtered =
    sideFilter.value === 'all'
      ? videoClips.value
      : videoClips.value.filter((c) => c.side === sideFilter.value);
  const auto = filtered.map((c) => ({
    id: c.id,
    kind: c.kind,
    title:
      c.kind === 'match-point'
        ? 'Match point'
        : c.kind === 'game-point'
          ? `${c.unit === 'set' ? 'Set' : 'Game'} ${c.gameIndex + 1} won`
          : c.kind === 'point-saved'
            ? c.saved === 'match'
              ? 'Match point saved'
              : 'Game point saved'
            : c.kind === 'clutch'
              ? 'Clutch point'
              : 'Long rally',
    meta: `${c.unit === 'set' ? 'Set' : 'Game'} ${c.gameIndex + 1} · ${c.scoreText.before} → ${c.scoreText.after} · at ${formatTime(c.videoStartMs)}`,
    videoStartMs: c.videoStartMs,
    videoEndMs: c.videoEndMs,
  }));
  const manual = manualClips.value.map((m) => ({
    id: m.id,
    kind: 'manual' as const,
    title: 'Added clip',
    meta: `Marked on timeline · at ${formatTime(m.videoStartMs)}`,
    videoStartMs: m.videoStartMs,
    videoEndMs: m.videoEndMs,
  }));
  return [...auto, ...manual]
    .sort((x, y) => x.videoStartMs - y.videoStartMs)
    .map((c) => ({
      ...c,
      durationLabel: formatTime(c.videoEndMs - c.videoStartMs),
      thumbnail: thumbnails.value[c.id] ?? null,
      selected: !excluded.value.has(c.id),
    }));
});

const selectedCards = computed(() => cards.value.filter((c) => c.selected));
const allSelected = computed(
  () =>
    cards.value.length > 0 && selectedCards.value.length === cards.value.length
);
const toggleSelectAll = () => {
  excluded.value = allSelected.value
    ? new Set(cards.value.map((c) => c.id))
    : new Set();
};
const selectedTotalLabel = computed(() =>
  formatTime(
    selectedCards.value.reduce(
      (sum, c) => sum + (c.videoEndMs - c.videoStartMs),
      0
    )
  )
);

const anchorTicks = computed(() =>
  Object.entries(anchors.value)
    .filter((entry): entry is [string, Anchor] => !!entry[1])
    .map(([i, a]) => ({ gameIndex: Number(i), videoMs: a.videoMs }))
);

const timelineBands = computed(() =>
  cards.value.map((c) => ({
    id: c.id,
    startMs: c.videoStartMs,
    endMs: c.videoEndMs,
    kind: c.kind,
    selected: c.selected,
  }))
);

const activeCardId = ref<string | null>(null);
const previewCard = (id: string) => {
  activeCardId.value = id;
  const c = cards.value.find((x) => x.id === id);
  if (c) seekTo(c.videoStartMs);
};

// ── Thumbnails ──────────────────────────────────────────────────────────────
// A second, muted video element grabs a real frame per clip so capture never
// jumps the operator's playhead. Sequential seek → 'seeked' → drawImage.
const thumbVideoEl = ref<HTMLVideoElement | null>(null);
const thumbnails = ref<Record<string, string>>({});
let thumbQueueRunning = false;

const captureThumbnails = async () => {
  const video = thumbVideoEl.value;
  if (!video || thumbQueueRunning) return;
  thumbQueueRunning = true;
  try {
    const canvas = document.createElement('canvas');
    // Re-read the pending list each pass — clips can appear mid-capture.
    for (;;) {
      // `=== undefined`, not falsiness: a failed capture is recorded as ''
      // below, and a falsy check would re-select that card forever.
      const next = cards.value.find(
        (c) => thumbnails.value[c.id] === undefined
      );
      if (!next) break;
      // The rally's payoff sits just before the clip's post-roll tail.
      const atSec = Math.max(next.videoStartMs, next.videoEndMs - 4_000) / 1000;
      const seeked = await new Promise<boolean>((resolve) => {
        const onSeeked = () => {
          cleanup();
          resolve(true);
        };
        const onError = () => {
          cleanup();
          resolve(false);
        };
        const cleanup = () => {
          video.removeEventListener('seeked', onSeeked);
          video.removeEventListener('error', onError);
        };
        video.addEventListener('seeked', onSeeked, { once: true });
        video.addEventListener('error', onError, { once: true });
        video.currentTime = atSec;
      });
      if (!seeked || !video.videoWidth) {
        // Mark it so a broken seek can't loop forever; card falls back to
        // the dark placeholder.
        thumbnails.value = { ...thumbnails.value, [next.id]: '' };
        continue;
      }
      canvas.width = 320;
      canvas.height = Math.round((320 * video.videoHeight) / video.videoWidth);
      const ctx = canvas.getContext('2d');
      if (!ctx) break;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      thumbnails.value = {
        ...thumbnails.value,
        [next.id]: canvas.toDataURL('image/jpeg', 0.7),
      };
    }
  } finally {
    thumbQueueRunning = false;
  }
};

// Re-anchoring moves every auto clip, so cached frames no longer match.
watch(anchors, () => {
  thumbnails.value = {};
});
watch(
  [() => cards.value.length, mode, anchors],
  () => {
    if (mode.value === 'highlights') void captureThumbnails();
  },
  { flush: 'post' }
);

// ── Per-clip render ─────────────────────────────────────────────────────────
const renderingClipId = ref<string | null>(null);

// Only the overlay states a clip can actually show: everything inside the
// window plus the state already active when it opens. Deliberately NO
// fallback to plan[0] when nothing precedes the window — plan[0] can belong
// to a LATER game's footage (only-game-2-synced on a continuous recording),
// and burning a future scoreline over earlier footage is worse than the
// empty-subset guard refusing with its toast.
const snapshotSubsetFor = (
  startSec: number,
  endSec: number
): SnapshotPlanEntry[] => {
  const plan = snapshotPlan.value;
  const before = plan.filter((p) => p.videoTimeSec <= startSec);
  const opening = before.length ? [before[before.length - 1]!] : [];
  return [
    ...opening,
    ...plan.filter(
      (p) => p.videoTimeSec > startSec && p.videoTimeSec <= endSec
    ),
  ];
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
};

const clipFilename = (card: ClipCard) => {
  const base = videoFile.value?.name.replace(/\.[^.]+$/, '') ?? 'match';
  const at = formatTime(card.videoStartMs).replace(':', 'm');
  return `${base}-${card.kind}-${at}s${clipOverlay.value ? '' : '-clean'}.mp4`;
};

const renderClip = async (card: ClipCard) => {
  if (!videoFile.value || renderingClipId.value) return;
  const startSec = card.videoStartMs / 1000;
  const endSec = card.videoEndMs / 1000;
  // Clean clips skip the overlay entirely — no snapshots to rasterize, so
  // they don't need an anchor either (a manual clip on an unsynced stretch
  // still exports clean).
  const subset = clipOverlay.value ? snapshotSubsetFor(startSec, endSec) : [];
  if (clipOverlay.value && subset.length === 0) {
    toast.error('Sync at least one game before rendering clips with score');
    return;
  }
  renderingClipId.value = card.id;
  try {
    const bitmaps = clipOverlay.value
      ? await collectOverlayBitmaps(subset)
      : [];
    const blob = await render({
      videoBlob: videoFile.value,
      overlaySnapshots: bitmaps,
      range: { startSec, endSec },
    });
    // The composable publishes every render on `outputUrl`, which feeds the
    // FULL-match section's preview + download button — a clip must not pose
    // as the full render there, and each abandoned URL pins its MP4 blob.
    if (outputUrl.value) {
      URL.revokeObjectURL(outputUrl.value);
      outputUrl.value = null;
    }
    downloadBlob(blob, clipFilename(card));
  } catch (err) {
    snapshotting.value = false;
    console.warn('[render] clip failed', err);
    toast.error(`Clip render failed: ${getErrorMessage(err)}`);
  } finally {
    renderingClipId.value = null;
  }
};

const downloadSelected = async () => {
  // Every save after the first happens minutes outside the click gesture,
  // which Chromium gates behind an "allow multiple downloads" permission —
  // warn once so a dismissed prompt doesn't silently swallow clips 2..n.
  if (selectedCards.value.length > 1) {
    toast.info('If your browser asks to allow multiple downloads, allow it.');
  }
  for (const card of selectedCards.value) {
    await renderClip(card);
  }
};

const clipRenderRatio = (id: string): number | null => {
  if (renderingClipId.value !== id) return null;
  // Snapshotting is the short first phase; encode dominates.
  if (snapshotting.value) {
    const { done, total } = snapshotProgress.value;
    return total ? (done / total) * 0.2 : 0;
  }
  return 0.2 + (progress.value.ratio ?? 0) * 0.8;
};

// WebCodecs render — accepts pre-collected overlay bitmaps from this page.
// The page drives the snapshot loop itself (no video seek; just push the
// reactive state forward) so snapshotting is dramatically faster.
const { render, progress, outputUrl } = useVideoRenderWebCodecs();

// Snapshot plan: each entry pairs the video-time the overlay should appear
// with the engine-time required to compute that overlay state. We snapshot
// by writing the engine-time into `replayTimeMs` directly — no video seek.
// Logic lives in lib/snapshot-plan.ts so it can be tested without the page.
const snapshotPlan = computed(() =>
  buildSnapshotPlan(events.value, anchors.value)
);

const canRender = computed(
  () => !!videoFile.value && snapshotPlan.value.length > 0
);

// Games that exist in the event log but have no anchor. buildSnapshotPlan
// silently drops every event in an unanchored game, so the burned-in overlay
// FREEZES at the previous game's last frame for that stretch of video — with
// nothing at render time to say so. Not a blocker (a video that only covers
// game 1 is a legitimate render); it must just never be a surprise.
const unsyncedGames = computed(() =>
  firstPointPerGame.value
    .map((ev, i) => (ev && !anchors.value[i] ? i + 1 : null))
    .filter((n): n is number => n !== null)
);
const syncedCount = computed(
  () => Object.values(anchors.value).filter(Boolean).length
);
const unsyncedWarning = computed(() => {
  if (syncedCount.value === 0 || unsyncedGames.value.length === 0) return null;
  const list = unsyncedGames.value.map((n) => `Game ${n}`).join(', ');
  return `${list} not synced — the overlay will freeze on the last synced game's final score for that part of the video.`;
});

const snapshotting = ref(false);
const snapshotProgress = ref({ done: 0, total: 0 });

// Rasterize the overlay at each plan point. Drives the reactive state via
// `replayTimeMs` directly — the video element doesn't move, no expensive
// seek, no decoder cache flush. Just push, await DOM, snapshot, repeat.
// Takes the plan explicitly: the full render passes the whole plan, a clip
// render passes just the entries its window can show.
const collectOverlayBitmaps = async (
  plan: SnapshotPlanEntry[]
): Promise<OverlaySnapshot[]> => {
  const overlay = overlayEl.value;
  const video = videoEl.value;
  if (!overlay || !video) throw new Error('overlay or video not mounted');
  // A playing video would keep firing timeupdate against the guarded watcher
  // above; pause so the operator's playback can't race the snapshot loop.
  video.pause();

  const overlayRect = overlay.getBoundingClientRect();
  const videoW = video.videoWidth || overlayRect.width;
  const scale = overlayRect.width > 0 ? videoW / overlayRect.width : 1;

  snapshotting.value = true;
  snapshotProgress.value = { done: 0, total: plan.length };

  const out: OverlaySnapshot[] = [];
  for (let i = 0; i < plan.length; i++) {
    const p = plan[i]!;
    replayTimeMs.value = p.replayTimeMs;
    await nextTick();
    const canvas = await domToCanvas(overlay, {
      scale,
      backgroundColor: undefined,
    });
    const bitmap = await createImageBitmap(canvas);
    out.push({ videoTimeSec: p.videoTimeSec, bitmap });
    snapshotProgress.value = { done: i + 1, total: plan.length };
  }
  snapshotting.value = false;
  return out;
};

const onRender = async () => {
  if (!videoFile.value) return;
  try {
    const bitmaps = await collectOverlayBitmaps(snapshotPlan.value);
    await render({
      videoBlob: videoFile.value,
      overlaySnapshots: bitmaps,
    });
    toast.success('Render complete');
  } catch (err) {
    snapshotting.value = false;
    console.warn('[render] failed', err);
    toast.error(`Render failed: ${getErrorMessage(err)}`);
  }
};

const downloadOutput = () => {
  if (!outputUrl.value || !videoFile.value) return;
  const a = document.createElement('a');
  a.href = outputUrl.value;
  a.download = `${videoFile.value.name.replace(/\.[^.]+$/, '')}-overlay.mp4`;
  document.body.appendChild(a);
  a.click();
  a.remove();
};

// Shared with the timeline strip — one clock format for the whole page.
const formatTime = formatClockMs;

// Overlay themes size themselves in px against OBS's 1920×1080 browser
// source (broadcast-classic is a 620px panel ≈ ⅓ of that frame). The render
// stage is ~1000px wide, so mounting the theme directly doubles the bug's
// share of the frame — and the export snapshot preserves the on-screen ratio,
// burning it in oversized. Render the theme inside a virtual broadcast-width
// frame scaled down to the stage instead; the size option divides the virtual
// width (wider virtual canvas = smaller bug), so every theme keeps its own
// edge insets regardless of which corner it anchors to.
const BROADCAST_WIDTH = 1920;
const OVERLAY_SIZE_FACTOR = { s: 0.8, m: 1, l: 1.2 } as const;
const overlaySize = ref<keyof typeof OVERLAY_SIZE_FACTOR>('m');
const { width: stageWidth, height: stageHeight } = useElementSize(stageEl);
const overlayFrameStyle = computed(() => {
  const frameW = BROADCAST_WIDTH / OVERLAY_SIZE_FACTOR[overlaySize.value];
  const ratio =
    stageWidth.value > 0 ? stageHeight.value / stageWidth.value : 9 / 16;
  return {
    width: `${frameW}px`,
    height: `${frameW * ratio}px`,
    transform: `scale(${stageWidth.value > 0 ? stageWidth.value / frameW : 0})`,
  };
});

// Theme — reuse the overlay theme the operator chose for this match.
const { overlay: overlayTheme } = useThemeChoice(matchId);
const themeEntry = computed(() =>
  getTheme(overlayTheme.value || 'broadcast-classic', 'overlay')
);
const meta = computed(() => ({
  sportLabel: matchMeta.value.eventName?.trim().toUpperCase() || undefined,
  courtLabel: matchMeta.value.courtLabel?.trim() || null,
  round: matchMeta.value.round?.trim() || null,
  category: matchMeta.value.category?.trim() || null,
  venue: null as string | null,
  sponsorName: null as string | null,
  // Post-game render: events are reconstructed against recorded footage, so
  // the LIVE pill would be a lie. Themes hide it when isLive === false.
  isLive: false,
}));
</script>

<template>
  <div
    class="min-h-screen bg-background text-foreground font-sans pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)]"
  >
    <!-- Same h-14 / border-b / backdrop-blur styling as the site-wide
         AppHeader so /render reads as part of the product. AppLogo links
         home (consistent with the rest of the site); explicit Back button
         on the left covers the "step back to match" intent. ThemeToggle
         joins the right side for consistency with AppHeader. -->
    <header
      class="sticky top-0 z-30 flex h-[calc(3.5rem+env(safe-area-inset-top))] w-full items-center justify-between gap-2 border-b border-border bg-background/80 pt-[env(safe-area-inset-top)] px-3 backdrop-blur supports-[backdrop-filter]:bg-background/60"
    >
      <div class="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Back to match"
          @click="navigateTo(`/m/${matchId}`)"
        >
          <ArrowLeft class="size-4" />
        </Button>
        <AppLogo link-to="/" size="sm" />
      </div>
      <span
        class="hidden sm:block text-[11px] font-semibold tracking-wider text-fg-muted uppercase"
      >
        Render · Beta
      </span>
      <ThemeToggle />
    </header>

    <main class="mx-auto max-w-5xl p-4 space-y-4">
      <!-- Shared picker input: opened by the dropzone button and by
           "Change video" after a mount, so a wrong auto-pick is always
           recoverable. -->
      <input
        ref="filePickerEl"
        type="file"
        accept="video/*"
        multiple
        class="hidden"
        @change="onPickVideo"
      />

      <!-- File picker -->
      <section
        v-if="!videoUrl"
        class="rounded-lg border border-dashed border-border-strong bg-surface p-10 text-center"
      >
        <Upload class="mx-auto mb-3 size-8 text-fg-subtle" />
        <p class="mb-1 text-sm font-medium">Upload your gameplay video</p>
        <p class="mb-4 text-xs text-fg-muted">
          Stays in your browser — never uploaded anywhere. Filmed the whole
          session? Select all the videos and the one matching this match's
          timing loads automatically.
        </p>
        <Button @click="openFilePicker">Choose video</Button>
      </section>

      <!-- Stage: video + overlay -->
      <section v-else class="space-y-3">
        <!-- Output picker: one anchoring session, two deliverables. -->
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-1">
            <ToggleGroup
              type="single"
              variant="outline"
              :model-value="mode"
              @update:model-value="
                (v) => v && (mode = v as 'full' | 'highlights')
              "
            >
              <ToggleGroupItem value="full">Full match</ToggleGroupItem>
              <ToggleGroupItem value="highlights">
                Highlight reel
              </ToggleGroupItem>
            </ToggleGroup>
            <Button variant="ghost" size="sm" @click="openFilePicker">
              <Upload class="size-3.5" />
              Change video
            </Button>
          </div>
          <div class="flex items-center gap-3">
            <div class="flex items-center gap-2">
              <span
                class="text-[11px] font-semibold tracking-wider uppercase text-fg-subtle"
              >
                Score size
              </span>
              <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                :model-value="overlaySize"
                @update:model-value="
                  (v) =>
                    v && (overlaySize = v as keyof typeof OVERLAY_SIZE_FACTOR)
                "
              >
                <ToggleGroupItem value="s" aria-label="Small score overlay">
                  S
                </ToggleGroupItem>
                <ToggleGroupItem value="m" aria-label="Medium score overlay">
                  M
                </ToggleGroupItem>
                <ToggleGroupItem value="l" aria-label="Large score overlay">
                  L
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
            <span class="text-xs text-fg-muted">
              {{ syncedCount }} of {{ totalGames }} game{{
                totalGames === 1 ? '' : 's'
              }}
              synced
            </span>
          </div>
        </div>

        <!-- Recording ↔ match timing check. Fires once metadata is readable;
             silent when the file carries no usable timestamps. -->
        <p
          v-if="fitBanner"
          class="rounded-md border px-3 py-2 text-xs"
          :class="
            fitBanner.tone === 'success'
              ? 'border-success/40 bg-success-soft text-success'
              : 'border-warning/40 bg-warning-soft text-warning'
          "
        >
          {{ fitBanner.text }}
        </p>

        <div
          ref="stageEl"
          class="relative aspect-video w-full overflow-hidden rounded-lg bg-black"
        >
          <video
            ref="videoEl"
            :src="videoUrl"
            class="absolute inset-0 size-full"
            controls
            @timeupdate="onTimeUpdate"
            @seeked="onTimeUpdate"
            @loadedmetadata="onLoadedMetadata"
            @play="isPlaying = true"
            @pause="isPlaying = false"
          />
          <!-- Overlay layered on top. pointer-events:none so video controls
               stay tappable. `overlayEl` ref is what html-to-image snapshots
               during render; the inner frame renders the theme at broadcast
               proportions and scales down to the stage (see overlayFrameStyle).
               The fade wrapper reveals the native controls under the bug —
               it must stay OUTSIDE overlayEl or it would burn into exports. -->
          <div
            v-if="loaded && themeEntry"
            class="pointer-events-none absolute inset-0 transition-opacity duration-200"
            :class="isControlsZoneHovered ? 'opacity-15' : 'opacity-100'"
          >
            <div
              ref="overlayEl"
              class="pointer-events-none absolute inset-0 overflow-hidden"
            >
              <div
                class="absolute left-0 top-0 origin-top-left"
                :style="overlayFrameStyle"
              >
                <component
                  :is="themeEntry.component"
                  :state="state"
                  :config="config"
                  :team-names="teamNames"
                  :players="players"
                  :meta="meta"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Hidden sibling video: thumbnail capture seeks THIS element so the
             operator's playhead never jumps. Same blob URL, no extra fetch. -->
        <video
          ref="thumbVideoEl"
          :src="videoUrl"
          muted
          playsinline
          preload="auto"
          class="hidden"
        />

        <!-- Timeline strip: sync ticks + playhead always; clip bands in
             highlight mode. Click seeks; clicking a band focuses its card. -->
        <div class="rounded-lg border border-border bg-surface p-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Button
                variant="secondary"
                size="icon-sm"
                :aria-label="isPlaying ? 'Pause' : 'Play'"
                :disabled="!videoDurationMs"
                @click="togglePlay"
              >
                <Pause v-if="isPlaying" class="size-3.5" />
                <Play v-else class="size-3.5" />
              </Button>
              <span
                class="text-[11px] font-bold tracking-wider uppercase text-fg-subtle"
              >
                Timeline
              </span>
            </div>
            <Button
              v-if="mode === 'highlights'"
              variant="secondary"
              size="sm"
              :disabled="!videoDurationMs"
              @click="addClipAtPlayhead"
            >
              <Plus class="size-3.5" />
              Add clip at playhead
            </Button>
          </div>
          <HighlightTimeline
            class="mt-1"
            :duration-ms="videoDurationMs"
            :current-ms="videoTimeMs"
            :anchor-ticks="anchorTicks"
            :bands="mode === 'highlights' ? timelineBands : []"
            :active-band-id="activeCardId"
            @seek="seekTo"
            @select-band="previewCard"
          />
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
          <!-- This copy used to say syncing Game 1 was "usually enough" for a
               continuous recording. It never was: the plan builder drops every
               event in an unanchored game, so that advice produced overlays
               frozen from game 2 onward. Every game needs its anchor. -->
          <p class="text-xs text-fg-muted">
            Scrub to the moment the first rally of each game ends (shuttle
            lands, score would flip), then tap "Sync." Do this for every game —
            even in one continuous recording — so each game's overlay lines up
            with its footage.
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
                {{ anchors[i] ? 'Re-sync here' : 'Sync here' }}
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
          <p
            v-if="unsyncedWarning"
            class="rounded-md border border-warning/40 bg-warning-soft px-3 py-2 text-xs text-warning"
          >
            {{ unsyncedWarning }}
          </p>
        </div>

        <!-- Render — WebCodecs (hardware H.264) + modern-screenshot for the
             overlay rasterization. Only renders events whose game has a
             sync anchor. -->
        <div
          v-if="mode === 'full'"
          class="rounded-lg border border-border bg-surface p-4 space-y-3"
        >
          <div class="flex items-center gap-3 flex-wrap">
            <Button
              :disabled="
                !canRender ||
                snapshotting ||
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
              {{ snapshotPlan.length }}
              event{{ snapshotPlan.length === 1 ? '' : 's' }} will be drawn
              <template v-if="totalGames > 1">
                from {{ syncedCount }} of {{ totalGames }} games</template
              >.
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

          <!-- Snapshotting progress (driven by the page, not the composable). -->
          <div
            v-if="snapshotting"
            class="rounded-md border border-border bg-background px-3 py-2 text-xs font-mono text-fg-muted space-y-2"
          >
            <div>
              Snapshot {{ snapshotProgress.done }}/{{ snapshotProgress.total }}
            </div>
            <Progress
              :model-value="
                (snapshotProgress.done / Math.max(1, snapshotProgress.total)) *
                100
              "
              class="h-1.5"
            />
          </div>

          <!-- Composable progress (demux / encode / finalize). -->
          <div
            v-if="!snapshotting && progress.stage !== 'idle'"
            class="rounded-md border border-border bg-background px-3 py-2 text-xs font-mono text-fg-muted space-y-2"
          >
            <div>{{ progress.message }}</div>
            <Progress
              :model-value="
                progress.ratio !== undefined ? progress.ratio * 100 : null
              "
              class="h-1.5"
            />
          </div>

          <!-- Output preview -->
          <video
            v-if="outputUrl"
            :src="outputUrl"
            controls
            class="w-full rounded-md border border-border bg-black"
          />

          <p class="text-[11px] text-fg-subtle">
            Beta · encoded in your browser via WebCodecs. Long matches take real
            time to encode; watch progress above.
          </p>
        </div>

        <!-- Highlight reel: auto-picked clips + manual ones, each downloading
             as its own MP4 — score burned in, or clean footage. -->
        <template v-else>
          <div
            v-if="videoClips.length === 0 && manualClips.length === 0"
            class="rounded-lg border border-dashed border-border-strong bg-surface p-8 text-center text-sm text-fg-muted"
          >
            No highlights yet — sync a game above and clips will appear here, or
            scrub to a moment and add one at the playhead.
          </div>
          <template v-else>
            <div class="flex items-center justify-between">
              <span
                class="text-[11px] font-bold tracking-wider uppercase text-fg-subtle"
              >
                Highlights
              </span>
              <div class="flex items-center gap-2">
                <span class="text-xs text-fg-muted">
                  {{ selectedCards.length }} of {{ cards.length }} selected
                </span>
                <Button variant="ghost" size="sm" @click="toggleSelectAll">
                  {{ allSelected ? 'Clear' : 'Select all' }}
                </Button>
              </div>
            </div>

            <!-- Who + how: side filter ("someone's highlights" — the log
                 knows who won every point) and score-bug on/off per clip. -->
            <div class="flex flex-wrap items-center justify-between gap-2">
              <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                :model-value="sideFilter"
                @update:model-value="
                  (v) => v && (sideFilter = v as 'all' | 'A' | 'B')
                "
              >
                <ToggleGroupItem value="all">All points</ToggleGroupItem>
                <ToggleGroupItem value="A">
                  {{ sideFilterLabel('A') }}
                </ToggleGroupItem>
                <ToggleGroupItem value="B">
                  {{ sideFilterLabel('B') }}
                </ToggleGroupItem>
              </ToggleGroup>
              <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                :model-value="clipOverlay ? 'score' : 'clean'"
                @update:model-value="(v) => v && (clipOverlay = v === 'score')"
              >
                <ToggleGroupItem value="score">With score</ToggleGroupItem>
                <ToggleGroupItem value="clean">Clean footage</ToggleGroupItem>
              </ToggleGroup>
            </div>

            <div
              v-if="cards.length === 0"
              class="rounded-lg border border-dashed border-border bg-surface p-6 text-center text-sm text-fg-muted"
            >
              No clips won by {{ sideFilterLabel(sideFilter as 'A' | 'B') }} in
              the synced games.
            </div>
            <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <HighlightCard
                v-for="card in cards"
                :key="card.id"
                :card="card"
                :render-ratio="clipRenderRatio(card.id)"
                :busy="!!renderingClipId"
                :removable="card.kind === 'manual'"
                @toggle="toggleCard(card.id)"
                @preview="previewCard(card.id)"
                @download="renderClip(card)"
                @remove="removeManualClip(card.id)"
              />
            </div>
            <div
              class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3"
            >
              <div class="text-[13px]">
                <span class="font-semibold">
                  {{ selectedCards.length }} clip{{
                    selectedCards.length === 1 ? '' : 's'
                  }}
                  selected
                </span>
                <span class="text-fg-subtle">
                  · {{ selectedTotalLabel }} total ·
                  {{ clipOverlay ? 'score burned in' : 'clean footage' }} · each
                  clip downloads as its own MP4
                </span>
              </div>
              <Button
                :disabled="!selectedCards.length || !!renderingClipId"
                @click="downloadSelected"
              >
                <Download class="size-4 mr-2" />
                Download {{ selectedCards.length }} clip{{
                  selectedCards.length === 1 ? '' : 's'
                }}
              </Button>
            </div>
            <p class="text-[11px] text-fg-subtle">
              Clips export at the source aspect ratio — crop to 9:16 in the
              Instagram editor for Reels.
            </p>
          </template>
        </template>
      </section>
    </main>
  </div>
</template>
