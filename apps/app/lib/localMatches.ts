// Local-match utilities. The matches list reads display data from Supabase
// in both auth states — localStorage is used only to know which match IDs
// were scored on THIS device (signed-out filter) and to drive claim-on-login.

import type { SupabaseClient } from "@supabase/supabase-js";

const META_PREFIX = "sb:meta:";
const EVENTS_PREFIX = "sb:events:";

export const collectLocalMatchIds = (): string[] => {
  if (typeof localStorage === "undefined") return [];
  const ids = new Set<string>();
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;
    if (k.startsWith(EVENTS_PREFIX)) ids.add(k.slice(EVENTS_PREFIX.length));
    else if (k.startsWith(META_PREFIX)) ids.add(k.slice(META_PREFIX.length));
  }
  return [...ids];
};

// Claim local anonymous matches for the just-signed-in user. Updates only
// rows whose owner_id is still NULL — RLS will silently filter the rest.
// Returns the count of rows actually claimed.
export const claimAnonymousMatches = async (
  supabase: SupabaseClient,
  uid: string,
): Promise<number> => {
  const ids = collectLocalMatchIds();
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
