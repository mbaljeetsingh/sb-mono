import { ulid } from 'ulid';
import { computed, onUnmounted, ref, watch } from 'vue';
import { useUserStore } from '~/stores/user';

// Operator side of dynamic overlay URLs — the account's stable OBS pointers.
// The overlay's read-only half lives in useDynamicBinding.
//
// Signed-in only. Every mutation here is owner-gated by RLS; the composable
// mirrors that by refusing to act without a user rather than firing a request
// that will bounce.

export type DynamicUrl = {
  id: string;
  name: string;
  currentMatchId: string | null;
  // NULL means "never bound" — the only state in which auto-bind on match
  // creation is allowed to fire. See `autoBindOnCreate`.
  firstBoundAt: string | null;
};

export const DYNAMIC_URL_NAME_MAX = 40;

type Row = {
  id: string;
  name: string;
  current_match_id: string | null;
  first_bound_at: string | null;
};

const fromRow = (r: Row): DynamicUrl => ({
  id: r.id,
  name: r.name,
  currentMatchId: r.current_match_id,
  firstBoundAt: r.first_bound_at,
});

const COLS = 'id, name, current_match_id, first_bound_at';

export function useDynamicUrls(opts?: { realtime?: boolean }) {
  const supabase = useSupabaseClient();
  const userStore = useUserStore();

  const urls = ref<DynamicUrl[]>([]);
  const loaded = ref(false);

  const ownerId = computed(() =>
    userStore.isAuthenticated ? (userStore.currentUser?.id ?? null) : null
  );

  const refresh = async () => {
    if (!ownerId.value) {
      urls.value = [];
      loaded.value = true;
      return;
    }
    const { data, error } = await supabase
      .from('dynamic_urls')
      .select(COLS)
      .eq('owner_id', ownerId.value)
      .order('created_at', { ascending: true });
    if (error) {
      console.warn('[useDynamicUrls] fetch failed', error);
      loaded.value = true;
      return;
    }
    urls.value = (data ?? []).map((r) => fromRow(r as Row));
    loaded.value = true;
  };

  const create = async (name?: string): Promise<DynamicUrl | null> => {
    if (!ownerId.value) return null;
    // Default name is a placeholder meant to be overwritten, numbered so a
    // second one doesn't collide with the first in the picker.
    const fallback = `Stream ${urls.value.length + 1}`;
    const { data, error } = await supabase
      .from('dynamic_urls')
      .insert({
        id: ulid(),
        owner_id: ownerId.value,
        name: (name ?? fallback).slice(0, DYNAMIC_URL_NAME_MAX),
      })
      .select(COLS)
      .single();
    if (error) {
      console.warn('[useDynamicUrls] create failed', error);
      return null;
    }
    const row = fromRow(data as Row);
    urls.value = [...urls.value, row];
    return row;
  };

  const rename = async (id: string, name: string): Promise<boolean> => {
    const trimmed = name.trim().slice(0, DYNAMIC_URL_NAME_MAX);
    if (!trimmed) return false;
    // Renaming never touches `id`, so the URL pasted into OBS keeps working.
    const { error } = await supabase
      .from('dynamic_urls')
      .update({ name: trimmed })
      .eq('id', id);
    if (error) {
      console.warn('[useDynamicUrls] rename failed', error);
      return false;
    }
    urls.value = urls.value.map((u) =>
      u.id === id ? { ...u, name: trimmed } : u
    );
    return true;
  };

  const bind = async (id: string, matchId: string | null): Promise<boolean> => {
    const existing = urls.value.find((u) => u.id === id);
    // Stamp first_bound_at once, on the first real binding. It's what lets
    // auto-bind distinguish "never used" from "deliberately cleared".
    const stampFirst = Boolean(matchId) && !existing?.firstBoundAt;
    const stampedAt = stampFirst ? new Date().toISOString() : null;
    const patch: { current_match_id: string | null; first_bound_at?: string } =
      {
        current_match_id: matchId,
      };
    if (stampedAt) patch.first_bound_at = stampedAt;

    const { error } = await supabase
      .from('dynamic_urls')
      .update(patch)
      .eq('id', id);
    if (error) {
      console.warn('[useDynamicUrls] bind failed', error);
      return false;
    }
    urls.value = urls.value.map((u) =>
      u.id === id
        ? {
            ...u,
            currentMatchId: matchId,
            firstBoundAt: stampedAt ?? u.firstBoundAt,
          }
        : u
    );
    return true;
  };

  const unbind = (id: string) => bind(id, null);

  const remove = async (id: string): Promise<boolean> => {
    // `.select()` so a delete that matched nothing is reported as a failure.
    // Without it, PostgREST returns no error for a zero-row delete (an RLS
    // denial looks identical to success), and the UI would show a success
    // toast while the row stayed put.
    const { data, error } = await supabase
      .from('dynamic_urls')
      .delete()
      .eq('id', id)
      .select('id');
    if (error) {
      console.warn('[useDynamicUrls] delete failed', error);
      return false;
    }
    if (!data || data.length === 0) {
      console.warn('[useDynamicUrls] delete matched no rows', id);
      return false;
    }
    urls.value = urls.value.filter((u) => u.id !== id);
    return true;
  };

  // First-tap path from the match page. The operator has never set a URL up,
  // so this both creates one and binds the match — but the caller MUST then
  // reveal the URL. A silent create-and-bind "succeeds" while doing nothing
  // in OBS, because the operator has never seen the URL to paste it.
  const createAndBind = async (matchId: string): Promise<DynamicUrl | null> => {
    const row = await create();
    if (!row) return null;
    const ok = await bind(row.id, matchId);
    if (!ok) return row;
    return urls.value.find((u) => u.id === row.id) ?? row;
  };

  // Auto-bind on match creation (/new). Fires ONLY for a URL that has never
  // been bound, which is why first_bound_at exists as a column: gating on
  // `currentMatchId === null` instead would mean that clearing the overlay
  // during a break and then prepping the next match pushes it straight on air.
  const autoBindOnCreate = async (matchId: string): Promise<void> => {
    if (!ownerId.value) return;
    await refresh();
    const virgin = urls.value.find((u) => !u.firstBoundAt);
    if (!virgin) return;
    await bind(virgin.id, matchId);
  };

  // Optional Realtime mirror of the owner's rows. Opt-in because most callers
  // (/new's auto-bind) only need a one-shot read — but any surface that *shows*
  // what's on air wants it: the entire premise is rebinding from a phone while
  // a laptop has the app open, and a mount-time snapshot goes stale the moment
  // you do exactly that.
  let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;
  const channelSuffix = Math.random().toString(36).slice(2, 10);

  const teardownRealtime = () => {
    if (!realtimeChannel) return;
    supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  };

  const subscribeRealtime = (owner: string) => {
    teardownRealtime();
    realtimeChannel = supabase
      .channel(`dynamic-urls:${owner}:${channelSuffix}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'dynamic_urls',
          filter: `owner_id=eq.${owner}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            // DELETE payloads carry only the primary key.
            const gone = (payload.old as { id?: string }).id;
            if (gone) urls.value = urls.value.filter((u) => u.id !== gone);
            return;
          }
          const row = fromRow(payload.new as Row);
          const idx = urls.value.findIndex((u) => u.id === row.id);
          urls.value =
            idx === -1
              ? [...urls.value, row]
              : urls.value.map((u) => (u.id === row.id ? row : u));
        }
      )
      .subscribe();
  };

  if (opts?.realtime) {
    watch(
      ownerId,
      (owner) => {
        if (owner) subscribeRealtime(owner);
        else teardownRealtime();
      },
      { immediate: true }
    );
    onUnmounted(teardownRealtime);
  }

  const urlFor = (id: string) =>
    typeof window === 'undefined'
      ? ''
      : `${window.location.origin}/d/${id}/overlay`;

  const setupUrlFor = (id: string) =>
    typeof window === 'undefined' ? '' : `${window.location.origin}/d/${id}`;

  // Which of the operator's URLs is currently showing this match, if any.
  // Drives the match-page row's "Showing on <name>" state.
  const showingMatch = (matchId: string) =>
    urls.value.find((u) => u.currentMatchId === matchId) ?? null;

  return {
    urls,
    loaded,
    refresh,
    create,
    rename,
    bind,
    unbind,
    remove,
    createAndBind,
    autoBindOnCreate,
    urlFor,
    setupUrlFor,
    showingMatch,
  };
}
