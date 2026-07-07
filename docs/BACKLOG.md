# The Nightstand — backlog / "later" list

Things we've intentionally deferred (not bugs — decisions or future phases).

## Parked for a decision
- **Member-to-member friending / social design** _(2026-06-29: partially decided)._
  ✅ DECIDED: **room invites = any member, from their own circle** (rooms grow organically; every
  entrant vouched-for). ✅ SHIPPED: **owner-brokered stopgap** — Admin "Connect two members" card
  (connect/unlink; uses connect_users RPC) so Kevin ↔ sister don't wait for Rooms.
  ✅ DECIDED (2026-06-29, Chelsea blessed "Option D — the room IS the relationship"):
  NO friend-requests anywhere. Visibility = your 1:1 connections ∪ your roommates. Sharing a
  room = you see each other's cozy signals (currently-reading, just-finished, reactions) + can
  recommend/buddy-read; being brought into a room by someone who knows you IS the consent;
  leave the room → lose the visibility. Kevin↔girlfriends stays impossible (no shared room).
  Scale-safe: request-to-join / public rooms / block-report are additive later (she wants to
  keep the door open for a bigger audience — do NOT build auto-connect). NEXT SESSION: design
  + build buddy reads and Reading Rooms on this foundation (rooms grow via any member inviting
  from their own circle).
- **Blind date with a book — make it dynamic.** Right now it always reveals the same
  placeholder (Piranesi) and "Not for me" / "Not right now" don't change what shows.
  Options when we pick it up: pull a real hidden pick from the advisor each time
  (cover/title concealed until reveal) and have the veto buttons actually rotate it.
  _(Chelsea wants to think about it — 2026-06-27.)_

## Phase 3 — the social model (designed 2026-06-28 with Chelsea; not built yet)
Designed via interview. Vibe: **cozy + private by default**, StoryGraph-leaning (not
Goodreads' broadcast-everything). Three layers — Circle -> Reading Rooms -> Buddy reads:
- **Circle** — your *personal* set of friends (you <-> each person), **ego-centric**: your
  friends do NOT see each other through it; only you see all of them (you're the hub). This
  makes "Kevin close, but not mixed in with my girlfriends" work *for free* — unconnected
  people never see each other. (How people enter your circle: TBD — likely auto on invite,
  since it's invite-only + small.)
- **Reading Rooms** (✅ name decided 2026-06-28 — was "Clubs") — persistent named *group
  rooms* where everyone in the room sees everyone else: a shared wall (ongoing group chatter /
  recs / reactions, NOT tied to one book), an optional pinned **group read**, a "books we've
  read together" shelf, and an identity (name + emoji/color). Scales 2->many (a 2-person
  "Family" room with Kevin is fine).
- **Buddy reads** — the *reading-together* mechanic: 1+ people on one book, **flexible/chill**
  (jump in partway, NOT synced to page 1), with progress + discussion. Works 1:1 OR as a room's
  pinned read (the two compose). Spoilers: **open / honor-system for v1** (small trusted group);
  **progress-gated comments = future enhancement** (StoryGraph-style hide-past-your-progress).
- **Cozy feed** — ambient, ego-centric glimpses of YOUR circle: currently-reading, **"just
  finished" moments**, and **reactions**. Passive — no page-visiting. (Lives in the Circle
  view; since "Reading Rooms" now names the group spaces, the feed itself gets a plainer label
  — probably just the home/Circle tab.)

**Visibility / privacy (decided):** **private by default.** Your **shelves are yours alone** —
nobody browses them. Shared signals only: currently-reading, just-finished, reactions, recs,
and buddy-read progress + discussion. **Taste-match %** still works — computed **server-side**
so it shows just the number without exposing anyone's books. ("Recommend a book to a friend"
already exists today.)

Build notes: new `circles`/`circle_members` + `reading_rooms`/`room_members` tables (or one
unified groups table), buddy-read tables (a `buddy_reads` table + `BuddyRead` component template
already exist; `#/buddy` route is off), RLS scoped by connection/room membership, a feed query,
reactions. Keep it multi-tenant-friendly (no new owner-specific hardcoding).

**Build progress + queue:**
- ✅ **Slice 1 (shipped 2026-06-28):** connections table + ego-centric Circle; privacy tightened
  (shelves private, currently-reading shared only with connections); Circle screen shows friends
  + their current read; **tappable friend cards** -> current reads as rich cards (cover, AI
  description, +TBR, share, look-it-up, recommend); **PWA reload** (top-bar refresh button +
  pull-to-refresh gesture for installed/standalone apps).
- ✅ **Slice 2 — the cozy feed (shipped 2026-06-28/29):** Reading Room feed shows the circle's
  currently-reading + recent "just finished" (with stars), newest first; **reactions** (❤️/😍/👏,
  optimistic, per-item); rec-notification = rose bubble on the advisor FAB that clears on respond.
- ✅ **Slices 3+4 — buddy reads + Reading Rooms (shipped 2026-07-03, Option D).** Rooms:
  create (name+emoji) from the Circle tab, roster, invite-from-YOUR-circle, shared wall,
  pinned group read; leave anytime, creator removes. Buddy reads: "Read it together" on any
  book (friends and/or a whole room), per-reader progress from their own shelves, thread with
  at-% message context, roommates can join the group read. Visibility unified to can_see
  (connections ∪ roommates) across profiles/shelves/reactions/recs via my_visible_ids.
  Needs the §18 migration run. NOT built yet: "books we've read together" room shelf (small
  follow-up); realtime wall/thread updates (currently refresh-on-post).
