// Brand + familiar system. Lets us try names/familiars without rebuilds:
//   ?brand=nightstand|bound   ?familiar=cat|moth|dog   (also remembered in localStorage)
import { html } from './html.js';

export const FAMILIARS = {
  cat: {
    id: 'cat', name: 'Binx', label: 'a black tuxedo cat',
    art: () => html`<svg viewBox="0 0 64 64" style="width:100%;height:100%" aria-hidden="true">
      <path d="M47 53c8-2 9-12 3-16" fill="none" stroke="#241c40" stroke-width="6" stroke-linecap="round"/>
      <path d="M20 57c-3-15 4-23 12-23s15 8 12 23z" fill="#241c40"/>
      <path d="M27 57c-1-10 2-15 5-15s6 5 5 15z" fill="#f4eede"/>
      <circle cx="32" cy="26" r="13" fill="#241c40"/>
      <path d="M21 19l-3-11 12 6z" fill="#241c40"/>
      <path d="M43 19l3-11-12 6z" fill="#241c40"/>
      <ellipse cx="32" cy="31" rx="7" ry="5" fill="#f4eede"/>
      <ellipse cx="27" cy="24" rx="2.6" ry="3.3" fill="#e9b85c"/>
      <ellipse cx="37" cy="24" rx="2.6" ry="3.3" fill="#e9b85c"/>
      <ellipse cx="27" cy="24.3" rx="1" ry="3" fill="#241c40"/>
      <ellipse cx="37" cy="24.3" rx="1" ry="3" fill="#241c40"/>
      <path d="M30.5 29.6h3l-1.5 2.2z" fill="#e58bab"/>
    </svg>`,
  },
  moth: {
    id: 'moth', name: 'Mabel', label: 'a lamplight moth',
    art: () => html`<svg viewBox="0 0 64 64" style="width:100%;height:100%" aria-hidden="true">
      <path d="M32 25C21 13 7 17 9 30c2 11 15 12 23 6z" fill="#e9b85c"/>
      <path d="M32 25C43 13 57 17 55 30c-2 11-15 12-23 6z" fill="#e9b85c"/>
      <path d="M32 35c-7 0-13 6-11 15 4 6 9 4 11-2z" fill="#cf9540"/>
      <path d="M32 35c7 0 13 6 11 15-4 6-9 4-11-2z" fill="#cf9540"/>
      <circle cx="17" cy="26" r="3" fill="#241c40"/>
      <circle cx="47" cy="26" r="3" fill="#241c40"/>
      <ellipse cx="32" cy="33" rx="3.4" ry="13" fill="#3a2d1a" stroke="#e9b85c" stroke-width="0.6"/>
      <g stroke="#f4d27a" stroke-width="0.7" stroke-linecap="round">
        <line x1="29.3" y1="25" x2="34.7" y2="25"/>
        <line x1="28.8" y1="29" x2="35.2" y2="29"/>
        <line x1="28.7" y1="33" x2="35.3" y2="33"/>
        <line x1="28.8" y1="37" x2="35.2" y2="37"/>
        <line x1="29.3" y1="41" x2="34.7" y2="41"/>
      </g>
      <circle cx="32" cy="19" r="3.4" fill="#3a2d1a" stroke="#e9b85c" stroke-width="0.6"/>
      <path d="M32 17c-2-4-7-6-10-4M32 17c2-4 7-6 10-4" fill="none" stroke="#3a2d1a" stroke-width="1.6" stroke-linecap="round"/>
    </svg>`,
  },
  dog: {
    id: 'dog', name: 'Biscuit', label: 'the club dog',
    art: () => html`<svg viewBox="0 0 64 64" style="width:100%;height:100%" aria-hidden="true">
      <path d="M47 51c7 0 9-6 6-11" fill="none" stroke="#c98e34" stroke-width="6" stroke-linecap="round"/>
      <path d="M22 57c-4-13 2-21 10-21s14 8 10 21z" fill="#d99f4a"/>
      <ellipse cx="32" cy="28" rx="12" ry="11" fill="#e9b85c"/>
      <path d="M20 21c-6 1-7 9-3 15 3-2 5-6 6-11z" fill="#c98e34"/>
      <path d="M44 21c6 1 7 9 3 15-3-2-5-6-6-11z" fill="#c98e34"/>
      <ellipse cx="32" cy="33" rx="6" ry="4.6" fill="#f4d9a8"/>
      <ellipse cx="32" cy="30" rx="2.3" ry="1.7" fill="#241c40"/>
      <circle cx="27" cy="25" r="1.8" fill="#241c40"/>
      <circle cx="37" cy="25" r="1.8" fill="#241c40"/>
    </svg>`,
  },
};

export const BRANDS = {
  nightstand: {
    id: 'nightstand',
    name: 'The Nightstand',
    wordmark: () => html`The <b>Nightstand</b>`,
    tagline: 'a book club for people who’d rather be reading',
    familiar: 'moth',
    logo: () => html`<svg viewBox="0 0 512 512" style="width:100%;height:100%" aria-hidden="true">
      <rect width="512" height="512" rx="116" fill="#1b1436"/>
      <g fill="#e9b85c">
        <path d="M182 158h148l38 92H144z"/>
        <rect x="246" y="250" width="20" height="104" rx="6"/>
        <rect x="200" y="350" width="112" height="18" rx="9"/>
        <rect x="96" y="374" width="320" height="14" rx="7"/>
        <path d="M120 220l7 19 19 7-19 7-7 19-7-19-19-7 19-7z"/>
        <path d="M392 230l6 16 16 6-16 6-6 16-6-16-16-6 16-6z"/>
      </g>
    </svg>`,
  },
  bound: {
    id: 'bound',
    name: 'Bound',
    wordmark: () => html`<b>Bound</b>`,
    tagline: 'read alone, together — a private book club',
    familiar: 'cat',
    logo: () => html`<svg viewBox="0 0 512 512" style="width:100%;height:100%" aria-hidden="true">
      <rect width="512" height="512" rx="116" fill="#1b1436"/>
      <rect x="150" y="132" width="212" height="248" rx="16" fill="#e9b85c"/>
      <rect x="150" y="132" width="30" height="248" rx="10" fill="#bb8a36"/>
      <rect x="238" y="120" width="34" height="272" fill="#8a78d8"/>
      <path d="M255 246l-26-20v40zM255 246l26-20v40z" fill="#6f5cc0"/>
      <circle cx="255" cy="246" r="13" fill="#a896ec"/>
      <g fill="#f4eede">
        <path d="M150 104l6 17 17 6-17 6-6 17-6-17-17-6 17-6z"/>
        <path d="M372 372l5 14 14 5-14 5-5 14-5-14-14-5 14-5z"/>
      </g>
    </svg>`,
  },
};

export function getBrand() {
  const q = new URLSearchParams(location.search);
  let id = q.get('brand');
  if (id) { try { localStorage.setItem('rg_brand', id); } catch (e) {} }
  id = id || (() => { try { return localStorage.getItem('rg_brand'); } catch (e) { return null; } })() || 'nightstand';
  if (!BRANDS[id]) id = 'nightstand';
  const brand = BRANDS[id];

  let fam = q.get('familiar');
  if (fam) { try { localStorage.setItem('rg_familiar', fam); } catch (e) {} }
  fam = fam || (() => { try { return localStorage.getItem('rg_familiar'); } catch (e) { return null; } })() || brand.familiar;
  if (!FAMILIARS[fam]) fam = brand.familiar;

  return { ...brand, familiarId: fam, fam: FAMILIARS[fam] };
}
