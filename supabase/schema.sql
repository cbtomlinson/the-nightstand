-- ============================================================================
-- The Nightstand — database schema
-- Run this in Supabase: SQL Editor → New query → paste all → Run.
-- Safe to re-run (idempotent).
--
-- Model: a small PRIVATE book club. Only allow-listed emails get a profile.
-- Each member's data is private by default; "public" shelf items + the feed
-- are visible to fellow members. Row-Level Security enforces all of this.
-- ============================================================================

-- (No CREATE EXTENSION needed — gen_random_uuid() is built into Postgres on Supabase.)

-- ── 1) Invite allowlist ────────────────────────────────────────────────────
create table if not exists public.allowed_emails (
  email      text primary key,
  invited_by uuid,
  created_at timestamptz default now()
);

-- Seed the first member (you). Add friends later with:
--   insert into public.allowed_emails(email) values ('friend@example.com');
insert into public.allowed_emails (email)
values ('tomlinson.chelsea@gmail.com')
on conflict (email) do nothing;

-- ── 2) Profiles (1 per user) ───────────────────────────────────────────────
create table if not exists public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  email               text,
  display_name        text,
  avatar_emoji        text default '📚',
  bio                 text,
  mood                text,
  reading_profile     jsonb default '{}'::jsonb,   -- loves / dislikes / patterns / exceptions / shape
  onboarding_complete boolean default false,
  status              text not null default 'active' check (status in ('active','archived')),
  created_at          timestamptz default now()
);
-- (existing installs) add the column if it's not there yet:
alter table public.profiles add column if not exists status text not null default 'active';

-- ── 3) Books (shared catalog) ──────────────────────────────────────────────
create table if not exists public.books (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  author      text,
  cover_url   text,
  cover_color text,
  isbn        text,
  meta        jsonb default '{}'::jsonb,            -- genre / pace / tags / narration
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz default now()
);
create unique index if not exists books_title_author_key
  on public.books (lower(title), lower(coalesce(author, '')));

-- ── 4) Shelf items (the heart) ─────────────────────────────────────────────
create table if not exists public.shelf_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  book_id     uuid not null references public.books(id) on delete cascade,
  status      text not null check (status in ('to_read','reading','finished','dnf')),
  rating      int  check (rating between 1 and 5),
  progress    int  default 0,
  started_at  date,
  finished_at date,
  dnf_at_pct  int,
  dnf_reason  text,
  note        text,
  added_note  text,
  source      text,                                 -- 'me' | 'friend'
  is_public   boolean default true,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  unique (user_id, book_id)
);

-- ── 5) Reflections (interview transcripts; private) ────────────────────────
create table if not exists public.reflections (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  shelf_item_id uuid references public.shelf_items(id) on delete set null,
  kind          text check (kind in ('intake','post_read','dnf')),
  transcript    jsonb default '[]'::jsonb,
  insights      jsonb default '{}'::jsonb,
  created_at    timestamptz default now()
);

-- ── 6) Recommendations (each rec is a hypothesis) ──────────────────────────
create table if not exists public.recommendations (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,  -- who it's for
  book_id        uuid references public.books(id) on delete cascade,
  source         text default 'ai',                 -- 'ai' | 'friend'
  recommended_by uuid references auth.users(id) on delete set null,
  rationale      text,
  confidence     int,
  mood_fit       text,
  good           jsonb default '[]'::jsonb,
  warn           jsonb default '[]'::jsonb,
  is_experiment  boolean default false,
  status         text default 'pending' check (status in ('pending','accepted','dismissed')),
  created_at     timestamptz default now()
);

-- ── 7) Buddy reads + private threads ───────────────────────────────────────
create table if not exists public.buddy_reads (
  id         uuid primary key default gen_random_uuid(),
  book_id    uuid references public.books(id) on delete cascade,
  created_by uuid references auth.users(id) on delete cascade,
  member_ids uuid[] not null default '{}',
  status     text default 'active',
  created_at timestamptz default now()
);
create table if not exists public.buddy_read_messages (
  id            uuid primary key default gen_random_uuid(),
  buddy_read_id uuid references public.buddy_reads(id) on delete cascade,
  user_id       uuid references auth.users(id) on delete cascade,
  body          text not null,
  created_at    timestamptz default now()
);

-- ── 8) Badges ──────────────────────────────────────────────────────────────
create table if not exists public.badges (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  description text,
  icon        text
);
create table if not exists public.user_badges (
  user_id   uuid references auth.users(id) on delete cascade,
  badge_id  uuid references public.badges(id) on delete cascade,
  earned_at timestamptz default now(),
  primary key (user_id, badge_id)
);

-- ── 9) Activity feed ───────────────────────────────────────────────────────
create table if not exists public.activity (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  type       text not null,                         -- started|finished|rated|badge|blind|buddy
  payload    jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- ── 10) Helpers ────────────────────────────────────────────────────────────
