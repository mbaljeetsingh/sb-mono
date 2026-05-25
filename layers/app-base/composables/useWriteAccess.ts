// useWriteAccess — resolves who can score this match.
//
// Three legitimate write paths exist:
//   1. Anonymous match (owner_id IS NULL) — anyone with the URL.
//   2. Owner of an owned match — direct writes via RLS.
//   3. Co-scorer with a `?wt=<token>` query param that matches
//      matches.write_token — writes routed through the SECURITY DEFINER
//      RPC (`append_event_with_token` / `delete_events_with_token`).
//
// The token rides in the URL once, then is mirrored into sessionStorage so
// reload/return-to-tab keep working without re-scanning the QR. We don't
// use localStorage because losing access on tab close is the desired
// behavior — co-scorer leaves the venue → next browser session is read-only.
//
// `writeToken` is only non-null when token-mode is the active path. The
// owner of the match doesn't see a token even if `?wt=` is in the URL —
// they don't need it, and useEvents would otherwise route their own writes
// through the RPC unnecessarily.

import { computed, onMounted, ref, watch, type Ref } from "vue";
import { useSessionStorage } from "@vueuse/core";

export function useWriteAccess(matchId: Ref<string>) {
  const supabase = useSupabaseClient();
  const route = useRoute();

  const urlToken = computed(() => {
    const q = route.query.wt;
    return typeof q === "string" ? q : "";
  });

  // Per-match, per-tab storage. New tab via QR scan = fresh token; same
  // tab reload preserves access.
  const sessionToken = useSessionStorage<string>(
    computed(() => `sb:wt:${matchId.value}`),
    "",
  );

  // First time the URL carries `?wt=…`, mirror it into sessionStorage so a
  // subsequent reload (which may drop the query string) keeps access.
  watch(
    urlToken,
    (v) => {
      if (v) sessionToken.value = v;
    },
    { immediate: true },
  );

  const presentedToken = computed(() => urlToken.value || sessionToken.value);

  const ownerId = ref<string | null | undefined>(undefined);
  const rowToken = ref<string | null>(null);
  // Snapshot of auth.uid() captured *at the same time* as the match row.
  // Reading the reactive `useSupabaseUser()` instead races against auth
  // hydration: if the user is signed in but the cookie hasn't been resolved
  // yet when fetchRow finishes, `isOwner` evaluates false → the watcher in
  // control.vue bounces the legitimate owner before auth catches up.
  // `supabase.auth.getSession()` is the authoritative read.
  const authUid = ref<string | null>(null);
  const ended = ref<boolean>(false);
  const loaded = ref(false);
  // Flips to true when realtime tells us the matches row was deleted while
  // the page is open (e.g., owner deleted from /m/[id] settings). Consumers
  // should kick the user off /control — they can't write into a row that's
  // gone, and the scoreboard view of a deleted match is empty anyway.
  const matchDeleted = ref(false);

  const fetchRow = async () => {
    const id = matchId.value;
    if (!id) {
      loaded.value = true;
      return;
    }
    // Resolve auth and row in parallel — both inputs into canScore.
    const [{ data: sessionData }, rowRes] = await Promise.all([
      supabase.auth.getSession(),
      supabase
        .from("matches")
        .select("owner_id, write_token, ended_at")
        .eq("id", id)
        .maybeSingle(),
    ]);
    authUid.value = sessionData.session?.user?.id ?? null;
    if (rowRes.error) {
      // Fail-open. The most likely error here during dev is a stale schema
      // (the new columns haven't been migrated locally yet); treating that
      // as "no row" gives anon-match semantics so the app stays usable. The
      // server-side RLS / RPC still enforces the real access rules — this
      // is purely a UI gate.
      console.warn(
        "[useWriteAccess] match fetch failed; assuming anon-open",
        rowRes.error,
      );
      ownerId.value = null;
      rowToken.value = null;
      ended.value = false;
      loaded.value = true;
      return;
    }
    // No row yet — `/new` is the only writer of matches rows, so this means
    // the row either hasn't propagated yet or the URL points to a match that
    // was never created. Treat as anonymous-open while waiting; the realtime
    // INSERT below will refresh us if the row appears.
    const row = rowRes.data as {
      owner_id?: string | null;
      write_token?: string | null;
      ended_at?: string | null;
    } | null;
    ownerId.value = row?.owner_id ?? null;
    rowToken.value = row?.write_token ?? null;
    ended.value = !!row?.ended_at;
    loaded.value = true;
  };

  onMounted(fetchRow);
  watch(matchId, fetchRow);

  // Watch for owner_id / write_token changes (e.g. the owner regenerates the
  // token while we're holding an old one, or claim-on-login flips owner_id
  // from null to a uid on an anon match).
  let channel: ReturnType<typeof supabase.channel> | null = null;
  const subscribe = () => {
    if (channel) {
      supabase.removeChannel(channel);
      channel = null;
    }
    const id = matchId.value;
    if (!id) return;
    channel = supabase
      .channel(`match-access:${id}:${Math.random().toString(36).slice(2, 8)}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "matches",
          filter: `id=eq.${id}`,
        },
        (payload) => {
          const row = payload.new as {
            owner_id?: string | null;
            write_token?: string | null;
            ended_at?: string | null;
          };
          ownerId.value = row.owner_id ?? null;
          rowToken.value = row.write_token ?? null;
          ended.value = !!row.ended_at;
        },
      )
      // INSERT path — the row may not exist when useWriteAccess mounts
      // (lazy-create from useEvents). Without this, an anon viewer who
      // arrives before the row is stamped never observes the owner_id
      // flipping, and would optimistically score against a now-owned match.
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "matches",
          filter: `id=eq.${id}`,
        },
        (payload) => {
          const row = payload.new as {
            owner_id?: string | null;
            write_token?: string | null;
            ended_at?: string | null;
          };
          ownerId.value = row.owner_id ?? null;
          rowToken.value = row.write_token ?? null;
          ended.value = !!row.ended_at;
        },
      )
      // DELETE path — owner deleted the match while a co-scorer (or any
      // other viewer) had /control open. Without this, the co-scorer keeps
      // tapping into a void: events cascade-deleted, RPC starts rejecting,
      // and they're left confused. Flip `matchDeleted` so the control page
      // can bounce them somewhere meaningful.
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "matches",
          filter: `id=eq.${id}`,
        },
        () => {
          matchDeleted.value = true;
        },
      )
      .subscribe();
  };
  onMounted(subscribe);
  watch(matchId, subscribe);

  const isAnonMatch = computed(() => loaded.value && ownerId.value === null);
  const isOwner = computed(
    () => !!authUid.value && !!ownerId.value && ownerId.value === authUid.value,
  );
  const hasValidToken = computed(
    () =>
      !!presentedToken.value &&
      !!rowToken.value &&
      presentedToken.value === rowToken.value,
  );
  const isEnded = computed(() => ended.value);

  // Optimistic during load: don't kick the legitimate owner out before the
  // match row arrives. After load, the real answer is enforced. Owners can
  // still write past match end (corrections, un-end); token-path co-scorers
  // can't — once the match ends, their invite is automatically dead. A
  // realtime DELETE of the row kicks everyone unconditionally — the match
  // no longer exists, so nobody can score it.
  const canScore = computed(() => {
    if (matchDeleted.value) return false;
    if (!loaded.value) return true;
    if (isAnonMatch.value || isOwner.value) return true;
    if (hasValidToken.value && !ended.value) return true;
    return false;
  });

  // Token to pass to useEvents. Null when the caller has a direct write path
  // (owner, or anon match) — only token-only co-scorers go through the RPC.
  const writeToken = computed<string | null>(() => {
    if (isOwner.value || isAnonMatch.value) return null;
    return hasValidToken.value ? presentedToken.value : null;
  });

  return {
    loaded,
    isOwner,
    isAnonMatch,
    hasValidToken,
    isEnded,
    matchDeleted,
    canScore,
    writeToken,
    presentedToken,
  };
}
