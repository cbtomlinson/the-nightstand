# The Nightstand — backlog / "later" list

Things we've intentionally deferred (not bugs — decisions or future phases).

## Parked for a decision
- **Member-to-member friending — how do people add EACH OTHER?** _(Raised 2026-06-28.)_ Today
  connections are only created when the owner invites someone (connects them to the owner), so
  e.g. Kevin can't friend Chelsea's sister — both are connected to Chelsea but not to each other,
  and there's no member-to-member path. The tension: the ego-centric privacy model means you only
  see people you're connected to, so you can't just "browse + add"; and friend-of-friend would
  expose *everyone* connected to Chelsea to each other (mixing Kevin with the girlfriends), which
  she explicitly does NOT want. Options discussed: (1) **Reading Rooms** — you connect by being in
  a shared room (the intended mechanism; Slice 4); (2) **owner brokers** — an Admin control to link
  any two members (quick, keeps Chelsea in control); (3) **friend link/code** — self-serve + private,
  shared out-of-band. _(Chelsea wants to think it over — revisit.)_
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
- ⏭️ **Slice 2 — the cozy feed:** ambient glimpses of your circle, namely **"just finished"
  moments** + **reactions**. Passive, no page-visiting.
- ⏭️ **Slice 3 — buddy reads:** flexible (1+ people, jump in anytime), progress + discussion
  (open / honor-system spoilers for v1). Wire the existing `BuddyRead` template; turn the
  `#/buddy` route back on.
- ⏭️ **Slice 4 — Reading Rooms:** persistent group rooms with a shared wall, optional pinned
  group read, and a "books we've read together" shelf.
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
- ⏳ **Re-enable the service worker** for a *true* installable/offline PWA. Current state:
  the SW is **completely off** — nothing calls `navigator.serviceWorker.register()`, and
  `index.html` actively **unregisters any SW + clears all caches on every load** (leftover
  "dev mode" code). To turn it on, when ready: (1) register the SW, (2) remove the unregister/
  cache-clear block in `index.html`, (3) adopt **cache-bump discipline** — bump `CACHE` in
  `service-worker.js` on every JS/CSS change so installed clients pull fresh code. **Deliberately
  deferred past Beta** — keeping it off means everyone always gets the latest on reload. NOTE:
  this is also the fix for the **"stale cache / still seeing old code until a hard reload"** trap
  we keep hitting during testing. _(Chelsea asked to park this — 2026-06-27.)_

## Enhancements (discussed, not built — 2026-06-28)
- **"Where to find it" deep links** _(proposed 2026-06-29, awaiting Chelsea's go)._ Keep the manual
  chips as the source of truth, but add one-tap **search links** per service: Kindle store
  (amazon.com search), Audible (audible.com search), Spotify (open.spotify.com audiobook search) —
  tap to check availability yourself, then tag it. **Libby stays manual** (no universal search URL;
  it's library-specific — Chelsea expected this). Open design question: make the existing chips
  themselves the links, or a separate "check availability" row.
- **Hardcover API** _(parked 2026-06-29)._ Free GraphQL API with crowdsourced tags/moods/lists.
  Could enrich recommendations + metadata later, but it's a new integration + key to manage, and
  Mabel's rec quality is currently limited by taste data, not book metadata. Revisit when
  recommendations need sharper mood/tag grounding.
- **Background description pre-fetch.** Descriptions are now *cached* after first load (instant on
  reopen), but the *first* open of a book is still a beat slow. Fix: quietly pre-fetch + cache
  descriptions for your shelf books in the background (same trick as covers) so a book is ready
  the moment you open it. Plus a subtle shimmer for the rare uncached one.
- **Save "revisit a finished book" conversations.** Post-read reflection chats currently vanish
  when you leave. The `reflections` table already exists — persist the transcript so you can
  reopen a book and see "here's what you said last time" (also feeds Mabel's understanding).
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
