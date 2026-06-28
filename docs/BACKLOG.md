# The Nightstand — backlog / "later" list

Things we've intentionally deferred (not bugs — decisions or future phases).

## Parked for a decision
- **Blind date with a book — make it dynamic.** Right now it always reveals the same
  placeholder (Piranesi) and "Not for me" / "Not right now" don't change what shows.
  Options when we pick it up: pull a real hidden pick from the advisor each time
  (cover/title concealed until reveal) and have the veto buttons actually rotate it.
  _(Chelsea wants to think about it — 2026-06-27.)_

## Phase 3 — the social model (designed 2026-06-28 with Chelsea; not built yet)
Designed via interview. Vibe: **cozy + private by default**, StoryGraph-leaning (not
Goodreads' broadcast-everything). Three layers — Circle → Clubs → Buddy reads:
- **Circle** — your *personal* set of friends (you ↔ each person), **ego-centric**: your
  friends do NOT see each other through it; only you see all of them (you're the hub). This
  makes "Kevin close, but not mixed in with my girlfriends" work *for free* — unconnected
  people never see each other. (How people enter your circle: TBD — likely auto on invite,
  since it's invite-only + small.)
- **Clubs** — persistent named *group rooms* where everyone in the club sees everyone else:
  a shared wall (ongoing group chatter / recs / reactions, NOT tied to one book), an optional
  pinned **group read**, a "books we've read together" shelf, and an identity (name + emoji/
  color). Scales 2→many (a 2-person "Family" club with Kevin is fine). ⚠️ **TO-DO: brainstorm
  a better term than "Clubs"** — might find something better.
- **Buddy reads** — the *reading-together* mechanic: 1+ people on one book, **flexible/chill**
  (jump in partway, NOT synced to page 1), with progress + discussion. Works 1:1 OR as a club's
  pinned read (the two compose). Spoilers: **open / honor-system for v1** (small trusted group);
  **progress-gated comments = future enhancement** (StoryGraph-style hide-past-your-progress).
- **Cozy feed ("Reading Room")** — ambient, ego-centric glimpses of YOUR circle: currently-
  reading, **"just finished" moments**, and **reactions** (😍/👏). Passive — no page-visiting.

**Visibility / privacy (decided):** **private by default.** Your **shelves are yours alone** —
nobody browses them. Shared signals only: currently-reading, just-finished, reactions, recs,
and buddy-read progress + discussion. **Taste-match %** still works — computed **server-side**
so it shows just the number without exposing anyone's books. ("Recommend a book to a friend"
already exists today.)

Build notes: new `circles`/`circle_members` + clubs/club_members tables (or one unified groups
table), buddy-read tables (a `buddy_reads` table + `BuddyRead` component template already exist;
`#/buddy` route is off), RLS scoped by connection/club membership, a feed query, reactions.
Keep it multi-tenant-friendly (no new owner-specific hardcoding).

**Build progress + queue:**
- ✅ **Slice 1 (shipped 2026-06-28):** connections table + ego-centric Circle; privacy tightened
  (shelves private, currently-reading shared only with connections); Circle screen shows friends
  + their current read; **tappable friend cards** → current reads as rich cards (cover, AI
  description, ＋TBR, share, look-it-up, recommend); **PWA reload** (top-bar refresh button +
  pull-to-refresh gesture for installed/standalone apps).
- ⏭️ **Slice 2 — the cozy feed:** the Reading Room = ambient glimpses of your circle, namely
  **"just finished" moments** + **reactions** (😍/👏). Passive, no page-visiting.
- ⏭️ **Slice 3 — buddy reads:** flexible (1+ people, jump in anytime), progress + discussion
  (open / honor-system spoilers for v1). Wire the existing `BuddyRead` template; turn the
  `#/buddy` route back on.
- ⏭️ **Slice 4 — Reading Rooms** (the renamed "Clubs"): persistent group rooms with a shared
  wall, optional pinned group read, and a "books we've read together" shelf.
- ⏭️ **Taste-match %** — NOT built (was only a mockup label). Needs a **server-side** function
  (compare both users' loved/disliked + shared books + rating agreement → return just the %,
  since shelves are now private), AND enough reading data to be meaningful — do it once Chelsea
  + Kevin have logged some books, else it just shows a sad 0%.

## Phase 4 — going live for phones  ✅ mostly done (2026-06-27)
- ✅ Deployed live at **https://littletomato.dev/the-nightstand/** (GitHub Pages, public repo).
- ✅ Supabase Auth redirect URL added — magic-link sign-in confirmed working end-to-end.
- ✅ **Custom SMTP (Resend)** — done: domain `littletomato.dev` verified, wired into Supabase
  (sender `nightstand@littletomato.dev`); the ~3–4/hr cap is gone.
- ⏳ **Re-enable the service worker** for a *true* installable/offline PWA. Current state:
  the SW is **completely off** — nothing calls `navigator.serviceWorker.register()`, and
  `index.html` actively **unregisters any SW + clears all caches on every load** (leftover
  "dev mode" code). `service-worker.js` (cache-v8, cache-first app shell) exists but is dead
  code until registered. To turn it on, when ready: (1) register the SW (e.g. in `app.js`),
  (2) remove the unregister/cache-clear block in `index.html`, (3) adopt **cache-bump
  discipline** — bump `CACHE` in `service-worker.js` on every JS/CSS change so installed
  clients pull fresh code (this is the "why am I seeing old code" trap). **Deliberately
  deferred past Beta** — keeping it off means everyone always gets the latest on reload,
  which is what we want while iterating. _(Chelsea asked to park this — 2026-06-27.)_

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
