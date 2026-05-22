-- sb-mono initial schema
-- Event-sourced: matches table holds metadata + config; events table is the append-only log.
--
-- RLS shape (Option A — free anonymous scorer):
--   * Anyone (anon or authed) can READ any match/event by id. The match URL is the access token.
--   * Authenticated users INSERT matches with owner_id = auth.uid() and a 'match.create' permission.
--   * Anonymous users INSERT matches with owner_id = NULL.
--   * Owners UPDATE/DELETE their own matches (with the corresponding permission).
--   * Anonymous matches (owner_id IS NULL) stay open to anon and authed UPDATE.
--   * Events follow the same gating via the parent match's owner_id.
--
-- Per-match write tokens for delegated scoring are deferred to E2.8.

create extension if not exists "uuid-ossp";

create table public.matches (
    id              text primary key,                       -- ULID
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    owner_id        uuid references auth.users(id) on delete set null,
    sport_family    text not null check (sport_family in ('racquet')),
    sport_preset    text not null,                          -- e.g., 'badminton-21', 'badminton-15'
    config          jsonb not null default '{}'::jsonb,
    overlay_theme_id    text not null default 'broadcast-classic',
    scoreboard_theme_id text not null default 'filmable',
    colors          jsonb not null default '{"a": "#dc2626", "b": "#2563eb"}'::jsonb,
    started_at      timestamptz,                            -- null until first point
    -- Set when the engine reports match-over (won, walkover, retirement,
    -- black card). Used by the token RPCs (E2.8) to auto-revoke co-scorer
    -- access — once the match is over there's no legitimate reason a
    -- token-holder should still be writing events. Owners can keep writing
    -- (corrections / un-end via score.correct) regardless of this column.
    ended_at        timestamptz,
    -- Display metadata mirrored from `sb:meta:{matchId}` localStorage so any
    -- device opening the overlay (OBS on a laptop, phone of a co-scorer) can
    -- render team / player / tournament info without sharing localStorage.
    is_doubles      boolean not null default false,
    team_name_a     text,
    team_name_b     text,
    players         jsonb not null default '{}'::jsonb,     -- { a1, a2, b1, b2 }
    event_name      text,
    court_label     text,
    round           text,
    category        text,
    venue           text,
    -- Per-match write token (E2.8). NULL until the owner generates a
    -- co-scorer invite link. Embedded in the URL as `?wt=…`; validated by
    -- the `append_event_with_token` / `delete_events_with_token` RPCs so
    -- holders can score without owning the match. Only owned matches use
    -- this — anonymous matches stay open to anyone with the URL.
    write_token     text,
    -- Soft handoff lock (E2.8). The device_id that most recently appended
    -- an event is the "active scorer"; other devices loading /control see
    -- a read-only banner with a "Score from this device" reclaim button.
    -- Updated automatically by the events_bump_active_scorer trigger when
    -- a different device writes; the reclaim button calls claim_scoring
    -- to flip it without waiting for the first event. NULL until first
    -- event (or first explicit claim) — in that state every device is
    -- enabled so the bootstrap tap can happen.
    active_scorer_device_id text,
    active_scorer_at        timestamptz
);

create index matches_owner_id_idx on public.matches (owner_id);
create index matches_updated_at_idx on public.matches (updated_at desc);

create table public.events (
    id              text primary key,                       -- ULID, sortable + globally unique
    match_id        text not null references public.matches(id) on delete cascade,
    device_id       text not null,
    ts              timestamptz not null,                   -- client clock at write time
    type            text not null,
    payload         jsonb not null default '{}'::jsonb,
    inserted_at     timestamptz not null default now()
);

create index events_match_id_ts_idx on public.events (match_id, ts);
create index events_match_id_id_idx on public.events (match_id, id);

-- Bump matches.updated_at on row update so the "recent matches" list (sorted
-- by updated_at desc) reflects actual recency, not just creation order.
create or replace function public.matches_bump_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists matches_bump_updated_at on public.matches;
create trigger matches_bump_updated_at
    before update on public.matches
    for each row execute function public.matches_bump_updated_at();

-- Stamp the "active scorer" device on the parent match whenever a new
-- event is appended. The trigger is a no-op when the device hasn't
-- changed, which keeps Realtime UPDATE noise off the matches row during
-- a single scorer's normal play. When a *different* device writes (or
-- the very first event of the match), the column flips and Realtime
-- pushes the change to every viewer — that's how passive devices learn
-- they need to disable their score buttons.
create or replace function public.events_bump_active_scorer()
returns trigger
language plpgsql
as $$
begin
    update public.matches
        set active_scorer_device_id = NEW.device_id,
            active_scorer_at        = NEW.ts
        where id = NEW.match_id
          and active_scorer_device_id is distinct from NEW.device_id;
    return NEW;
end;
$$;

drop trigger if exists events_bump_active_scorer on public.events;
create trigger events_bump_active_scorer
    after insert on public.events
    for each row execute function public.events_bump_active_scorer();

-- Realtime: enable for both tables so subscribers can watch events appended in real time.
alter publication supabase_realtime add table public.matches;
alter publication supabase_realtime add table public.events;

-- Row-Level Security ---------------------------------------------------------
alter table public.matches enable row level security;
alter table public.events  enable row level security;

-- Public read by id (URL = access token).
create policy "matches_read_by_id" on public.matches
    for select using (true);

create policy "events_read_by_match" on public.events
    for select using (true);

-- Permission-gated policies on matches/events depend on public.authorize(),
-- which is defined in the roles_and_permissions migration. We split the
-- mutation policies into that migration to keep the dependency order clean.
