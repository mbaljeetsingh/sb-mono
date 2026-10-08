/**
 * Native-shell (Capacitor, apps/mobile-native) detection and the one URL
 * difference it forces on the app.
 *
 * `isNativePlatform()` reads a build-time constant (`__NUXT_NATIVE__`, a Vite
 * define), not Capacitor's runtime bridge check: the shell is a physically
 * separate `NUXT_NATIVE=1` bundle, so the build already knows the answer, and
 * the constant lets every `if (isNativePlatform())` branch — and the
 * `@capacitor/*` dynamic imports behind it — tree-shake out of the web bundle.
 */

export function isNativePlatform(): boolean {
  return __NUXT_NATIVE__;
}

/**
 * Origin for URLs that leave this device — overlay / scoreboard / control
 * links, QR codes, auth email redirects.
 *
 * On web that's simply where the app is served. In the shell it is NOT:
 * `window.location.origin` is `capacitor://localhost` (iOS) or
 * `https://localhost` (Android), so an overlay link pasted into OBS on the
 * streaming PC would point at that PC itself. The shell bakes the public web
 * app's origin instead (`NUXT_PUBLIC_APP_URL`, see native-env.ts).
 */
export function publicOrigin(): string {
  if (typeof window === 'undefined') return '';
  return isNativePlatform() ? __PUBLIC_APP_URL__ : window.location.origin;
}

/**
 * Paths the shell claims as Universal Links / App Links. Mirrors
 * `public/.well-known/apple-app-site-association` and the `autoVerify`
 * intent-filter in AndroidManifest.xml — change all three together. Overlay
 * links (for OBS) and `/auth/*` (PKCE must finish in the browser that started
 * it) are deliberately not claimed.
 */
const DEEP_LINK_PATHS = [
  /^\/m\/[^/]+\/control\/?$/,
  /^\/m\/[^/]+\/scoreboard\/?$/,
];

/**
 * In-app route for an incoming deep link, or null if it isn't one we handle.
 * The URL comes from outside the app, so only our own host and the claimed
 * paths get through.
 */
export function deepLinkRoute(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.host !== new URL(__PUBLIC_APP_URL__).host) return null;
  if (!DEEP_LINK_PATHS.some((re) => re.test(url.pathname))) return null;
  return url.pathname + url.search + url.hash;
}
