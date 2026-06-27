-- The Nightstand — admin / member management (Phase A)
-- Run once: Supabase dashboard → SQL Editor → New query → paste → Run.
-- Safe to re-run. Already folded into schema.sql.

-- Member status. 'archived' = keeps all their shelves/data + the FREE Google Books
-- covers, but the advisor function refuses the paid Anthropic calls (no charges).
alter table public.profiles
  add column if not exists status text not null default 'active';

-- ── How to archive / restore someone by hand (until the Admin UI lands) ──
-- Archive:
--   update public.profiles set status = 'archived'
--   where id = (select id from auth.users where email = 'friend@example.com');
-- Restore:
--   update public.profiles set status = 'active'
--   where id = (select id from auth.users where email = 'friend@example.com');

-- ── Waitlist (public interest from the landing page) ──────────────────────
-- Logged-out visitors can add themselves; only you can read it (via the admin fn).
create table if not exists public.waitlist (
  id         uuid primary key default gen_random_uuid(),
  name       text,
  email      text not null,
  note       text,
  created_at timestamptz default now()
);
alter table public.waitlist enable row level security;
drop policy if exists waitlist_insert on public.waitlist;
create policy waitlist_insert on public.waitlist for insert with check (true);
