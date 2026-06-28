// The Nightstand — "admin" edge function (owner-only member management).
// Uses the service-role key (auto-provided to Supabase edge functions) to act
// across accounts, but ONLY after verifying the caller is the owner.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const OWNER_EMAIL = 'tomlinson.chelsea@gmail.com';
const APP_URL = 'https://littletomato.dev/the-nightstand/'; // where invite / reset links land

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!serviceKey) return json({ error: 'SUPABASE_SERVICE_ROLE_KEY not available' }, 500);

    // 1) Verify the caller is signed in AND is the owner (using a user-scoped client).
    const authHeader = req.headers.get('Authorization') || '';
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'not signed in' }, 401);
    if ((user.email || '').toLowerCase() !== OWNER_EMAIL) return json({ error: 'forbidden' }, 403);

    // 2) Admin client (service role) — bypasses RLS. Only reachable past the gate.
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

    const body = await req.json().catch(() => ({}));
    const { action = 'list', userId = null } = body;

    if (action === 'list') {
      const { data: profiles } = await admin
        .from('profiles')
        .select('id, email, display_name, status, onboarding_complete, created_at')
        .order('created_at', { ascending: true });
      const since = new Date(Date.now() - 30 * 86400000).toISOString();
      const { data: calls } = await admin.from('advisor_calls').select('user_id').gte('created_at', since);
      const { data: items } = await admin.from('shelf_items').select('user_id');
      const tally = (rows: any[]) => {
        const m: Record<string, number> = {};
        for (const r of rows || []) m[r.user_id] = (m[r.user_id] || 0) + 1;
        return m;
      };
      const callsBy = tally(calls || []), itemsBy = tally(items || []);
      const members = (profiles || []).map((p: any) => ({
        ...p,
        isOwner: (p.email || '').toLowerCase() === OWNER_EMAIL,
        calls30d: callsBy[p.id] || 0,
        shelfCount: itemsBy[p.id] || 0,
      }));
      // Invited but not signed in yet (on the allowlist, no profile row).
      const { data: allowed } = await admin.from('allowed_emails').select('email, created_at').order('created_at', { ascending: true });
      const memberEmails = new Set((profiles || []).map((p: any) => (p.email || '').toLowerCase()));
      const pendingInvites = (allowed || [])
        .filter((a: any) => !memberEmails.has((a.email || '').toLowerCase()))
        .map((a: any) => ({ email: a.email, created_at: a.created_at }));
      const { data: waitlist } = await admin.from('waitlist').select('id, name, email, note, created_at').order('created_at', { ascending: false });
      return json({ members, pendingInvites, waitlist: waitlist || [] });
    }

    // Invite = allowlist + send Supabase's "Invite user" email (service role).
    // The friend clicks it, lands on the app already signed in, and sets their own
    // password (see SetPassword in the client). inviteUserByEmail also creates the
    // auth user, which fires the allowlist trigger to make their profile.
    // Re-inviting someone who already has an account returns { already: true }.
    if (action === 'invite') {
      const email = String(body.email || '').trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'Enter a valid email.' }, 400);
      await admin.from('allowed_emails').upsert({ email }, { onConflict: 'email' });
      let emailed = false, already = false;
      try {
        const { error: invErr } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: APP_URL });
        if (invErr) {
          const m = (invErr.message || '').toLowerCase();
          if (m.includes('already') || m.includes('registered') || m.includes('exists')) already = true;
          else console.warn('[admin] invite email:', invErr.message);
        } else emailed = true;
      } catch (e) { console.warn('[admin] invite threw:', String(e)); }
      return json({ ok: true, emailed, already });
    }
    if (action === 'dismiss_waitlist') {
      const email = String(body.email || '').trim().toLowerCase();
      if (!email) return json({ error: 'email required' }, 400);
      await admin.from('waitlist').delete().ilike('email', email);
      return json({ ok: true });
    }
    if (action === 'uninvite') {
      const email = String(body.email || '').trim().toLowerCase();
      if (!email) return json({ error: 'email required' }, 400);
      if (email === OWNER_EMAIL) return json({ error: 'cannot remove the owner' }, 400);
      await admin.from('allowed_emails').delete().ilike('email', email);
      return json({ ok: true });
    }

    if (!userId) return json({ error: 'userId required' }, 400);

    // Never modify the owner account.
    const { data: target } = await admin.from('profiles').select('email').eq('id', userId).maybeSingle();
    if ((target?.email || '').toLowerCase() === OWNER_EMAIL) return json({ error: 'cannot modify the owner account' }, 400);

    if (action === 'archive') {
      await admin.from('profiles').update({ status: 'archived' }).eq('id', userId);
      return json({ ok: true });
    }
    if (action === 'unarchive') {
      await admin.from('profiles').update({ status: 'active' }).eq('id', userId);
      return json({ ok: true });
    }
    if (action === 'reset') {
      // Back to a fresh start: empty shelves, blank profile, re-trigger onboarding.
      await admin.from('shelf_items').delete().eq('user_id', userId);
      await admin.from('profiles')
        .update({ reading_profile: {}, mood: null, onboarding_complete: false, status: 'active' })
        .eq('id', userId);
      return json({ ok: true });
    }
    if (action === 'remove') {
      // Hard removal: off the guest list, profile + data gone, auth user deleted.
      if (target?.email) await admin.from('allowed_emails').delete().ilike('email', target.email);
      await admin.from('profiles').delete().eq('id', userId);
      try { await admin.auth.admin.deleteUser(userId); } catch (_e) { /* profile already gone is enough */ }
      return json({ ok: true });
    }
    return json({ error: 'unknown action: ' + action }, 400);
  } catch (e: any) {
    return json({ error: String(e?.message || e) }, 500);
  }
});
