-- ────────────────────────────────────────────────────────────────────────────
-- sb-mono — local development seed
-- ────────────────────────────────────────────────────────────────────────────
-- Run: pnpm supabase:reset (loads migrations + this seed)
--
-- All seed users have password: 'password'
-- Bcrypt hash matches the well-known dev hash used by np-mono so devs can
-- copy/paste credentials between projects.
-- ────────────────────────────────────────────────────────────────────────────

set session_replication_role = replica;

-- ────────────────────────────────────────────────────────────────────────────
--  AUTH USERS — Personas, plus an admin
-- ────────────────────────────────────────────────────────────────────────────
-- These users land in v2 (Pro tier launch). v1 matches are anonymous, but
-- having seed users now lets the academy network / Pro flows be exercised
-- end-to-end during v2 development without one-off setup.

insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
   confirmation_token, recovery_token, email_change_token_new, email_change,
   raw_app_meta_data, raw_user_meta_data,
   created_at, updated_at,
   is_super_admin, is_anonymous, is_sso_user)
values
  ('00000000-0000-0000-0000-000000000000',
   'a0000000-0000-4000-8000-000000000001'::uuid,
   'authenticated', 'authenticated', 'admin@scoreboard.com',
   '$2a$10$t8mbMwzHJ4Wv69Z5W7X12.dnxBOyLyKl9ibFVFqoRSbflloFYg98y',
   now(), '', '', '', '',
   '{"provider":"email","providers":["email"]}',
   '{"email_verified":true,"name":"Admin","role":"admin"}',
   now(), now(),
   true, false, false),

  ('00000000-0000-0000-0000-000000000000',
   'a0000000-0000-4000-8000-000000000002'::uuid,
   'authenticated', 'authenticated', 'coach@scoreboard.com',
   '$2a$10$t8mbMwzHJ4Wv69Z5W7X12.dnxBOyLyKl9ibFVFqoRSbflloFYg98y',
   now(), '', '', '', '',
   '{"provider":"email","providers":["email"]}',
   '{"email_verified":true,"name":"Coach Sharma","role":"coach","academy":"Xperience Academy"}',
   now(), now(),
   false, false, false),

  ('00000000-0000-0000-0000-000000000000',
   'a0000000-0000-4000-8000-000000000003'::uuid,
   'authenticated', 'authenticated', 'streamer@scoreboard.com',
   '$2a$10$t8mbMwzHJ4Wv69Z5W7X12.dnxBOyLyKl9ibFVFqoRSbflloFYg98y',
   now(), '', '', '', '',
   '{"provider":"email","providers":["email"]}',
   '{"email_verified":true,"name":"Arjun (OBS streamer)","role":"streamer"}',
   now(), now(),
   false, false, false),

  ('00000000-0000-0000-0000-000000000000',
   'a0000000-0000-4000-8000-000000000004'::uuid,
   'authenticated', 'authenticated', 'player@scoreboard.com',
   '$2a$10$t8mbMwzHJ4Wv69Z5W7X12.dnxBOyLyKl9ibFVFqoRSbflloFYg98y',
   now(), '', '', '', '',
   '{"provider":"email","providers":["email"]}',
   '{"email_verified":true,"name":"Priya","role":"player"}',
   now(), now(),
   false, false, false);

-- Identities — required for password login on modern Supabase Auth.
insert into auth.identities
  (id, user_id, identity_data, provider, provider_id,
   last_sign_in_at, created_at, updated_at)
values
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000001'::uuid,
   '{"sub":"a0000000-0000-4000-8000-000000000001","email":"admin@scoreboard.com","email_verified":true}',
   'email', 'a0000000-0000-4000-8000-000000000001', now(), now(), now()),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000002'::uuid,
   '{"sub":"a0000000-0000-4000-8000-000000000002","email":"coach@scoreboard.com","email_verified":true}',
   'email', 'a0000000-0000-4000-8000-000000000002', now(), now(), now()),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000003'::uuid,
   '{"sub":"a0000000-0000-4000-8000-000000000003","email":"streamer@scoreboard.com","email_verified":true}',
   'email', 'a0000000-0000-4000-8000-000000000003', now(), now(), now()),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000004'::uuid,
   '{"sub":"a0000000-0000-4000-8000-000000000004","email":"player@scoreboard.com","email_verified":true}',
   'email', 'a0000000-0000-4000-8000-000000000004', now(), now(), now());

set session_replication_role = default;

-- ────────────────────────────────────────────────────────────────────────────
--  PUBLIC PROFILES + ROLES
-- ────────────────────────────────────────────────────────────────────────────
-- The on_auth_user_created trigger is bypassed by session_replication_role=replica
-- above (we need that to bulk-insert auth.users without firing it once per row).
-- Re-create the rows it would have inserted so the seed is consistent end-state.

insert into public.users (id, email, display_name, avatar_url) values
  ('a0000000-0000-4000-8000-000000000001'::uuid, 'admin@scoreboard.com',    split_part('admin@scoreboard.com',    '@', 1), null),
  ('a0000000-0000-4000-8000-000000000002'::uuid, 'coach@scoreboard.com',    split_part('coach@scoreboard.com',    '@', 1), null),
  ('a0000000-0000-4000-8000-000000000003'::uuid, 'streamer@scoreboard.com', split_part('streamer@scoreboard.com', '@', 1), null),
  ('a0000000-0000-4000-8000-000000000004'::uuid, 'player@scoreboard.com',   split_part('player@scoreboard.com',   '@', 1), null)
