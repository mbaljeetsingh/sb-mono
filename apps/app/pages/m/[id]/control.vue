<script setup lang="ts">
import {
  type RacquetEvent,
  type SideId,
  applyRacquetUndo,
  reduceRacquet,
} from '@sb/engine';
import { Button } from '@sb/layer-ui/components/ui/button';
import { onLongPress, useStorage, useVibrate, useWakeLock } from '@vueuse/core';
import {
  ArrowLeft,
  ArrowLeftRight,
  ArrowUpDown,
  Columns3,
  MoreHorizontal,
  PencilLine,
  Repeat,
  Rows3,
  Undo2,
} from 'lucide-vue-next';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { toast } from 'vue-sonner';
import AppLogo from '~/components/common/AppLogo.vue';
import ThemeToggle from '~/components/common/ThemeToggle.vue';
import FormatSheet from '~/components/control/FormatSheet.vue';
import GameOverModal from '~/components/control/GameOverModal.vue';
import MatchOverModal from '~/components/control/MatchOverModal.vue';
import MatchStateSheet from '~/components/control/MatchStateSheet.vue';
import ScoreCorrectSheet from '~/components/control/ScoreCorrectSheet.vue';
import TeamRow from '~/components/control/TeamRow.vue';
import TossSheet from '~/components/control/TossSheet.vue';
import { swapTeamPlayers } from '~/lib/partner-swap';
import { sportIdFromPreset } from '~/lib/sports';

definePageMeta({ layout: false });

const route = useRoute();
const matchId = computed(() => String(route.params.id ?? ''));

// Resolve who can score here: owner, anon-match-anyone, or token holder.
// Token-only access routes writes through SECURITY DEFINER RPCs that
// validate the token server-side; owners and anon-match writers use the
// normal RLS-gated path (writeToken stays null for them).
const {
  loaded: accessLoaded,
  canScore,
  writeToken,
  isOwner,
  isAnonMatch,
  matchDeleted,
} = useWriteAccess(matchId);
// `canEditMeta` gates UI that writes directly to the `matches` row (format
// preset, gamesToWin, player swap in doubles). Co-scorer token writes are
// routed through the SECURITY DEFINER RPCs; direct UPDATEs fail under RLS
// for anyone who isn't the owner of an owned match, so we hide the chrome
// to avoid showing "successful" local edits that never sync.
const canEditMeta = computed(() => isOwner.value || isAnonMatch.value);
watch([accessLoaded, canScore], ([l, ok]) => {
  if (!l || ok) return;
  // The match was deleted while we were here — the scoreboard view would be
  // an empty shell, so send the user somewhere meaningful instead.
  if (matchDeleted.value) {
    toast.error('This match was deleted.');
    navigateTo('/', { replace: true });
    return;
  }
  toast.error("You don't have permission to score this match.");
  navigateTo(`/m/${matchId.value}/scoreboard`, { replace: true });
});

const { meta: matchMeta } = useMatchMeta(matchId);
const {
  preset,
  gamesToWin,
  config,
  sportPresetOptions,
  presetLabel,
  seriesLabel,
} = useFormat(matchId);
const {
  events,
  append,
  replace,
  loaded: eventsLoaded,
} = useEvents(matchId, { writeToken });

// Soft handoff lock: at most one device is the "active scorer" at a time.
// Other devices viewing /control land in read-only mode with a banner +
// "Score from this device" reclaim button. Bootstrap: when no one has
// claimed yet (first load on a fresh match), every device is active so the
// first tap registers. The trigger flips the column on first event INSERT.
const {
  isActive,
  activeDeviceId,
  claim: claimScoring,
} = useScorerActive(matchId, { writeToken });

const teamMeta = computed(() => ({
  isDoubles: matchMeta.value.isDoubles ?? false,
  teamNames: matchMeta.value.teamNames ?? { a: '', b: '' },
  players: matchMeta.value.players ?? { a1: '', a2: '', b1: '', b2: '' },
}));

const state = computed(() => reduceRacquet(events.value, config.value));
const { cellsA, cellsB, cellIsServer, displayNameA, displayNameB } =
  useCourtCells(state, teamMeta);

// Which playing surface to draw. TeamRow renders the real court for the sport
// (green badminton mat, blue TT table, ...), so the active preset is legible
// without reading the format chip.
const sport = computed(() => sportIdFromPreset(preset.value));

// Interval countdown. BWF allows 60s at the mid-game interval (first side to
// 11) and 120s between games, and umpires actually run to those clocks — a
// static "INTERVAL" badge doesn't help. Display only: nothing is blocked when
// it reaches zero, it just stops counting.
const INTERVAL_MS = 60_000;
const nowMs = ref(Date.now());
let nowTimer: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  nowTimer = setInterval(() => {
    nowMs.value = Date.now();
  }, 1000);
});
onUnmounted(() => clearInterval(nowTimer));

