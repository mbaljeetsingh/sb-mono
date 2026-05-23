-- Explicit table-level GRANTs for anon / authenticated / service_role.
--
-- Why this exists: newer Supabase Cloud projects no longer auto-grant DML
-- privileges on public tables to anon/authenticated when a migration creates
-- them. Older projects (like np-mono) had this as a project-level default and
-- never needed explicit grants. sb-mono's prod project was provisioned after
-- the default changed, so without this migration every PostgREST request
-- against `matches` / `events` / `users` returns:
--   { code: "42501", message: "permission denied for table <name>" }
-- regardless of RLS policies — because GRANTs are checked before RLS.
--
-- All statements below are idempotent (GRANT on an already-granted privilege
-- is a no-op), so it's safe to run against an already-granted prod state.
--
-- Asymmetries vs. "grant everything everywhere":
--   * public.users         — authenticated + service_role only. Anonymous
--                            users shouldn't see profile rows; RLS would
--                            also block, but no GRANT is defense-in-depth.
--   * public.user_roles    — left untouched. The roles_and_permissions
--                            migration intentionally REVOKEs all access from
--                            anon/authenticated/public and gates reads to
--                            supabase_auth_admin + SECURITY DEFINER RPCs.
--   * public.role_permissions — SELECT for authenticated so the client-side
--                            get_my_permissions() flow resolves.

grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on public.matches to anon, authenticated, service_role;
grant select, insert, update, delete on public.events  to anon, authenticated, service_role;
grant select, insert, update, delete on public.users   to authenticated, service_role;
grant select                          on public.role_permissions to authenticated;

-- Default privileges for any future table created in `public`. Stops the
-- same class of "permission denied" failure from recurring next time we add
-- a table without thinking about explicit grants.
alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated, service_role;
