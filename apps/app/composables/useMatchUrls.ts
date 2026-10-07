import { computed, type Ref } from 'vue';
import { publicOrigin } from '~/lib/native';

// Build the shareable per-match URLs in one place. Themes are now stored on
// the matches row in Supabase, so the canonical URLs don't need `?theme=`
// — every device opening the URL hydrates the operator's chosen theme.
// Themes are still accepted as a query param override at the page level
// (preview / "force this theme" scenarios), but they're no longer part of
// the URL we put on the operator's clipboard.
export function useMatchUrls(matchId: Ref<string>) {
  // publicOrigin, not window.location.origin: inside the native shell the
  // origin is the phone itself, and these URLs are pasted into OBS elsewhere.
  const baseUrl = computed(() => publicOrigin());
  return computed(() => {
    const base = `${baseUrl.value}/m/${matchId.value}`;
    return {
      control: `${base}/control`,
      overlay: `${base}/overlay`,
      scoreboard: `${base}/scoreboard`,
    };
  });
}
