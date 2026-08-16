-- Dynamic overlay URLs — the "paste into OBS once, ever" surface.
--
-- Problem this solves: the per-match overlay URL (/m/{id}/overlay) changes
-- every match, so a streamer re-edits their OBS browser source between every
-- game of a tournament evening. A dynamic URL is a stable pointer the operator
-- pastes once; rebinding it to the next match swaps what OBS renders, live,
-- from any device.
--
-- Signed-in only, unlike the rest of the app (which is anonymous-OK per
-- ARCHITECTURE.md §6's original nullable-owner sketch). Three reasons the
-- anon variant was dropped:
--   * A "permanent" URL whose id lives only in localStorage isn't permanent —
--     clearing site data strands an OBS source pointing at an id the operator
--     can never recover.
--   * With no owner the rebind policy has to be permissive, so anyone who
--     learns the id can redirect a live broadcast. That trade is acceptable
--     for a throwaway anonymous match URL; it isn't for a reused on-air one.
--   * Its home surface is /profile, which is already auth-gated.
-- Anonymous scoring itself is untouched — /m/{id}/overlay still works with no
-- account. The account only buys the *permanent* URL.
--
-- Schema supports N URLs per account (multi-court: one OBS source each). The
-- v1 UI creates exactly one and only reveals the picker at 2+.

create table public.dynamic_urls (
    id               text primary key,                        -- ULID, unguessable; the OBS handle
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now(),
    -- Cascade, not set-null: an ownerless dynamic URL would be a permanently
    -- unrebindable pointer that anyone could still read.
    owner_id         uuid not null references auth.users(id) on delete cascade,
    -- Operator-facing label, shown in the picker and inline on the match page
    -- ("Showing on MacBook Air 13 stream"). Capped because it renders in both
    -- of those single-line slots. Default is a placeholder meant to be
    -- overwritten, not a name to live with.
    name             text not null default 'Stream 1'
                     check (char_length(name) between 1 and 40),
    -- What OBS is currently rendering. NULL = nothing bound; the overlay
    -- renders fully transparent in that state (see below).
    current_match_id text references public.matches(id) on delete set null,
    -- Distinguishes "never bound" from "deliberately unbound". Auto-bind on
    -- match creation fires ONLY while this is NULL; without the column,
    -- clearing the URL during a break and then prepping the next match would
    -- silently push it on air.
    first_bound_at   timestamptz
);

create index dynamic_urls_owner_id_idx on public.dynamic_urls (owner_id);

-- Generic despite the name — sets new.updated_at = now(). Reused rather than
-- duplicated; see the initial schema migration.
drop trigger if exists dynamic_urls_bump_updated_at on public.dynamic_urls;
create trigger dynamic_urls_bump_updated_at
    before update on public.dynamic_urls
    for each row execute function public.matches_bump_updated_at();

-- Realtime is the whole point: the operator rebinds on a phone and the OBS
-- browser source on a laptop swaps within a second off this UPDATE.
alter publication supabase_realtime add table public.dynamic_urls;

-- Row-Level Security ---------------------------------------------------------
alter table public.dynamic_urls enable row level security;

-- Read is PUBLIC BY ID, deliberately, and this asymmetry is load-bearing:
-- OBS's embedded browser is never authenticated, so a policy requiring
-- auth.uid() here would 403 the overlay in the one place the feature has to
-- work. Same trust model as matches_read_by_id — the id is the access token.
-- Reading only reveals which match is currently on air, which is by
-- definition already on screen.
create policy "dynamic_urls_read_by_id" on public.dynamic_urls
    for select using (true);

-- Writes are owner-only. This is what makes the URL safe to reuse on air:
-- knowing the id lets you watch it, never redirect it.
create policy "dynamic_urls_insert_own" on public.dynamic_urls
    for insert to authenticated
    with check (owner_id = (select auth.uid()));

create policy "dynamic_urls_update_own" on public.dynamic_urls
    for update to authenticated
    using (owner_id = (select auth.uid()))
    with check (owner_id = (select auth.uid()));

create policy "dynamic_urls_delete_own" on public.dynamic_urls
    for delete to authenticated
    using (owner_id = (select auth.uid()));

-- Explicit grants. The default-privileges rule from the explicit_table_grants
-- migration would hand anon full DML here; RLS blocks it, but GRANTs are
-- checked first and defense-in-depth is cheap. anon reads only.
grant select                          on public.dynamic_urls to anon;
grant select, insert, update, delete  on public.dynamic_urls to authenticated, service_role;
revoke insert, update, delete         on public.dynamic_urls from anon;
