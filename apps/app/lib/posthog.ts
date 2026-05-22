import { useRuntimeConfig } from "#imports";

let posthogInstance: typeof import("posthog-js").default | null = null;

export async function initPostHog() {
  if (import.meta.server) return;
  const config = useRuntimeConfig();
  const posthogKey = config.public.posthogKey as string;

  if (
    !posthogKey ||
    window.location.href.includes("localhost") ||
    window.location.href.includes("127.0.0.1")
  ) {
    return;
  }

  const posthog = (await import("posthog-js")).default;

  posthog.init(posthogKey, {
    api_host: "https://us.i.posthog.com",
    person_profiles: "identified_only",
    capture_pageview: false,
    capture_pageleave: true,
    autocapture: true,
  });

  posthogInstance = posthog;
}

export function getPostHog() {
  return posthogInstance;
}

export function trackEvent(
  event: string,
  properties?: Record<string, unknown>,
) {
  getPostHog()?.capture(event, properties);
}
