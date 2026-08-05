-- Fourward — Supabase schema
-- Run this once in the Supabase SQL editor (Dashboard → SQL → New query).
--
-- Prototype scope: one shared demo user, no auth. The anon key is meant to
-- be public — access is controlled by the policies below, not by hiding the
-- key. Before this goes anywhere real, swap `user_id text` for a reference
-- to auth.users and scope every policy to auth.uid().

create table if not exists sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       text        not null default 'demo',
  date          date        not null,
  planned_min   int         not null,
  focused_min   int         not null default 0,
  distractions  jsonb       not null default '[]'::jsonb,
  created_at    timestamptz not null default now()
);

create table if not exists reframes (
  id          uuid primary key default gen_random_uuid(),
  user_id     text        not null default 'demo',
  input       text        not null,
  distortion  text,
  response    text,
  created_at  timestamptz not null default now()
);

create index if not exists sessions_user_date_idx on sessions (user_id, date desc);
create index if not exists reframes_user_created_idx on reframes (user_id, created_at desc);

-- Row Level Security is ON, with policies that permit the anon role on the
-- demo user only. Nothing is world-writable by accident.
alter table sessions enable row level security;
alter table reframes enable row level security;

drop policy if exists sessions_demo_read  on sessions;
drop policy if exists sessions_demo_write on sessions;
drop policy if exists reframes_demo_read  on reframes;
drop policy if exists reframes_demo_write on reframes;

create policy sessions_demo_read  on sessions for select using (user_id = 'demo');
create policy sessions_demo_write on sessions for insert with check (user_id = 'demo');
create policy reframes_demo_read  on reframes for select using (user_id = 'demo');
create policy reframes_demo_write on reframes for insert with check (user_id = 'demo');
