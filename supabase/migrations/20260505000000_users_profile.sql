-- Public users profile table.
-- Mirrors auth.users by id; holds display_name, avatar_url, contact email.
-- Populated by the on_auth_user_created trigger (see roles_and_permissions migration).

create table if not exists public.users (
    id              uuid primary key references auth.users(id) on delete cascade,
    email           text,
    display_name    text,
    avatar_url      text,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

create index if not exists users_email_idx on public.users (email);

alter table public.users enable row level security;

-- Public profiles are readable by anyone (display_name + avatar shown on shared scoreboards).
create policy "users_read_public" on public.users
    for select using (true);

-- Owners update their own profile.
create policy "users_update_own" on public.users
    for update using (id = auth.uid())
    with check (id = auth.uid());

-- Bump updated_at on row update.
create or replace function public.users_bump_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists users_bump_updated_at on public.users;
create trigger users_bump_updated_at
    before update on public.users
    for each row execute function public.users_bump_updated_at();
