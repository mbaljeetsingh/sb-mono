export default {
  '*.{ts,vue,css,json}': ['prettier --write'],
  // Keep generated Supabase types in lockstep with migrations — a schema
  // change can never land without its regenerated types.
  'supabase/migrations/*.sql': () => [
    'pnpm run supabase:types',
    'git add packages/shared/src/types/supabase.ts',
  ],
};
