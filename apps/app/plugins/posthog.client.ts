import posthog from 'posthog-js';
import { defineNuxtPlugin, useRouter, useRuntimeConfig } from '#app';
import { setPostHog } from '../lib/posthog';

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig();

  const isLocalhost =
    window.location.href.includes('localhost') ||
    window.location.href.includes('127.0.0.1');

  if (!config.public.posthogKey || isLocalhost) {
    return;
  }

  posthog.init(config.public.posthogKey as string, {
    api_host: 'https://us.i.posthog.com',
    person_profiles: 'identified_only',
    capture_pageview: false,
    capture_pageleave: true,
    autocapture: true,
  });

  // Hand the initialized client to lib/posthog so trackEvent()/getPostHog()
  // resolve — without this they no-op forever.
  setPostHog(posthog);

  // SPA pageviews: capture_pageview is off (it only fires on full loads),
  // so capture $pageview on every route change, including the initial one.
  const router = useRouter();
  router.afterEach((to) => {
    posthog.capture('$pageview', { path: to.fullPath });
  });
});
