-- In-app account deletion. Apple requires it wherever accounts can be created
-- (App Store 5.1.1(v)) and Play requires a deletion path; it serves the web
-- app too. Called from DeleteAccountCard on /profile.
--
-- An RPC rather than an edge function (np-mono's shape): sb has no billing to
-- check and no other server-side work, so one transaction in the database is
-- simpler — matches and the auth user go together or not at all, and it
-- ships with `supabase db push` like everything else.
--
-- What goes:
--   * matches the user owns — deleted, events cascade. NOT anonymised: an
--     owner_id NULL row is writable by anyone holding its URL (Option A RLS)
--     and still carries the player names the user typed.
--   * the auth user — public.users, user_roles and dynamic_urls cascade from
--     it, as do auth sessions / identities / refresh tokens.
-- Avatar files are removed by the client first (avatars_delete_own policy):
-- storage.objects rejects direct SQL deletes.
--
-- Deliberately takes no user id: it only ever deletes its own caller.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  delete from public.matches where owner_id = uid;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
