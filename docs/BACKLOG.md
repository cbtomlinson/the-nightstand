# The Nightstand — backlog / "later" list

Things we've intentionally deferred (not bugs — decisions or future phases).

## Parked for a decision
- **Blind date with a book — make it dynamic.** Right now it always reveals the same
  placeholder (Piranesi) and "Not for me" / "Not right now" don't change what shows.
  Options when we pick it up: pull a real hidden pick from the advisor each time
  (cover/title concealed until reveal) and have the veto buttons actually rotate it.
  _(Chelsea wants to think about it — 2026-06-27.)_

## Phase 3 — when friends join
- Wire **buddy reads** + the **Reading Room feed** + **Your circle** taste-match to real
  data (the `BuddyRead` component is kept as a template; `#/buddy` route is currently off).
- "Send a friend a blind date" / shared shelves.
- Consider a mood/"currently reading" presence in the circle.

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
