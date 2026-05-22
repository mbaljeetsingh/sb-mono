-- E2.8 — per-match write tokens for delegated scoring.
--
-- pgcrypto provides gen_random_bytes() — used below to mint opaque write
-- tokens. The extension isn't enabled by the initial schema (which only
-- uses uuid-ossp), so we enable it here for self-containment.
create extension if not exists pgcrypto;


--
-- Threat model: anonymous matches stay open (URL = access token). Owned
-- matches default to owner-only scoring; the owner can mint a short opaque
-- token, embed it in `/m/[id]/control?wt=<token>`, and hand the link to a
-- co-scorer (typically via QR). Two SECURITY DEFINER RPCs gate the writes:
--   * append_event_with_token   — co-scorer inserts an event.
--   * delete_events_with_token  — co-scorer undo / score-correct path.
-- Both validate matches.write_token = caller-supplied token before touching
-- the events table, so RLS for owned-match writes stays strict.
--
-- Regeneration: owner calls regenerate_write_token() to mint or rotate the
-- token. Rotation invalidates any outstanding co-scorer links in one shot.
-- Token format: 18 random bytes → URL-safe base64 (24 chars, ~144 bits).

create or replace function public.regenerate_write_token(p_match_id text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_owner uuid;
    v_token text;
begin
    select owner_id into v_owner from public.matches where id = p_match_id;
    if not found then
        raise exception 'match not found' using errcode = 'PGRST';
    end if;
    if v_owner is null then
        -- Anon matches are URL-gated by design; a token would be redundant.
        raise exception 'anonymous matches do not use write tokens';
    end if;
    if v_owner is distinct from auth.uid() then
        raise exception 'not the owner of this match';
    end if;

    -- pgcrypto lives in the `extensions` schema on Supabase; our function
    -- runs with an empty search_path so we must fully qualify.
    v_token := encode(extensions.gen_random_bytes(18), 'base64');
    -- URL-safe (drop padding, swap + and /).
    v_token := replace(replace(replace(v_token, '+', '-'), '/', '_'), '=', '');

    update public.matches set write_token = v_token where id = p_match_id;
    return v_token;
end;
$$;

grant execute on function public.regenerate_write_token(text) to authenticated;
revoke execute on function public.regenerate_write_token(text) from anon, public;


create or replace function public.append_event_with_token(
    p_match_id  text,
    p_token     text,
    p_event_id  text,
    p_device_id text,
    p_ts        timestamptz,
    p_type      text,
    p_payload   jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_token text;
    v_ended timestamptz;
begin
    if p_token is null or length(p_token) = 0 then
        raise exception 'write token required';
    end if;
    select write_token, ended_at into v_token, v_ended
        from public.matches where id = p_match_id;
    if v_token is null or v_token is distinct from p_token then
        raise exception 'invalid write token';
    end if;
    if v_ended is not null then
        raise exception 'match has ended; token-path writes are revoked';
    end if;
    insert into public.events (id, match_id, device_id, ts, type, payload)
    values (p_event_id, p_match_id, p_device_id, p_ts, p_type, coalesce(p_payload, '{}'::jsonb))
    on conflict (id) do nothing;
end;
$$;

grant execute on function public.append_event_with_token(text, text, text, text, timestamptz, text, jsonb) to anon, authenticated;


create or replace function public.delete_events_with_token(
    p_match_id  text,
    p_token     text,
    p_event_ids text[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_token text;
    v_ended timestamptz;
begin
    if p_token is null or length(p_token) = 0 then
        raise exception 'write token required';
    end if;
    select write_token, ended_at into v_token, v_ended
        from public.matches where id = p_match_id;
    if v_token is null or v_token is distinct from p_token then
        raise exception 'invalid write token';
    end if;
    if v_ended is not null then
        raise exception 'match has ended; token-path writes are revoked';
    end if;
    delete from public.events
        where match_id = p_match_id
          and id = any(p_event_ids);
end;
$$;

grant execute on function public.delete_events_with_token(text, text, text[]) to anon, authenticated;


-- Take-over / handoff. Lets a device claim the "active scorer" slot
-- without writing an event first. The trigger on events keeps the slot
-- in sync once scoring resumes, so this is the *bootstrap* path:
--   * Tablet B opens /control mid-match → sees Phone A is active →
--     taps "Score from this device" → this RPC flips the slot to B.
-- Access policy mirrors the event-write paths: owners, anon-match callers,
-- and valid token holders can all claim. Token holders also need
-- matches.ended_at to be NULL, matching append_event_with_token.
create or replace function public.claim_scoring(
    p_match_id  text,
    p_device_id text,
    p_token     text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_owner uuid;
    v_token text;
    v_ended timestamptz;
begin
    if p_device_id is null or length(p_device_id) = 0 then
        raise exception 'device id required';
    end if;
    select owner_id, write_token, ended_at into v_owner, v_token, v_ended
        from public.matches where id = p_match_id;
    if not found then
        raise exception 'match not found';
    end if;

    if v_owner is null then
        -- Anonymous match: any caller may claim.
        null;
    elsif v_owner is not distinct from auth.uid() then
        -- Owner: always may claim.
        null;
    elsif p_token is not null and v_token is not null and p_token = v_token then
        -- Token holder: must also pass the same ended-at check the event
        -- RPCs enforce, otherwise we'd let revoked tokens reclaim post-end.
        if v_ended is not null then
            raise exception 'match has ended; token-path writes are revoked';
        end if;
    else
        raise exception 'not authorised to claim scoring for this match';
    end if;

    update public.matches
        set active_scorer_device_id = p_device_id,
            active_scorer_at        = now()
        where id = p_match_id
          and active_scorer_device_id is distinct from p_device_id;
end;
$$;

grant execute on function public.claim_scoring(text, text, text) to anon, authenticated;
