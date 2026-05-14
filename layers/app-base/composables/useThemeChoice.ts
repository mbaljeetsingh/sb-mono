import { computed, onMounted, onUnmounted, ref, watch, type Ref } from "vue";
import { watchDebounced } from "@vueuse/core";
import { themes as themeRegistry } from "@sb/themes";

// Per-match theme pair (overlay + scoreboard) backed by the matches row in
// Supabase + a Realtime UPDATE subscription. A theme change on the
// operator's phone re-renders in OBS overlay on a laptop within ~500ms
// (one debounce window) without OBS needing to refresh.
//
// `overlay` ← `matches.overlay_theme_id`
// `scoreboard` ← `matches.scoreboard_theme_id`
//
// Same echo-guard pattern as useMatchMeta / useFormat: track the last-seen-
// remote snapshot and skip the watch-driven upsert when current state
// equals it, breaking the write-back loop without time-based heuristics.

const DEFAULT_OVERLAY = "broadcast-classic";
const DEFAULT_SCOREBOARD = "filmable";

export function useThemeChoice(matchId: Ref<string>) {
  const supabase = useSupabaseClient();
  const overlay = ref<string>(DEFAULT_OVERLAY);
  const scoreboard = ref<string>(DEFAULT_SCOREBOARD);
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
      .from("matches")
      .select("overlay_theme_id, scoreboard_theme_id")
      .eq("id", id)
      .maybeSingle();
    if (error) {
      console.warn("[useThemeChoice] fetch failed", error);
      return;
    }
    if (data) applyRemote(data);
  };

  const upsertRemote = async () => {
    const id = matchId.value;
    if (!id) return;
    const currentStr = snapshot();
    if (currentStr === lastSeenRemote) return;
    const { error } = await supabase.from("matches").upsert(
      {
        id,
        sport_family: "racquet",
        sport_preset: "badminton-21",
        overlay_theme_id: overlay.value,
        scoreboard_theme_id: scoreboard.value,
      },
      { onConflict: "id" },
    );
    if (error) {
      console.warn("[useThemeChoice] upsert failed", error);
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
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "matches",
          filter: `id=eq.${id}`,
        },
        (payload) =>
          applyRemote(
            payload.new as {
              overlay_theme_id?: string;
              scoreboard_theme_id?: string;
            },
          ),
      )
      .subscribe();
  };

  onMounted(() => {
    fetchRemote();
    subscribeRealtime();
  });

  watch(matchId, () => {
    fetchRemote();
    subscribeRealtime();
  });

  onUnmounted(() => {
    if (realtimeChannel) {
      supabase.removeChannel(realtimeChannel);
      realtimeChannel = null;
    }
  });

  watchDebounced([overlay, scoreboard], () => upsertRemote(), {
    debounce: 500,
  });

  const overlayName = computed(
    () => themeRegistry[overlay.value]?.manifest.name ?? "—",
  );
  const scoreboardName = computed(
    () => themeRegistry[scoreboard.value]?.manifest.name ?? "—",
  );

  return { overlay, scoreboard, overlayName, scoreboardName };
}
