// useScorerActive — soft handoff lock for /control.
//
// At most one device "actively" scores a match at a time. The DB column
// `matches.active_scorer_device_id` is the source of truth; a Postgres
// trigger keeps it in sync as events arrive, and `claim_scoring` lets a
// passive device take over without writing an event first. This composable
// surfaces the current state + a `claim()` action and tracks whether the
// caller's own device is the active scorer.
//
// Bootstrap rule: when nobody has claimed yet (column NULL), every device
// is considered active so the first tap on a fresh match isn't gated. The
// `events_bump_active_scorer` trigger fires on that first INSERT and
// stamps the device; from then on, other devices flip to passive and have
// to claim before they can score.
//
// Token-path callers must pass the same `writeToken` they use for the
// event RPCs; the `claim_scoring` RPC re-checks the token (and rejects
// after match end) so a stale invite can't reclaim scoring.

import { ulid } from 'ulid';
import { type Ref, computed, onMounted, onUnmounted, ref, watch } from 'vue';

const DEVICE_ID_KEY = 'sb:device-id';
// Match `useEvents.getDeviceId` so a tap registers the same device id the
// trigger then stamps onto the row. If these ever diverge, a single device
// would look like two and break the lock.
const getDeviceId = (): string => {
  if (typeof localStorage === 'undefined') return 'ssr';
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = ulid();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
};

export function useScorerActive(
  matchId: Ref<string>,
  opts: { writeToken?: Ref<string | null> } = {}
) {
  const supabase = useSupabaseClient();
  const writeToken = opts.writeToken;

  // Resolved on mount because localStorage is unavailable during SSR.
  const myDeviceId = ref<string>('');
  const activeDeviceId = ref<string | null>(null);
  const activeAt = ref<string | null>(null);

  const fetchActive = async () => {
    const id = matchId.value;
    if (!id) return;
    const { data, error } = await supabase
      .from('matches')
      .select('active_scorer_device_id, active_scorer_at')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      console.warn('[useScorerActive] fetch failed', error);
      return;
    }
    const row = data as {
      active_scorer_device_id?: string | null;
      active_scorer_at?: string | null;
    } | null;
    activeDeviceId.value = row?.active_scorer_device_id ?? null;
    activeAt.value = row?.active_scorer_at ?? null;
  };

  let channel: ReturnType<typeof supabase.channel> | null = null;
  const subscribe = () => {
    if (channel) {
      supabase.removeChannel(channel);
      channel = null;
    }
    const id = matchId.value;
    if (!id) return;
    const apply = (row: {
      active_scorer_device_id?: string | null;
      active_scorer_at?: string | null;
    }) => {
      activeDeviceId.value = row.active_scorer_device_id ?? null;
      activeAt.value = row.active_scorer_at ?? null;
    };
    channel = supabase
      .channel(`scorer-active:${id}:${Math.random().toString(36).slice(2, 8)}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'matches',
          filter: `id=eq.${id}`,
        },
        (payload) => apply(payload.new as Parameters<typeof apply>[0])
      )
      // INSERT in case the matches row is created lazily after we mount.
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'matches',
          filter: `id=eq.${id}`,
        },
        (payload) => apply(payload.new as Parameters<typeof apply>[0])
      )
      .subscribe();
  };

  onMounted(() => {
    myDeviceId.value = getDeviceId();
    fetchActive();
    subscribe();
  });
  watch(matchId, () => {
    fetchActive();
    subscribe();
  });
  onUnmounted(() => {
    if (channel) {
      supabase.removeChannel(channel);
      channel = null;
    }
  });

  // Optimistic during the SSR-to-hydration gap (myDeviceId not yet read).
  // Once we know our id, we're active iff no one has claimed yet OR the
  // claim matches us.
  const isActive = computed(() => {
    if (!myDeviceId.value) return true;
    if (!activeDeviceId.value) return true;
    return activeDeviceId.value === myDeviceId.value;
  });

  const claim = async () => {
    if (!myDeviceId.value) return false;
    const { error } = await supabase.rpc('claim_scoring', {
      p_match_id: matchId.value,
      p_device_id: myDeviceId.value,
      // Generated RPC types model the SQL default as optional, not nullable.
      p_token: writeToken?.value ?? undefined,
    });
    if (error) {
      console.warn('[useScorerActive] claim failed', error);
      return false;
    }
    // Optimistic local flip; realtime UPDATE will reconcile shortly.
    activeDeviceId.value = myDeviceId.value;
    return true;
  };

  return { activeDeviceId, activeAt, isActive, claim, myDeviceId };
}
