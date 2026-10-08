import { deepLinkRoute, isNativePlatform } from '~/lib/native';

/**
 * Native-shell lifecycle glue (apps/mobile-native). No-op on web and in the PWA.
 *
 * Splash: capacitor.config.ts sets `launchAutoHide: false` because the shell
 * is a pure SPA — the WebView has nothing to paint until the Nuxt bundle
 * mounts, and a fixed timer would drop a slow cold start onto a blank page.
 * Hiding from `app:mounted` ties the splash to the actual boot.
 *
 * System bars: the WebView runs edge-to-edge (`contentInset: 'never'`, safe
 * areas handled in CSS), so the status-bar icons sit on the app's own
 * background and must follow its color mode — including the per-page
 * `colorMode: 'light'` the broadcast surfaces force.
 *
 * Deep links: a control / scoreboard URL tapped in Messages, Mail or a QR
 * scan opens the app when it's installed (Universal Links / App Links) and
 * arrives here as `appUrlOpen`. Registered at plugin setup, not on mount, so
 * a cold-start link isn't missed; `getLaunchUrl()` backs that up, and
 * `lastUrl` stops it re-navigating to a link the listener already took.
 */
export default defineNuxtPlugin((nuxtApp) => {
  if (!isNativePlatform()) return;

  let lastUrl = '';
  const openDeepLink = (url: string | undefined) => {
    const route = url && deepLinkRoute(url);
    if (!route) return;
    lastUrl = url;
    void nuxtApp.runWithContext(() => navigateTo(route));
  };
  void import('@capacitor/app')
    .then(async ({ App }) => {
      await App.addListener('appUrlOpen', ({ url }) => openDeepLink(url));
      const launch = (await App.getLaunchUrl())?.url;
      if (launch !== lastUrl) openDeepLink(launch);
    })
    .catch((err) => console.warn('deep links:', err));

  nuxtApp.hook('app:mounted', async () => {
    try {
      const { SplashScreen } = await import('@capacitor/splash-screen');
      await SplashScreen.hide();
    } catch {
      // Plugin absent — launchAutoHide only applies where it exists.
    }

    try {
      const { SystemBars, SystemBarsStyle } = await import('@capacitor/core');
      const colorMode = await nuxtApp.runWithContext(() => useColorMode());
      watch(
        () => colorMode.value,
        (mode) => {
          // Dark style = light icons, for a dark background.
          void SystemBars.setStyle({
            style:
              mode === 'dark' ? SystemBarsStyle.Dark : SystemBarsStyle.Light,
          });
        },
        { immediate: true }
      );
    } catch (err) {
      console.warn('system bars:', err);
    }
  });
});
