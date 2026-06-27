// Entry point: auth gate → hash router + app shell (top bar, screen outlet, bottom nav).
import { render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { html } from './html.js';
import { Icon, Avatar } from './ui.js';
import { me } from './data.js';
import { getBrand } from './brand.js';
import { isConfigured } from './config.js';
import { getSession, onAuth, getMyProfile, getUserEmail, signOut } from './auth.js';
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
    case 'profile':    return { screen: html`<${S.Profile} />`, nav: 'profile' };
    case 'search':     return { screen: html`<${S.Search} />`, nav: 'shelf' };
    case 'import':     return { screen: html`<${S.Import} />`, nav: 'profile' };
    case 'rated':      return { screen: html`<${S.RatedList} min=${seg[1]} />`, nav: 'profile' };
    case 'admin':      return { screen: html`<${S.Admin} />`, nav: 'profile' };
    case 'shelf':      return { screen: html`<${S.Shelf} tab=${seg[1]} />`, nav: 'shelf' };
    default:           return { screen: html`<${S.Shelf} />`, nav: 'shelf' };
  }
}

function Shell() {
  const hash = useHash();
  const brand = getBrand();
  const { screen, nav, bare } = route(hash);
  const navCls = (k) => 'nav-item' + (nav === k ? ' active' : '');
  useEffect(() => { document.title = brand.name; }, [brand.name]);
  useEffect(() => { initStore(); }, []);

  return html`<div class="app">
    ${!bare && html`<header class="topbar">
      <div class="brand" onClick=${() => go('/shelf')} role="button">
        <span class="brand-mark">${brand.logo()}</span>
        <span class="brand-name">${brand.wordmark()}</span>
        <span class="beta-tag">Beta</span>
      </div>
      <div class="topbar-actions">
        <button class="icon-btn" onClick=${() => go('/search')} aria-label="Add a book"><${Icon} name="plus" /></button>
        <button class="icon-btn" onClick=${() => go('/profile')} aria-label="Your profile">
          <${Avatar} initial=${me.initial} color=${me.color} size="sm" />
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
  </div>`;
}

function LoadingScreen() {
  const brand = getBrand();
  return html`<div class="app"><div class="splash">
    <div class="splash-lamp">${brand.fam.art()}</div>
    <div class="splash-sub">opening the library…</div>
  </div></div>`;
}

function App() {
  const [st, setSt] = useState({ loading: true, session: null, profile: null, email: null });

  useEffect(() => {
    // No backend configured yet → run the local (mock) app as before.
    if (!isConfigured()) {
      setSt({ loading: false, session: 'local', profile: { local: true }, email: null });
      return;
    }
    let sub;
    (async () => {
      const session = await getSession();
      const profile = session ? await getMyProfile() : null;
      const email = session ? await getUserEmail() : null;
      setSt({ loading: false, session, profile, email });
      const { data } = onAuth(async (s) => {
        const profile2 = s ? await getMyProfile() : null;
        const email2 = s ? await getUserEmail() : null;
        setSt({ loading: false, session: s, profile: profile2, email: email2 });
      });
      sub = data && data.subscription;
    })();
    return () => { try { if (sub) sub.unsubscribe(); } catch (e) {} };
  }, []);

  if (st.loading) return html`<${LoadingScreen} />`;
  if (!isConfigured()) return html`<${Shell} />`;
  if (!st.session) return html`<${S.SignIn} />`;
  if (!st.profile) return html`<${S.NotInvited} email=${st.email} onSignOut=${signOut} />`;
  // New members (friends): walk them through onboarding before the app proper.
  if (st.profile && st.profile.onboarding_complete === false) {
    return html`<div class="app"><main class="app-main"><${S.Onboarding} /></main></div>`;
  }
  return html`<${Shell} />`;
}

render(html`<${App} />`, document.getElementById('app'));
