// Magic-link auth + the current user's profile.
import { supabase } from './supabase.js';

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function onAuth(cb) {
  return supabase.auth.onAuthStateChange((event, session) => cb(session, event));
}

export async function sendMagicLink(email) {
  // Redirect back to wherever the app is being served from.
  return supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: location.origin + location.pathname },
  });
}

export async function signOut() {
  return supabase.auth.signOut();
}

// Finish a magic-link sign-in. Supabase sends the user back to the app with the
// session tokens (or an error) in the URL hash, e.g.
//   /the-nightstand/#access_token=…&refresh_token=…&type=magiclink
// We establish the session from those tokens, then strip them from the URL so
// (a) the one-time tokens don't linger in history and (b) they don't collide with
// the app's hash router. Returns { ok, error }. A no-op (and harmless) when the
// URL carries no auth params, so it's safe to call on every load.
export async function completeAuthRedirect() {
  let raw = '';
  try { raw = (location.hash || '').replace(/^#\/?/, ''); } catch (_e) { return { ok: false, error: null }; }
  if (!raw || !/(access_token|error|error_description)=/.test(raw)) return { ok: false, error: null };

  const clean = () => {
    try { history.replaceState(null, '', location.pathname + location.search); } catch (_e) {}
  };

  const p = new URLSearchParams(raw);
  const errDesc = p.get('error_description') || p.get('error');
  if (errDesc) { clean(); return { ok: false, error: errDesc.replace(/\+/g, ' ') }; }

  const access_token = p.get('access_token');
  const refresh_token = p.get('refresh_token');
  if (!access_token || !refresh_token) { clean(); return { ok: false, error: null }; }

  try {
    const { error } = await supabase.auth.setSession({ access_token, refresh_token });
    clean();
    return error ? { ok: false, error: error.message } : { ok: true, error: null };
  } catch (e) {
    clean();
    return { ok: false, error: (e && e.message) || 'Could not complete sign-in.' };
  }
}

// Public waitlist signup — works for logged-out visitors (anon key + RLS insert policy).
export async function joinWaitlist({ name = '', email, note = '' }) {
  const e = (email || '').trim();
  if (!e.includes('@')) throw new Error('Please enter a valid email.');
  const { error } = await supabase.from('waitlist')
    .insert({ name: name.trim() || null, email: e, note: note.trim() || null });
  if (error) throw error;
}

export async function getUserEmail() {
  const { data: { user } } = await supabase.auth.getUser();
  return user ? user.email : null;
}

// Returns the profile row (only exists for allow-listed members), or null.
// Pass a known user id (from the session) to skip an extra getUser() round-trip.
export async function getMyProfile(userId) {
  let uid = userId;
  if (!uid) { const { data: { user } } = await supabase.auth.getUser(); uid = user && user.id; }
  if (!uid) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', uid)
    .maybeSingle();
  if (error) {
    console.warn('[auth] profile fetch error:', error.message);
    return null;
  }
  return data;
}
