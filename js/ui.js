// Shared UI primitives + a hand-rolled inline-SVG icon set (no font dependency).
import { html } from './html.js';

const SOLID = new Set(['star', 'sparkles', 'sparkle', 'medal', 'gift']);

const PATHS = {
  book:      html`<path d="M12 5c-1.6-1-4.2-1.6-6.6-1.6C4.1 3.4 3 4.1 3 5.2v11.6c0 .9.8 1.4 1.6 1.2 2.2-.5 4.6-.2 6.4.8 1.8-1 4.2-1.3 6.4-.8.8.2 1.6-.3 1.6-1.2V5.2c0-1.1-1.1-1.8-2.4-1.8-2.4 0-5 .6-6.6 1.6z"/><path d="M12 5v13"/>`,
  books:     html`<path d="M12 5c-1.6-1-4.2-1.6-6.6-1.6C4.1 3.4 3 4.1 3 5.2v11.6c0 .9.8 1.4 1.6 1.2 2.2-.5 4.6-.2 6.4.8 1.8-1 4.2-1.3 6.4-.8.8.2 1.6-.3 1.6-1.2V5.2c0-1.1-1.1-1.8-2.4-1.8-2.4 0-5 .6-6.6 1.6z"/><path d="M12 5v13"/>`,
  sparkles:  html`<path d="M12 3l1.7 4.6L18 9.2l-4.3 1.6L12 15.4l-1.7-4.6L6 9.2l4.3-1.6z"/><path d="M18.5 14l.8 2.1 2.2.8-2.2.8-.8 2.1-.8-2.1-2.2-.8 2.2-.8z"/>`,
  sparkle:   html`<path d="M12 4l1.9 5.1L19 11l-5.1 1.9L12 18l-1.9-5.1L5 11l5.1-1.9z"/>`,
  users:     html`<circle cx="9" cy="8" r="3.2"/><path d="M3.6 19a5.4 5.4 0 0 1 10.8 0"/><path d="M16 5.2a3.2 3.2 0 0 1 0 5.6"/><path d="M17.4 13.6a5.4 5.4 0 0 1 3 4.9"/>`,
  user:      html`<circle cx="12" cy="8" r="3.4"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0"/>`,
  feed:      html`<path d="M3 12h4l2-6 4 12 2-6h6"/>`,
  star:      html`<path d="M12 3.6l2.6 5.3 5.8.9-4.2 4.1 1 5.8L12 17l-5.2 2.7 1-5.8L3.6 9.8l5.8-.9z"/>`,
  heart:     html`<path d="M12 20s-7-4.4-9.2-9C1.2 7.6 3.2 4.6 6.2 4.6c2 0 3.2 1.2 4 2.5.8-1.3 2-2.5 4-2.5 3 0 5 3 3.4 6.4C19 15.6 12 20 12 20z"/>`,
  plus:      html`<path d="M12 5v14M5 12h14"/>`,
  search:    html`<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/>`,
  x:         html`<path d="M6 6l12 12M18 6L6 18"/>`,
  chevleft:  html`<path d="M15 5l-7 7 7 7"/>`,
  chevright: html`<path d="M9 5l7 7-7 7"/>`,
  check:     html`<path d="M5 12.5l4.5 4.5L19 6.5"/>`,
  send:      html`<path d="M12 19V5M6 11l6-6 6 6"/>`,
  flag:      html`<path d="M5 21V4M5 4h11l-2 3 2 3H5"/>`,
  flask:     html`<path d="M9 3h6M10 3v6.2L5.2 18a2 2 0 0 0 1.8 3h10a2 2 0 0 0 1.8-3L14 9.2V3"/><path d="M7.4 14.5h9.2"/>`,
  compass:   html`<circle cx="12" cy="12" r="8.6"/><path d="M15.6 8.4l-2.1 5.1-5.1 2.1 2.1-5.1z"/>`,
  flame:     html`<path d="M12 3c2 3 4.2 4.6 4.2 8.2A4.2 4.2 0 0 1 7.8 11c0-1.1.4-2 1.1-3 .3 1 .9 1.5 1.6 1.7C9.9 7.8 10.4 5.4 12 3z"/>`,
  cup:       html`<path d="M5 8h11v5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z"/><path d="M16 9h2.3a2 2 0 0 1 0 4H16"/><path d="M7.5 4.4v1.2M10 4v1.2M12.5 4.4v1.2"/>`,
  clock:     html`<circle cx="12" cy="12" r="8.6"/><path d="M12 7v5l3 2"/>`,
  bulb:      html`<path d="M9.5 18h5M10.5 21h3"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.5.4.6 1 .6 1.6V16h6v-.6c0-.6.1-1.2.6-1.6A6 6 0 0 0 12 3z"/>`,
  alert:     html`<path d="M12 9.5v4M12 17h.01"/><path d="M10.3 4.4 2.7 18a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3L13.7 4.4a2 2 0 0 0-3.4 0z"/>`,
  bookmark:  html`<path d="M6 4h12v16l-6-4-6 4z"/>`,
  arrow:     html`<path d="M5 12h14M13 6l6 6-6 6"/>`,
  medal:     html`<path d="M8.5 3.5 12 9l3.5-5.5M9 3.5h6"/><circle cx="12" cy="15" r="6"/><path d="M12 12.6l.9 1.9 2 .3-1.45 1.4.35 2L12 17.2l-1.8.95.35-2L9.1 14.8l2-.3z"/>`,
  gift:      html`<path d="M4.5 9h15v3h-15zM6 12h12v8H6zM12 9v11"/><path d="M12 9C12 6 11 4 8.8 4 7 4 6.6 6.6 8.6 8.2 9.6 9 12 9 12 9zM12 9c0-3 1-5 3.2-5 1.8 0 2.2 2.6.2 4.2C14.4 9 12 9 12 9z"/>`,
  dnf:       html`<circle cx="12" cy="12" r="8.6"/><path d="M6.3 6.3l11.4 11.4"/>`,
  edit:      html`<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/>`,
  moon:      html`<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>`,
  mail:      html`<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M4 7.5l8 5.5 8-5.5"/>`,
};

