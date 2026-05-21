// useDeleteMatch — single source of truth for tearing down a match.
//
// Deletes the matches row in Supabase (events cascade via FK ON DELETE CASCADE)
// and wipes all per-match localStorage keys listed in CLAUDE.md so a stale
// entry doesn't linger and resurrect the match in client-side composables.

const PER_MATCH_KEYS = [
  "sb:meta:",
  "sb:events:",
  "sb:format:preset:",
  "sb:format:gamesToWin:",
  "sb:theme:",
  "sb:control-layout:",
  "sb:result:",
];

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
