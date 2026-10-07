/**
 * Capacitor shell configuration — wraps the apps/app SPA for the App Store
 * and Play Store.
 *
 * Settings marked "np-mono" were ported from ~/Code/np-mono/apps/mobile-native,
 * where they were arrived at by shipping the bugs they prevent. The comments
 * explaining *why* are the valuable part — don't strip them.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { CapacitorConfig } from '@capacitor/cli';

// The Capacitor CLI transpiles this file to CJS (no import.meta) and only runs
// it with cwd = this package, so cwd-relative resolution is the reliable one.
const webDirAbs = resolve(process.cwd(), '../app/.output/public');
const stampPath = resolve(webDirAbs, 'native-build.json');

// Refuse to copy anything that isn't a native build. The web build
// (`nuxt build`) writes the same apps/app/.output/public, and turbo can
// restore either from cache — without this check a web build syncs into the
// shell and ships as a white screen, or a bundle pointed at a developer's
// local Supabase ships as an app with no data. Both fail silently.
// The stamp is written by apps/app/nuxt.config.ts under NUXT_NATIVE=1.
//
// Enforced only for commands that copy webDir — `cap open` and
// capacitor-assets also load this file and read nothing from .output.
const copiesWebDir = process.argv.some((a) =>
  ['sync', 'copy', 'run', 'add'].includes(a)
);
const remedy =
  'Run `pnpm build:native` at the repo root (or `pnpm --filter @sb/mobile-native sync:app`).';
if (copiesWebDir && !existsSync(stampPath)) {
  throw new Error(
    `[capacitor.config] ${webDirAbs} is not a native build ` +
      `(native-build.json missing — it holds a web build or is stale). ${remedy}`
  );
}
if (copiesWebDir) {
  const stamp = JSON.parse(readFileSync(stampPath, 'utf8')) as {
    supabaseUrl?: string;
  };
  const isLocalBackend = /localhost|127\.0\.0\.1|10\.0\.2\.2/.test(
    stamp.supabaseUrl ?? ''
  );
  // NATIVE_DEV=1 is the deliberate local-backend dev loop; nothing headed for
  // a store may point at a dev stack.
  if (isLocalBackend && process.env.NATIVE_DEV !== '1') {
    throw new Error(
      `[capacitor.config] This bundle points at a LOCAL backend (${stamp.supabaseUrl}) — ` +
        'it would ship as an app with no data. Rebuild with production config, ' +
        'or pass NATIVE_DEV=1 for a local dev loop.'
    );
  }
}

const config: CapacitorConfig = {
  // Load-bearing beyond naming: it's the bundle id / application id both
  // stores key the listing on. Effectively permanent after the first upload.
  appId: 'com.beejaysoft.scoreboard',
  appName: 'Scoreboard',

  // Built by `pnpm build:native` (NUXT_NATIVE=1 → nitro static). The web
  // build and `cap sync` must run as a pair — hence `sync:app`.
  webDir: '../app/.output/public',

  plugins: {
    SplashScreen: {
      // No fixed timer (np-mono): the WebView is blank until the Nuxt bundle
      // mounts, and a timer can't know when that is. plugins/native.client.ts
      // hides the splash from the app:mounted hook.
      launchAutoHide: false,
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    Keyboard: {
      // `native` resizes the WebView frame when the keyboard opens, so `dvh`
      // and safe-area insets shrink with it and the /new form's Start button
      // stays reachable (np-mono).
      resize: 'native',
      resizeOnFullScreen: true,
    },
  },

  ios: {
    // Edge-to-edge; the app already pads with env(safe-area-inset-*). The
    // default 'always' double-insets content and shows a strip under the
    // home indicator (np-mono).
    contentInset: 'never',
    // App-Bound Domains OFF: enabling it silently blocks every fetch to an
    // unlisted domain — Supabase included — with no log output (np-mono).
    limitsNavigationsToAppBoundDomains: false,
    // Lets Safari's Web Inspector attach. Apple ignores it for App Store
    // builds, so it's safe to leave on.
    webContentsDebuggingEnabled: true,
  },

  android: {
    // Mixed content stays blocked in anything shippable; NATIVE_DEV=1 allows
    // the https://localhost page to reach a local Supabase over http.
    allowMixedContent: process.env.NATIVE_DEV === '1',
    captureInput: true,
    webContentsDebuggingEnabled: true,
  },

  server: {
    androidScheme: 'https',
    // No `url` on purpose: the app loads its bundled assets, never the live
    // site. A remote URL means no offline scoring and an App Review 4.2
    // "just a website" rejection risk.
  },
};

export default config;