export function Icon({ name, solid, cls = '', size = 20 }) {
  const inner = PATHS[name] || PATHS.book;
  const isSolid = solid || SOLID.has(name);
  return html`<svg class=${cls} width=${size} height=${size} viewBox="0 0 24 24" aria-hidden="true"
    fill=${isSolid ? 'currentColor' : 'none'}
    stroke=${isSolid ? 'none' : 'currentColor'}
    stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}

export function Avatar({ initial, color, size }) {
  return html`<div class=${'avatar' + (size ? ' ' + size : '')} style=${`background:${color}`}>${initial}</div>`;
}

export function BookCover({ book, size }) {
  const c = (book && book.cover) || '#3a3160';
  const big = size === 'lg';
  const url = book && book.coverUrl;
  return html`<div class=${'book-cover' + (size ? ' ' + size : '')}
      style=${`background:linear-gradient(155deg, ${c} 0%, rgba(0,0,0,0.5) 130%)`}>
    <span class="spine"></span>
    ${url
      ? html`<img src=${url} alt="" loading="lazy" onError=${(e) => { e.target.style.display = 'none'; }} />`
      : html`<span style=${`position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:var(--serif);font-weight:600;font-size:${big ? '46px' : '22px'};color:rgba(255,255,255,0.92)`}>${book ? book.title[0] : '?'}</span>`}
  </div>`;
}

export function Stars({ n, max = 5 }) {
  const out = [];
  for (let i = 1; i <= max; i++) out.push(html`<${Icon} name="star" cls=${i <= n ? '' : 'off'} />`);
  return html`<span class="stars">${out}</span>`;
}

// Tappable rating — same star shape as <Stars>, but each is a button.
export function StarRating({ value = 0, onRate, size = 30 }) {
  const out = [];
  for (let i = 1; i <= 5; i++) {
    out.push(html`<button type="button" class=${'star-btn' + (i <= value ? ' on' : '')}
      aria-label=${i + (i === 1 ? ' star' : ' stars')}
      onClick=${() => onRate && onRate(i)}><${Icon} name="star" size=${size} /></button>`);
  }
  return html`<div class="star-rating">${out}</div>`;
}

export function Pill({ tone, icon, children }) {
  return html`<span class=${'pill' + (tone ? ' pill-' + tone : '')}>${icon && html`<${Icon} name=${icon} />`}${children}</span>`;
}

export function Progress({ pct }) {
  return html`<div class="progress"><i style=${`width:${pct}%`}></i></div>`;
}

export function ConfBar({ pct }) {
  return html`<div class="conf-bar"><i style=${`width:${pct}%`}></i></div>`;
}

export function MatchRing({ pct, color }) {
  const r = 21, circ = 2 * Math.PI * r, off = circ * (1 - pct / 100);
  return html`<div class="match-ring">
    <svg viewBox="0 0 50 50">
      <circle cx="25" cy="25" r=${r} fill="none" stroke="var(--bg-3)" stroke-width="4" />
      <circle cx="25" cy="25" r=${r} fill="none" stroke=${color || 'var(--gold)'} stroke-width="4"
        stroke-linecap="round" stroke-dasharray=${circ} stroke-dashoffset=${off} />
    </svg>
    <span class="pct">${pct}%</span>
  </div>`;
}

export function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 6.5"/></svg><span></span>';
  el.lastChild.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2000);
}