-- Is the caller a club member (i.e. has a profile)?
create or replace function public.is_member()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid());
$$;

-- On signup: create a profile ONLY if the email is on the allowlist.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.allowed_emails a where lower(a.email) = lower(new.email)) then
    insert into public.profiles (id, email, display_name)
    values (new.id, new.email, split_part(new.email, '@', 1))
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row
  execute function public.handle_new_user();

-- The mirror case: someone is allow-listed AFTER their auth account already
-- exists (e.g. they requested a magic link on the sign-in screen before being
-- invited, so handle_new_user ran while they were NOT yet on the list and made
-- no profile — and the signup trigger never fires again). When an email is added
-- to the allowlist, backfill a profile for any matching existing auth user.
-- Together these two triggers make the profile appear regardless of order.
create or replace function public.backfill_profile_on_allow()
returns trigger language plpgsql security definer set search_path = public, auth as $$
begin
  insert into public.profiles (id, email, display_name)
  select u.id, u.email, split_part(u.email, '@', 1)
  from auth.users u
  where lower(u.email) = lower(new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_allowed_email on public.allowed_emails;
create trigger on_allowed_email
  after insert on public.allowed_emails for each row
  execute function public.backfill_profile_on_allow();

-- ── 11) Row-Level Security ─────────────────────────────────────────────────
alter table public.allowed_emails      enable row level security;
alter table public.profiles            enable row level security;
alter table public.books               enable row level security;
alter table public.shelf_items         enable row level security;
alter table public.reflections         enable row level security;
alter table public.recommendations     enable row level security;
alter table public.buddy_reads         enable row level security;
alter table public.buddy_read_messages enable row level security;
alter table public.badges              enable row level security;
alter table public.user_badges         enable row level security;
alter table public.activity            enable row level security;

-- profiles: members read everyone; you edit only yourself
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select using (public.is_member());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update using (id = auth.uid());
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert with check (id = auth.uid());

-- books: members read + add; you edit your own additions
drop policy if exists books_select on public.books;
create policy books_select on public.books for select using (public.is_member());
drop policy if exists books_insert on public.books;
create policy books_insert on public.books for insert with check (public.is_member());
drop policy if exists books_update on public.books;
create policy books_update on public.books for update using (created_by = auth.uid());

-- shelf_items: you manage yours; members read others' public ones
drop policy if exists shelf_select on public.shelf_items;
create policy shelf_select on public.shelf_items for select
  using (user_id = auth.uid() or (is_public and public.is_member()));
drop policy if exists shelf_insert on public.shelf_items;
create policy shelf_insert on public.shelf_items for insert with check (user_id = auth.uid());
drop policy if exists shelf_update on public.shelf_items;
create policy shelf_update on public.shelf_items for update using (user_id = auth.uid());
drop policy if exists shelf_delete on public.shelf_items;
create policy shelf_delete on public.shelf_items for delete using (user_id = auth.uid());

-- reflections: private to you
drop policy if exists reflections_all on public.reflections;
create policy reflections_all on public.reflections for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- recommendations: visible to recipient or sender; you manage your own
drop policy if exists recs_select on public.recommendations;
create policy recs_select on public.recommendations for select
  using (user_id = auth.uid() or recommended_by = auth.uid());
drop policy if exists recs_insert on public.recommendations;
create policy recs_insert on public.recommendations for insert
  with check (user_id = auth.uid() or recommended_by = auth.uid());
drop policy if exists recs_update on public.recommendations;
create policy recs_update on public.recommendations for update using (user_id = auth.uid());

-- buddy reads: participants only
drop policy if exists buddy_select on public.buddy_reads;
create policy buddy_select on public.buddy_reads for select
  using (auth.uid() = any(member_ids) or created_by = auth.uid());
drop policy if exists buddy_insert on public.buddy_reads;
create policy buddy_insert on public.buddy_reads for insert with check (created_by = auth.uid());
drop policy if exists buddy_update on public.buddy_reads;
create policy buddy_update on public.buddy_reads for update
  using (created_by = auth.uid() or auth.uid() = any(member_ids));

drop policy if exists buddymsg_select on public.buddy_read_messages;
create policy buddymsg_select on public.buddy_read_messages for select
  using (exists (select 1 from public.buddy_reads b
                 where b.id = buddy_read_id
                   and (auth.uid() = any(b.member_ids) or b.created_by = auth.uid())));
drop policy if exists buddymsg_insert on public.buddy_read_messages;
create policy buddymsg_insert on public.buddy_read_messages for insert
  with check (user_id = auth.uid());

