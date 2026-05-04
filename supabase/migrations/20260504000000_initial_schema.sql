-- sb-mono initial schema
-- Event-sourced: matches table holds metadata + config; events table is the append-only log.

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
    started_at      bigint                                  -- ms since epoch; null until first point
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

-- Row-Level Security
-- v1 model: anonymous matches are readable by anyone with the match id (it's a UUID-ish secret).
-- Authenticated users own their matches when owner_id is set.
alter table public.matches enable row level security;
alter table public.events enable row level security;

-- Anyone can read any match by id (the id itself is the access token in v1).
create policy "matches_read_by_id" on public.matches
    for select using (true);

-- Anyone can insert anonymous matches; signed-in users insert with their owner_id.
create policy "matches_insert_open" on public.matches
    for insert with check (owner_id is null or owner_id = auth.uid());

-- Only owner can update their matches; anonymous matches are immutable in metadata
-- (event log carries the truth).
create policy "matches_update_owner" on public.matches
    for update using (owner_id is not null and owner_id = auth.uid())
    with check (owner_id = auth.uid());

-- Events: anyone can read events for any match (overlay/scoreboard surfaces).
create policy "events_read_by_match" on public.events
    for select using (true);

-- Events: anyone can append. The owner check happens at the match level.
-- (v1: trust event log writers. Tighten in v2 with a per-match write token.)
create policy "events_insert_open" on public.events
    for insert with check (true);

-- Trigger: bump matches.updated_at when a new event lands.
create or replace function public.bump_match_updated_at()
returns trigger as $$
begin
    update public.matches
    set updated_at = now(),
        started_at = coalesce(started_at, new.ts)
    where id = new.match_id;
    return new;
end;
$$ language plpgsql;

create trigger events_bump_match
    after insert on public.events
    for each row execute function public.bump_match_updated_at();
