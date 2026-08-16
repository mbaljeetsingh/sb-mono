import { themes as themeRegistry } from '@sb/themes';
import { watchDebounced } from '@vueuse/core';
import { type Ref, computed, onMounted, onUnmounted, ref, watch } from 'vue';

// Per-match theme pair (overlay + scoreboard) backed by the matches row in
// Supabase + a Realtime UPDATE subscription. A theme change on the
// operator's phone re-renders in OBS overlay on a laptop within ~500ms
// (one debounce window) without OBS needing to refresh.
//
// `overlay` ← `matches.overlay_theme_id`
// `scoreboard` ← `matches.scoreboard_theme_id`
//
// Same echo-guard pattern as useMatchMeta / useFormat: track the last-seen-
// remote snapshot and skip the watch-driven update when current state
// equals it, breaking the write-back loop without time-based heuristics.

const DEFAULT_OVERLAY = 'broadcast-classic';
const DEFAULT_SCOREBOARD = 'filmable';

export function useThemeChoice(matchId: Ref<string>) {
  const supabase = useSupabaseClient();
  const overlay = ref<string>(DEFAULT_OVERLAY);
  const scoreboard = ref<string>(DEFAULT_SCOREBOARD);
  // True once the first fetch for the current matchId has resolved. The
  // dynamic-URL overlay gates its crossfade on this: themes differ in size and
  // anchor position, so swapping before the real theme lands would render the
  // incoming match in `broadcast-classic` and then visibly re-layout on air.
  const loaded = ref(false);
  let lastSeenRemote: string | null = null;
  let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;
  // Per-instance unique channel-name suffix — see useEvents for rationale.
  const channelSuffix = Math.random().toString(36).slice(2, 10);

  const snapshot = () =>
    JSON.stringify({ overlay: overlay.value, scoreboard: scoreboard.value });

  const applyRemote = (row: {
    overlay_theme_id?: string | null;
    scoreboard_theme_id?: string | null;
  }) => {
    const nextOverlay = row.overlay_theme_id || DEFAULT_OVERLAY;
    const nextScoreboard = row.scoreboard_theme_id || DEFAULT_SCOREBOARD;
    const incomingStr = JSON.stringify({
      overlay: nextOverlay,
      scoreboard: nextScoreboard,
    });
    if (incomingStr === snapshot()) return;
    lastSeenRemote = incomingStr;
    overlay.value = nextOverlay;
    scoreboard.value = nextScoreboard;
  };

  const fetchRemote = async () => {
    const id = matchId.value;
    if (!id) return;
    const { data, error } = await supabase
      .from('matches')
      .select('overlay_theme_id, scoreboard_theme_id')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      console.warn('[useThemeChoice] fetch failed', error);
      // Mark loaded anyway so a consumer gating a swap on this can't hang.
      loaded.value = true;
      return;
    }
    if (data) applyRemote(data);
    loaded.value = true;
  };

  const updateRemote = async () => {
    const id = matchId.value;
    if (!id) return;
    const currentStr = snapshot();
    if (currentStr === lastSeenRemote) return;
    // UPDATE, not upsert — the row always exists (/new creates it before
    // navigating here), and an upsert payload would have to carry sport
    // columns, which this composable must never write: a hardcoded
    // sport_preset here once retroactively rewrote non-badminton matches'
    // rules on every theme change.
    const { error } = await supabase
      .from('matches')
      .update({
        overlay_theme_id: overlay.value,
        scoreboard_theme_id: scoreboard.value,
      })
      .eq('id', id);
    if (error) {
      console.warn('[useThemeChoice] update failed', error);
      return;
    }
    lastSeenRemote = currentStr;
  };

  const subscribeRealtime = () => {
    if (realtimeChannel) {
      supabase.removeChannel(realtimeChannel);
      realtimeChannel = null;
    }
    const id = matchId.value;
    if (!id) return;
    realtimeChannel = supabase
      .channel(`match-theme:${id}:${channelSuffix}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'matches',
          filter: `id=eq.${id}`,
        },
        (payload) =>
          applyRemote(
            payload.new as {
              overlay_theme_id?: string;
              scoreboard_theme_id?: string;
            }
          )
      )
      .subscribe();
  };

  onMounted(() => {
    fetchRemote();
    subscribeRealtime();
  });

  watch(matchId, () => {
    loaded.value = false;
    fetchRemote();
    subscribeRealtime();
  });

  onUnmounted(() => {
    if (realtimeChannel) {
      supabase.removeChannel(realtimeChannel);
      realtimeChannel = null;
    }
  });

  watchDebounced([overlay, scoreboard], () => updateRemote(), {
    debounce: 500,
  });

  const overlayName = computed(
    () => themeRegistry[overlay.value]?.manifest.name ?? '—'
  );
  const scoreboardName = computed(
    () => themeRegistry[scoreboard.value]?.manifest.name ?? '—'
  );

  return { overlay, scoreboard, overlayName, scoreboardName, loaded };
}
