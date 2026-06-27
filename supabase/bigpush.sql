-- The Nightstand — "big push" database additions.
-- Run once: Supabase dashboard → SQL Editor → New query → paste all → Run.
-- Safe to re-run (idempotent). Already folded into schema.sql too.

-- 1) Per-shelf-item availability + Libby hold ────────────────────────────────
alter table public.shelf_items add column if not exists availability text[] default '{}';
alter table public.shelf_items add column if not exists libby_hold   boolean default false;

-- 2) Advisor call log → per-user API rate limiting ───────────────────────────
create table if not exists public.advisor_calls (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);
create index if not exists advisor_calls_user_time
  on public.advisor_calls (user_id, created_at desc);
alter table public.advisor_calls enable row level security;
drop policy if exists advisor_calls_own on public.advisor_calls;
create policy advisor_calls_own on public.advisor_calls for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
