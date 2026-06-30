// Entry point: auth gate → hash router + app shell (top bar, screen outlet, bottom nav).
import { render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { html } from './html.js';
import { Icon, Avatar } from './ui.js';
import { me } from './data.js';
import { getBrand } from './brand.js';
import { isConfigured } from './config.js';
import { getSession, onAuth, getMyProfile, signOut, completeAuthRedirect } from './auth.js';
import { init as initStore } from './store.js';
import * as S from './screens.js';
import { go } from './screens.js';

console.log('%c🌙 The Nightstand — live build (data layer active)', 'color:#e9b85c;font-weight:bold');

function useHash() {
  const [hash, setHash] = useState(location.hash.slice(1) || '/');
  useEffect(() => {
    const onChange = () => {
      setHash(location.hash.slice(1) || '/');
      const main = document.querySelector('.app-main');
      if (main) main.scrollTop = 0;
    };
    addEventListener('hashchange', onChange);
    return () => removeEventListener('hashchange', onChange);
  }, []);
  return hash;
}

function route(hash) {
  const seg = hash.split('/').filter(Boolean);
  const base = seg[0] || 'shelf';
  switch (base) {
    case 'book':       return { screen: html`<${S.BookDetail} id=${seg[1]} />`, nav: 'shelf' };
    case 'interview':  return { screen: html`<${S.Interview} id=${seg[1]} />`, nav: 'shelf' };
    case 'genie':      return { screen: html`<${S.Genie} />`, nav: 'genie' };
    case 'choose':     return { screen: html`<${S.Choose} />`, nav: 'genie' };
    case 'fit':        return { screen: html`<${S.Fit} id=${seg[1]} />`, nav: 'shelf' };
    case 'blind':      return { screen: html`<${S.BlindDate} />`, nav: 'genie' };
    case 'feed':       return { screen: html`<${S.Feed} />`, nav: 'feed' };
    case 'friends':    return { screen: html`<${S.Friends} />`, nav: 'friends' };
    case 'friend':     return { screen: html`<${S.FriendDetail} id=${seg[1]} />`, nav: 'friends' };
    case 'profile':    return { screen: html`<${S.Profile} />`, nav: 'profile' };
    case 'search':     return { screen: html`<${S.Search} />`, nav: 'shelf' };
    case 'import':     return { screen: html`<${S.Import} />`, nav: 'profile' };
    case 'rated':      return { screen: html`<${S.RatedList} min=${seg[1]} />`, nav: 'profile' };
    case 'admin':      return { screen: html`<${S.Admin} />`, nav: 'profile' };
    case 'shelf':      return { screen: html`<${S.Shelf} tab=${seg[1]} />`, nav: 'shelf' };
    default:           return { screen: html`<${S.Shelf} />`, nav: 'shelf' };
  }
}

function Shell({ profile } = {}) {
  const hash = useHash();
  const brand = getBrand();
  // The signed-in user's initial for the top-right avatar (was hardcoded to the
  // owner's "C" from data.js — wrong for everyone else).
  const avInitial = (profile && profile.display_name ? profile.display_name[0] : (me.initial || 'R')).toUpperCase();
  const { screen, nav, bare } = route(hash);
  const navCls = (k) => 'nav-item' + (nav === k ? ' active' : '');
  const [showTour, setShowTour] = useState(() => { try { return !localStorage.getItem('rg_tour_seen'); } catch (e) { return false; } });
  const closeTour = () => { try { localStorage.setItem('rg_tour_seen', '1'); } catch (e) {} setShowTour(false); };
  useEffect(() => { document.title = brand.name; }, [brand.name]);
  useEffect(() => { initStore(); }, []);
  // Pull-to-refresh for installed (standalone) PWAs — iOS has no browser
  // pull-to-refresh there. Drag down from the top of the scroll area to reload.
  useEffect(() => {
    const main = document.querySelector('.app-main');
    if (!main) return;
    let startY = null, dy = 0, active = false;
    const onStart = (e) => { startY = main.scrollTop <= 0 ? e.touches[0].clientY : null; dy = 0; active = false; };
    const onMove = (e) => {
      if (startY == null) return;
      dy = e.touches[0].clientY - startY;
      if (dy > 0 && main.scrollTop <= 0) { active = true; main.style.transform = `translateY(${Math.min(dy * 0.5, 80)}px)`; }
    };
    const onEnd = () => {
      if (active && dy > 90) { location.reload(); return; }
      if (active) { main.style.transition = 'transform .2s ease'; main.style.transform = ''; setTimeout(() => { main.style.transition = ''; }, 220); }
      startY = null; dy = 0; active = false;
    };
    main.addEventListener('touchstart', onStart, { passive: true });
    main.addEventListener('touchmove', onMove, { passive: true });
    main.addEventListener('touchend', onEnd, { passive: true });
    return () => { main.removeEventListener('touchstart', onStart); main.removeEventListener('touchmove', onMove); main.removeEventListener('touchend', onEnd); };
  }, []);

  return html`<div class="app">
    ${!bare && html`<header class="topbar">
      <div class="brand" onClick=${() => go('/shelf')} role="button">
        <span class="brand-mark">${brand.logo()}</span>
        <span class="brand-name">${brand.wordmark()}</span>
        <span class="beta-tag">Beta</span>
      </div>
      <div class="topbar-actions">
        <button class="icon-btn" onClick=${() => location.reload()} aria-label="Refresh"><${Icon} name="refresh" /></button>
        <button class="icon-btn" onClick=${() => go('/search')} aria-label="Add a book"><${Icon} name="plus" /></button>
        <button class="icon-btn" onClick=${() => go('/profile')} aria-label="Your profile">
          <${Avatar} initial=${avInitial} color="#e9b85c" size="sm" />
        </button>
      </div>
    </header>`}

    <main class="app-main">${screen}</main>

    ${!bare && html`<nav class="bottom-nav">
      <button class=${navCls('shelf')} onClick=${() => go('/shelf')}><${Icon} name="books" /><span>Shelf</span></button>
      <button class=${navCls('feed')} onClick=${() => go('/feed')}><${Icon} name="feed" /><span>Room</span></button>
      <button class="nav-fab" onClick=${() => go('/genie')} aria-label="Ask the advisor"><${Icon} name="sparkles" /></button>
      <button class=${navCls('friends')} onClick=${() => go('/friends')}><${Icon} name="users" /><span>Circle</span></button>
      <button class=${navCls('profile')} onClick=${() => go('/profile')}><${Icon} name="user" /><span>You</span></button>
    </nav>`}

    ${showTour ? html`<${S.Tour} onClose=${closeTour} />` : ''}
  </div>`;
}

function LoadingScreen({ stage, onReload } = {}) {
  const brand = getBrand();
  // If the boot drags, show what it's doing + a manual escape so no one is ever
  // stranded staring at the splash (and the stage tells us where it stalled).
  const [slow, setSlow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setSlow(true), 4000); return () => clearTimeout(t); }, []);
  return html`<div class="app"><div class="splash">
    <div class="splash-lamp">${brand.fam.art()}</div>
    <div class="splash-sub">opening the library…</div>
    ${slow ? html`<div style="margin-top:16px;text-align:center">
      <div style="font-size:12px;color:var(--text-3);margin-bottom:10px">Taking a moment${stage ? ` · ${stage}` : ''}…</div>
      <button class="btn btn-ghost" onClick=${onReload || (() => location.reload())}>Reload</button>
    </div>` : ''}
  </div></div>`;
}

