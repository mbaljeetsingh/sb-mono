// useDeleteMatch — single source of truth for tearing down a match.
//
// Deletes the matches row in Supabase (events cascade via FK ON DELETE CASCADE)
// and wipes the per-device local state we actually write: the IDB event log
// and the localStorage control-layout preference. Meta / format / theme /
// result are Supabase-backed and have no local cache.

import { deleteEvents } from "../lib/eventStore";

const LOCALSTORAGE_PREFIXES = ["sb:control-layout:"];

export function useDeleteMatch() {
  const supabase = useSupabaseClient();

  const clearLocal = async (matchId: string) => {
    if (typeof window === "undefined") return;
    await deleteEvents(matchId);
    for (const prefix of LOCALSTORAGE_PREFIXES) {
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
    await clearLocal(matchId);
  };

  return { deleteMatch };
}
