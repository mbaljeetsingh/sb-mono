import { computed, type Ref } from "vue";

// Build the shareable per-match URLs in one place. Theme refs are optional —
// when supplied, overlay/scoreboard URLs carry `?theme=` so OBS / venue TV
// pick up the operator's choice without an extra hop.
export function useMatchUrls(
  matchId: Ref<string>,
  themes?: { overlay: Ref<string>; scoreboard: Ref<string> },
) {
  const baseUrl = computed(() =>
    typeof window === "undefined" ? "" : window.location.origin,
  );
  return computed(() => {
    const base = `${baseUrl.value}/m/${matchId.value}`;
    const o = themes?.overlay.value;
    const s = themes?.scoreboard.value;
    return {
      control: `${base}/control`,
      overlay: o ? `${base}/overlay?theme=${o}` : `${base}/overlay`,
      scoreboard: s ? `${base}/scoreboard?theme=${s}` : `${base}/scoreboard`,
    };
  });
}
