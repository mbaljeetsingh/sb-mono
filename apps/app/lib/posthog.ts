// PostHog access for app code. The client is initialized in exactly one
// place — plugins/posthog.client.ts — which calls setPostHog() after init.
// Everything else goes through trackEvent()/getPostHog(); both no-op safely
// when analytics is disabled (localhost, missing key).
import type posthogJs from 'posthog-js';

let posthogInstance: typeof posthogJs | null = null;

export function setPostHog(instance: typeof posthogJs) {
  posthogInstance = instance;
}

export function getPostHog() {
  return posthogInstance;
}

export function trackEvent(
  event: string,
  properties?: Record<string, unknown>
) {
  getPostHog()?.capture(event, properties);
}
