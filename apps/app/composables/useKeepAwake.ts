import { useEventListener, useWakeLock } from '@vueuse/core';
import { onMounted, onUnmounted } from 'vue';
import { isNativePlatform } from '~/lib/native';

/**
 * Keep the screen on while the calling page is mounted — the scorer's phone
 * on /control, the courtside tablet on /scoreboard.
 *
 * Native shell: the OS idle-timer flag (`@capacitor-community/keep-awake` —
 * `isIdleTimerDisabled` on iOS, `FLAG_KEEP_SCREEN_ON` on Android). It holds
 * until released; nothing to babysit.
 *
 * Web: the Screen Wake Lock API, which is fragile in exactly the ways an
 * operator notices. A bare `request()` on mount fails silently and is never
 * retried when the browser refuses it (iOS before 18.4 in home-screen apps,
 * Android battery saver, a request racing page load), and the lock is dropped
 * whenever the tab is hidden, the screen locks, or a system sheet opens. So
 * we re-request on every way back: tab visible again, and the next tap or key
 * press — scoring IS tapping, so a lost lock comes back on the next point
 * instead of the screen dimming mid-rally.
 */
export function useKeepAwake() {
  if (isNativePlatform()) {
    onMounted(async () => {
      try {
        const { KeepAwake } = await import('@capacitor-community/keep-awake');
        await KeepAwake.keepAwake();
      } catch (err) {
        console.warn('keep-awake:', err);
      }
    });
    onUnmounted(async () => {
      try {
        const { KeepAwake } = await import('@capacitor-community/keep-awake');
        await KeepAwake.allowSleep();
      } catch {
        // Plugin absent — nothing was held.
      }
    });
    return;
  }

  // useWakeLock releases on scope dispose, so no onUnmounted here.
  const wakeLock = useWakeLock();
  let isRequesting = false;

  // Not `wakeLock.isActive`: after the browser drops the lock, VueUse keeps
  // the released sentinel in its ref, so isActive stays true and no tap would
  // ever re-acquire. Ask the sentinel itself.
  const isHeld = () => {
    const sentinel = wakeLock.sentinel.value;
    return !!sentinel && !sentinel.released;
  };

  const acquire = async () => {
    if (!wakeLock.isSupported.value || isHeld()) return;
    if (isRequesting || document.visibilityState !== 'visible') return;
    isRequesting = true;
    try {
      await wakeLock.request('screen');
    } catch {
      // Refused (no user activation yet, battery saver, …). The next tap or
      // visibility change tries again.
    } finally {
      isRequesting = false;
    }
  };

  onMounted(acquire);
  useEventListener(document, 'visibilitychange', acquire);
  // Capture phase: score cells and sheets may stop propagation.
  useEventListener(document, 'pointerdown', acquire, {
    capture: true,
    passive: true,
  });
  useEventListener(document, 'keydown', acquire, { capture: true });
}
