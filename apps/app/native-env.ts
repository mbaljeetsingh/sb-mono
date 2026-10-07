/**
 * Backend configuration baked into NUXT_NATIVE=1 (Capacitor shell) builds.
 *
 * Why this file exists: the native build inherits apps/app/.env, which points
 * at each developer's LOCAL Supabase. A store binary built from those values
 * is broken for everyone else, and silently so — on Android the WebView
 * refuses cleartext to 127.0.0.1 and the app just shows empty lists. So the
 * flag that creates the need supplies the values; nuxt.config.ts assigns them
 * to process.env when the inherited value is dev-shaped.
 *
 * NOT secrets — every value here already ships in the public runtime config
 * of the deployed web app (the publishable key is client-visible by design;
 * access is enforced by RLS). Never put the service-role key here.
 *
 * Rotation: these bake into every shipped binary. Rotate the publishable key
 * by issuing the new one alongside the old, shipping a native release, and
 * only revoking the old key once installs have updated.
 *
 * An explicit, non-dev env var still wins, so CI / a staging build can
 * override any of these without editing code.
 */

export const NATIVE_ENV = {
  NUXT_PUBLIC_SUPABASE_URL: 'https://kviinvknshdoxlqznodl.supabase.co',
  NUXT_PUBLIC_SUPABASE_KEY: 'sb_publishable_ZHYFq4-8OEtoHrfKgM6MkA_gGh0oh5v',
  NUXT_PUBLIC_POSTHOG_KEY: 'phc_u8KcLAszVNaFAfsX7UVXumDF92SP2A3MBcNDsTsT5CeR',
  NUXT_PUBLIC_ENVIRONMENT: 'production',
  // Origin for every URL that leaves the phone (overlay links, QR codes,
  // auth emails) — see publicOrigin() in lib/native.ts.
  NUXT_PUBLIC_APP_URL: 'https://scoreboard.beejaysoft.com',
} satisfies Record<string, string>;