const intervalClock = computed(() => {
  if (!state.value.atInterval) return null;
  // Anchor to the last *point* — the event that actually reached the interval.
  // The reducer keeps atInterval true across timeout/penalty events appended
  // during the break, so anchoring to "whatever event is last" would silently
  // restart the countdown every time the umpire logs one.
  const anchor = events.value.findLast((e) => e.type === 'point');
  if (!anchor?.ts) return null;
  const left = Math.ceil((anchor.ts + INTERVAL_MS - nowMs.value) / 1000);
  if (left <= 0) return null;
  return `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
});

// Sync matches.ended_at to the engine's view of "match is finished". Going
// true → stamps the timestamp so the token RPCs auto-revoke co-scorer
// writes; going false → clears it so a score.correct that un-finishes the
// match re-opens token-path scoring. The watcher only fires on actual
// transitions, so we don't burn updates on every event. Owner-or-anon-match
// path (RLS gates this update); for token-only callers the write fails
// silently — they shouldn't be the ones ending matches anyway.
const supabaseClient = useSupabaseClient();
watch(
  () => state.value.matchOver,
  async (isOver, wasOver) => {
    if (isOver === wasOver) return;
    const { error } = await supabaseClient
      .from('matches')
      .update({ ended_at: isOver ? new Date().toISOString() : null })
      .eq('id', matchId.value);
    if (error) console.warn('[control] sync ended_at failed', error);
  }
);

// Seed the match.start event only when this device is the *first* one to
// touch the match. We have to wait for two things before we can safely
// answer "is the match empty?":
//   1. useWriteAccess has resolved (`accessLoaded`) — otherwise we might
//      write a phantom event into IDB before being redirected away.
//   2. useEvents has finished its first reconcile (`eventsLoaded`) —
//      otherwise a co-scorer opening /control in a fresh browser races
//      the async Supabase fetch, sees `events.value.length === 0` because
//      the remote events haven't landed yet, and stamps a stray match.start
//      that resets the score (the engine treats match.start as a reset).
const maybeSeedMatchStart = () => {
  if (!canScore.value || events.value.length !== 0) return;
  append({
    type: 'match.start',
    serverSide: 'A',
    serverCourt: 'right',
  } as Omit<RacquetEvent, 'id' | 'ts'>);
};

watch(
  [accessLoaded, eventsLoaded],
  ([access, evs]) => {
    if (access && evs) maybeSeedMatchStart();
  },
  { immediate: true }
);

// Pre-match toss flow. Toss is a match-level prompt, but the "has this
// operator already decided?" state lives per-device in localStorage so a
// co-scorer who scans the QR before any points have been scored still gets
// the prompt. We show the TossSheet whenever this device hasn't yet seen
// it for this match AND the log is still just the auto-bootstrap match.start.
// Both commit and skip set the seen flag, so an undo back to 0-0 on the
// same device won't re-prompt.
const tossSeen = ref(false);
const refreshTossSeen = () => {
  if (typeof localStorage === 'undefined') {
    tossSeen.value = true;
    return;
  }
  tossSeen.value =
    localStorage.getItem(`sb:toss-seen:${matchId.value}`) === '1';
};
onMounted(refreshTossSeen);
watch(matchId, refreshTossSeen);

const markTossSeen = () => {
  try {
    localStorage.setItem(`sb:toss-seen:${matchId.value}`, '1');
  } catch {
    // ignore — flag is best-effort
  }
  tossSeen.value = true;
};

// Show only when the match is genuinely fresh: exactly the auto-seeded
// match.start and nothing else. Once any other event lands we never re-prompt.
const showToss = computed(() => {
  if (tossSeen.value) return false;
  if (!canScore.value || !isActive.value) return false;
  if (events.value.length !== 1) return false;
  return events.value[0]?.type === 'match.start';
});

const onTossCommit = (payload: {
  tossWinner: SideId;
  choice: 'serve' | 'receive';
  serverSide: SideId;
  startingServerSlot?: 1 | 2;
  startingReceiverSlot?: 1 | 2;
}) => {
  if (matchMeta.value.isDoubles) {
    const receivingSide: SideId = payload.serverSide === 'A' ? 'B' : 'A';
    const current = matchMeta.value.players ?? {
      a1: '',
      a2: '',
      b1: '',
      b2: '',
    };
    const next = { ...current };
    // Engine's initial partnerOnRight = {a:1, b:1}; serverCourt starts "right",
    // so slot 1 of the serving team is the first server, slot 1 of the
    // receiving team is the first receiver. If the operator picked slot 2 for
    // either role, swap that team's a1/a2 (or b1/b2) so slot 1 becomes the
    // picked starter — no engine change required.
    if (payload.startingServerSlot === 2) {
      if (payload.serverSide === 'A') {
        next.a1 = current.a2;
        next.a2 = current.a1;
      } else {
        next.b1 = current.b2;
        next.b2 = current.b1;
      }
    }
    if (payload.startingReceiverSlot === 2) {
      if (receivingSide === 'A') {
        next.a1 = current.a2;
        next.a2 = current.a1;
      } else {
        next.b1 = current.b2;
        next.b2 = current.b1;
      }
    }
    if (JSON.stringify(next) !== JSON.stringify(current)) {
      matchMeta.value = { ...matchMeta.value, players: next };
    }
  }
  replace([]);
  append({
    type: 'match.start',
    serverSide: payload.serverSide,
    serverCourt: 'right',
  } as Omit<RacquetEvent, 'id' | 'ts'>);
  const serverName =
    payload.serverSide === 'A' ? displayNameA.value : displayNameB.value;
  toast.success(`${serverName} serves first`, {
    description: 'Wrong? Tap "Change server" above the court.',
  });
  markTossSeen();
};

const onTossSkip = () => markTossSeen();

const score = (side: SideId) => {
  const last = state.value.games[state.value.games.length - 1];
  return last ? (side === 'A' ? last.a : last.b) : 0;
};

const { vibrate } = useVibrate();

// Gate every event-emitting handler on the handoff lock. The overlay
// banner already disables pointer events on the score cells; this is a
// defensive backstop for code paths that fire through other entry points
// (more menu, undo button, modals).
const guardActive = (): boolean => {
  if (isActive.value) return true;
  toast.info("Another device is scoring. Tap 'Score from this device' first.");
  return false;
};

// Mis-tap guard. Each team's tap target is now the full half rather than a
// half-width cell — better for a gloved thumb mid-rally, but a bigger surface
// for a pocket brush or a bounced tap to land on. Two taps on the SAME team
// inside 300ms are treated as one point; alternating taps are never swallowed,
// because a genuine rally can't change hands that fast either.
const TAP_DEBOUNCE_MS = 300;
let lastTapSide: SideId | null = null;
let lastTapAt = 0;

const onTap = (side: SideId) => {
  if (state.value.matchOver) return;
  // Active timeout or suspension pauses play — score taps no-op until the
  // operator clears them (Events sheet → "Clear timeout" / "Resume match").
  // Penalty cards don't pause play (BWF Law 16): yellow is a warning, red
  // awards a point already, black ends the match.
  if (state.value.timeout || state.value.suspended) return;
  if (state.value.betweenGames) return;
  if (!guardActive()) return;
  const now = performance.now();
  if (side === lastTapSide && now - lastTapAt < TAP_DEBOUNCE_MS) return;
  lastTapSide = side;
  lastTapAt = now;
  vibrate(10);
  append({ type: 'point', side } as Omit<RacquetEvent, 'id' | 'ts'>);
};

// Service-over haptic cue. Fires whenever the active server cell changes
// (team flip OR partner-swap on serve). The visual transition in TeamRow
// catches the eye; the soft second vibrate confirms the change to the
// operator without looking. Skip the first tick so opening a page doesn't
// buzz on initial server assignment.
const serveSignature = computed(
  () => `${state.value.servingSide}-${state.value.serverCourt}`
);
let serveWatchSkippedFirst = false;
watch(serveSignature, () => {
  if (!serveWatchSkippedFirst) {
    serveWatchSkippedFirst = true;
    return;
  }
  vibrate(8);
});

const onUndo = () => {
  if (!guardActive()) return;
  vibrate(20);
  replace(applyRacquetUndo(events.value));
};

// Reset = restore a clean initial state. Wipes the event log AND clears the
// per-device visual sides-swap so the operator isn't left looking at a
// half-reset court (score 0–0 but ends still flipped from the previous run),
// then re-seeds `match.start` so the engine has a serving side again — without
// it the first post-reset tap appends a `point` with no preceding start event.
const onReset = () => {
  if (!guardActive()) return;
  sidesSwapped.value = false;
  replace([]);
  append({
    type: 'match.start',
    serverSide: 'A',
    serverCourt: 'right',
  } as Omit<RacquetEvent, 'id' | 'ts'>);
};

// Reset just the current game's score (mistake recovery without losing
// completed games). Uses the existing score.correct event so prior games
// + gamesWon stay intact and the engine recomputes flags from scratch.
const onResetCurrentGame = () => {
  const games = state.value.games;
  if (games.length === 0) return;
  if (!guardActive()) return;
  vibrate(20);
  append({
    type: 'score.correct',
    games: [...games.slice(0, -1), { a: 0, b: 0 }],
    gamesWon: state.value.gamesWon,
    reason: 'Reset current game',
  } as Omit<RacquetEvent, 'id' | 'ts'>);
};

// Between-games dialog: explicit transition into the next game. Engine
// `game.end` appends a fresh {a:0,b:0} game to state.games and clears
// betweenGames; the operator's next score tap then increments G(N+1)
// directly without the auto-create path.
const onStartNextGame = () => {
  if (!guardActive()) return;
  vibrate(10);
  append({ type: 'game.end' } as Omit<RacquetEvent, 'id' | 'ts'>);
};

// Pre-rally swaps. Only valid before the first point — once a rally is
// scored, server identity is derived from the event log so we shouldn't
// rewrite history.
const canSwapInitial = computed(
  () => events.value.length === 1 && events.value[0]?.type === 'match.start'
);

// Sides swap: mirrors the entire pre-match setup. Flips which screen edge
// each team occupies AND who serves first (operator realized they had it
// backwards). Replaces match.start so the log stays clean.
const sidesSwapped = useStorage<boolean>(
  computed(() => `sb:control-sides-swapped:${matchId.value}`),
  false
);
// Visual-only ends swap. Used in GameOverModal between games and as the
// post-rally swap action — engine state untouched, only `sidesSwapped`
// flips. Operator decides per BWF Law 9.4 expectations vs. club practice.
const swapSidesVisualOnly = () => {
  vibrate(10);
  sidesSwapped.value = !sidesSwapped.value;
};

// Decoupled "change first server" fix. Pre-match only. Flips `serverSide`
// on match.start WITHOUT touching `sidesSwapped`, so the operator can fix
// "I picked the wrong team during the toss" without also flipping the
// visual layout (which is what "Swap sides" does — that one mirrors both).
// In doubles, partner-within-team fixes still go through the per-cell
// swap-arrow on TeamRow.
const swapServerOnly = () => {
  if (!canSwapInitial.value) return;
  if (!guardActive()) return;
  const first = events.value[0];
  if (!first || first.type !== 'match.start') return;
  vibrate(10);
  const opposite: SideId = first.serverSide === 'A' ? 'B' : 'A';
  replace([]);
  append({
    type: 'match.start',
    serverSide: opposite,
    serverCourt: 'right',
  } as Omit<RacquetEvent, 'id' | 'ts'>);
};

const swapSides = () => {
  const isPreMatch = canSwapInitial.value;
  // Visual-only flip is fine offline; the event rewrite below is the gated
  // part. We allow the visual flip even when inactive so the read-only
  // viewer can orient the court to their seat — only the match.start
  // rewrite needs the guard.
  vibrate(10);
  sidesSwapped.value = !sidesSwapped.value;
  // Pre-match swap also mirrors who serves first (operator setup was
  // backwards). Mid-game ends-change swap is visual only — server identity
  // is derived from the event log and shouldn't be rewritten.
  if (isPreMatch) {
    if (!guardActive()) return;
    const first = events.value[0];
    if (first && first.type === 'match.start') {
      const opposite: SideId = first.serverSide === 'A' ? 'B' : 'A';
      replace([]);
      append({
        type: 'match.start',
        serverSide: opposite,
        serverCourt: 'right',
      } as Omit<RacquetEvent, 'id' | 'ts'>);
    }
  }
};

// Deciding-game ends-change. BWF Law 9.4: in the deciding game, players
// change ends when the leading score reaches 11. We don't enforce it —
// just expose the swap button again whenever it's relevant, since club
// players often skip ends-change. The button stays visible from 11 until
// the game ends so an operator who missed the moment can still act.
const isDecidingGame = computed(
  () =>
    state.value.gamesWon.a === config.value.gamesToWin - 1 &&
    state.value.gamesWon.b === config.value.gamesToWin - 1
);
// Visible only at the interval moment in the deciding game (11 for BWF-21,
// 8 for BWF-15 — `state.atInterval` is engine-derived from `cfg.intervalAt`
// and is true only for the rally that crosses it, then false on the next
// score). If the operator doesn't act before the next point is scored, the
// button hides itself — matches club behavior where ends-change is often
// skipped.
const canSwapAtDecider = computed(
  () =>
    isDecidingGame.value &&
    !state.value.matchOver &&
    !state.value.betweenGames &&
    state.value.atInterval
);
// Start of any in-progress game (score still 0-0) is also a valid swap
// moment — covers operators who clicked "Start Game N" without first
// hitting the swap button in the GameOverModal, or who change their mind.
const canSwapAtGameStart = computed(
  () =>
    !state.value.matchOver &&
    !state.value.betweenGames &&
    lastGame.value.a === 0 &&
    lastGame.value.b === 0
);
const canSwapSidesVisible = computed(
  () =>
    canSwapInitial.value || canSwapAtGameStart.value || canSwapAtDecider.value
);

// Per-team player swap (doubles only, pre-match). Swaps a1↔a2 (or b1↔b2)
// in meta — useCourtCells re-renders so the partner who was about to start
// on the right (server) court is now on the left and vice versa. Service
// still begins from the right court; this just picks which partner stands
// there.
// `players` and the joined `teamNames` string are two views of the same fact
// and must move together — see lib/partner-swap.ts for why.
const swapPlayers = (side: SideId) => {
  if (!canSwapInitial.value && !canSwapAtGameStart.value) return;
  const isDoubles = matchMeta.value.isDoubles ?? false;
  if (!isDoubles) return;
  vibrate(10);
  const { players, teamNames } = swapTeamPlayers(
    matchMeta.value.players ?? { a1: '', a2: '', b1: '', b2: '' },
    matchMeta.value.teamNames ?? { a: '', b: '' },
    side
  );
  matchMeta.value = { ...matchMeta.value, players, teamNames };
};

// Player swap writes to matches.players via useMatchMeta → only the owner
// (or anyone on an anon match) can persist it; co-scorers' edits would
// silently fail under RLS. Hide the arrow rather than letting them perform
// a local-only swap that never syncs to the owner.
const canSwapPlayersA = computed(
  () =>
    canEditMeta.value &&
    (canSwapInitial.value || canSwapAtGameStart.value) &&
    (matchMeta.value.isDoubles ?? false)
);
const canSwapPlayersB = canSwapPlayersA;

// Pre-match setup lives in the footer bar rather than as pills floating over
// the court: the pills were live targets sitting inside the score button, and
// four of them at once (ends, two partner swaps, first server) buried the
// surface. The bar is free at this moment anyway — with nothing scored, Undo
// has nothing to undo and Correct nothing to correct.
//
// Gated on canSwapInitial only (not canSwapAtGameStart), so Undo is never taken
// away at the start of a later game, where undoing the previous game.end is a
// real thing to want. Partner swap is rendered outside this branch precisely
// because it stays legal in that second window.
const showSetupBar = computed(
  () => canSwapInitial.value && !state.value.matchOver
);

// swapServerOnly flips which SIDE serves first, so name the team that would
// take over rather than the current server.
const serveFirstLabel = computed(() =>
  state.value.servingSide === 'A' ? displayNameB.value : displayNameA.value
);

// Glow the team(s) actually at game/match point — under rally scoring the
// receiver can be at game point, so this must not follow servingSide. Both
// can glow at once (e.g. 29–29 under the BWF cap).
const isGlowingA = computed(
  () => state.value.gamePoint.a || state.value.matchPoint.a
);
const isGlowingB = computed(
  () => state.value.gamePoint.b || state.value.matchPoint.b
);

const lastPointWinner = computed<SideId | null>(() => {
  for (let i = events.value.length - 1; i >= 0; i--) {
    const ev = events.value[i] as { type: string; side?: SideId };
    if (ev.type === 'point') return ev.side ?? null;
  }
  return null;
});

const games = computed(() => state.value.games);
const gamesWon = computed(() => state.value.gamesWon);
const lastGame = computed(
  () => games.value[games.value.length - 1] ?? { a: 0, b: 0 }
);
const lastGameWinnerName = computed(() =>
  lastGame.value.a > lastGame.value.b ? displayNameA.value : displayNameB.value
);
const lastGameScore = computed(() => ({
  winner: Math.max(lastGame.value.a, lastGame.value.b),
  loser: Math.min(lastGame.value.a, lastGame.value.b),
}));

const headerLabel = computed(() => {
  if (state.value.matchOver) return 'Match complete';
  if (state.value.betweenGames)
    return `Between games · ${gamesWon.value.a}–${gamesWon.value.b}`;
  return `Game ${games.value.length} · ${presetLabel.value} · ${seriesLabel.value}`;
});

// Wake-lock keeps the phone screen on during a match.
const wakeLock = useWakeLock();
onMounted(() => wakeLock.request('screen'));
onUnmounted(() => wakeLock.release());

// Layout — operator picks based on where they sit relative to the court.
//   stacked    — phone portrait, A on top / B on bottom (default).
//   sideBySide — phone landscape (or umpire's chair), A left / B right.
type ControlLayout = 'stacked' | 'sideBySide';
const layout = useStorage<ControlLayout>(
  computed(() => `sb:control-layout:${matchId.value}`),
  'stacked'
);

// Sheets ────────────────────────────────────────────────────────────────────
type SheetKind = 'matchState' | 'scoreCorrect' | 'format' | null;
const openSheet = ref<SheetKind>(null);
const closeSheet = () => {
  openSheet.value = null;
};

// Long-press on Undo escalates to score correction — the natural next step
// when single-tap undo isn't enough. Short tap undoes the last point.
//
// The short tap MUST come from a native `click`, not from onLongPress's
// `onMouseUp` option. That option is delivered from a `pointerup` listener that
// bails out whenever the internal state was cleared — and `onLongPress` clears
// it as soon as the pointer drifts 10px (its `distanceThreshold`) or leaves the
// element. On a phone, a thumb tap on a full-width button at the bottom of the
// screen drifts past 10px constantly, so the undo was being silently swallowed
// mid-match. A real `click` keeps the browser's own tap-slop tolerance and
// makes the button reachable by keyboard (Enter/Space fire click, never
// pointerup). Threshold haptic fires when the long-press triggers so the
// operator feels the cross.
const undoBtn = ref<HTMLElement | null>(null);
// iOS still delivers a click after the long-press fires; swallow that one so
// the sheet doesn't open on top of an undo. Reset on every new press so a
// long-press that ends off the button (no click) can't poison the next tap.
const undoLongPressed = ref(false);
onLongPress(
  undoBtn,
  () => {
    vibrate(15);
    undoLongPressed.value = true;
    openSheet.value = 'scoreCorrect';
  },
  { delay: 400 }
);
const onUndoClick = () => {
  if (undoLongPressed.value) {
    undoLongPressed.value = false;
    return;
  }
  onUndo();
};

// Match-state actions
const onWalkover = (winner: SideId) => {
  if (!guardActive()) return;
  append({ type: 'walkover', winner } as Omit<RacquetEvent, 'id' | 'ts'>);
  closeSheet();
};
const onRetirement = (retiring: SideId) => {
  if (!guardActive()) return;
  append({ type: 'retirement', retiring } as Omit<RacquetEvent, 'id' | 'ts'>);
  closeSheet();
};
const onPenalty = (side: SideId, card: 'yellow' | 'red' | 'black') => {
  if (!guardActive()) return;
  append({ type: 'penalty', side, card } as Omit<RacquetEvent, 'id' | 'ts'>);
  closeSheet();
};
const onTimeout = (side: SideId, kind: 'standard' | 'medical' | 'injury') => {
  if (!guardActive()) return;
  append({ type: 'timeout.start', side, kind } as Omit<
    RacquetEvent,
    'id' | 'ts'
  >);
  closeSheet();
};
const onClearTimeout = () => {
  const t = state.value.timeout;
  if (!t) return;
  if (!guardActive()) return;
  append({ type: 'timeout.end', side: t.side } as Omit<
    RacquetEvent,
    'id' | 'ts'
  >);
};
const onResetFromSheet = () => {
  vibrate(20);
  onReset();
  closeSheet();
};
const onResetGameFromSheet = () => {
  onResetCurrentGame();
  closeSheet();
};
const onApplyScoreCorrect = (payload: {
  games: { a: number; b: number }[];
  gamesWon: { a: number; b: number };
}) => {
  if (!guardActive()) return;
  append({
    type: 'score.correct',
    games: payload.games,
    gamesWon: payload.gamesWon,
  } as Omit<RacquetEvent, 'id' | 'ts'>);
  closeSheet();
};

const winnerName = computed(() =>
  state.value.winner === 'A' ? displayNameA.value : displayNameB.value
);
const goHome = () => navigateTo(`/m/${matchId.value}`);

// "New match" used to wipe events in-place via replace([]) — destructive,
// erased the finished match from history. Rematch now navigates to /new
// with the source id so the form pre-fills the same teams/format/court;
// submitting creates a new match row, preserving the just-played one.
const onRematch = () =>
  navigateTo({ path: '/new', query: { rematch: matchId.value } });

// Orientation prop for TeamRow: geometric edge each team occupies. Combines
// outer layout with the visual sides-swap toggle.
type Orientation = 'top' | 'bottom' | 'left' | 'right';
const orientationA = computed<Orientation>(() => {
  if (layout.value === 'sideBySide')
    return sidesSwapped.value ? 'right' : 'left';
  return sidesSwapped.value ? 'bottom' : 'top';
});
const orientationB = computed<Orientation>(() => {
  if (layout.value === 'sideBySide')
    return sidesSwapped.value ? 'left' : 'right';
  return sidesSwapped.value ? 'top' : 'bottom';
});

// The bar names people where the pills used to point at them. `cells` is
// always [left court, right court], but TeamRow renders the top/right team's
// zones reversed (BWF top-down view from that end), so the label has to follow
// the same flip or it reads back-to-front against the court above it.
const swapLabel = (cells: { label: string }[], reversed: boolean) => {
  const names = cells.map((c) => c.label).filter(Boolean);
  if (names.length !== 2) return 'Swap partners';
  return (reversed ? [...names].reverse() : names).join(' ⇄ ');
};
const isZoneFlowReversed = (o: string) => o === 'top' || o === 'right';
const swapLabelA = computed(() =>
  swapLabel(cellsA.value, isZoneFlowReversed(orientationA.value))
);
const swapLabelB = computed(() =>
  swapLabel(cellsB.value, isZoneFlowReversed(orientationB.value))
);
</script>

<template>
  <div
    class="fixed inset-0 bg-muted/40 sm:bg-muted pt-[env(safe-area-inset-top)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]"
  >
    <div
      class="mx-auto flex h-full max-w-2xl flex-col bg-background text-foreground font-sans sm:border-x sm:border-border sm:shadow-2xl"
    >
      <!-- Top chrome. Same h-14 / border-b / backdrop-blur styling as the
           site-wide AppHeader so /control reads as part of the product.
           AppLogo links home (same target as everywhere else); explicit
           Back button next to it covers the "step back one" intent — having
           the logo navigate to the match hub felt off vs. the rest of the
           site. ThemeToggle joins the actions on the right for consistency
           with AppHeader. -->
      <header
        class="sticky top-0 z-30 h-14 flex-shrink-0 flex w-full items-center justify-between gap-2 border-b border-border bg-background/80 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      >
        <div class="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Back to match"
            @click="goHome"
          >
            <ArrowLeft class="size-4" />
          </Button>
          <AppLogo link-to="/" size="sm" />
        </div>
        <span
          class="hidden sm:block min-w-0 truncate text-[11px] font-semibold tracking-wider text-fg-muted uppercase"
        >
          {{ headerLabel }}
        </span>
        <div class="flex items-center gap-1">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            aria-label="More"
            @click="openSheet = 'matchState'"
          >
            <MoreHorizontal class="size-4" />
          </Button>
        </div>
      </header>

      <!-- Active timeout / suspension banners -->
      <div
        v-if="state.timeout"
        class="px-4 py-2 bg-warning-soft text-warning text-xs font-bold tracking-wider uppercase flex justify-between items-center"
      >
        <span>
          ⏸ TIMEOUT · TEAM {{ state.timeout.side }} ·
          {{ state.timeout.kind }}
        </span>
        <Button
          variant="link"
          size="sm"
          class="h-auto p-0 text-warning"
          @click="onClearTimeout"
        >
          End
        </Button>
      </div>
      <div
        v-if="state.suspended"
        class="px-4 py-2 bg-danger-soft text-danger text-xs font-bold tracking-wider uppercase"
      >
        ⏸ MATCH SUSPENDED
      </div>

      <!-- Format / previous-games / interval strip. Tap chip to change format. -->
      <div
        class="h-9 px-3 flex items-center justify-between border-b border-border bg-background/80 backdrop-blur-sm text-sm text-fg-muted"
      >
        <span class="flex items-center gap-2 text-xs">
          <template v-for="(g, i) in games" :key="i">
            <span
              class="font-mono tabular-nums inline-flex gap-1 items-baseline"
            >
              <span class="score">{{ g.a }}</span>
              <span class="opacity-40">–</span>
              <span class="score">{{ g.b }}</span>
              <span
                v-if="i < games.length - 1 || state.betweenGames"
                class="ml-1 text-success"
              >
                ✓
              </span>
            </span>
            <span v-if="i < games.length - 1" class="opacity-40">·</span>
          </template>
        </span>
        <div class="flex items-center gap-2">
          <!-- Counts down the BWF 60s interval rather than showing a static
               badge — umpires run to that clock. Falls back to the plain badge
               once it expires (or if the event has no timestamp). -->
          <span
            v-if="state.atInterval"
            class="text-[11px] font-bold tracking-wider uppercase text-warning bg-warning-soft px-2 py-0.5 rounded-sm tabular-nums"
          >
            Interval{{ intervalClock ? ` · ${intervalClock}` : '' }}
          </span>
          <Button
            v-if="canEditMeta"
            variant="link"
            size="sm"
            class="h-auto p-0 text-[11px] text-fg-muted hover:text-foreground"
            @click="openSheet = 'format'"
          >
            {{ presetLabel }} · {{ seriesLabel }}
          </Button>
          <span v-else class="text-[11px] text-fg-muted">
            {{ presetLabel }} · {{ seriesLabel }}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            class="size-6"
            :title="
              layout === 'stacked'
                ? 'Switch to side-by-side (umpire view)'
                : 'Switch to stacked (portrait phone)'
            "
            :aria-label="
              layout === 'stacked'
                ? 'Switch to side-by-side layout'
                : 'Switch to stacked layout'
            "
            @click="layout = layout === 'stacked' ? 'sideBySide' : 'stacked'"
          >
            <component
              :is="layout === 'stacked' ? Rows3 : Columns3"
              class="size-3.5"
            />
          </Button>
        </div>
      </div>

      <!-- Court frame. Two team halves separated by the net — a 1px line of
           the wrapper background showing through `gap-px` (--border-strong,
           not foreground/30: foreground is near-white in dark mode, which lit
           the frame up). No border of its own: each half paints its own court
           boundary, so anything here would stack a third line around them.
           Render order follows `sidesSwapped` so the swap is a real DOM
           reorder, not just a CSS reverse — TeamRow's orientation prop then
           puts the net on each half's correct inner edge. -->
      <div
        class="relative m-2 flex flex-1 gap-px overflow-hidden rounded-lg bg-border-strong"
        :class="layout === 'sideBySide' ? 'flex-row' : 'flex-col'"
      >
        <template
          v-for="team in sidesSwapped ? ['B', 'A'] : ['A', 'B']"
          :key="team"
        >
          <TeamRow
            v-if="team === 'A'"
            team="A"
            :sport="sport"
            :orientation="orientationA"
            :score="score('A')"
            :games-won="gamesWon.a"
            :total-slots="config.gamesToWin + 1"
            :is-match-point="state.matchPoint.a"
            :is-game-point="state.gamePoint.a"
            :cells="cellsA"
            :match-over="state.matchOver"
            :is-glowing="isGlowingA"
            :last-winner="lastPointWinner === 'A'"
            :cell-is-server="(court) => cellIsServer('A', court)"
            :server-court="state.serverCourt"
            :cards="state.cards.a"
            :is-doubles="teamMeta.isDoubles"
            :display-name="displayNameA"
            @tap="onTap('A')"
          />
          <TeamRow
            v-else
            team="B"
            :sport="sport"
            :orientation="orientationB"
            :score="score('B')"
            :games-won="gamesWon.b"
            :total-slots="config.gamesToWin + 1"
            :is-match-point="state.matchPoint.b"
            :is-game-point="state.gamePoint.b"
            :cells="cellsB"
            :match-over="state.matchOver"
            :is-glowing="isGlowingB"
            :last-winner="lastPointWinner === 'B'"
            :cell-is-server="(court) => cellIsServer('B', court)"
            :server-court="state.serverCourt"
            :cards="state.cards.b"
            :is-doubles="teamMeta.isDoubles"
            :display-name="displayNameB"
            @tap="onTap('B')"
          />
        </template>

        <!-- Pre-match setup pills. Centered between the two team rows.
              • Swap sides — visible pre-match AND at deciding-game interval.
                Pre-match: rewrites match.start (mirrors server) AND flips
                visual ends. Mid-deciding: visual only (engine state
                untouched). BWF Law 9.4.
              • Change server — pre-match only. Decoupled fix: rewrites
                match.start serverSide WITHOUT touching visual ends.
                Single-tap correction for "I tapped the wrong team during
                the toss" without forcing an ends flip too. -->
        <!-- Take-over overlay. Sits above the court, dims it slightly, and
             intercepts taps with a "Score from this device" reclaim button.
             Pointer-events on the cells underneath are blocked by this
             layer; on-screen score stays visible so the read-only viewer
             still tracks the match. -->
        <div
          v-if="!isActive"
          class="absolute inset-0 z-30 flex items-center justify-center bg-background/55 backdrop-blur-[1px]"
        >
          <div
            class="flex flex-col items-center gap-3 rounded-lg border border-border-strong bg-background/95 px-4 py-3 shadow-xl"
          >
            <span
              class="text-[11px] font-bold uppercase tracking-wider text-fg-muted"
            >
              Another device is scoring
            </span>
            <Button type="button" size="sm" @click="claimScoring">
              Score from this device
            </Button>
            <span class="max-w-[16rem] text-center text-[10px] text-fg-subtle">
              Taking over disables scoring on the other device until they
              reclaim it.
            </span>
          </div>
        </div>
      </div>

      <!-- Bottom action bar, mode-aware.
           Pre-match it holds the setup actions that used to float over the
           court as pills; they wrap onto a second row on a phone and sit in
           one row from `sm` up. In play it is Undo + Correct — Undo takes the
           width it deserves (second-most-used control after scoring, formerly
           a `size="sm"` button in an otherwise empty bar) and Correct is
           visible rather than long-press-only, though the long-press still
           works. `Ends` reappears here at the deciding-game interval, the one
           mid-match moment it is legal. Wider audit / multi-step recovery
           stays in the 3-dot menu (match-state sheet). -->
      <!-- The bottom inset lives here rather than on the fixed root: as root
           padding it left a strip of `bg-muted` under the card, and it did
           nothing for the sheets below (absolutely positioned boxes resolve
           `bottom-0` against the padding box, so they ignore it and need their
           own inset). Floored so the buttons keep clearance from the physical
           screen edge where `env()` reports 0 — Android edge-to-edge, desktop
           PWA, and installed-Chrome. -->
      <footer
        class="min-h-14 flex-shrink-0 px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] flex flex-wrap items-center gap-2 border-t border-border"
      >
        <template v-if="showSetupBar">
          <Button
            variant="outline"
            class="flex-1 min-w-[7rem]"
            title="Put the other team on the other court"
            @click="swapSides"
          >
            <component
              :is="layout === 'sideBySide' ? ArrowLeftRight : ArrowUpDown"
              class="size-4"
            />
            Ends
          </Button>
          <Button
            variant="outline"
            class="flex-1 min-w-[7rem]"
            :title="`Change which side serves first — hand the serve to ${serveFirstLabel}`"
            @click="swapServerOnly"
          >
            <Repeat class="size-4" />
            Switch server
          </Button>
        </template>
        <template v-else>
          <Button
            ref="undoBtn"
            variant="outline"
            class="flex-1 select-none"
            title="Undo the last point — long-press to correct the score"
            @pointerdown="undoLongPressed = false"
            @click="onUndoClick"
          >
            <Undo2 class="size-4" />
            Undo
          </Button>
          <Button
            v-if="canSwapSidesVisible"
            variant="ghost"
            class="flex-shrink-0"
            title="Change ends"
            @click="swapSides"
          >
            <component
              :is="layout === 'sideBySide' ? ArrowLeftRight : ArrowUpDown"
              class="size-4"
            />
            Ends
          </Button>
          <Button
            variant="ghost"
            class="flex-shrink-0"
            @click="openSheet = 'scoreCorrect'"
          >
            <PencilLine class="size-4" />
            Correct
          </Button>
        </template>
        <!-- Partner swap sits outside both branches: it is legal pre-match
             AND at the start of any later game (score back to 0-0), and that
             second window is in-play, where the bar is showing Undo. Scoping it
             to the setup branch made it unreachable exactly there. -->
        <Button
          v-if="canSwapPlayersA"
          variant="outline"
          class="flex-1 min-w-[9rem]"
          title="Swap which partner starts in the right service court"
          @click="swapPlayers('A')"
        >
          <ArrowLeftRight class="size-4 text-team-a" />
          <span class="truncate">{{ swapLabelA }}</span>
        </Button>
        <Button
          v-if="canSwapPlayersB"
          variant="outline"
          class="flex-1 min-w-[9rem]"
          title="Swap which partner starts in the right service court"
          @click="swapPlayers('B')"
        >
          <ArrowLeftRight class="size-4 text-team-b" />
          <span class="truncate">{{ swapLabelB }}</span>
        </Button>
      </footer>

      <MatchOverModal
        v-if="state.matchOver"
        :end-reason="state.endReason"
        :winner-name="winnerName"
        :games-won="gamesWon"
        @rematch="onRematch"
        @back="goHome"
      />

      <GameOverModal
        v-else-if="state.betweenGames && games.length > 0"
        :game-number="games.length"
        :winner-name="lastGameWinnerName"
        :game-score="lastGameScore"
        :match-score="gamesWon"
        :next-game-number="games.length + 1"
        :sides-swapped="sidesSwapped"
        @start-next="onStartNextGame"
        @swap-sides="swapSidesVisualOnly"
      />

      <TossSheet
        v-if="showToss"
        :is-doubles="teamMeta.isDoubles"
        :team-names="teamMeta.teamNames"
        :players="teamMeta.players"
        @commit="onTossCommit"
        @skip="onTossSkip"
      />

      <!-- Sheet backdrop -->
      <div
        v-if="openSheet"
        class="absolute inset-0 z-40 bg-overlay"
        @click="closeSheet"
      />

      <MatchStateSheet
        v-if="openSheet === 'matchState'"
        :team-names="{ a: displayNameA, b: displayNameB }"
        :games-to-win="config.gamesToWin"
        @timeout="onTimeout"
        @penalty="onPenalty"
        @walkover="onWalkover"
        @retirement="onRetirement"
        @open-score-correct="openSheet = 'scoreCorrect'"
        @reset="onResetFromSheet"
        @reset-game="onResetGameFromSheet"
        @close="closeSheet"
      />
      <FormatSheet
        v-if="openSheet === 'format'"
        :preset="preset"
        :games-to-win="gamesToWin"
        :options="sportPresetOptions"
        @update:preset="(id) => (preset = id)"
        @update:games-to-win="(n) => (gamesToWin = n)"
        @close="closeSheet"
      />
      <ScoreCorrectSheet
        v-if="openSheet === 'scoreCorrect'"
        :initial-games="state.games"
        :initial-games-won="state.gamesWon"
        :games-to-win="config.gamesToWin"
        :team-names="{ a: displayNameA, b: displayNameB }"
        @apply="onApplyScoreCorrect"
        @close="closeSheet"
      />
    </div>
  </div>
</template>
