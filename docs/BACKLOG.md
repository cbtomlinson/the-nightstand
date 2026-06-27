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

## Phase 4 — going live for phones
- Deploy to a real HTTPS URL; re-enable the service worker for offline/install
  (it's disabled in `index.html` for dev cache sanity).
- Add the deployed URL to Supabase Auth redirect allowlist.
- **Custom SMTP (e.g. Resend)** before inviting several friends — Supabase's built-in
  mailer rate-limits magic links to ~3–4/hour.

## Nice-to-haves
- Let ratings of 2–4 (not just 1/5) nudge the profile, if useful.
- A way to edit a finished book's note (currently set via the advisor only).
