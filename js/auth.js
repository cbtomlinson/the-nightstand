// Magic-link auth + the current user's profile.
import { supabase } from './supabase.js';

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function onAuth(cb) {
  return supabase.auth.onAuthStateChange((_event, session) => cb(session));
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
export async function getMyProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();
  if (error) {
    console.warn('[auth] profile fetch error:', error.message);
    return null;
  }
  return data;
}