function App() {
  const [st, setSt] = useState({ loading: true, session: null, profile: null, email: null, error: null });
  // Set when arriving from an invite/reset link → show the set-password screen.
  // Stored in sessionStorage so a reload mid-setup still lands on set-password.
  const [needPw, setNeedPw] = useState(() => { try { return sessionStorage.getItem('rg_need_pw') === '1'; } catch (_e) { return false; } });
  const [bootStage, setBootStage] = useState('starting'); // shown on the splash if the boot drags

  useEffect(() => {
    // No backend configured yet → run the local (mock) app as before.
    if (!isConfigured()) {
      setSt({ loading: false, session: 'local', profile: { local: true }, email: null, error: null });
      return;
    }
    let active = true, sub;

    // Resolve the auth state from a session (+ an optional boot error to surface).
    const apply = async (session, err = null) => {
      if (!active) return;
      const email = (session && session.user && session.user.email) || null;
      let profile = null;
      try { profile = session ? await getMyProfile(session.user && session.user.id) : null; } catch (_e) {}
      if (active) setSt({ loading: false, session: session || null, profile, email, error: err });
    };

    // Bootstrap: first finish any magic-link redirect sitting in the URL (this
    // establishes + persists the session, or captures an error), THEN read the
    // session and render. Doing the redirect explicitly — with a non-blocking auth
    // lock (see supabase.js) — is what fixes the "stuck on opening the library"
    // hang and the silent bounce back to sign-in. Only AFTER the initial resolve do
    // we attach the change listener, so a stray INITIAL_SESSION can't clobber the
    // boot error or race the first paint.
    // Note an invite/reset arrival synchronously (before any await) so a slow
    // setSession can't lose the signal to show the set-password screen.
    try {
      const h = location.hash || '';
      if (/type=(invite|recovery)/.test(h)) {
        try { sessionStorage.setItem('rg_need_pw', '1'); } catch (_e) {}
        if (active) setNeedPw(true);
        // A password reset is an existing user — don't replay the first-run tour.
        if (/type=recovery/.test(h)) { try { localStorage.setItem('rg_tour_seen', '1'); } catch (_e) {} }
      }
    } catch (_e) {}

    (async () => {
      let bootError = null;
      if (active) setBootStage('restoring your session');
      try { const r = await completeAuthRedirect(); if (r && r.error) bootError = r.error; } catch (_e) {}
      let session = null;
      // Cap the wait so a slow token refresh can't trap the splash; the auth
      // listener below still catches a session that lands a moment later.
      try { session = await Promise.race([getSession(), new Promise((res) => setTimeout(() => res(null), 5000))]); } catch (_e) {}
      if (active) setBootStage('loading your shelf');
      await apply(session, bootError);
      // Watch for later changes only — skip the redundant INITIAL_SESSION that
      // fires on subscribe, which would otherwise wipe the boot error we just set.
      try {
        const { data } = onAuth((s, event) => { if (event === 'INITIAL_SESSION') return; apply(s, null); });
        sub = data && data.subscription;
      } catch (_e) {}
    })();

    // Safety net: never sit on the splash. If the auth boot is slow, unstick the
    // UI; then do one more session read so a session that just arrived still lands
    // the user in the app (and the onAuth listener catches any later refresh too).
    const timer = setTimeout(async () => {
      if (!active) return;
      setSt((p) => (p.loading ? { ...p, loading: false } : p));
      try { const s = await getSession(); if (active && s) apply(s, null); } catch (_e) {}
    }, 6000);

    return () => { active = false; clearTimeout(timer); try { if (sub) sub.unsubscribe(); } catch (_e) {} };
  }, []);

  if (st.loading) return html`<${LoadingScreen} stage=${bootStage} onReload=${() => location.reload()} />`;
  if (!isConfigured()) return html`<${Shell} />`;
  if (!st.session) return html`<${S.SignIn} bootError=${st.error} />`;
  if (needPw) return html`<${S.SetPassword} email=${st.email} onDone=${() => { try { sessionStorage.removeItem('rg_need_pw'); } catch (_e) {} setNeedPw(false); }} />`;
  if (!st.profile) return html`<${S.NotInvited} email=${st.email} onSignOut=${signOut} />`;
  // New members (friends): walk them through onboarding before the app proper.
  if (st.profile && st.profile.onboarding_complete === false) {
    return html`<div class="app"><main class="app-main"><${S.Onboarding} /></main></div>`;
  }
  return html`<${Shell} profile=${st.profile} />`;
}

render(html`<${App} />`, document.getElementById('app'));
