import posthog from "posthog-js";
import { defineNuxtPlugin, useRuntimeConfig } from "#app";

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig();

  const isLocalhost =
    window.location.href.includes("localhost") ||
    window.location.href.includes("127.0.0.1");

  if (!config.public.posthogKey || isLocalhost) {
    return;
  }

  posthog.init(config.public.posthogKey as string, {
    api_host: "https://us.i.posthog.com",
    person_profiles: "identified_only",
    capture_pageview: false,
    capture_pageleave: true,
    autocapture: true,
  });
});
