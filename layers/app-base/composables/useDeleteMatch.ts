// useDeleteMatch — single source of truth for tearing down a match.
//
// Deletes the matches row in Supabase (events cascade via FK ON DELETE CASCADE)
// and wipes the per-match localStorage keys that we actually write. Meta /
// format / theme / result are Supabase-backed and have no local cache; only
// the event log (offline-first by design) and the per-device control-layout
// preference live in localStorage.

const PER_MATCH_KEYS = ["sb:events:", "sb:control-layout:"];

export function useDeleteMatch() {
  const supabase = useSupabaseClient();

  const clearLocal = (matchId: string) => {
    if (typeof window === "undefined") return;
    for (const prefix of PER_MATCH_KEYS) {
      try {
        window.localStorage.removeItem(`${prefix}${matchId}`);
      } catch {
        // Storage unavailable (private mode, quota) — non-fatal.
      }
    }
  };

  const deleteMatch = async (matchId: string): Promise<void> => {
    if (!matchId) throw new Error("matchId required");
    const { error } = await supabase.from("matches").delete().eq("id", matchId);
    if (error) throw error;
    clearLocal(matchId);
  };

  return { deleteMatch };
}
