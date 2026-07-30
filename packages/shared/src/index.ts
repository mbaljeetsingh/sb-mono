// Shared types and constants for sb-mono. Re-export only from here.

export type { Database, Json } from './types/supabase';

/** What sport family a match belongs to — determines which engine + UI to load. */
export type SportFamily = 'racquet';

/** Match record persisted in Supabase. State is computed from the events relation. */
export type MatchRecord = {
  id: string;
  created_at: string;
  updated_at: string;
  /** ULID. Owner is anonymous in v1 (browser-stored); user_id arrives with Pro. */
  owner_id: string | null;
  sport_family: SportFamily;
  sport_preset: string;
  /** Free-form sport config (e.g., RacquetConfig). Stored as JSONB in Postgres. */
  config: Record<string, unknown>;
  /** Theme ID applied at render time. */
  theme_id: string;
  /** Hex colors per side. */
  colors: { a: string; b: string };
  /** ISO 8601 timestamp when the match was actually started; null until first event. */
  started_at: string | null;
};

export type EventRecord = {
  id: string;
  match_id: string;
  /** Originating device — used for offline-merge tie-breaks. */
  device_id: string;
  /** ISO 8601 timestamp at write time (client clock). */
  ts: string;
  /** Discriminator — one of the sport-family event types. */
  type: string;
  /** Event-specific payload (everything except id, ts, type). */
  payload: Record<string, unknown>;
};
