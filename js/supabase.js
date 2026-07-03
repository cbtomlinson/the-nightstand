// Supabase client. supabase-js is loaded from a CDN (the app needs the network
// for data anyway). The publishable key is safe in the browser; RLS protects data.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

// supabase-js is VENDORED (assets/vendor/supabase.umd.js, loaded in index.html
// before this module) instead of imported from esm.sh. The CDN import sat on the
// boot path — one stalled fetch on flaky wifi froze the whole app on the splash
// before any in-app safety net could run. Vendoring removes that failure mode.
const { createClient } = (globalThis.supabase || {});
if (!createClient) throw new Error('Vendored supabase-js failed to load (assets/vendor/supabase.umd.js)');

// supabase-js defaults to the Web Locks API to stop two token refreshes running at
// once. In standalone-PWA / Safari that lock can DEADLOCK — auth calls never resolve
// and the app hangs forever on the splash ("opening the library…"). A no-op lock
// cured the deadlock but removed ALL serialization, so concurrent refreshes raced
// (refresh-token rotation invalidates one) → the *intermittent* splash hangs / surprise
// sign-outs. This is a tiny in-process queue (the same idea as supabase's own
// processLock, inlined so we don't depend on a CDN named export): it serializes auth
// ops through one promise chain — no concurrent-refresh race — WITHOUT touching Web
// Locks, so it can't deadlock. Best of both for a single-tab PWA.
let authChain = Promise.resolve();
function serialLock(_name, _acquireTimeout, fn) {
  const run = authChain.then(fn, fn);
  authChain = run.then(() => {}, () => {});
  return run;
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // We finish the invite/reset redirect ourselves (see completeAuthRedirect in
    // auth.js + the gate in app.js). The built-in auto-detection runs at client
    // construction and would fight the app's hash router for the URL fragment.
    // Doing it explicitly after mount lets us control timing, strip the token from
    // the hash, and surface errors instead of failing silently.
    detectSessionInUrl: false,
    lock: serialLock,
  },
});
