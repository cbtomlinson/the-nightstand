# The Nightstand 🌙 (Beta)

A cozy, AI‑powered reading advisor and tiny private book club. Chelsea and her friends
track what they're reading, and **Mabel** — a warm, opinionated librarian — learns each
reader's taste and recommends books as hypotheses (with reasoning, confidence, and no
spoilers).

> **Status:** Beta. Built for a small invite-only group of friends.

## Stack

- **Zero-build PWA** — plain HTML/CSS/JS + [Preact] + [htm], vendored under `assets/vendor/`
  (no Node toolchain, no bundler). An import map in `index.html` wires it together.
- **Supabase** — Postgres + Row-Level Security, magic-link auth, and edge functions.
- **Claude** (Anthropic) — the advisor "Mabel," via a Supabase edge function that keeps the
  API key server-side. Google Books supplies covers/ratings/descriptions.

## Layout

| Path | What it is |
|------|-----------|
| `index.html` | App shell + import map |
| `js/` | App code — `app.js` (router/shell), `screens.js` (all screens), `store.js` (data), `advisor.js`/`admin.js` (edge-function clients), `brand.js`, `ui.js` |
| `css/styles.css` | Design system (midnight‑plum + gold) |
| `assets/` | Icons + vendored Preact/htm |
| `supabase/schema.sql` | Tables, RLS, triggers |
| `supabase/functions/advisor/` | Mabel — recommendations, chat, fit, descriptions |
| `supabase/functions/admin/` | Owner-only member management |
| `supabase/*.sql` | One-off migrations (`bigpush.sql`, `admin.sql`) |
| `docs/` | Setup notes + `BACKLOG.md` |

## Running locally

```sh
python3 devserver.py     # serves on http://localhost:8123 with no-cache headers
```

Config lives in `js/config.js` (Supabase URL + **publishable** key — safe to ship; RLS
protects the data). The Anthropic, Google Books, and service-role keys are **Supabase
secrets**, never in this repo.

## Secrets / safety

- Nothing secret is committed. The only key in the source is the Supabase *publishable*
  (anon) key, which is designed to be public and is gated by Row-Level Security.
- The repo also seeds Chelsea's own reading history (`js/data.js`, `reading-profile_*`),
  so keep it **private** unless that personal data is scrubbed first.

[Preact]: https://preactjs.com
[htm]: https://github.com/developit/htm
