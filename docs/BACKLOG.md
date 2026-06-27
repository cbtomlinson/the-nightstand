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
- ✅ Supabase Auth redirect URL added — magic-link sign-in confirmed working.
- ⏳ Re-enable the **service worker** for offline/install (still disabled in `index.html`
  for dev cache sanity — fine to leave off through Beta).
- ⏳ **Custom SMTP (Resend)** — deferred by Chelsea; not needed while it's just her + a few
  friends (Supabase's built-in mailer ~3–4 magic-links/hr). Set up before scaling.

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
