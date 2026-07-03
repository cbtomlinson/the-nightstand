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
  kind          text check (kind in ('intake','post_read','dnf','midread')),
  transcript    jsonb default '[]'::jsonb,
  insights      jsonb default '{}'::jsonb,
  created_at    timestamptz default now()
);
-- (existing installs) allow the mid-read companion chats:
alter table public.reflections drop constraint if exists reflections_kind_check;
alter table public.reflections add constraint reflections_kind_check
  check (kind in ('intake','post_read','dnf','midread'));

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
-- Shared-catalog enrichment (cover + cached description) must work for every member,
-- not just whoever created the row — creator-only made those persists silently fail
-- for everyone else. Fine for an invite-only club; revisit if the club opens up.
create policy books_update on public.books for update using (public.is_member());

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
-- One resumable thread per (user, shelf item, kind): dedupe (keep newest), then enforce.
delete from public.reflections a using public.reflections b
  where a.user_id = b.user_id and a.shelf_item_id is not distinct from b.shelf_item_id
    and a.kind is not distinct from b.kind and a.created_at < b.created_at;
create unique index if not exists reflections_thread_key
  on public.reflections (user_id, shelf_item_id, kind) where shelf_item_id is not null;

-- recommendations: visible to recipient or sender; you manage your own
drop policy if exists recs_select on public.recommendations;
create policy recs_select on public.recommendations for select
  using (user_id = auth.uid() or recommended_by = auth.uid());
drop policy if exists recs_insert on public.recommendations;
-- Only send recs AS yourself, TO someone in your circle. (The old OR-shaped check
-- let a member send to ANY user — or forge a rec that claimed to be FROM a friend.)
create policy recs_insert on public.recommendations for insert
  with check (
    recommended_by = auth.uid()
    and user_id <> auth.uid()
    and public.are_connected(auth.uid(), user_id)
  );
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
-- SECURITY: without this revoke, ANY signed-in member could call connect_users via
-- the API and connect arbitrary pairs (themselves to anyone — or any two other
-- people), bypassing the whole privacy model. Admin (service role) only.
revoke execute on function public.connect_users(uuid, uuid) from public, anon, authenticated;
grant execute on function public.connect_users(uuid, uuid) to service_role;

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

