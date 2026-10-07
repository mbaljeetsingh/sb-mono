// Compile-time constants injected by Vite via `define` in nuxt.config.ts.
declare const __APP_VERSION__: string;
// True only in the NUXT_NATIVE=1 (Capacitor shell) bundle. Read it through
// isNativePlatform() in lib/native.ts.
declare const __NUXT_NATIVE__: boolean;
// Public web-app origin baked into the native bundle; '' on web.
declare const __PUBLIC_APP_URL__: string;
