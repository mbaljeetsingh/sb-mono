import {
  type RacquetConfig,
  type SportPresetId,
  getPreset,
  sportPresets,
} from '@sb/engine';
import type { Json } from '@sb/shared';
import { watchDebounced } from '@vueuse/core';
import { type Ref, computed, onMounted, onUnmounted, ref, watch } from 'vue';

// Per-match format selection — preset (which points-per-game ruleset) + how
// many games make a match. Backed by the matches row in Supabase + a
// Realtime UPDATE subscription so the OBS overlay reflects mid-match format
// changes from the operator's phone without a manual refresh.
//
// `preset` ← `matches.sport_preset`
// `gamesToWin` ← `matches.config.gamesToWin`
//
// Same echo-guard pattern as useMatchMeta: track the last-seen-remote
// snapshot and skip the watch-driven update when current state equals it,
// breaking the write-back loop without time-based heuristics.
export function useFormat(matchId: Ref<string>) {
  const supabase = useSupabaseClient();
  const preset = ref<SportPresetId>('badminton-21');
  const gamesToWin = ref<number>(1);
  let lastSeenRemote: string | null = null;
  let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;
  // Per-instance unique channel-name suffix — see useEvents for rationale.
  const channelSuffix = Math.random().toString(36).slice(2, 10);

  const snapshot = () =>
    JSON.stringify({ preset: preset.value, gamesToWin: gamesToWin.value });

  const applyRemote = (row: {
    sport_preset?: string | null;
    config?: Json | null;
  }) => {
    let nextPreset: SportPresetId = preset.value;
    if (
      typeof row.sport_preset === 'string' &&
      row.sport_preset in sportPresets
    ) {
      nextPreset = row.sport_preset as SportPresetId;
    }
    let nextGamesToWin = gamesToWin.value;
    const cfg = (row.config ?? {}) as { gamesToWin?: number };
    if (typeof cfg.gamesToWin === 'number' && cfg.gamesToWin >= 1) {
      nextGamesToWin = cfg.gamesToWin;
    }
    const incomingStr = JSON.stringify({
      preset: nextPreset,
      gamesToWin: nextGamesToWin,
    });
    if (incomingStr === snapshot()) return;
    lastSeenRemote = incomingStr;
    preset.value = nextPreset;
    gamesToWin.value = nextGamesToWin;
  };

  const fetchRemote = async () => {
    const id = matchId.value;
    if (!id) return;
    const { data, error } = await supabase
      .from('matches')
      .select('sport_preset, config')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      console.warn('[useFormat] fetch failed', error);
      return;
    }
    if (data) applyRemote(data);
  };

  const updateRemote = async () => {
    const id = matchId.value;
    if (!id) return;
    const currentStr = snapshot();
    // Echo guard — current state was just hydrated; nothing to push back.
    if (currentStr === lastSeenRemote) return;
    // UPDATE, not upsert — the row always exists (/new creates it), so this
    // can't create a stub and doesn't need to re-send sport_family.
    const { error } = await supabase
      .from('matches')
      .update({
        sport_preset: preset.value,
        config: { gamesToWin: gamesToWin.value },
      })
      .eq('id', id);
    if (error) {
      console.warn('[useFormat] update failed', error);
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
      .channel(`match-format:${id}:${channelSuffix}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'matches',
          filter: `id=eq.${id}`,
        },
        (payload) =>
          applyRemote(payload.new as Parameters<typeof applyRemote>[0])
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

  watchDebounced([preset, gamesToWin], () => updateRemote(), {
    debounce: 500,
  });

  const config = computed<RacquetConfig>(() => ({
    ...getPreset(preset.value).config,
    gamesToWin: gamesToWin.value,
  }));

  const sport = computed(() => getPreset(preset.value).sport);
  const sportPresetOptions = computed(() =>
    Object.values(sportPresets).filter((p) => p.sport === sport.value)
  );

  const seriesLabel = computed(() =>
    gamesToWin.value === 1 ? 'Single' : `BO${gamesToWin.value * 2 - 1}`
  );

  const presetLabel = computed(() => {
    switch (preset.value) {
      case 'badminton-21':
        return 'BWF 21';
      case 'badminton-15':
        return '15 (2027)';
      case 'tennis-basic':
        return 'Tennis · 6';
      case 'pickleball-classic':
        return 'PB 11';
      case 'pickleball-rally':
        return 'PB 21';
      case 'table-tennis':
        return 'TT 11';
      default:
        return `P${config.value.pointsPerGame}`;
    }
  });

  return {
    preset,
    gamesToWin,
    config,
    sport,
    sportPresetOptions,
    seriesLabel,
    presetLabel,
  };
}
