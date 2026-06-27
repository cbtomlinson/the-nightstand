// Supabase client. supabase-js is loaded from a CDN (the app needs the network
// for data anyway). The publishable key is safe in the browser; RLS protects data.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

// supabase-js v2 guards its auth token with the Web Locks API. An *infinite* wait
// there can deadlock in standalone-PWA / Safari — the app hangs on the splash and a
// second load "fixes" it. This lock behaves like the default EXCEPT it never waits
// forever: a would-be-infinite wait is capped, and only in that case do we proceed
// without the lock rather than hang. (All other timeouts keep their normal meaning.)
const safeAuthLock = async (name, acquireTimeout, fn) => {
  const locks = globalThis.navigator && globalThis.navigator.locks;
  if (!locks || !locks.request) return await fn();
  if (acquireTimeout === 0) {
    return await locks.request(name, { mode: 'exclusive', ifAvailable: true }, async (lock) => {
      if (!lock) { const e = new Error('lock unavailable'); e.isAcquireTimeout = true; throw e; }
      return await fn();
    });
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), acquireTimeout < 0 ? 5000 : acquireTimeout);
  try {
    return await locks.request(name, { mode: 'exclusive', signal: ctrl.signal }, async () => await fn());
  } catch (e) {
    if (acquireTimeout < 0) return await fn(); // capped an infinite wait → run rather than deadlock
    throw e;
  } finally {
    clearTimeout(timer);
  }
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    lock: safeAuthLock,
  },
});