on conflict (id) do nothing;

insert into public.user_roles (user_id, role) values
  ('a0000000-0000-4000-8000-000000000001'::uuid, 'admin'::public.app_role),
  ('a0000000-0000-4000-8000-000000000002'::uuid, 'free'::public.app_role),
  ('a0000000-0000-4000-8000-000000000003'::uuid, 'free'::public.app_role),
  ('a0000000-0000-4000-8000-000000000004'::uuid, 'free'::public.app_role)
on conflict (user_id, role) do nothing;

-- ────────────────────────────────────────────────────────────────────────────
--  MATCHES — three demo matches across personas
-- ────────────────────────────────────────────────────────────────────────────
-- Match 1: Live match owned by the streamer (Persona B)
-- Match 2: Completed final owned by the coach (academy preview)
-- Match 3: Anonymous match (Persona A — Sunday phone streamer)

insert into public.matches
  (id, owner_id, sport_family, sport_preset, config,
   overlay_theme_id, scoreboard_theme_id, colors,
   started_at, court_label, round, category, venue)
values
  ('01HZSBM00000DEMOLIVE0000001',
   'a0000000-0000-4000-8000-000000000003'::uuid,
   'racquet', 'badminton-21',
   '{"sport":"badminton","displayName":"Badminton (21-point, BWF)","pointsPerGame":21,"winBy":2,"cap":30,"gamesToWin":2,"intervalAt":11}'::jsonb,
   'broadcast-classic', 'filmable',
   '{"a":"#dc2626","b":"#2563eb"}'::jsonb,
   to_timestamp(1), 'Court 3', 'QF', 'Men''s Doubles U-19', 'Xperience Academy'),

  ('01HZSBM00000DEMODONE0000002',
   'a0000000-0000-4000-8000-000000000002'::uuid,
   'racquet', 'badminton-21',
   '{"sport":"badminton","displayName":"Badminton (21-point, BWF)","pointsPerGame":21,"winBy":2,"cap":30,"gamesToWin":2,"intervalAt":11}'::jsonb,
   'broadcast-classic', 'filmable',
   '{"a":"#dc2626","b":"#2563eb"}'::jsonb,
   to_timestamp(1), 'Court 1', 'F', 'Mixed Doubles', 'Xperience Academy'),

  ('01HZSBM00000DEMOANON0000003',
   null,
   'racquet', 'badminton-21',
   '{"sport":"badminton","displayName":"Badminton (21-point, BWF)","pointsPerGame":21,"winBy":2,"cap":30,"gamesToWin":2,"intervalAt":11}'::jsonb,
   'broadcast-classic', 'filmable',
   '{"a":"#dc2626","b":"#2563eb"}'::jsonb,
   to_timestamp(1), 'Court 2', null, null, null);

-- ────────────────────────────────────────────────────────────────────────────
--  EVENTS — replay each match's history
-- ────────────────────────────────────────────────────────────────────────────

-- Match 1 (live, mid-game): A leading 5–1 in game 1
insert into public.events (id, match_id, device_id, ts, type, payload) values
  ('01HZSBME00000LIVE000000M001', '01HZSBM00000DEMOLIVE0000001', 'seed', to_timestamp(1),
   'match.start', '{"serverSide":"A","serverCourt":"right"}'::jsonb),
  ('01HZSBME00000LIVE000000P001', '01HZSBM00000DEMOLIVE0000001', 'seed', to_timestamp(1.1),
   'point', '{"side":"A"}'::jsonb),
  ('01HZSBME00000LIVE000000P002', '01HZSBM00000DEMOLIVE0000001', 'seed', to_timestamp(1.2),
   'point', '{"side":"A"}'::jsonb),
  ('01HZSBME00000LIVE000000P003', '01HZSBM00000DEMOLIVE0000001', 'seed', to_timestamp(1.3),
   'point', '{"side":"B"}'::jsonb),
  ('01HZSBME00000LIVE000000P004', '01HZSBM00000DEMOLIVE0000001', 'seed', to_timestamp(1.4),
   'point', '{"side":"A"}'::jsonb),
  ('01HZSBME00000LIVE000000P005', '01HZSBM00000DEMOLIVE0000001', 'seed', to_timestamp(1.5),
   'point', '{"side":"A"}'::jsonb),
  ('01HZSBME00000LIVE000000P006', '01HZSBM00000DEMOLIVE0000001', 'seed', to_timestamp(1.6),
   'point', '{"side":"A"}'::jsonb);

-- Match 2 (completed): authoritative score.correct sets the final state.
-- This proves event-sourcing works end-to-end without 42 individual point events.
insert into public.events (id, match_id, device_id, ts, type, payload) values
  ('01HZSBME00000DONE000000M001', '01HZSBM00000DEMODONE0000002', 'seed', to_timestamp(1),
   'match.start', '{"serverSide":"A","serverCourt":"right"}'::jsonb),
  ('01HZSBME00000DONE000000C001', '01HZSBM00000DEMODONE0000002', 'seed', to_timestamp(1.5),
   'score.correct',
   '{"games":[{"a":21,"b":17},{"a":21,"b":14}],"gamesWon":{"a":2,"b":0}}'::jsonb);

-- Match 3 (anonymous, just started): 0–0 fresh match
insert into public.events (id, match_id, device_id, ts, type, payload) values
  ('01HZSBME00000ANON000000M001', '01HZSBM00000DEMOANON0000003', 'seed', to_timestamp(1),
   'match.start', '{"serverSide":"A","serverCourt":"right"}'::jsonb);
