<script setup lang="ts">
import {
  type RacquetEvent,
  type SideId,
  applyRacquetUndo,
  pointLabel,
  reduceRacquet,
} from '@sb/engine';
import { Button } from '@sb/layer-ui/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@sb/layer-ui/components/ui/dropdown-menu';
import { onLongPress, useStorage, useVibrate, useWakeLock } from '@vueuse/core';
import {
  ArrowLeft,
  ArrowLeftRight,
  ArrowUpDown,
  Check,
  Columns3,
  MoreHorizontal,
  Palette,
  PencilLine,
  Repeat,
  Rows3,
  Undo2,
} from 'lucide-vue-next';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { toast } from 'vue-sonner';
import AppLogo from '~/components/common/AppLogo.vue';
import FormatSheet from '~/components/control/FormatSheet.vue';
import GameOverModal from '~/components/control/GameOverModal.vue';
import MatchOverModal from '~/components/control/MatchOverModal.vue';
import MatchStateSheet from '~/components/control/MatchStateSheet.vue';
import ScoreCorrectSheet from '~/components/control/ScoreCorrectSheet.vue';
import TeamRow from '~/components/control/TeamRow.vue';
import TossSheet from '~/components/control/TossSheet.vue';
import { courtColorVariants, courtSurfaceClass } from '~/lib/court-colors';
import { swapTeamPlayers } from '~/lib/partner-swap';
import { courtAspectClass, sportIdFromPreset } from '~/lib/sports';

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

const { meta: matchMeta, loaded: metaLoaded } = useMatchMeta(matchId);
// Doubles reaches the engine through the format config: side-out pickleball
// gives a doubles team two servers per turn, so the reducer can't score the
// sport without it.
const isDoublesRef = computed(() => matchMeta.value.isDoubles ?? false);
const {
  preset,
  gamesToWin,
  config,
  sportPresetOptions,
  presetLabel,
  seriesLabel,
  unitNoun,
} = useFormat(matchId, { isDoubles: isDoublesRef });
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
  myDeviceId,
  claim: claimScoring,
} = useScorerActive(matchId, { writeToken });

// Positive counterpart to the take-over overlay, which only ever renders when
// this device is *not* the scorer — so when you were the scorer nothing said
// so, and two operators both tapping "Score from this device" ping-ponged with
// no feedback beyond taps going dead.
//
// Deliberately gated on an actual claim rather than on `isActive`: `isActive`
// is also true in the bootstrap case (nobody has claimed, column still NULL),
// and asserting "scoring here" before any device is stamped would be a claim we
// can't back. On a fresh match the pill appears on the first tap.
const isClaimedScorer = computed(
  () => !!myDeviceId.value && activeDeviceId.value === myDeviceId.value
);

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

const intervalSecondsLeft = computed<number | null>(() => {
  if (!state.value.atInterval) return null;
  // Anchor to the last *point* — the event that actually reached the interval.
  // The reducer keeps atInterval true across timeout/penalty events appended
  // during the break, so anchoring to "whatever event is last" would silently
  // restart the countdown every time the umpire logs one.
  const anchor = events.value.findLast((e) => e.type === 'point');
  if (!anchor?.ts) return null;
  return Math.ceil((anchor.ts + INTERVAL_MS - nowMs.value) / 1000);
});