-- ── 17) Reactions (feed hearts/claps on a friend's currently-reading / finished) ──
create table if not exists public.reactions (
  id         uuid primary key default gen_random_uuid(),
  item_id    uuid not null references public.shelf_items(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  emoji      text not null,
  created_at timestamptz default now(),
  unique (item_id, user_id, emoji)
);
alter table public.reactions enable row level security;
-- See reactions on any item you're allowed to see (yours, or a connected friend's shared item).
drop policy if exists reactions_select on public.reactions;
create policy reactions_select on public.reactions for select using (
  exists (select 1 from public.shelf_items s
          where s.id = reactions.item_id
            and (s.user_id = auth.uid() or public.are_connected(auth.uid(), s.user_id)))
);
-- React (as yourself) to a connected friend's item.
drop policy if exists reactions_insert on public.reactions;
create policy reactions_insert on public.reactions for insert with check (
  user_id = auth.uid()
  and exists (select 1 from public.shelf_items s
              where s.id = item_id
                and (s.user_id = auth.uid() or public.are_connected(auth.uid(), s.user_id)))
);
-- Remove your own reaction.
drop policy if exists reactions_delete on public.reactions;
create policy reactions_delete on public.reactions for delete using (user_id = auth.uid());

-- ── 18) Reading Rooms + buddy reads (social slices 3+4, Option D) ──────────
-- Option D: "the room is the relationship." Visibility = your 1:1 connections
-- ∪ your roommates. No friend requests — being brought into a room by someone
-- who knows you IS the consent; leave the room, lose the visibility.
create table if not exists public.reading_rooms (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  emoji      text default '📚',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);
create table if not exists public.room_members (
  room_id    uuid not null references public.reading_rooms(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  added_by   uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  primary key (room_id, user_id)
);
create table if not exists public.room_posts (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references public.reading_rooms(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  body       text not null,
  created_at timestamptz default now()
);

-- Helpers. is_room_member avoids RLS self-recursion on room_members; can_see is
-- the Option-D visibility test; my_visible_ids lists everyone YOU can see.
-- (These must stay executable by authenticated — RLS policies evaluate them.)
create or replace function public.is_room_member(rid uuid, uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.room_members where room_id = rid and user_id = uid);
$$;
create or replace function public.can_see(x uuid, y uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.are_connected(x, y)
      or exists (select 1 from public.room_members a
                 join public.room_members b on a.room_id = b.room_id
                 where a.user_id = x and b.user_id = y);
$$;
create or replace function public.my_visible_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select case when user_a = auth.uid() then user_b else user_a end
    from public.connections where auth.uid() in (user_a, user_b)
  union
  select b.user_id from public.room_members a
    join public.room_members b on a.room_id = b.room_id
    where a.user_id = auth.uid() and b.user_id <> auth.uid();
$$;

alter table public.reading_rooms enable row level security;
alter table public.room_members  enable row level security;
alter table public.room_posts    enable row level security;

drop policy if exists rooms_select on public.reading_rooms;
create policy rooms_select on public.reading_rooms for select
  using (public.is_room_member(id, auth.uid()));
drop policy if exists rooms_insert on public.reading_rooms;
create policy rooms_insert on public.reading_rooms for insert
  with check (created_by = auth.uid() and public.is_member());
drop policy if exists rooms_update on public.reading_rooms;
create policy rooms_update on public.reading_rooms for update using (created_by = auth.uid());
drop policy if exists rooms_delete on public.reading_rooms;
create policy rooms_delete on public.reading_rooms for delete using (created_by = auth.uid());

-- Add someone = you're in the room AND they're in YOUR circle (Option D consent);
-- the creator seats themselves at creation. Leave anytime; creator may remove.
drop policy if exists roommem_select on public.room_members;
create policy roommem_select on public.room_members for select
  using (public.is_room_member(room_id, auth.uid()));
drop policy if exists roommem_insert on public.room_members;
create policy roommem_insert on public.room_members for insert
  with check (
    added_by = auth.uid() and (
      (user_id = auth.uid() and exists (select 1 from public.reading_rooms r where r.id = room_id and r.created_by = auth.uid()))
      or (public.is_room_member(room_id, auth.uid()) and public.are_connected(auth.uid(), user_id))
    )
  );
drop policy if exists roommem_delete on public.room_members;
create policy roommem_delete on public.room_members for delete
  using (user_id = auth.uid()
         or exists (select 1 from public.reading_rooms r where r.id = room_id and r.created_by = auth.uid()));

drop policy if exists roomposts_select on public.room_posts;
create policy roomposts_select on public.room_posts for select
  using (public.is_room_member(room_id, auth.uid()));
drop policy if exists roomposts_insert on public.room_posts;
create policy roomposts_insert on public.room_posts for insert
  with check (user_id = auth.uid() and public.is_room_member(room_id, auth.uid()));
drop policy if exists roomposts_delete on public.room_posts;
create policy roomposts_delete on public.room_posts for delete using (user_id = auth.uid());

-- Buddy reads grow up: an optional home room (a room's "group read") + messages
-- carry the sender's progress at post time (spoiler context).
alter table public.buddy_reads add column if not exists room_id uuid references public.reading_rooms(id) on delete set null;
alter table public.buddy_read_messages add column if not exists at_pct int;

-- Room members can SEE (and join) their room's group read; posting requires being
-- a member of the read (the old check let anyone post into any thread).
drop policy if exists buddy_select on public.buddy_reads;
create policy buddy_select on public.buddy_reads for select
  using (auth.uid() = any(member_ids) or created_by = auth.uid()
         or (room_id is not null and public.is_room_member(room_id, auth.uid())));
drop policy if exists buddymsg_insert on public.buddy_read_messages;
create policy buddymsg_insert on public.buddy_read_messages for insert
  with check (user_id = auth.uid() and exists (
    select 1 from public.buddy_reads b where b.id = buddy_read_id and auth.uid() = any(b.member_ids)));
-- Roommates may join their room's group read (update adds them to member_ids).
drop policy if exists buddy_update on public.buddy_reads;
create policy buddy_update on public.buddy_reads for update
  using (created_by = auth.uid() or auth.uid() = any(member_ids)
         or (room_id is not null and public.is_room_member(room_id, auth.uid())));

-- Option D visibility swap: roommates count like connections everywhere.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  using (id = auth.uid() or public.can_see(auth.uid(), id));
drop policy if exists shelf_select on public.shelf_items;
create policy shelf_select on public.shelf_items for select using (
  user_id = auth.uid()
  or (is_public and public.can_see(auth.uid(), user_id) and (
    status = 'reading'
    or (status = 'finished' and updated_at > now() - interval '30 days')
  ))
);
drop policy if exists reactions_select on public.reactions;
create policy reactions_select on public.reactions for select using (
  exists (select 1 from public.shelf_items s
          where s.id = reactions.item_id
            and (s.user_id = auth.uid() or public.can_see(auth.uid(), s.user_id)))
);
drop policy if exists reactions_insert on public.reactions;
create policy reactions_insert on public.reactions for insert with check (
  user_id = auth.uid()
  and exists (select 1 from public.shelf_items s
              where s.id = item_id
                and (s.user_id = auth.uid() or public.can_see(auth.uid(), s.user_id)))
);
drop policy if exists recs_insert on public.recommendations;
create policy recs_insert on public.recommendations for insert
  with check (
    recommended_by = auth.uid()
    and user_id <> auth.uid()
    and public.can_see(auth.uid(), user_id)
  );

-- Done. Tables, security, and badges are ready.
