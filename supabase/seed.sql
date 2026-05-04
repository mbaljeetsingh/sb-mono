-- Seed data for local development.
-- Creates one example badminton match with a few scored points.

insert into public.matches (id, sport_family, sport_preset, config, theme_id) values
  ('01HZSEED0000DEMOMATCHID0001', 'racquet', 'badminton-21',
   '{"sport":"badminton","displayName":"Badminton (21-point, BWF)","pointsPerGame":21,"winBy":2,"cap":30,"gamesToWin":2,"intervalAt":11}'::jsonb,
   'broadcast-classic');

insert into public.events (id, match_id, device_id, ts, type, payload) values
  ('01HZSEED0010MATCHSTART00001', '01HZSEED0000DEMOMATCHID0001', 'seed', 1000, 'match.start',
   '{"serverSide":"A","serverCourt":"right"}'::jsonb),
  ('01HZSEED0011POINT0000000001', '01HZSEED0000DEMOMATCHID0001', 'seed', 2000, 'point',
   '{"side":"A"}'::jsonb),
  ('01HZSEED0012POINT0000000002', '01HZSEED0000DEMOMATCHID0001', 'seed', 3000, 'point',
   '{"side":"B"}'::jsonb),
  ('01HZSEED0013POINT0000000003', '01HZSEED0000DEMOMATCHID0001', 'seed', 4000, 'point',
   '{"side":"A"}'::jsonb);