-- badges: members read definitions + everyone's earned badges; you earn your own
drop policy if exists badges_select on public.badges;
create policy badges_select on public.badges for select using (public.is_member());
drop policy if exists userbadges_select on public.user_badges;
create policy userbadges_select on public.user_badges for select using (public.is_member());
drop policy if exists userbadges_insert on public.user_badges;
create policy userbadges_insert on public.user_badges for insert with check (user_id = auth.uid());

-- activity: members read the feed; you write your own
drop policy if exists activity_select on public.activity;
create policy activity_select on public.activity for select using (public.is_member());
drop policy if exists activity_insert on public.activity;
create policy activity_insert on public.activity for insert with check (user_id = auth.uid());

-- allowed_emails: members can view + invite (simple club model)
drop policy if exists allowed_select on public.allowed_emails;
create policy allowed_select on public.allowed_emails for select using (public.is_member());
drop policy if exists allowed_insert on public.allowed_emails;
create policy allowed_insert on public.allowed_emails for insert with check (public.is_member());

-- ── 12) Seed badge definitions ─────────────────────────────────────────────
insert into public.badges (slug, name, description, icon) values
  ('honest_dnf',     'Honest DNF',           'Logged a DNF with real reasons',        'flag'),
  ('first_rec',      'First Recommendation', 'Asked your advisor for a rec',          'sparkles'),
  ('kindred',        'Kindred Spirit',       '80%+ taste match with a friend',        'heart'),
  ('twist_seeker',   'Twist Seeker',         'Logged 5 unreliable-narrator reads',    'search'),
  ('genre_explorer', 'Genre Explorer',       'Finished a book outside your usual',    'compass'),
  ('experimentalist','Experimentalist',      'Accepted a reading experiment',         'flask'),
  ('buddy_reader',   'Buddy Reader',         'Finished a buddy read together',        'users'),
  ('marathon',       'Marathon',             'Finished 12 books in a year',           'flame')
on conflict (slug) do nothing;

-- ── 13) Availability + Libby hold (per shelf item) ─────────────────────────
alter table public.shelf_items add column if not exists availability text[] default '{}';
alter table public.shelf_items add column if not exists libby_hold   boolean default false;

-- ── 14) Advisor call log → per-user rate limiting ──────────────────────────
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

-- ── 15) Waitlist (public interest from the landing page) ───────────────────
create table if not exists public.waitlist (
  id         uuid primary key default gen_random_uuid(),
  name       text,
  email      text not null,
  note       text,
  created_at timestamptz default now()
);
alter table public.waitlist enable row level security;
-- Anyone (even logged-out visitors) may add themselves; NOBODY can read it from
-- the client. The owner views it via the service-role admin function.
drop policy if exists waitlist_insert on public.waitlist;
create policy waitlist_insert on public.waitlist for insert with check (true);

-- ── 16) Connections + circle privacy (social slice 1) ──────────────────────
-- A mutual 1:1 friendship, stored canonically (user_a < user_b) so each pair is
-- one row. This is your "Circle": ego-centric — your friends don't see each other
-- through it, only you see all of them.
create table if not exists public.connections (
  user_a     uuid not null references auth.users(id) on delete cascade,
  user_b     uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);
alter table public.connections enable row level security;
drop policy if exists connections_select on public.connections;
create policy connections_select on public.connections for select
  using (auth.uid() = user_a or auth.uid() = user_b);

create or replace function public.are_connected(x uuid, y uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.connections
    where user_a = least(x, y) and user_b = greatest(x, y)
  );
$$;

-- Idempotent helper to connect two users (called by the admin invite function).
create or replace function public.connect_users(x uuid, y uuid)
returns void language sql security definer set search_path = public as $$
  insert into public.connections (user_a, user_b)
  values (least(x, y), greatest(x, y))
  on conflict do nothing;
$$;

-- Tighten visibility now that there's a real graph:
--  • profiles: you see only yourself + people you're connected to.
--  • shelves : yours stay private; connected friends see your currently-reading +
--    finishes from the last ~30 days (for the cozy feed) — never your whole shelf.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  using (id = auth.uid() or public.are_connected(auth.uid(), id));

drop policy if exists shelf_select on public.shelf_items;
create policy shelf_select on public.shelf_items for select using (
  user_id = auth.uid()
  or (is_public and public.are_connected(auth.uid(), user_id) and (
    status = 'reading'
    or (status = 'finished' and updated_at > now() - interval '30 days')
  ))
);

-- One-time backfill: connect the owner to every other existing member so the
-- current members (you ↔ Kevin) are connected right away.
insert into public.connections (user_a, user_b)
select least(o.id, p.id), greatest(o.id, p.id)
from public.profiles o
join public.profiles p on p.id <> o.id
where lower(o.email) = lower('tomlinson.chelsea@gmail.com')
on conflict do nothing;

-- Done. Tables, security, and badges are ready.
