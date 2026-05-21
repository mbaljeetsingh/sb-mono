-- Retention sweep for anonymous matches.
--
-- Policy (single source of truth for cleanup):
--   * Anon + zero events: hard-delete after 24h. These are almost always
--     accidental /new clicks the user never returned to.
--   * Anon + has events: hard-delete after 30 days. Matches the copy
--     surfaced on /m/[...notfound] ("Anonymous matches are kept for 30 days").
--   * Signed-in matches (owner_id IS NOT NULL): never deleted by this job.
--     Pro-tier differentiation is on features, not storage retention.
--
-- Why created_at rather than updated_at: keeping the contract simple ("30
-- days from creation") and avoiding a "keep-alive" exploit where a single
-- auto-refreshing tab perpetually resurrects a row.
--
-- Events cascade via the FK ON DELETE CASCADE on public.events.match_id.

-- pg_cron must be enabled on the project first (Dashboard → Database →
-- Extensions → pg_cron). Supabase installs it into the pg_catalog schema by
-- default; the user-facing API still lives under the `cron` schema (auto-
-- created by the extension) regardless of where the extension binary sits,
-- so the cron.schedule(...) call below is unaffected by the install schema.
create extension if not exists pg_cron;

create or replace function public.cleanup_anonymous_matches()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Bucket 1: empty anon matches > 24h old.
  delete from public.matches m
  where m.owner_id is null
    and m.created_at < (now() - interval '24 hours')
    and not exists (
      select 1 from public.events e where e.match_id = m.id
    );

  -- Bucket 2: anon matches with events, older than 30 days.
  delete from public.matches m
  where m.owner_id is null
    and m.created_at < (now() - interval '30 days')
    and exists (
      select 1 from public.events e where e.match_id = m.id
    );
end;
$$;

-- Lock the function down — it's only meant to be invoked by the cron job.
revoke execute on function public.cleanup_anonymous_matches from public, anon, authenticated;

-- Unschedule any prior copy of the job under this name so re-running the
-- migration doesn't accumulate duplicates. Wrapped in a DO block because
-- cron.unschedule raises if no such job exists.
do $$
begin
  perform cron.unschedule('sb-cleanup-anonymous-matches');
exception when others then null;
end
$$;

-- Hourly sweep. The deletes are bounded by the indexed predicates
-- (owner_id IS NULL + created_at), so the job is cheap even at scale.
select
  cron.schedule(
    'sb-cleanup-anonymous-matches',
    '0 * * * *',
    $$select public.cleanup_anonymous_matches();$$
  );
