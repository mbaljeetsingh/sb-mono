import { computed, type Ref } from "vue";

// Build the shareable per-match URLs in one place. Themes are now stored on
// the matches row in Supabase, so the canonical URLs don't need `?theme=`
// — every device opening the URL hydrates the operator's chosen theme.
// Themes are still accepted as a query param override at the page level
// (preview / "force this theme" scenarios), but they're no longer part of
// the URL we put on the operator's clipboard.
export function useMatchUrls(matchId: Ref<string>) {
  const baseUrl = computed(() =>
    typeof window === "undefined" ? "" : window.location.origin,
  );
  return computed(() => {
    const base = `${baseUrl.value}/m/${matchId.value}`;
    return {
      control: `${base}/control`,
      overlay: `${base}/overlay`,
      scoreboard: `${base}/scoreboard`,
    };
  });
}
