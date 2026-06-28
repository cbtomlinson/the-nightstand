// Supabase client. supabase-js is loaded from a CDN (the app needs the network
// for data anyway). The publishable key is safe in the browser; RLS protects data.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

// supabase-js v2 guards every auth-token read/write with the Web Locks API so that
// multiple tabs don't refresh the token at once. In standalone-PWA / Safari that
// lock can DEADLOCK — auth calls (including setSession during a magic-link sign-in)
// never resolve, and the app hangs forever on the splash ("opening the library…").
// This is a single-user app that effectively runs in one tab, so we don't need
// cross-tab locking. We pass a no-op lock that just runs the operation immediately
// and never blocks — which is what makes magic-link sign-in actually complete.
const noBlockLock = async (_name, _acquireTimeout, fn) => fn();

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // We finish the magic-link redirect ourselves (see completeAuthRedirect in
    // auth.js + the gate in app.js). The built-in auto-detection runs at client
    // construction and would fight the app's hash router for the URL fragment.
    // Doing it explicitly after mount lets us control timing, strip the token from
    // the hash, and surface errors instead of failing silently.
    detectSessionInUrl: false,
    lock: noBlockLock,
  },
});
