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
