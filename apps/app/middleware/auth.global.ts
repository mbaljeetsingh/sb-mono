// Global auth middleware. SPA-mode (no SSR) — runs once on initial nav and on every route change.
//
// Public routes (no auth needed):
//   - landing + match-creation + scorer surfaces — the free tier ("score anonymously").
//     Anyone can land on /, click Start a match, score, and share the URL. Sign-in is
//     OPTIONAL and unlocks history, ownership, premium features.
//   - auth pages themselves
//   - viewer surfaces (/m/*/scoreboard, /m/*/overlay, /d/*/overlay)
// Pages requiring sign-in (today): /profile. Future: /history, /admin, etc.
//
// Per-route permission gates: set `definePageMeta({ requiredPermission: 'match.create' })` on a page.

import { defineNuxtRouteMiddleware, navigateTo, createError } from "#app";
import { useUserStore } from "@/stores/user";
import { useRolePermissions } from "@/composables/useRolePermissions";

// Routes anyone can hit without being signed in. Match against `to.path`.
const PUBLIC_PREFIXES = [
  "/auth/", // signin / signup / forgot / reset / callback
  "/m/", // match hub + control + scoreboard + overlay (free scorer)
  "/d/", // dynamic-URL bindings (operator pre-publishes a stable overlay link)
];

// Anonymous-OK paths. The scorer is free — anyone can score without signing up.
// Sign-in is optional and unlocks ownership, history, and Pro features later.
const PUBLIC_EXACT = new Set<string>(["/", "/new", "/matches"]);

// Suffix-based public surfaces — the viewer-facing routes broadcasters and audience hit.
// e.g. /m/abc/scoreboard, /m/abc/overlay, /d/abc/overlay
const PUBLIC_SUFFIXES = ["/scoreboard", "/overlay"];

const isPublicRoute = (path: string): boolean => {
  if (PUBLIC_EXACT.has(path)) return true;
  if (PUBLIC_PREFIXES.some((p) => path.startsWith(p))) return true;
  if (PUBLIC_SUFFIXES.some((s) => path.endsWith(s))) return true;
  return false;
};

const AUTH_PAGES = new Set<string>([
  "/auth/signin",
  "/auth/signup",
  "/auth/forgot-password",
]);

export default defineNuxtRouteMiddleware(async (to) => {
  const userStore = useUserStore();
  const { hasPermission } = useRolePermissions();

  // initAuth is idempotent — first call runs synchronizeUserState, subsequent calls return early.
  await userStore.initAuth();

  // Bounce signed-in users away from signin/signup/forgot.
  if (AUTH_PAGES.has(to.path) && userStore.isAuthenticated) {
    return navigateTo("/", { replace: true });
  }

  // Allow public surfaces to skip the gate.
  if (isPublicRoute(to.path)) return;

  // Gate everything else.
  if (!userStore.isAuthenticated) {
    return navigateTo(
      { path: "/auth/signin", query: { redirect: to.fullPath } },
      { replace: true },
    );
  }

  // Per-page permission requirement (definePageMeta({ requiredPermission: '...' })).
  const required = to.meta.requiredPermission as string | string[] | undefined;
  if (required) {
    const granted = Array.isArray(required)
      ? required.some(hasPermission)
      : hasPermission(required);
    if (!granted) {
      throw createError({
        statusCode: 403,
        statusMessage: "Access denied",
        message: "You do not have permission to access this page.",
        fatal: true,
      });
    }
  }
});
