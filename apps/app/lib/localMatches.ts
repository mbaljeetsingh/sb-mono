// Local-match utilities. The matches list reads display data from Supabase
// in both auth states — IDB is used only to know which match IDs were scored
// on THIS device (signed-out filter) and to drive claim-on-login.

import { listLocalMatchIds } from "@sb/layer-app-base/lib/eventStore";
import type { SupabaseClient } from "@supabase/supabase-js";

export const collectLocalMatchIds = async (): Promise<string[]> => {
  return await listLocalMatchIds();
};

// Claim local anonymous matches for the just-signed-in user. Updates only
// rows whose owner_id is still NULL — RLS will silently filter the rest.
// Returns the count of rows actually claimed.
export const claimAnonymousMatches = async (
  supabase: SupabaseClient,
  uid: string,
): Promise<number> => {
  const ids = await collectLocalMatchIds();
  if (ids.length === 0) return 0;
  const { data, error } = await supabase
    .from("matches")
    .update({ owner_id: uid })
    .in("id", ids)
    .is("owner_id", null)
    .select("id");
  if (error) {
    console.warn("[claimAnonymousMatches] failed", error);
    return 0;
  }
  return data?.length ?? 0;
};
