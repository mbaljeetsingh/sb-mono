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