- ⏭️ **Taste-match %** — NOT built (was only a mockup label). Needs a **server-side** function
  (compare both users' loved/disliked + shared books + rating agreement -> return just the %,
  since shelves are now private), AND enough reading data to be meaningful — do it once Chelsea
  + Kevin have logged some books, else it just shows a sad 0%.

## Phase 4 — going live for phones  ✅ mostly done (2026-06-27)
- ✅ Deployed live at **https://littletomato.dev/the-nightstand/** (GitHub Pages, public repo).
- ✅ Auth: switched to **email + password** with console **"Invite user"** emails (Resend SMTP);
  invite -> set-password -> onboarding. Magic links removed.
- ✅ Fixed the intermittent **"opening the library" hang** (serialized auth-token refresh; no
  Web Locks) + a 6s splash safety net with a Reload button.
- ✅ **Service worker re-enabled — network-first** _(shipped 2026-07-06)._ Rewrote
  `service-worker.js` (`nightstand-v9`): every same-origin request goes to the network with
  `cache:'no-cache'` (ETag revalidation bypasses the 10-min GitHub Pages HTTP cache), with a
  3.5s timeout falling back to the cached copy — so deploys show up on the **next launch**, no
  hard refresh, and the app still opens offline. Cross-origin (Supabase, covers) is never
  intercepted; registration is post-`load` with `updateViaCache:'none'`. **No cache-bump
  discipline needed** — content flows network-first; bump `CACHE` only on strategy changes.
  This closes the recurring **"stale cache / old code for 10 minutes"** trap.
- ⏳ **Offline shelf snapshot** _(queued 2026-07-06 — Chelsea: "add that to the backlog for now")._
  The SW makes the app *open* offline, but shelves still need the network (boot fetch fails →
  error screen). Plan: persist the last-synced store (`booksById` + `shelves` + `me`) to
  localStorage on every `refresh()`; on boot, hydrate from the snapshot first, then let the
  network refresh replace it — if the fetch fails and a snapshot exists, show shelves read-only
  with a soft "showing your last synced library" banner. Writes fail politely offline; Mabel /
  feed / friends stay online-only. Nice-to-have later: SW-cache cover images (cross-origin,
  opaque responses) so covers show in airplane mode too.

## Enhancements (discussed, not built — 2026-06-28)
- ✅ **"Where to find it" deep links** _(shipped 2026-06-29 — Option 1, the check row)._ Chips stay
  one-tap toggles; a "Check for this title" row links to Kindle-store / Audible / Spotify searches
  for the book. Libby stays manual (library-specific, no universal search URL).
- **Exact-book deep links for Spotify + Audible** _(queued 2026-07-03)._ Today's "Check for
  this title" links open each service's *search* (and, via universal links, usually the app).
  Upgrade to land on the exact book when found: **Spotify** via the official API (server-side
  lookup in an edge fn using a Spotify client id/secret — Chelsea does the free ~5-min dev-app
  signup; cache the audiobook ID in `books.meta.spotify_id`; fall back to the search link).
  **Audible** via the unofficial `api.audible.com/1.0/catalog/products?title=` endpoint
  (undocumented — could break anytime; graceful fallback to search; Chelsea OK'd trying it).
  **Kindle/KU stays a search link** (Amazon's product API needs an approved Associates account).
- **Hardcover API** _(parked 2026-06-29)._ Free GraphQL API with crowdsourced tags/moods/lists.
  Could enrich recommendations + metadata later, but it's a new integration + key to manage, and
  Mabel's rec quality is currently limited by taste data, not book metadata. Revisit when
  recommendations need sharper mood/tag grounding.
- ✅ **Background description pre-fetch** _(shipped 2026-06-29)._ `backfillDescriptions` in
  store.js quietly caches a description for every shelved book missing one (batched, Google
  first, Claude fallback capped at 8/pass; persists to the shared books row = one-time backfill).
- ✅ **Saved, resumable advisor chats** _(shipped 2026-06-29)._ Mid-read + post-read threads
  persist to `reflections` (one thread per shelf item + kind, kept forever) and resume on
  reopen; the post-read trigger includes what you said mid-read. Needed: the
  `reflections_kind_check` migration (adds 'midread').
- **More import sources for a data-rich profile seed.** No Kindle scraping (no public API; ToS;
  brittle) — asked twice, answer stands. The legit path: Amazon's official **"Request My Data"**
  export (user requests at amazon.com/gp/privacycentral, arrives as a ZIP in ~1–2 days) includes
  **Kindle reading history + reading-session data** (the percentages-read signal Chelsea wants) —
  build a parser for it when someone has an export in hand. Also: **StoryGraph CSV** parser.
  The **Goodreads CSV importer already exists** in onboarding and remains the practical seed.

## Product direction (someday) — Chelsea's roadmap
Staying **invite-only for Chelsea + friends** for now. Possible futures (noted 2026-06-27):
- **Fork to monetize** (paid product). Main work = "de-personalize": today it's hardwired
  to Chelsea (her seed in `js/data.js`, owner email in `store.js` + the `admin` function).
  Make those per-instance config + multi-tenant. The invite/allowlist + admin console +
  archive (cost control) are a solid foundation.
- **Free but bring-your-own API key** — each user supplies their own Anthropic key. Natural
  fit: the key is already brokered server-side in the edge function, so it becomes "store
  each user's key (encrypted) + have the function use the caller's key, not the shared one."
  Per-user rate-limit/usage plumbing already exists.
- Design note: to keep these doors open, **avoid hardcoding new owner-specific bits** as we
  add features — prefer config/columns over constants.

## Nice-to-haves
- Let ratings of 2–4 (not just 1/5) nudge the profile, if useful.
- A way to edit a finished book's note (currently set via the advisor only).
- Waitlist table exists now; the public "join the waitlist" form works — revisit its copy/flow
  when opening up beyond the inner circle.
