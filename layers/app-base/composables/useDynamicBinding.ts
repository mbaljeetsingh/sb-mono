import { type Ref, onMounted, onUnmounted, ref, watch } from 'vue';

// Read side of a dynamic overlay URL — "which match is this URL pointing at
// right now?", backed by the dynamic_urls row plus a Realtime UPDATE
// subscription.
//
// This is what makes the feature work: the operator rebinds on a phone and the
// OBS browser source on a laptop swaps within a second, with no refresh and no
// shared storage. The v1 implementation used localStorage, which OBS's
// embedded Chromium never sees — the binding silently never arrived.
//
// Deliberately read-only and unauthenticated. `dynamic_urls_read_by_id` is a
// `using (true)` policy precisely because OBS is anon; writes are owner-gated
// elsewhere, so knowing the id lets you watch a URL, never redirect it.

export function useDynamicBinding(dynamicId: Ref<string>) {
  const supabase = useSupabaseClient();
  const boundMatchId = ref<string | null>(null);
  // Distinguishes "fetch hasn't answered yet" from "answered: nothing bound".
  // Without it the overlay flashes its waiting state on every source load.
  const loaded = ref(false);
  let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;
  // Per-instance channel-name suffix — see useEvents for rationale.
  const channelSuffix = Math.random().toString(36).slice(2, 10);

  const fetchRemote = async () => {
    const id = dynamicId.value;
    if (!id) return;
    const { data, error } = await supabase
      .from('dynamic_urls')
      .select('current_match_id')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      console.warn('[useDynamicBinding] fetch failed', error);
      loaded.value = true;
      return;
    }
    boundMatchId.value = data?.current_match_id ?? null;
    loaded.value = true;
  };

  const subscribeRealtime = () => {
    if (realtimeChannel) {
      supabase.removeChannel(realtimeChannel);
      realtimeChannel = null;
    }
    const id = dynamicId.value;
    if (!id) return;
    realtimeChannel = supabase
      .channel(`dynamic-url:${id}:${channelSuffix}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'dynamic_urls',
          filter: `id=eq.${id}`,
        },
        (payload) => {
          const row = payload.new as { current_match_id?: string | null };
          boundMatchId.value = row.current_match_id ?? null;
        }
      )
      // A browser source that OBS suspended and resumed can come back with a
      // dead socket. Re-fetch on (re)subscribe so the overlay self-heals to
      // the current binding instead of rendering a stale match.
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') fetchRemote();
      });
  };

  onMounted(() => {
    fetchRemote();
    subscribeRealtime();
  });

  watch(dynamicId, () => {
    loaded.value = false;
    boundMatchId.value = null;
    fetchRemote();
    subscribeRealtime();
  });

  onUnmounted(() => {
    if (realtimeChannel) {
      supabase.removeChannel(realtimeChannel);
      realtimeChannel = null;
    }
  });

  return { boundMatchId, loaded };
}
