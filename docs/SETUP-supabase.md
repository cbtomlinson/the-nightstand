# Phase 1 — Supabase setup (your ~10 minutes)

This creates the shared database + logins for The Nightstand. You only do this once.

## 1. Create the project
1. Go to **supabase.com** → **Start your project** → sign in (GitHub or email).
2. **New project**:
   - **Name:** `the-nightstand`
   - **Database password:** generate one and save it somewhere (you won't need it day-to-day).
   - **Region:** pick the one closest to you (lower latency).
   - **Plan:** Free.
3. Wait ~2 minutes while it provisions.

## 2. Load the database schema
1. Left sidebar → **SQL Editor** → **New query**.
2. Open the file `supabase/schema.sql` (in the Reading Genie folder), copy **everything**, paste it in.
3. Click **Run**. You should see **Success. No rows returned**. (Re-running it later is safe.)

## 3. Turn on email magic-link login
1. Left sidebar → **Authentication** → **Sign In / Providers** → make sure **Email** is enabled (it is by default).
2. **Authentication** → **URL Configuration**:
   - **Site URL:** `http://localhost:8123`
   - **Redirect URLs:** add `http://localhost:8123/**` (we'll add the phone + deployed URLs later).

## 4. Grab your keys
1. **Project Settings** (gear icon) → **API**.
2. Copy these two and send them to me here:
   - **Project URL** (e.g. `https://abcdwxyz.supabase.co`)
   - **anon public** key (a long string) — this one is **safe to share/ship**.
3. ⚠️ Do **not** share the **service_role** key — that one is secret and stays out of the app.

## 5. (Later) Invite your friends
When you're ready, add each friend's email to the allowlist so they can sign in. Either tell me
the emails, or run this in the SQL editor:

```sql
insert into public.allowed_emails (email) values ('friend@example.com');
```

---

Once you send me the **Project URL** + **anon key**, I'll drop them into `js/config.js`, wire the
app to the database (logins, saving, loading), migrate your kickstarted reading data into your
account, and we'll watch **Add to shelf** actually work. ✅