const intervalClock = computed(() => {
  const left = intervalSecondsLeft.value;
  if (left === null || left <= 0) return null;
  return `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
});

// Distinct from "no clock at all". The badge used to fall back from
// "Interval · 0:23" to a bare "Interval" the moment the 60s expired, so it
// silently changed meaning — an umpire glancing down couldn't tell "hasn't
// started" from "time's up". Expiry now says so, and switches tint.
const intervalOver = computed(() => {
  const left = intervalSecondsLeft.value;
  return left !== null && left <= 0;
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
/**
 * Every `match.start` this page writes goes through here, so each one records
 * singles vs doubles in the log itself — replaying the log then scores the
 * same on every surface without the format config having to be told.
 *
 * Omitted, never guessed, until the match row has loaded: the bootstrap can
 * fire before it has, and a wrong `false` in the log would override the
 * config fallback the reducer uses for events that don't carry it.
 */
const matchStartEvent = (serverSide: SideId) =>
  ({
    type: 'match.start',
    serverSide,
    serverCourt: 'right',
    ...(metaLoaded.value
      ? { isDoubles: matchMeta.value.isDoubles ?? false }
      : {}),
  }) as Omit<RacquetEvent, 'id' | 'ts'>;

const maybeSeedMatchStart = () => {
  if (!canScore.value || events.value.length !== 0) return;
  append(matchStartEvent('A'));
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
  append(matchStartEvent(payload.serverSide));
  const serverName =
    payload.serverSide === 'A' ? displayNameA.value : displayNameB.value;
  toast.success(`${serverName} serves first`, {
    description: 'Wrong? Tap "Change server" above the court.',
  });
  markTossSeen();
};

const onTossSkip = () => markTossSeen();

/** The current entry of `state.games` — the live game, or the live SET under
 *  tennis scoring. */
const currentUnit = (side: SideId) => {
  const last = state.value.games[state.value.games.length - 1];
  return last ? (side === 'A' ? last.a : last.b) : 0;
};

/**
 * The big numeral on this team's half.
 *
 * Under tennis/padel scoring that is the rally tally on the 0/15/30/40 ladder
 * (or a plain integer inside a tiebreak) rather than the game count — the
 * number an umpire calls. Every other format's big numeral IS the game score.
 */
const score = (side: SideId): string | number => {
  if (config.value.scoring !== 'tennis') return currentUnit(side);
  return pointLabel(
    state.value.points,
    side,
    state.value.inTiebreak,
    config.value
  );
};

/** Games in the current set — the secondary number tennis needs beside the
 *  point score, and nothing at all for the formats without a point tier. */
const setGames = (side: SideId): number | null =>
  config.value.scoring === 'tennis' ? currentUnit(side) : null;

/**
 * Pickleball's server number, for the serving team only — it is meaningless
 * for the receivers and reads as a stray digit on their half. Undefined
 * everywhere else, including singles, which has no second server.
 */
const serverNumberFor = (side: SideId): 1 | 2 | undefined => {
  if (config.value.scoring !== 'side-out' || !teamMeta.value.isDoubles) {
    return undefined;
  }
  if (state.value.servingSide !== side || state.value.matchOver) {
    return undefined;
  }
  return state.value.serverNumber;
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
// Tennis alternates the service court every rally and table-tennis doubles
// always serves from the right, so keying on the court buzzed every tennis
// point and never on a table-tennis change of server. Key on the serving
// PLAYER there; badminton and pickleball keep the court, whose change is also
// the partner swap on serve the cue was written for.
const serveSignature = computed(() => {
  const s = state.value;
  const byPlayer =
    config.value.scoring === 'tennis' ||
    (config.value.serveRule === 'alternate' && s.doubles);
  return byPlayer
    ? `${s.servingSide}-${s.serverSlot}`
    : `${s.servingSide}-${s.serverCourt}`;
});
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
  append(matchStartEvent('A'));
};

// Reset just the current game's score (mistake recovery without losing
// completed games). Uses the existing score.correct event so prior games
// + gamesWon stay intact and the engine recomputes flags from scratch.
const onResetCurrentGame = () => {
  const games = state.value.games;
  if (games.length === 0) return;
  if (!guardActive()) return;
  vibrate(20);
  // Under tennis scoring the last `games` entry is the whole SET, so zeroing it
  // wiped every game of the set to undo one; the game is the point tier.
  const isTennis = config.value.scoring === 'tennis';
  append({
    type: 'score.correct',
    games: isTennis ? games : [...games.slice(0, -1), { a: 0, b: 0 }],
    gamesWon: state.value.gamesWon,
    ...(isTennis ? { points: { a: 0, b: 0 } } : {}),
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
  append(matchStartEvent(opposite));
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
      append(matchStartEvent(opposite));
    }
  }
};

// Ends change, per the sport's own rule — the engine's `endsChange` is true for
// the rally that makes one due: the deciding game's midpoint in badminton (11),
// pickleball (6) and table tennis (5), and in tennis/padel every odd game and
// every six tiebreak points. We don't enforce it — club players often skip it —
// just expose the swap button (and a pill) until the next rally is scored.
const canSwapAtDecider = computed(
  () =>
    !state.value.matchOver &&
    !state.value.betweenGames &&
    state.value.endsChange
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

// Completed games only. The strip used to render every entry in `games`,
// including the in-progress one — so at 1–0 it printed "1 – 0" directly above
// the two giant numbers saying the same thing, distinguished from a finished
// game only by the *absence* of a ✓. Now the live score lives on court and the
// strip is pure history, with the game number carried by `stripStateLabel`.
//
// The `played` guard is the same one MatchHeroCard needs: a walkover called
// before the first rally ends the match with `games` still [{a:0,b:0}], and
// printing "G1 0–0" claims a nil-nil result nobody played. Unlike the hero card
// we keep single-game results — "G1 21–19" in the strip is worth the ink.
const completedGames = computed(() => {
  const all = games.value;
  if (state.value.matchOver) {
    return all.some((g) => g.a > 0 || g.b > 0) ? all : [];
  }
  if (state.value.betweenGames) return all;
  return all.slice(0, -1);
});

// Where-are-we, in the strip rather than the header — the header's copy is
// `hidden sm:block`, so on a phone (the primary device) the game number never
// appeared at all and you inferred it by counting entries in this strip.
const stripStateLabel = computed(() => {
  if (state.value.matchOver) return null;
  // A tiebreak is the thing an operator most needs confirmed — the serve
  // pattern and the point counting both change — so it outranks the set number.
  if (state.value.betweenGames) return `Between ${unitNoun.value}s`;
  if (state.value.inMatchTiebreak) return 'Match tiebreak';
  if (state.value.inTiebreak) return 'Tiebreak';
  return `${unitNoun.value === 'set' ? 'Set' : 'Game'} ${games.value.length}`;
});

// The matchup, not the match state. The state moved into the strip below, and
// repeating "Game 1" in both places was worse than the gap it filled. Naming the
// players earns the slot instead: with a control tab open per court, nothing in
// this page's chrome said which match you were about to score.
const headerLabel = computed(() => {
  if (state.value.matchOver) return 'Match complete';
  return `${displayNameA.value} vs ${displayNameB.value}`;
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

// Court color — device-local like the layout: sport → variant id, global
// across matches (the operator's venue doesn't change per match).
const courtColorChoice = useStorage<Record<string, string>>(
  'sb:court-color',
  {}
);
const courtSurface = computed(() =>
  courtSurfaceClass(sport.value, courtColorChoice.value[sport.value])
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
    // The sheet edits games and sets only. Without carrying the point tier
    // through, fixing a set score under tennis scoring silently reset the game
    // in progress to 0–0.
    ...(config.value.scoring === 'tennis'
      ? { points: state.value.points }
      : {}),
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
    <!-- Width follows the layout. `max-w-2xl` is right for the stacked phone
         layout, and wrong for side-by-side: that layout exists to be read from
         an umpire's chair, and capping it at 672px on a desktop monitor left
         two narrow halves in a wide grey field — which also starved the score
         (see TeamRow's box-derived sizing). The sheets stay 2xl-centred either
         way: they're `absolute` against the `fixed inset-0` root, not this card,
         which has no `position` of its own. -->
    <div
      class="mx-auto flex h-full flex-col bg-background text-foreground font-sans sm:border-x sm:border-border sm:shadow-2xl"
      :class="layout === 'sideBySide' ? 'max-w-5xl' : 'max-w-2xl'"
    >
      <!-- Top chrome. Same h-14 / border-b / backdrop-blur styling as the
           site-wide AppHeader so /control reads as part of the product.
           AppLogo links home (same target as everywhere else); explicit
           Back button next to it covers the "step back one" intent — having
           the logo navigate to the match hub felt off vs. the rest of the
           site. The right side holds only the ⋯ menu and the "this device is
           scoring" marker: everything tappable up here is a thumb-width from
           the score halves, so it has to be something you can't regret. -->
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
          <!-- ThemeToggle used to sit here, a thumb-width from the score halves.
               Flipping light/dark mid-rally is never the intent, so it moved
               into the ⋯ sheet — this bar should hold nothing you can regret
               tapping. -->
          <span
            v-if="isClaimedScorer"
            class="mr-1 inline-flex shrink-0 items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-fg-muted"
          >
            <span class="size-1.5 rounded-full bg-success" />
            Scoring
          </span>
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
        <span class="flex min-w-0 items-center gap-2 overflow-hidden text-xs">
          <span
            v-if="stripStateLabel"
            class="shrink-0 text-[11px] font-bold uppercase tracking-wider text-foreground"
          >
            {{ stripStateLabel }}
          </span>
          <span
            v-for="(g, i) in completedGames"
            :key="i"
            class="shrink-0 inline-flex items-baseline gap-1 font-mono tabular-nums"
          >
            <span class="text-[10px] font-bold uppercase text-fg-subtle">
              G{{ i + 1 }}
            </span>
            <span class="score">{{ g.a }}</span>
            <span class="opacity-40">–</span>
            <span class="score">{{ g.b }}</span>
          </span>
        </span>
        <div class="flex items-center gap-2">
          <!-- Counts down the BWF 60s interval rather than showing a static
               badge — umpires run to that clock. Falls back to the plain badge
               once it expires (or if the event has no timestamp). -->
          <!-- Deuce belongs to the scoreline, not to a team, so it sits here
               rather than as a TeamRow chip (those are per-side: GAME PT /
               MATCH PT). The engine never sets isDeuce alongside game point —
               at 29–29 the next point wins, so that stays a per-side chip. -->
          <span
            v-if="state.isDeuce"
            class="text-[11px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-sm text-warning bg-warning-soft"
            :title="`Level at ${score('A')} — two clear points needed`"
          >
            Deuce
          </span>
          <span
            v-if="state.atInterval"
            class="text-[11px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-sm tabular-nums"
            :class="
              intervalOver
                ? 'text-danger bg-danger-soft'
                : 'text-warning bg-warning-soft'
            "
          >
            {{
              intervalOver
                ? 'Interval over'
                : `Interval${intervalClock ? ` · ${intervalClock}` : ''}`
            }}
          </span>
          <!-- The sport's ends change is due (see canSwapAtDecider). A tap
               target rather than a label: it is the swap itself. -->
          <Button
            v-if="canSwapAtDecider"
            variant="secondary"
            size="sm"
            class="h-auto px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider"
            @click="swapSidesVisualOnly"
          >
            <ArrowUpDown class="size-3" />
            Change ends
          </Button>
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
          <!-- Court color — device-local, per sport (a screen preference like
               the layout toggle, so it never syncs to other scorers). -->
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button
                variant="ghost"
                size="icon-sm"
                class="size-6"
                title="Court color"
                aria-label="Change court color"
              >
                <Palette class="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                v-for="variant in courtColorVariants[sport]"
                :key="variant.id"
                @click="
                  courtColorChoice = {
                    ...courtColorChoice,
                    [sport]: variant.id,
                  }
                "
              >
                <span
                  class="size-3 rounded-full border border-border-strong"
                  :class="variant.class"
                />
                {{ variant.label }}
                <Check
                  v-if="courtSurface === variant.class"
                  class="ml-auto size-3.5"
                />
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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

      <!-- Court frame. Two team halves separated by the net — a 4px band of
           the wrapper background showing through `gap`, painted with
           foreground/50 so it reads as a real net against the mats, which
           sit flush against this edge (the translucent --court-line washed
           out to a faint seam here, and TeamRow suppresses its boundary on
           the net edge so a serving team's tint can't overpaint the net).
           foreground is safe now that only the 4px gap shows it — the old
           warning about foreground lighting the frame up applied to a
           full-perimeter border. Render order follows `sidesSwapped` so the
           swap is a real DOM reorder, not just a CSS reverse — TeamRow's
           orientation prop then puts the net on each half's correct inner
           edge.

           Stacked layout carries a real court's proportions from `sm` up:
           the frame derives its width from its height via the sport's own
           aspect ratio (see `courtAspectClass`) instead of filling the card —
           a desktop viewport otherwise renders it near-square, twice as fat
           as the ground it's depicting. Per-sport because these courts are
           genuinely different shapes: badminton is 6.1 × 13.4m, padel a clean
           10 × 20m, a table tennis table 1.525 × 2.74m. Phones keep full width
           (thumb targets beat realism mid-rally), min-w floors short landscape
           windows, and max-w falls back to filling when height outruns the
           card. Side-by-side stays full-bleed: umpire-chair mode wants the
           biggest halves it can get. -->
      <div class="m-2 flex min-h-0 flex-1 justify-center">
        <div
          class="relative flex h-full w-full gap-1 overflow-hidden rounded-lg bg-foreground/50"
          :class="
            layout === 'sideBySide'
              ? 'flex-row'
              : [
                  'flex-col sm:w-auto sm:min-w-[20rem] sm:max-w-full',
                  courtAspectClass[sport],
                ]
          "
        >
          <template
            v-for="team in sidesSwapped ? ['B', 'A'] : ['A', 'B']"
            :key="team"
          >
            <TeamRow
              v-if="team === 'A'"
              team="A"
              :sport="sport"
              :surface-class="courtSurface"
              :orientation="orientationA"
              :score="score('A')"
              :set-games="setGames('A')"
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
              :server-number="serverNumberFor('A')"
              :cards="state.cards.a"
              :is-doubles="teamMeta.isDoubles"
              :display-name="displayNameA"
              @tap="onTap('A')"
            />
            <TeamRow
              v-else
              team="B"
              :sport="sport"
              :surface-class="courtSurface"
              :orientation="orientationB"
              :score="score('B')"
              :set-games="setGames('B')"
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
              :server-number="serverNumberFor('B')"
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
              <span
                class="max-w-[16rem] text-center text-[10px] text-fg-subtle"
              >
                Taking over disables scoring on the other device until they
                reclaim it.
              </span>
            </div>
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
        :unit-label="unitNoun"
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
        :unit-label="unitNoun"
        :team-names="{ a: displayNameA, b: displayNameB }"
        @apply="onApplyScoreCorrect"
        @close="closeSheet"
      />
    </div>
  </div>
</template>
