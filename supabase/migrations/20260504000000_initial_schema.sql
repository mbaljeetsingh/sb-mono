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
    sport_family    text not null check (sport_family in ('racquet', 'cricket')),
    sport_preset    text not null,                          -- e.g., 'badminton-21', 'badminton-15'
    config          jsonb not null default '{}'::jsonb,
    theme_id        text not null default 'broadcast-classic',
    colors          jsonb not null default '{"a": "#dc2626", "b": "#2563eb"}'::jsonb,
    started_at      bigint,                                 -- ms since epoch; null until first point
    court_label     text,
    round           text,
    category        text,
    venue           text
);

create index matches_owner_id_idx on public.matches (owner_id);
create index matches_updated_at_idx on public.matches (updated_at desc);

create table public.events (
    id              text primary key,                       -- ULID, sortable + globally unique
    match_id        text not null references public.matches(id) on delete cascade,
    device_id       text not null,
    ts              bigint not null,                        -- ms since epoch (Date.now() at write time)
    type            text not null,
    payload         jsonb not null default '{}'::jsonb,
    inserted_at     timestamptz not null default now()
);

create index events_match_id_ts_idx on public.events (match_id, ts);
create index events_match_id_id_idx on public.events (match_id, id);

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
