// All Phase 0 screens, rendered from mock data.
import { html } from './html.js';
import { useState, useEffect, useRef } from 'preact/hooks';
import * as D from './data.js';
import { Icon, Avatar, BookCover, Stars, StarRating, Pill, Progress, ConfBar, toast, shareBook } from './ui.js';
import { getBrand } from './brand.js';
import { signInWithPassword, resetPassword, setPassword, joinWaitlist, signOut } from './auth.js';
import { useStore, addToShelf, setStatus, updateShelfItem, persistCover, importShelf, neverRecommend, snoozeBook, setRatingAndNudge, removeFromShelf, setMyMood, saveProfileBasics, completeOnboarding, listMembers, getCircle, recommendToFriends, getCircleRecs, respondToRec } from './store.js';
import { advisorReady, advisorChat, advisorRecommend, advisorEnrich, advisorDescribe } from './advisor.js';
import { searchBooks } from './lib/openlibrary.js';
import { parseGoodreads } from './lib/goodreads.js';
import { adminList, adminAct } from './admin.js';

export const go = (p) => { location.hash = p; };

const stripHtml = (s) => (s || '').replace(/<[^>]+>/g, '');
const escapeHtml = (s) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const statusMove = { to_read: 'TBR', reading: 'Reading', finished: 'Finished', dnf: 'DNF' };

function greeting() {
  const hStr = new Date().getHours();
  if (hStr < 12) return 'Good morning';
  if (hStr < 18) return 'Good afternoon';
  return 'Good evening';
}

function WishCard() {
  const brand = getBrand();
  return html`<div class="hero" onClick=${() => go('/genie')} role="button">
    <div class="hero-familiar">${brand.fam.art()}</div>
    <span class="spark s1"><${Icon} name="sparkle" /></span>
    <span class="spark s2"><${Icon} name="sparkle" /></span>
    <span class="spark s3"><${Icon} name="sparkle" /></span>
    <span class="spark s4"><${Icon} name="sparkle" /></span>
    <div class="hero-kicker">Your advisor</div>
    <div class="hero-title">Your next read</div>
    <div class="hero-sub">Tell the advisor your mood and you’ll get a book you’ll actually love.</div>
    <button class="btn btn-primary"><${Icon} name="sparkles" /> Consult your advisor</button>
  </div>`;
}

// Shown on advisor screens when the member is archived (AI paused, app still works).
function AdvisorPaused() {
  return html`<div class="card center-col" style="gap:10px;padding:26px 18px">
    <div class="blind-gift" style="width:54px;height:54px;margin:0;border-radius:14px;background:var(--bg-2);color:var(--text-3);box-shadow:none"><${Icon} name="moon" /></div>
    <div class="book-title">Mabel is paused on your account</div>
    <p class="muted" style="margin:0;line-height:1.55;font-size:13.5px">You can still use all your shelves — add books, rate them, track progress, and mark where to find them. Ask Chelsea to switch the advisor back on.</p>
    <button class="btn btn-block mt-8" onClick=${() => go('/shelf')}><${Icon} name="books" /> Go to your shelves</button>
  </div>`;
}

// "Recommend to a friend" — inline picker (members + note); writes a friend rec
// that lands in their "From your circle" picks (the recommendations table).
function RecommendButton({ book }) {
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState(null);
  const [picked, setPicked] = useState([]);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);

  const toggleOpen = async () => {
    const nx = !open; setOpen(nx);
    if (nx && members === null) { try { setMembers(await listMembers()); } catch (_e) { setMembers([]); } }
  };
  const toggle = (id) => setPicked((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  const send = async () => {
    if (!picked.length || sending) return;
    setSending(true);
    try {
      const n = await recommendToFriends(book, picked, note);
      toast(`Recommended to ${n} ${n === 1 ? 'friend' : 'friends'} 🌙`);
      setOpen(false); setPicked([]); setNote('');
    } catch (e) { toast('Could not send — try again'); }
    setSending(false);
  };

  return html`<div class="card mt-12">
    <button class="btn btn-block" onClick=${toggleOpen}><${Icon} name="heart" /> Recommend to a friend</button>
    ${open ? html`<div class="mt-12">
      ${members === null
        ? html`<div class="empty" style="padding:14px"><div class="bubble genie typing" style="align-self:center"><i></i><i></i><i></i></div></div>`
        : members.length === 0
          ? html`<p class="dim" style="margin:0;font-size:13px">No one in your circle yet — invite a friend from the Admin console.</p>`
          : html`
            <div class="section-title">Send to…</div>
            <div class="tagrow mt-8">
              ${members.map((m) => html`<button class=${'tag' + (picked.includes(m.id) ? ' love' : '')} onClick=${() => toggle(m.id)}>${picked.includes(m.id) ? '✓ ' : ''}${m.name}</button>`)}
            </div>
            <div class="field mt-12" style="margin-bottom:0">
              <label>Add a note <span style="color:var(--text-3);font-weight:400;text-transform:none;letter-spacing:0">(optional)</span></label>
              <textarea rows="2" placeholder="why you think they’ll love it…" value=${note} onInput=${(e) => setNote(e.target.value)}></textarea>
            </div>
            <button class="btn btn-primary btn-block mt-12" disabled=${!picked.length || sending} onClick=${send}>
              <${Icon} name="send" /> ${sending ? 'Sending…' : (picked.length ? `Recommend to ${picked.length}` : 'Pick a friend')}
            </button>`}
    </div>` : ''}
  </div>`;
}

/* ---------------- New-user walkthrough ---------------- */
const TOUR_SLIDES = [
  { fam: true, title: 'Meet Mabel', body: 'Your reading advisor — a warm, opinionated librarian who learns your taste and recommends books you’ll genuinely love. No spoilers, ever.' },
  { icon: 'books', title: 'Help me choose', body: 'Torn between books you already have? Mabel interviews you — what you’re in the mood to feel, how hard you want to fall for it — then narrows it down with real reasons. (A favorite around here.)', cta: { label: 'Try “Help me choose”', to: '/choose' } },
  { icon: 'sparkles', title: 'Consult your advisor', body: 'Tell Mabel your mood and get a few picks tailored to your taste — each with her reasoning and a confidence level.', cta: { label: 'Get a recommendation', to: '/genie' } },
  { icon: 'star', title: 'Your shelves, your profile', body: 'Track what you’re reading and rate the ones you finish — especially the 5★ and 1★ — and your reading profile sharpens over time.' },
];

export function Tour({ onClose }) {
  const brand = getBrand();
  const [i, setI] = useState(0);
  const s = TOUR_SLIDES[i];
  const last = i === TOUR_SLIDES.length - 1;
  const jump = (to) => { onClose(); go(to); };
  return html`<div class="tour-overlay" onClick=${(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div class="tour-card">
      <button class="tour-skip" onClick=${onClose}>Skip</button>
      <div class=${'tour-icon' + (s.fam ? ' fam' : '')}>${s.fam ? brand.fam.art() : html`<${Icon} name=${s.icon} />`}</div>
      <div class="tour-title">${s.title}</div>
      <p class="tour-body">${s.body}</p>
      ${s.cta ? html`<button class="btn btn-ghost btn-block mt-12" onClick=${() => jump(s.cta.to)}><${Icon} name="arrow" /> ${s.cta.label}</button>` : ''}
      <div class="tour-dots">${TOUR_SLIDES.map((_, n) => html`<span class=${'tour-dot' + (n === i ? ' on' : '')}></span>`)}</div>
      <div class="row mt-12" style="gap:8px">
        ${i > 0 ? html`<button class="btn grow" onClick=${() => setI(i - 1)}>Back</button>` : ''}
        <button class="btn btn-primary grow" onClick=${() => last ? onClose() : setI(i + 1)}>${last ? 'Start reading' : 'Next'}</button>
      </div>
    </div>
  </div>`;
}

/* ---------------- Shelf (home) ---------------- */
export function Shelf({ tab: initialTab }) {
  const st = useStore();
  const [tab, setTab] = useState(['reading', 'to_read', 'finished', 'dnf'].includes(initialTab) ? initialTab : 'to_read');
  const [editingMood, setEditingMood] = useState(false);
  const [moodDraft, setMoodDraft] = useState('');

  if (!st.ready) {
    return html`<div class="screen"><div class="empty mt-20"><${Icon} name="books" /><div>Opening your shelves…</div></div></div>`;
  }

  const readingItems = st.shelves.reading || [];
  const list = st.shelves[tab];

  return html`<div class="screen">
    <div class="screen-title">${greeting()}, ${st.me.name}</div>
    <div class="screen-sub">Today’s mood: ${editingMood
      ? html`<span style="display:inline-flex;gap:6px;align-items:center;vertical-align:middle">
          <input value=${moodDraft} placeholder="how you’re feeling…" autofocus
            style="background:var(--bg-2);border:1px solid var(--line-2);border-radius:10px;padding:4px 9px;font-size:13px;width:170px;max-width:55vw"
            onInput=${(e) => setMoodDraft(e.target.value)}
            onKeyDown=${(e) => { if (e.key === 'Enter') { setMyMood(moodDraft); setEditingMood(false); } else if (e.key === 'Escape') setEditingMood(false); }} />
          <button class="icon-btn" style="width:30px;height:30px" aria-label="Save mood" onClick=${() => { setMyMood(moodDraft); setEditingMood(false); }}><${Icon} name="check" /></button>
        </span>`
      : html`<span class="gold" role="button" style="cursor:pointer;border-bottom:1px dashed var(--line-2)" onClick=${() => { setMoodDraft(st.me.mood || ''); setEditingMood(true); }}>${st.me.mood || 'set your mood'}</span>`}</div>

    <${WishCard} />

    ${readingItems.length ? html`
      <div class="section-head"><span class="section-title">Continue reading${readingItems.length > 1 ? ` · ${readingItems.length}` : ''}</span></div>
      ${readingItems.map((item) => {
        const rb = st.booksById[item.bookId];
        if (!rb) return null;
        return html`<div class="card book-row" onClick=${() => go('/book/' + rb.id)} role="button">
          <${BookCover} book=${rb} />
          <div class="book-meta">
            <div class="book-title">${rb.title}</div>
            <div class="book-author">${rb.author}</div>
            <${Progress} pct=${item.progress} />
            <div class="book-note">${item.progress}% · tap to log progress or finish</div>
          </div>
        </div>`;
      })}` : ''}

    <div class="section-head"><span class="section-title">Your shelves</span><button class="section-link" style="background:none;border:0;cursor:pointer" onClick=${() => go('/search')}>+ Add a book</button></div>
    <div class="seg">
      ${[['reading', 'Reading'], ['to_read', 'TBR'], ['finished', 'Finished'], ['dnf', 'DNF']].map(
        ([k, label]) => html`<button class=${'seg-item' + (tab === k ? ' active' : '')} onClick=${() => setTab(k)}>${label}</button>`
      )}
    </div>

    ${list.length === 0
      ? html`<div class="empty"><${Icon} name="book" /><div>Nothing here yet.</div></div>`
      : list.map((item) => {
          const b = st.booksById[item.bookId];
          if (!b) return null;
          return html`<div class="book-row" onClick=${() => go('/book/' + b.id)} role="button">
            <${BookCover} book=${b} />
            <div class="book-meta">
              <div class="book-title">${b.title}</div>
              <div class="book-author">${b.author}</div>
              ${tab === 'finished' && item.rating && html`<div class="mt-8"><${Stars} n=${item.rating} /></div>`}
              ${tab === 'dnf' && html`<div class="book-note">${item.atPct ? 'Stopped at ' + item.atPct + '% · ' : ''}${item.reason || ''}</div>`}
              ${tab === 'to_read' && item.addedNote && html`<div class="book-note">“${item.addedNote}”</div>`}
              ${tab === 'reading' && html`<div class="mt-8"><${Progress} pct=${item.progress || 0} /></div>`}
              ${((item.availability && item.availability.length) || item.libbyHold) ? html`<div class="book-note">${(item.availability || []).join(' · ')}${item.libbyHold ? ((item.availability && item.availability.length) ? ' · ' : '') + '⏳ Libby hold' : ''}</div>` : ''}
            </div>
            <${Icon} name="chevright" cls="dim-ico" />
          </div>`;
        })}
  </div>`;
}

/* ---------------- Rated books (from Profile stats) ---------------- */
export function RatedList({ min }) {
  const st = useStore();
  const onlyFive = parseInt(min, 10) === 5;
  if (!st.ready) return html`<div class="screen"><div class="empty mt-20"><${Icon} name="star" /><div>Loading…</div></div></div>`;
  const rated = (st.shelves.finished || [])
    .filter((i) => i.rating && (!onlyFive || i.rating === 5))
    .map((i) => ({ i, b: st.booksById[i.bookId] }))
    .filter((x) => x.b)
    .sort((a, b) => b.i.rating - a.i.rating);
  return html`<div class="screen">
    <button class="back-btn" onClick=${() => history.back()}><${Icon} name="chevleft" /> Back</button>
    <div class="screen-title">${onlyFive ? 'Five-star reads' : 'Your rated books'}</div>
    <div class="screen-sub">${onlyFive ? 'The ones that earned all five.' : 'Highest to lowest.'}</div>
    ${rated.length === 0
      ? html`<div class="empty mt-20"><${Icon} name="star" /><div>${onlyFive ? 'No five-star books yet.' : 'No rated books yet — open a finished book to rate it.'}</div></div>`
      : rated.map(({ i, b }) => html`<div class="book-row" onClick=${() => go('/book/' + b.id)} role="button">
          <${BookCover} book=${b} />
          <div class="book-meta">
            <div class="book-title">${b.title}</div>
            <div class="book-author">${b.author}</div>
            <div class="mt-8"><${Stars} n=${i.rating} /></div>
          </div>
          <${Icon} name="chevright" cls="dim-ico" />
        </div>`)}
  </div>`;
}

/* ---------------- Book detail ---------------- */
export function BookDetail({ id }) {
  const st = useStore();
  const [busy, setBusy] = useState(false);
  const [enrich, setEnrich] = useState(null);
  const [genDesc, setGenDesc] = useState(null);
  const [confirmRm, setConfirmRm] = useState(false);
  const b = (st.booksById && st.booksById[id]) || D.getBook(id);
  useEffect(() => {
    let alive = true;
    setGenDesc(null); setConfirmRm(false);
    if (advisorReady() && b && b.title) {
      const fetchGen = () => advisorDescribe({ title: b.title, author: b.author || '' }).then((d) => { if (alive) setGenDesc(d); }).catch(() => {});
      advisorEnrich({ title: b.title, author: b.author || '' }).then((e) => {
        if (!alive) return;
        setEnrich(e);
        if (e && e.coverUrl) persistCover(id, e.coverUrl); // correct wrong-language covers everywhere
        if (!e || !e.description) fetchGen(); // Google had no usable synopsis → ask Mabel
      }).catch(() => { fetchGen(); });
    }
    return () => { alive = false; };
  }, [id]);
  if (!b) return html`<div class="screen"><button class="back-btn" onClick=${() => history.back()}><${Icon} name="chevleft" /> Back</button><div class="empty">Book not found.</div></div>`;

  let status = null, item = null;
  for (const s of ['reading', 'to_read', 'finished', 'dnf']) {
    const f = (st.shelves[s] || []).find((i) => i.bookId === id);
    if (f) { status = s; item = f; break; }
  }

  const run = async (fn, after) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); if (after) after(); }
    catch (e) { toast('Hmm, that didn’t save — try again'); }
    setBusy(false);
  };

  return html`<div class="screen">
    <button class="back-btn" onClick=${() => history.back()}><${Icon} name="chevleft" /> Back</button>

    <div class="row" style="align-items:flex-start;gap:16px;margin-top:6px">
      <${BookCover} book=${{ ...b, coverUrl: b.coverUrl || (enrich && enrich.coverUrl) || null }} size="lg" />
      <div class="grow">
        <div class="screen-title" style="font-size:23px">${b.title}</div>
        <div class="book-author" style="font-size:14px">${b.author}</div>
        ${status && html`<div class="mt-12"><${Pill} tone=${status === 'finished' ? 'teal' : status === 'dnf' ? 'rose' : 'gold'}>${D.statusLabels[status]}<//></div>`}
        ${status === 'finished' && item.rating && html`<div class="mt-8"><${Stars} n=${item.rating} /></div>`}
      </div>
    </div>

    ${b.tags && b.tags.length ? html`<div class="tagrow mt-16">${b.tags.map((t) => html`<span class="tag">${t}</span>`)}</div>` : ''}

    ${(() => {
      const aboutDesc = (enrich && enrich.description) || genDesc;
      const aboutRating = enrich && enrich.rating;
      if (!aboutDesc && !aboutRating) return '';
      return html`<div class="card mt-16">
        ${aboutRating ? html`<div class="rec-line"><${Icon} name="star" /><span><b>★ ${enrich.rating}</b>${enrich.ratingsCount ? ' · ' + Number(enrich.ratingsCount).toLocaleString() + ' ratings' : ''}</span></div>` : ''}
        ${aboutDesc ? html`<p class="muted" style="margin:${aboutRating ? '10px' : '0'} 0 0;line-height:1.55">${(() => { const t = stripHtml(aboutDesc); return t.length > 700 ? t.slice(0, 700) + '…' : t; })()}</p>` : ''}
      </div>`;
    })()}

    <div class="row mt-12" style="gap:8px">
      <button class="btn btn-ghost grow" onClick=${() => shareBook(b)}><${Icon} name="send" /> Share</button>
      <a class="btn btn-ghost grow" href=${'https://www.google.com/search?q=' + encodeURIComponent(b.title + ' ' + (b.author || '') + ' book')} target="_blank" rel="noopener noreferrer"><${Icon} name="search" /> Look it up</a>
    </div>

    <${RecommendButton} book=${b} />

    ${status === 'reading' && html`<div class="card mt-16">
      <div class="between"><span class="section-title">Your progress</span><span class="conf-num">${item.progress || 0}%</span></div>
      <input type="range" class="range mt-8" min="0" max="100" step="1" value=${item.progress || 0} disabled=${busy}
        onChange=${(e) => run(() => updateShelfItem(item.id, { progress: Number(e.target.value) }), () => toast('Progress saved'))} />
      <div class="book-note">${b.pages ? `~ page ${Math.round((item.progress || 0) / 100 * b.pages)} of ${b.pages}` : 'Drag to update where you are'}</div>
      <div class="row mt-12" style="gap:8px">
        <button class="btn btn-primary grow" disabled=${busy} onClick=${() => run(() => setStatus(item.id, 'finished', { finished_at: new Date().toISOString().slice(0, 10) }), () => go('/interview/' + id))}><${Icon} name="sparkles" /> I finished this</button>
        <button class="btn" disabled=${busy} onClick=${() => run(() => setStatus(item.id, 'dnf'), () => toast('Moved to Didn’t finish'))}><${Icon} name="dnf" /> DNF</button>
      </div>
    </div>`}

    ${status === 'finished' && html`<div class="card mt-16">
      <div class="section-title">Your rating</div>
      <div style="margin-top:8px"><${StarRating} value=${item.rating || 0} onRate=${(n) => run(() => setRatingAndNudge(item.id, b, n), () => toast(n === 5 ? 'Five stars — noted what you love' : n === 1 ? 'One star — noted what to avoid' : 'Rated ' + n + ' stars'))} /></div>
      <hr class="divider" />
      ${item.note ? html`<div class="section-title">Your note</div><p class="muted" style="margin:8px 0 12px;line-height:1.55">“${item.note}”</p>` : ''}
      <button class="btn btn-block" onClick=${() => go('/interview/' + id)}><${Icon} name="sparkles" /> Revisit with the advisor</button>
    </div>`}

    ${status === 'to_read' && html`<div class="card mt-16">
      ${item.source === 'friend'
        ? html`<div class="rec-line good"><${Icon} name="heart" /><span>A friend put this on your shelf${item.addedNote ? ': “' + item.addedNote + '”' : ''}.</span></div>`
        : item.addedNote ? html`<div class="rec-line"><${Icon} name="bookmark" /><span>You saved this — “${item.addedNote}”</span></div>` : ''}
      <div class="row mt-12" style="gap:8px">
        <button class="btn btn-primary grow" disabled=${busy} onClick=${() => run(() => setStatus(item.id, 'reading'), () => toast('Started reading'))}><${Icon} name="book" /> Start reading</button>
        <button class="btn" onClick=${() => go('/fit/' + id)}><${Icon} name="sparkles" /> Is it a fit?</button>
      </div>
    </div>`}

    ${status === 'dnf' && html`<div class="card mt-16">
      ${item.reason ? html`<div class="section-title">Why you set it down</div><p class="muted" style="margin:8px 0 0;line-height:1.55">${item.reason}</p>` : ''}
      <div class="rec-line mt-12"><${Icon} name="bulb" /><span>Your advisor logged this as a <b>mood/timing</b> mismatch, not a quality problem.</span></div>
      <button class="btn btn-block mt-12" disabled=${busy} onClick=${() => run(() => setStatus(item.id, 'to_read'), () => toast('Back on your Want shelf'))}><${Icon} name="bookmark" /> Give it another chance</button>
    </div>`}

    ${status && html`<div class="card mt-12">
      <div class="section-title">Move to…</div>
      <div class="tagrow mt-8">
        ${['reading', 'to_read', 'finished', 'dnf'].filter((s) => s !== status).map((s) => html`<button class="tag" disabled=${busy} onClick=${() => run(() => setStatus(item.id, s, s === 'finished' ? { finished_at: new Date().toISOString().slice(0, 10) } : {}), () => toast('Moved to ' + statusMove[s]))}>${statusMove[s]}</button>`)}
      </div>
      <button class="btn btn-ghost btn-block mt-12" style=${'color:var(--danger)' + (confirmRm ? ';border-color:var(--danger)' : '')} disabled=${busy} onClick=${() => { if (!confirmRm) { setConfirmRm(true); return; } run(() => removeFromShelf(item.id), () => { toast('Removed from your shelves'); history.back(); }); }}>
        <${Icon} name="dnf" /> ${confirmRm ? 'Tap again to remove' : 'Remove from my shelves'}
      </button>
    </div>`}

    ${status && html`<div class="card mt-12">
      <div class="section-title">Where to find it</div>
      <div class="tagrow mt-8">
        ${['Libby', 'Kindle Unlimited', 'Audible', 'Spotify'].map((key) => {
          const on = (item.availability || []).includes(key);
          return html`<button class=${'tag' + (on ? ' love' : '')} disabled=${busy}
            onClick=${() => run(() => updateShelfItem(item.id, { availability: on ? item.availability.filter((x) => x !== key) : [...(item.availability || []), key] }), () => toast(on ? 'Removed ' + key : 'Marked on ' + key))}>${on ? '✓ ' : ''}${key}</button>`;
        })}
      </div>
      <button class=${'btn btn-block mt-12' + (item.libbyHold ? ' btn-primary' : '')} disabled=${busy}
        onClick=${() => run(() => updateShelfItem(item.id, { libby_hold: !item.libbyHold }), () => toast(item.libbyHold ? 'Removed Libby hold' : 'Marked on hold in Libby'))}>
        <${Icon} name="clock" /> ${item.libbyHold ? 'On hold in Libby ✓' : 'Mark as on hold in Libby'}
      </button>
    </div>`}

    ${!status && html`<div class="card mt-16">
      <button class="btn btn-primary btn-block" disabled=${busy} onClick=${() => run(() => addToShelf(b, 'to_read'), () => toast('Added to your shelf'))}><${Icon} name="plus" /> Add to shelf</button>
    </div>`}
  </div>`;
}

/* ---------------- Genie (make a wish) ---------------- */
export function Genie() {
  const st = useStore();
  const live = advisorReady();
  const [recs, setRecs] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mood, setMood] = useState(st.me.mood || '');
  const [dismissed, setDismissed] = useState([]);
  const [diag, setDiag] = useState(null);
  const [circleRecs, setCircleRecs] = useState([]);

  useEffect(() => {
    let alive = true;
    (async () => { try { const r = await getCircleRecs(); if (alive) setCircleRecs(r); } catch (_e) {} })();
    return () => { alive = false; };
  }, []);

  if (st.me.status === 'archived') {
    return html`<div class="screen"><div class="screen-title">Your next read</div><${AdvisorPaused} /></div>`;
  }

  const respondRec = async (rec, status) => {
    setCircleRecs((rs) => rs.filter((r) => r.id !== rec.id));
    try { await respondToRec(rec.id, status, status === 'accepted' ? rec.book : null); if (status === 'accepted') toast('Added to your shelf'); } catch (_e) {}
  };

  const consult = async () => {
    if (loading) return;
    if (!live) { toast('Deploy your advisor to go live — showing samples'); return; }
    if (mood && mood.trim()) setMyMood(mood).catch(() => {}); // keep "today's mood" in sync
    setLoading(true);
    setDiag(null);
    try {
      const d = await advisorRecommend({ mood });
      const items = (d && d.items) || [];
      setRecs(items);
      if (!items.length) {
        setDiag({ reason: d && d.reason, raw: d && d.raw });
        toast('No fresh picks this time — try another mood');
      }
    } catch (e) {
      console.warn('[advisor] recommend error:', e && e.message);
      setDiag({ reason: 'error', raw: e && (e.message || String(e)) });
      toast('Advisor hit an error — details below');
    }
    setLoading(false);
  };

  const list = (recs || []).map((r) => ({ ...r, book: { title: r.title, author: r.author, cover: '#4a2f5a', coverUrl: r.coverUrl || null, tags: [] }, bookId: null }));
  const shelfTitles = new Set(Object.values(st.booksById || {}).map((b) => (b.title || '').toLowerCase()));
  const neverTitles = new Set(((st.profile && st.profile.never) || []).map((n) => (n.title || '').toLowerCase()));
  const shown = list.filter((r) => r.book && !dismissed.includes(r.book.title)
    && !shelfTitles.has((r.book.title || '').toLowerCase())
    && !neverTitles.has((r.book.title || '').toLowerCase()));

  // Moods are multi-select: each chip toggles its term in the comma-separated mood.
  const moodHas = (c) => mood.split(',').map((s) => s.trim().toLowerCase()).includes(c.toLowerCase());
  const toggleMood = (c) => setMood((prev) => {
    const parts = prev.split(',').map((s) => s.trim()).filter(Boolean);
    const i = parts.findIndex((p) => p.toLowerCase() === c.toLowerCase());
    if (i >= 0) parts.splice(i, 1); else parts.push(c);
    return parts.join(', ');
  });

  return html`<div class="screen">
    <div class="screen-title">Your next read</div>
    <div class="screen-sub">Every recommendation is a hypothesis — I’ll show my reasoning and my confidence.</div>

    <div class="card">
      <div class="field" style="margin-bottom:10px">
        <label>What are you in the mood for? <span style="color:var(--text-3);font-weight:400;text-transform:none;letter-spacing:0">— pick any that fit, or type your own</span></label>
        <input value=${mood} placeholder="cozy, twisty, something short…" onInput=${(e) => setMood(e.target.value)} />
      </div>
      <div class="tagrow" style="margin-bottom:2px">
        ${['Cozy', 'Twisty', 'A page-turner', 'Make me cry', 'Hopeful', 'Funny', 'Dark & gritty', 'Slow burn', 'Atmospheric', 'Something short', 'Mind-bending', 'Romance', 'Escape', 'Surprise me'].map((c) => html`<button class=${'chip-btn' + (moodHas(c) ? ' active' : '')} onClick=${() => toggleMood(c)}>${c}</button>`)}
      </div>
      <button class=${'btn btn-primary btn-block mt-12' + (loading ? ' pulsing' : '')} disabled=${loading} onClick=${consult}><${Icon} name="sparkles" /> ${loading ? 'Consulting the stars…' : 'Consult your advisor'}</button>
      ${loading && html`<div class="dim" style="font-size:12.5px;text-align:center;margin-top:10px">Mabel is reading your shelves — this can take a moment.</div>`}
    </div>

    ${circleRecs.length ? html`<div class="section-head"><span class="section-title">From your circle</span></div>
      ${circleRecs.map((rec) => html`<div class="card">
        <div class="book-row">
          <${BookCover} book=${rec.book} />
          <div class="book-meta">
            <div class="book-title">${rec.book.title}</div>
            <div class="book-author">${rec.book.author}</div>
            <div class="rec-line good" style="margin-top:6px"><${Icon} name="heart" /><span><b>${rec.by}</b> thinks you’ll love this.</span></div>
            ${rec.note ? html`<p class="rec-line" style="margin-top:4px"><${Icon} name="sparkle" /><span>“${rec.note}”</span></p>` : ''}
          </div>
        </div>
        <div class="row mt-12" style="gap:8px">
          <button class="btn btn-primary grow" onClick=${() => respondRec(rec, 'accepted')}><${Icon} name="plus" /> Add to shelf</button>
          <button class="btn" onClick=${() => respondRec(rec, 'dismissed')}>Dismiss</button>
        </div>
      </div>`)}` : ''}

    ${!loading && recs === null ? html`<div class="card center-col" style="gap:8px;padding:22px 16px">
      <div class="muted" style="font-size:13.5px;text-align:center;line-height:1.5">Tap <b>Consult your advisor</b> and I’ll choose a few books for your taste and mood — each with my reasoning and confidence.</div>
    </div>` : ''}

    ${!loading && recs !== null ? html`
      <div class="section-head"><span class="section-title">Your advisor’s picks for you</span></div>
      ${shown.map((rec) => {
        const b = rec.book;
        return html`<div class="card">
          <div class="book-row" onClick=${rec.bookId ? (() => go('/book/' + rec.bookId)) : undefined} role=${rec.bookId ? 'button' : undefined}>
            <${BookCover} book=${b} />
            <div class="book-meta">
              <div class="row" style="gap:8px">
                <div class="book-title">${b.title}</div>
                ${rec.experiment && html`<${Pill} tone="lilac" icon="flask">Experiment<//>`}
              </div>
              <div class="book-author">${b.author}</div>
              <div class="rec-conf">
                <${ConfBar} pct=${rec.confidence || 0} />
                <span class="conf-num">${rec.confidence || 0}%</span>
              </div>
            </div>
          </div>
          ${rec.moodFit && html`<div class="rec-line mt-12"><${Icon} name="moon" /><span><b>Mood fit:</b> ${rec.moodFit}</span></div>`}
          ${rec.rating && html`<div class="rec-line"><${Icon} name="star" /><span><b>★ ${rec.rating}</b>${rec.ratingsCount ? ' · ' + Number(rec.ratingsCount).toLocaleString() + ' ratings' : ''}</span></div>`}
          ${(rec.good || []).map((g) => html`<div class="rec-line good"><${Icon} name="check" /><span>${g}</span></div>`)}
          ${(rec.warn || []).map((w) => html`<div class="rec-line warn"><${Icon} name="alert" /><span>${w}</span></div>`)}
          <div class="row mt-12" style="gap:8px">
            <button class="btn btn-primary grow" onClick=${() => addToShelf(b, 'to_read').then(() => toast('Added to your shelf')).catch(() => toast('Could not add — try again'))}><${Icon} name="plus" /> Add to shelf</button>
            <button class="btn" onClick=${() => setDismissed((d) => [...d, b.title])}>Not now</button>
          </div>
          <div class="row mt-8" style="gap:8px">
            <button class="btn btn-ghost grow" onClick=${() => { addToShelf(b, 'finished').then(() => toast('Marked as read')).catch(() => toast('Could not save')); setDismissed((d) => [...d, b.title]); }}><${Icon} name="check" /> Read it</button>
            <button class="btn btn-ghost grow" onClick=${() => shareBook(b)}><${Icon} name="send" /> Share</button>
            <a class="btn btn-ghost grow" href=${'https://www.google.com/search?q=' + encodeURIComponent(b.title + ' ' + (b.author || '') + ' book')} target="_blank" rel="noopener noreferrer"><${Icon} name="search" /> Info</a>
          </div>
          <button class="btn btn-ghost btn-block mt-8" style="color:var(--text-3)" onClick=${() => { neverRecommend(b.title, b.author).catch(() => {}); setDismissed((d) => [...d, b.title]); toast('Got it — I won’t suggest that again'); }}><${Icon} name="dnf" /> Never recommend this</button>
        </div>`;
      })}
      ${shown.length === 0 ? html`<div class="card">
        <p class="muted" style="margin:0;font-size:13.5px">${recs.length ? 'Everything that came back is already on your shelves.' : 'Mabel didn’t surface fresh picks this round.'} Try a different mood, or tap <b>Help me choose</b> above.</p>
        ${diag && (diag.raw || diag.reason) && html`<details style="margin-top:10px">
          <summary class="dim" style="font-size:12px;cursor:pointer">What happened? (tap, then share with Claude)</summary>
          <pre style="white-space:pre-wrap;word-break:break-word;font-size:11px;color:var(--text-3);background:var(--bg-2);border-radius:10px;padding:10px;margin:8px 0 0;max-height:220px;overflow:auto">${'reason: ' + (diag.reason || '—') + '\n\n' + (diag.raw ? String(diag.raw).slice(0, 1400) : '(no raw output)')}</pre>
        </details>`}
      </div>` : ''}
    ` : ''}

    <div class="card row mt-12" onClick=${() => go('/choose')} role="button" style="gap:14px">
      <div class="blind-gift" style="width:54px;height:54px;margin:0;border-radius:14px;background:var(--lilac-soft);color:var(--lilac);box-shadow:none"><${Icon} name="books" /></div>
      <div class="grow">
        <div class="book-title">Help me choose</div>
        <div class="book-note">Torn between books you already have? Pick a few and we’ll talk it through.</div>
      </div>
      <${Icon} name="chevright" cls="dim-ico" />
    </div>

    <div class="section-head"><span class="section-title">Feeling adventurous?</span></div>
    <div class="card row" onClick=${() => go('/blind')} role="button" style="gap:14px">
      <div class="blind-gift" style="width:54px;height:54px;margin:0;border-radius:14px"><${Icon} name="gift" /></div>
      <div class="grow">
        <div class="book-title">Blind date with a book</div>
        <div class="book-note">Mabel picked something for you. No cover, no blurb — just vibes.</div>
      </div>
      <${Icon} name="chevright" cls="dim-ico" />
    </div>
  </div>`;
}

/* ---------------- Blind date ---------------- */
export function BlindDate() {
  const [revealed, setRevealed] = useState(false);
  const bd = D.blindDate;
  const b = D.getBook(bd.bookId);
  return html`<div class="screen">
    <button class="back-btn" onClick=${() => history.back()}><${Icon} name="chevleft" /> Back</button>
    <div class="blind-card mt-8">
      ${!revealed ? html`<div>
        <div class="blind-gift"><${Icon} name="gift" /></div>
        <div class="blind-title">A mystery pick from Mabel</div>
        <div class="blind-teaser">Three clues, nothing more:</div>
        <div class="tagrow" style="justify-content:center;margin-bottom:18px">
          ${bd.teasers.map((t) => html`<span class="tag">${t}</span>`)}
        </div>
        <button class="btn btn-primary btn-lg" onClick=${() => setRevealed(true)}><${Icon} name="sparkles" /> Reveal my pick</button>
      </div>` : html`<div class="center-col screen">
        <${BookCover} book=${b} size="lg" />
        <div class="blind-title mt-12">${b.title}</div>
        <div class="book-author">${b.author}</div>
        <button class="btn btn-primary btn-block mt-16" onClick=${() => addToShelf(b, 'to_read').then(() => toast('Added to your shelf')).catch(() => toast('Could not add — try again'))}><${Icon} name="plus" /> Add to shelf</button>
        <div class="row mt-8" style="gap:8px">
          <button class="btn grow" onClick=${() => { snoozeBook(b.title, b.author).catch(() => {}); toast('Okay — I’ll set it aside for a while'); history.back(); }}><${Icon} name="clock" /> Not right now</button>
          <button class="btn grow" style="color:var(--text-3)" onClick=${() => { neverRecommend(b.title, b.author).catch(() => {}); toast('Got it — not for you'); history.back(); }}><${Icon} name="dnf" /> Not for me</button>
        </div>
      </div>`}
    </div>
  </div>`;
}

/* ---------------- Help me choose (from books you already have) ---------------- */
export function Choose() {
  const st = useStore();
  const live = advisorReady();
  const brand = getBrand();
  const [picked, setPicked] = useState([]);
  const [extra, setExtra] = useState([]);          // ad-hoc books found via search
  const [mood, setMood] = useState(st.me.mood || '');
  const [started, setStarted] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);

  if (st.me.status === 'archived') return html`<div class="screen"><div class="chat-topbar"><button class="back-btn" onClick=${() => history.back()}><${Icon} name="chevleft" /> Back</button></div><${AdvisorPaused} /></div>`;

  const tbr = (st.shelves.to_read || []).map((i) => st.booksById[i.bookId]).filter(Boolean);
  const seenT = new Set();
  const candidates = [...tbr, ...extra].filter((b) => {
    const k = (b.title || '').toLowerCase();
    if (seenT.has(k)) return false; seenT.add(k); return true;
  });
  const allTitles = candidates.map((b) => b.title);
  const toggle = (t) => setPicked((p) => p.includes(t) ? p.filter((x) => x !== t) : [...p, t]);

  const runSearch = async () => {
    const query = q.trim();
    if (!query || searching) return;
    setSearching(true);
    try { setResults(await searchBooks(query)); }
    catch (e) { setResults([]); toast('Search failed — try again'); }
    setSearching(false);
  };
  const consider = (b) => {
    if (!candidates.some((x) => (x.title || '').toLowerCase() === (b.title || '').toLowerCase()))
      setExtra((e) => [...e, { title: b.title, author: b.author, coverUrl: b.coverUrl }]);
    setPicked((p) => p.includes(b.title) ? p : [...p, b.title]);
    toast('Added to your choices');
  };
  const saveTbr = (b) => addToShelf({ title: b.title, author: b.author, coverUrl: b.coverUrl }, 'to_read')
    .then(() => toast('Saved to TBR')).catch(() => toast('Could not add'));

  if (started) {
    const chosen = picked.length ? picked : allTitles;
    const trigger = `Help me choose what to read next from these: ${chosen.join(', ')}.${mood ? ' Mood: ' + mood + '.' : ''} Interview me with a question or two to narrow it down, then give me your recommendation(s) with reasons — conditional picks are welcome.`;
    return html`<div class="screen">
      <div class="chat-topbar"><button class="back-btn" onClick=${() => setStarted(false)}><${Icon} name="chevleft" /> Back</button></div>
      <div class="row mt-8" style="gap:10px;margin-bottom:10px">
        <div class="familiar-sm">${brand.fam.art()}</div>
        <div><div class="book-title">Help me choose</div><div class="book-note">${chosen.length} book${chosen.length === 1 ? '' : 's'} on the table</div></div>
      </div>
      <${ChatThread}
        seed=${live ? [] : [{ me: false, text: `Let’s narrow it down. You’ve got <b>${chosen.length}</b> on the table${mood ? ` and you’re after <i>${escapeHtml(mood)}</i>` : ''}. What are you in the mood to <i>feel</i>?` }]}
        kickoff=${live}
        followups=${['What are you in the mood to feel right now?', 'Do you want to be hooked fast, or to slowly fall for the characters?', 'Okay — here’s how I’d choose between them.']}
        chips=${['A page-turner tonight', 'Something to sink into', 'Keep it light', 'Surprise me', ...chosen.slice(0, 2)]}
        placeholder="Tell Mabel…"
        sendFn=${live ? ((api) => advisorChat({ kind: 'choose', messages: api })) : null}
        trigger=${live ? trigger : null} />
    </div>`;
  }

  return html`<div class="screen">
    <button class="back-btn" onClick=${() => history.back()}><${Icon} name="chevleft" /> Back</button>
    <div class="screen-title">Help me choose</div>
    <div class="screen-sub">Pick from your TBR (or search for any book), tell me your mood, and I’ll help you decide.</div>

    <div class="card">
      <div class="field" style="margin-bottom:12px">
        <label>What are you in the mood for?</label>
        <input value=${mood} onInput=${(e) => setMood(e.target.value)} placeholder="cozy, twisty, something short…" />
      </div>
      <div class="section-title">Your TBR ${picked.length ? `· ${picked.length} picked` : '· tap to choose'}</div>
      ${candidates.length
        ? html`<div class="tagrow mt-8">
            ${candidates.map((b) => html`<button class=${'tag' + (picked.includes(b.title) ? ' love' : '')} onClick=${() => toggle(b.title)}>${picked.includes(b.title) ? '✓ ' : ''}${b.title}</button>`)}
          </div>`
        : html`<p class="dim" style="margin:8px 0 0;font-size:13px">Your TBR is empty — search below to add some.</p>`}
      <button class="btn btn-primary btn-block mt-12" disabled=${!candidates.length} onClick=${() => setStarted(true)}>
        <${Icon} name="sparkles" /> ${picked.length ? `Choose among ${picked.length}` : 'Choose from all my books'}
      </button>
    </div>

    <div class="card mt-12">
      <div class="section-title">Add another book to the mix</div>
      <div class="row mt-8" style="gap:8px">
        <input style="flex:1;min-width:0;background:var(--bg-2);border:1px solid var(--line-2);border-radius:var(--r);padding:11px 13px;font-size:14.5px"
          placeholder="Search title or author…" value=${q}
          onInput=${(e) => setQ(e.target.value)}
          onKeyDown=${(e) => { if (e.key === 'Enter') runSearch(); }} />
        <button class="btn btn-primary" disabled=${searching} onClick=${runSearch} aria-label="Search"><${Icon} name="search" /></button>
      </div>
      ${searching && html`<div class="empty" style="padding:18px"><div class="bubble genie typing" style="align-self:center"><i></i><i></i><i></i></div></div>`}
      ${!searching && results && results.length === 0 && html`<p class="dim" style="margin:10px 0 0;font-size:13px">No matches — try different words.</p>`}
      ${!searching && (results || []).slice(0, 8).map((b) => html`<div class="book-row mt-12">
        <${BookCover} book=${b} />
        <div class="book-meta">
          <div class="book-title">${b.title}</div>
          <div class="book-author">${b.author}${b.year ? ' · ' + b.year : ''}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;flex:none">
          <button class="btn" style="padding:7px 12px" onClick=${() => consider(b)}><${Icon} name="plus" /> Consider</button>
          <button class="btn btn-ghost" style="padding:7px 12px" onClick=${() => saveTbr(b)}>＋ TBR</button>
        </div>
      </div>`)}
    </div>
  </div>`;
}

/* ---------------- Is it a fit? (advisor's read on one book) ---------------- */
export function Fit({ id }) {
  const st = useStore();
  const live = advisorReady();
  const b = (st.booksById && st.booksById[id]) || D.getBook(id) || { title: 'this book', author: '' };
  if (st.me.status === 'archived') return html`<div class="screen"><div class="chat-topbar"><button class="back-btn" onClick=${() => history.back()}><${Icon} name="chevleft" /> Back</button></div><${AdvisorPaused} /></div>`;
  const trigger = `Is "${b.title}"${b.author ? ' by ' + b.author : ''} a good fit for me right now? Give me your honest read — whether it'll land, what might not, and your confidence — grounded in my taste.`;
  return html`<div class="screen">
    <div class="chat-topbar"><button class="back-btn" onClick=${() => history.back()}><${Icon} name="chevleft" /> Back</button></div>
    <div class="row mt-8" style="gap:12px;margin-bottom:12px">
      <${BookCover} book=${b} size="sm" />
      <div>
        <div class="book-title">Is it a fit?</div>
        <div class="book-note">${b.title} · with the advisor</div>
      </div>
    </div>
    <${ChatThread}
      seed=${live ? [] : [{ me: false, text: `Connect the advisor for a live read on whether <b>${b.title}</b> fits you.` }]}
      kickoff=${live}
      followups=${['Here’s my honest read on the fit.', 'Tell me what’s drawing you to it and I’ll sharpen this.']}
      chips=${['Why might it not work?', 'Compare it to a book I loved', 'When should I read it?']}
      placeholder="Ask about the fit…"
      sendFn=${live ? ((api) => advisorChat({ kind: 'fit', book: b.title, messages: api })) : null}
      trigger=${live ? trigger : null} />
  </div>`;
}

/* ---------------- Feed ---------------- */
export function Feed() {
  return html`<div class="screen">
    <div class="screen-title">The Reading Room</div>
    <div class="screen-sub">What your circle is reading, finishing, and arguing about.</div>

    <div class="card center-col" style="gap:10px;padding:30px 20px">
      <div class="blind-gift" style="width:54px;height:54px;margin:0;border-radius:14px;background:var(--lilac-soft);color:var(--lilac);box-shadow:none"><${Icon} name="users" /></div>
      <div class="book-title">It’s quiet in here… for now</div>
      <p class="muted" style="margin:0;line-height:1.55;font-size:13.5px">When your circle joins The Nightstand, you’ll see what everyone’s reading, finishing, and arguing about right here.</p>
      <button class="btn btn-block mt-8" onClick=${() => go('/friends')}><${Icon} name="users" /> Your circle</button>
    </div>
  </div>`;
}

/* ---------------- Buddy read ---------------- */
export function BuddyRead() {
  const br = D.buddyRead;
  const b = D.getBook(br.bookId);
  return html`<div class="screen">
    <button class="back-btn" onClick=${() => history.back()}><${Icon} name="chevleft" /> Back</button>
    <div class="row mt-8" style="gap:14px;align-items:flex-start">
      <${BookCover} book=${b} />
      <div class="grow">
        <div class="book-title" style="font-size:18px">${b.title}</div>
        <div class="book-author">Buddy read with ${br.with}</div>
      </div>
    </div>
    <div class="card mt-16">
      <div class="between"><span class="muted">You</span><span class="dim">${br.yourProgress}%</span></div>
      <${Progress} pct=${br.yourProgress} />
      <div class="between mt-12"><span class="muted">${br.with}</span><span class="dim">${br.theirProgress}%</span></div>
      <div class="progress"><i style=${`width:${br.theirProgress}%;background:${br.withColor}`}></i></div>
    </div>
    <div class="section-head"><span class="section-title">Your private thread</span></div>
    <div class="chat">
      ${br.thread.map((m) => html`<div class=${'bubble ' + (m.me ? 'me' : 'genie')}>${!m.me && html`<div class="who">${m.who}</div>`}<div>${m.text}</div></div>`)}
    </div>
    <div class="chat-input">
      <textarea placeholder=${'Message ' + br.with + '…'}></textarea>
      <button class="send-btn"><${Icon} name="send" /></button>
    </div>
  </div>`;
}

/* ---------------- Friends (Kindred Readers) ---------------- */
export function Friends() {
  const [circle, setCircle] = useState(null);
  useEffect(() => { getCircle().then(setCircle).catch(() => setCircle([])); }, []);
  return html`<div class="screen">
    <div class="screen-title">Your circle</div>
    <div class="screen-sub">Your people — and what they’re reading.</div>

    ${circle === null
      ? html`<div class="card center-col" style="padding:26px"><div class="dim">Loading your circle…</div></div>`
      : circle.length === 0
        ? html`<div class="card center-col" style="gap:10px;padding:30px 20px">
            <div class="blind-gift" style="width:54px;height:54px;margin:0;border-radius:14px;background:var(--teal-soft);color:var(--teal);box-shadow:none"><${Icon} name="heart" /></div>
            <div class="book-title">No one in your circle yet</div>
            <p class="muted" style="margin:0;line-height:1.55;font-size:13.5px">Invite a friend from the Admin console and they’ll appear here — along with what they’re currently reading.</p>
          </div>`
        : circle.map((f) => html`<div class="card">
            <div class="row" style="gap:12px">
              <${Avatar} initial=${f.initial} color="#e9b85c" />
              <div class="grow" style="min-width:0">
                <div class="book-title">${f.name}</div>
                ${f.reading.length
                  ? html`<div class="book-note" style="word-break:break-word">📖 Reading ${f.reading.map((b, i) => html`${i ? ', ' : ''}<b>${b.title}</b>`)}</div>`
                  : html`<div class="book-note dim">Not reading anything right now</div>`}
              </div>
            </div>
          </div>`)}
  </div>`;
}

/* ---------------- Profile (Reading Profile) ---------------- */
export function Profile() {
  const st = useStore();
  const me = st.me;
  const p = st.profile || {};
  const stats = st.stats;
  const iconFor = { love: 'heart', hate: 'dnf', note: 'bulb' };
  return html`<div class="screen">
    <div class="row" style="gap:14px">
      <${Avatar} initial=${me.initial} color=${me.color} size="lg" />
      <div class="grow">
        <div class="screen-title" style="margin:0">${me.name}</div>
        <div class="book-note">${me.joined ? 'Reading since ' + me.joined + ' · ' : ''}mood: ${me.mood || 'open to anything'}</div>
      </div>
    </div>

    <div class="stat-grid mt-16" style="grid-template-columns:repeat(2,1fr)">
      <div class="stat clickable" role="button" onClick=${() => go('/shelf/finished')}><div class="stat-num">${stats.booksYear}</div><div class="stat-label">books finished ›</div></div>
      <div class="stat clickable" role="button" onClick=${() => go('/rated')}><div class="stat-num">${stats.avgRating}</div><div class="stat-label">avg rating ›</div></div>
      <div class="stat clickable" role="button" onClick=${() => go('/shelf/dnf')}><div class="stat-num">${stats.dnfRate}%</div><div class="stat-label">DNF rate ›</div></div>
      <div class="stat clickable" role="button" onClick=${() => go('/rated/5')}><div class="stat-num">${stats.hitRate}%</div><div class="stat-label">five-star rate ›</div></div>
    </div>
    <div class="dim" style="font-size:11.5px;margin-top:8px;text-align:center">Average rating is the mean of the books you’ve rated — open a finished book to rate it.</div>

    ${(p.loves || []).length ? html`<div class="section-head"><span class="section-title">What you love</span></div>
    <div class="tagrow">${p.loves.map((t) => html`<span class="tag love">${t}</span>`)}</div>` : ''}

    ${(p.dislikes || []).length ? html`<div class="section-head"><span class="section-title">What turns you off</span></div>
    <div class="tagrow">${p.dislikes.map((t) => html`<span class="tag hate">${t}</span>`)}</div>` : ''}

    ${(p.patterns || []).length ? html`<div class="section-head"><span class="section-title">Patterns that predict</span></div>
    <div class="card">
      ${p.patterns.map((pt) => html`<div class="insight">
        <div class="ico" style=${'background:' + (pt.kind === 'hate' ? 'var(--rose-soft)' : pt.kind === 'note' ? 'var(--gold-soft)' : 'var(--teal-soft)') + ';color:' + (pt.kind === 'hate' ? 'var(--rose)' : pt.kind === 'note' ? 'var(--gold)' : 'var(--teal)')}>
          <${Icon} name=${iconFor[pt.kind] || 'bulb'} />
        </div>
        <p dangerouslySetInnerHTML=${{ __html: pt.text }}></p>
      </div>`)}
    </div>` : ''}

    ${(p.exceptions || []).length ? html`<div class="section-head"><span class="section-title">Exceptions to the rules</span></div>
    <div class="card">
      ${p.exceptions.map((ex) => html`<div class="insight">
        <div class="ico" style="background:var(--gold-soft);color:var(--gold)"><${Icon} name="bulb" /></div>
        <p dangerouslySetInnerHTML=${{ __html: ex.text }}></p>
      </div>`)}
    </div>` : ''}

    ${(p.evolution || []).length ? html`<div class="section-head"><span class="section-title">The shape of your taste</span></div>
    <div class="card">
      <div class="timeline">
        ${p.evolution.map((e) => html`<div class="tl-item">
          <div class="tl-date">${e.date}</div>
          <div class="tl-text">${e.text}</div>
        </div>`)}
      </div>
    </div>` : ''}

    ${!((p.loves || []).length || (p.dislikes || []).length || (p.patterns || []).length) ? html`<div class="card center-col" style="gap:8px;padding:22px 16px;margin-top:16px">
      <div class="muted" style="font-size:13.5px;text-align:center;line-height:1.5">Your reading profile fills in as you rate books and talk with the advisor. Rate a few finished books — especially the 5★ and 1★ ones — and it’ll start to take shape.</div>
    </div>` : ''}

    <button class="btn btn-ghost btn-block mt-20" onClick=${() => go('/import')}><${Icon} name="arrow" /> Import from Goodreads</button>
    ${me.isOwner ? html`<button class="btn btn-ghost btn-block mt-12" onClick=${() => go('/admin')}><${Icon} name="users" /> Admin console</button>` : ''}

    ${me.email ? html`<p class="dim" style="font-size:11.5px;text-align:center;margin:18px 0 0">Signed in as ${me.email}</p>` : ''}
    <button class="btn btn-ghost btn-block mt-8" style="color:var(--text-3)" onClick=${async () => { try { await signOut(); } catch (_e) {} location.reload(); }}><${Icon} name="user" /> Sign out</button>
  </div>`;
}

/* ---------------- Reusable chat thread ---------------- */
function ChatThread({ seed, chips, followups, placeholder, sendFn, trigger, kickoff }) {
  const [msgs, setMsgs] = useState(seed);
  const [val, setVal] = useState('');
  const [typing, setTyping] = useState(Boolean(kickoff && sendFn && trigger)); // thinking from frame 0 on kickoff
  const [dynChips, setDynChips] = useState([]); // contextual quick-replies from the last advisor turn
  const idx = useRef(0);
  const kicked = useRef(false);

  useEffect(() => {
    const el = document.querySelector('.app-main');
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, typing]);

  // Let the advisor speak first (fit reads, the choose interview).
  useEffect(() => {
    if (kicked.current || !kickoff || !sendFn || !trigger) return;
    kicked.current = true;
    (async () => {
      setTyping(true);
      try {
        const res = await sendFn([{ role: 'user', content: trigger }]);
        const text = typeof res === 'string' ? res : (res && res.reply) || '';
        setTyping(false);
        setMsgs((m) => [...m, { me: false, text: escapeHtml(text) }]);
        setDynChips((res && res.suggestions) || []);
      } catch (e) {
        setTyping(false);
        if (followups && followups.length) setMsgs((m) => [...m, { me: false, text: followups[0] }]);
      }
    })();
  }, []);

  const send = async (text) => {
    const t = (text != null ? text : val).trim();
    if (!t || typing) return;
    const convo = [...msgs, { me: true, text: t }];
    setMsgs(convo);
    setVal('');
    setTyping(true);
    setDynChips([]); // her last answer consumed the previous quick-replies

    const scripted = () => {
      setTyping(false);
      const f = followups[Math.min(idx.current, followups.length - 1)];
      idx.current += 1;
      setMsgs((m) => [...m, { me: false, text: f }]);
    };

    if (sendFn) {
      try {
        const api = [];
        if (trigger) api.push({ role: 'user', content: trigger });
        for (const m of convo) api.push({ role: m.me ? 'user' : 'assistant', content: stripHtml(m.text) });
        const res = await sendFn(api);
        const text = typeof res === 'string' ? res : (res && res.reply) || '';
        setTyping(false);
        setMsgs((m) => [...m, { me: false, text: escapeHtml(text) }]);
        setDynChips((res && res.suggestions) || []);
      } catch (e) {
        console.warn('[advisor] falling back to scripted:', e && e.message);
        scripted();
      }
    } else {
      setTimeout(scripted, 950);
    }
  };

  return html`<div>
    <div class="chat">
      ${msgs.map((m) => html`<div class=${'bubble ' + (m.me ? 'me' : 'genie')}>
        ${!m.me && html`<div class="who">Advisor</div>`}
        ${m.me ? html`<div>${m.text}</div>` : html`<div dangerouslySetInnerHTML=${{ __html: m.text }}></div>`}
      </div>`)}
      ${typing && html`<div class="bubble genie typing"><i></i><i></i><i></i></div>`}
    </div>
    ${(() => {
      if (typing) return ''; // no quick-replies while Mabel is still thinking
      const active = dynChips.length ? dynChips : (!msgs.some((m) => m.me) ? (chips || []) : []);
      return active.length ? html`<div class="chips-scroll">
        ${active.map((c) => html`<button class="chip-btn" onClick=${() => send(c)}>${c}</button>`)}
      </div>` : '';
    })()}
    <div class="chat-input">
      <textarea placeholder=${placeholder} value=${val}
        onInput=${(e) => setVal(e.target.value)}
        onKeyDown=${(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}></textarea>
      <button class="send-btn" onClick=${() => send()}><${Icon} name="send" /></button>
    </div>
  </div>`;
}

/* ---------------- Post-read / DNF interview ---------------- */
export function Interview({ id }) {
  const st = useStore();
  const live = advisorReady();
  const b = (st.booksById && st.booksById[id]) || D.getBook(id) || { title: 'this book', author: '' };
  if (st.me.status === 'archived') return html`<div class="screen"><div class="chat-topbar"><button class="back-btn" onClick=${() => history.back()}><${Icon} name="chevleft" /> Back</button></div><${AdvisorPaused} /></div>`;
  const seed = [
    { me: false, text: `You finished <b>${b.title}</b> — lovely. Want to tell me what stuck with you? Even a sentence sharpens my next picks — or just say “all set.”` },
  ];
  const followups = [
    'Noted — that’s useful. Anything about the <b>characters</b> or the <b>ending</b> that stuck with you?',
    'Lovely. I’ve folded that into your profile — thank you. Onward to the next great read.',
  ];
  return html`<div class="screen">
    <div class="chat-topbar"><button class="back-btn" onClick=${() => history.back()}><${Icon} name="chevleft" /> Back</button></div>
    <div class="row mt-8" style="gap:12px;margin-bottom:14px">
      <${BookCover} book=${b} size="sm" />
      <div>
        <div class="book-title">Reflection</div>
        <div class="book-note">${b.title} · with the advisor</div>
      </div>
    </div>
    <${ChatThread} seed=${seed} followups=${followups}
      chips=${['It flew by', 'Slow but worth it', 'I pushed through', 'The prose was the draw']}
      placeholder="Tell the advisor…"
      sendFn=${live ? ((api) => advisorChat({ kind: 'post_read', book: b.title, messages: api })) : null}
      trigger=${live ? ('I just finished ' + b.title + '.') : null} />
  </div>`;
}

/* ---------------- Onboarding / intake ---------------- */
export function Onboarding() {
  const brand = getBrand();
  const live = advisorReady();
  const [stage, setStage] = useState('welcome');
  const [emoji, setEmoji] = useState('📚');
  const [name, setName] = useState('');
  const [finishing, setFinishing] = useState(false);

  // Save what we have, mark onboarding done, and enter the app (optionally at a route).
  const finish = async (hash) => {
    if (finishing) return;
    setFinishing(true);
    try { await saveProfileBasics({ name, emoji }); } catch (_e) {}
    try { await completeOnboarding(); } catch (_e) {}
    if (hash) location.hash = hash;
    location.reload();
  };

  if (stage === 'chat') {
    return html`<div class="screen">
      <div class="chat-topbar"><button class="back-btn" onClick=${() => setStage('welcome')}><${Icon} name="chevleft" /> Back</button></div>
      <div class="row mt-8" style="gap:10px;margin-bottom:14px">
        <div class="familiar-sm">${brand.fam.art()}</div>
        <div><div class="book-title">Your intake interview</div><div class="book-note">No wrong answers — I’m just learning your taste.</div></div>
      </div>
      <${ChatThread}
        seed=${D.intakeScript.map((m) => ({ me: false, text: m.text }))}
        followups=${[
          'Beautiful choice. What was it about that one — the <b>prose</b>, the <b>characters</b>, the <b>feeling</b> it left?',
          'And the flip side: a celebrated book you <b>could not</b> finish. What pushed you out?',
          'Very useful. When you pick up a book lately, are you chasing <b>comfort</b>, <b>challenge</b>, or <b>escape</b>?',
          'I have enough to draft your Reading Profile. Welcome to The Nightstand — let’s find your next favorite.',
        ]}
        chips=${D.intakeChips}
        placeholder="Type your answer…"
        sendFn=${live ? ((api) => advisorChat({ kind: 'intake', messages: api })) : null}
        trigger=${live ? 'I want to find my next great read.' : null} />
      <button class="btn btn-primary btn-block mt-16" disabled=${finishing} onClick=${() => finish('/shelf')}>
        <${Icon} name="sparkles" /> ${finishing ? 'Setting up…' : 'Enter The Nightstand →'}
      </button>
    </div>`;
  }

  return html`<div class="screen onb">
    <div class="onb-hero">
      <div class="familiar-lg">${brand.fam.art()}</div>
      <h1>Welcome to ${brand.name}</h1>
      <p>I’m your personal librarian. I learn your taste over time and recommend books you’ll genuinely love — and you’ll never read alone.</p>
    </div>

    <div class="onb-steps">
      <div class="onb-step"><span class="num">1</span><span class="txt"><b>A quick intake interview</b> so I learn what you love.</span></div>
      <div class="onb-step"><span class="num">2</span><span class="txt"><b>Add your books</b> — or import a Goodreads export.</span></div>
      <div class="onb-step"><span class="num">3</span><span class="txt"><b>Get a recommendation</b> and meet your circle of readers.</span></div>
    </div>

    <div class="card">
      <div class="field">
        <label>What should we call you?</label>
        <input placeholder="Your name" value=${name} onInput=${(e) => setName(e.target.value)} />
      </div>
      <div class="field" style="margin-bottom:0">
        <label>Pick your reader emoji</label>
        <div class="emoji-pick">
          ${['📚', '🕯️', '🌙', '🍵', '🦉', '✨', '🐉', '🌿'].map((e) => html`<button class=${emoji === e ? 'active' : ''} onClick=${() => setEmoji(e)}>${e}</button>`)}
        </div>
      </div>
    </div>

    <button class="btn btn-primary btn-block btn-lg mt-16" disabled=${finishing} onClick=${async () => { try { await saveProfileBasics({ name, emoji }); } catch (_e) {} setStage('chat'); }}>
      <${Icon} name="sparkles" /> Begin the intake interview
    </button>
    <button class="btn btn-ghost btn-block mt-12" disabled=${finishing} onClick=${() => finish('/import')}><${Icon} name="arrow" /> Import a Goodreads export instead</button>
    <button class="btn btn-ghost btn-block mt-12" disabled=${finishing} onClick=${() => finish('/shelf')}>Skip for now — I’ll set up later</button>
  </div>`;
}

/* ---------------- Sign in (email + password) ---------------- */
export function SignIn({ bootError = null } = {}) {
  const brand = getBrand();
  const [mode, setMode] = useState('signin'); // 'signin' | 'waitlist'
  // sign-in / forgot-password
  const [view, setView] = useState('signin'); // 'signin' | 'forgot' | 'sent'
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [stage, setStage] = useState('idle'); // idle | working | error
  const [err, setErr] = useState('');
  // waitlist
  const [wName, setWName] = useState('');
  const [wEmail, setWEmail] = useState('');
  const [wNote, setWNote] = useState('');
  const [wStage, setWStage] = useState('idle'); // idle | saving | joined | error
  const [wErr, setWErr] = useState('');

  const submit = async (e) => {
    if (e) e.preventDefault();
    if (stage === 'working') return;
    const addr = email.trim();
    if (!addr.includes('@')) { setErr('Please enter a valid email.'); setStage('error'); return; }
    if (!pw) { setErr('Enter your password.'); setStage('error'); return; }
    setStage('working'); setErr('');
    const { error } = await signInWithPassword(addr, pw);
    if (error) {
      const m = (error.message || '').toLowerCase();
      let friendly = error.message || 'Could not sign in.';
      if (m.includes('invalid login')) friendly = 'That email or password isn’t right. New here? Open your invite email to set your password.';
      else if (m.includes('confirm')) friendly = 'Open the link in your invite email to finish setting up first.';
      setErr(friendly); setStage('error');
    }
    // On success the auth listener in app.js re-renders into onboarding / the app.
  };

  const sendReset = async (e) => {
    if (e) e.preventDefault();
    if (stage === 'working') return;
    const addr = email.trim();
    if (!addr.includes('@')) { setErr('Enter your email first.'); setStage('error'); return; }
    setStage('working'); setErr('');
    const { error } = await resetPassword(addr);
    if (error) { setErr(error.message || 'Could not send the reset link.'); setStage('error'); }
    else { setStage('idle'); setView('sent'); }
  };

  const join = async (e) => {
    if (e) e.preventDefault();
    if (wStage === 'saving') return;
    setWStage('saving'); setWErr('');
    try { await joinWaitlist({ name: wName, email: wEmail, note: wNote }); setWStage('joined'); }
    catch (er) { setWErr(er.message || 'Something went wrong — try again.'); setWStage('error'); }
  };

  return html`<div class="app"><main class="app-main"><div class="screen onb">
    <div class="onb-hero">
      <div class="familiar-lg">${brand.fam.art()}</div>
      <h1>${brand.name}</h1>
      <p>${brand.tagline}</p>
      <div style="margin-top:12px"><span class="pill pill-lilac"><${Icon} name="moon" /> Invite-only · Beta</span></div>
    </div>

    <div class="seg" style="max-width:340px;margin:4px auto 16px">
      <button class=${'seg-item' + (mode === 'signin' ? ' active' : '')} onClick=${() => setMode('signin')}>I have an invite</button>
      <button class=${'seg-item' + (mode === 'waitlist' ? ' active' : '')} onClick=${() => setMode('waitlist')}>Join the waitlist</button>
    </div>

    ${bootError && html`<p class="rec-line warn" style="max-width:340px;margin:0 auto 14px"><${Icon} name="alert" /><span>That didn't complete: ${bootError}. Open your invite or reset link again in this same browser.</span></p>`}

    ${mode === 'signin'
      ? (view === 'sent'
        ? html`<div class="card center-col" style="gap:10px">
            <div class="badge-medal"><${Icon} name="mail" /></div>
            <div class="book-title">Check your email ✉️</div>
            <p class="muted" style="line-height:1.55;margin:0">If <b>${email}</b> has an account, a reset link is on its way. Open it to choose a new password.</p>
            <button class="btn btn-ghost btn-block mt-12" onClick=${() => { setView('signin'); setStage('idle'); setErr(''); }}>Back to sign in</button>
          </div>`
        : view === 'forgot'
        ? html`<form class="card" onSubmit=${sendReset}>
            <p class="muted" style="margin:0 0 12px;font-size:13.5px;line-height:1.5">Enter your email and we’ll send a link to reset your password.</p>
            <div class="field" style="margin-bottom:10px">
              <label>Your email</label>
              <input type="email" autocomplete="email" placeholder="you@example.com" value=${email} onInput=${(ev) => setEmail(ev.target.value)} />
            </div>
            ${stage === 'error' && html`<p class="rec-line warn" style="margin:0 0 10px"><${Icon} name="alert" /><span>${err}</span></p>`}
            <button class="btn btn-primary btn-block btn-lg" type="submit" disabled=${stage === 'working'}>
              <${Icon} name="mail" /> ${stage === 'working' ? 'Sending…' : 'Send reset link'}
            </button>
            <p class="dim" style="font-size:12.5px;text-align:center;margin:12px 0 0"><a role="button" style="color:var(--gold);cursor:pointer" onClick=${() => { setView('signin'); setStage('idle'); setErr(''); }}>Back to sign in</a></p>
          </form>`
        : html`<form class="card" onSubmit=${submit}>
            <p class="muted" style="margin:0 0 12px;font-size:13.5px;line-height:1.5">The Nightstand is invite-only. Sign in with your email and password.</p>
            <div class="field" style="margin-bottom:10px">
              <label>Your email</label>
              <input type="email" autocomplete="email" placeholder="you@example.com" value=${email} onInput=${(ev) => setEmail(ev.target.value)} />
            </div>
            <div class="field" style="margin-bottom:10px">
              <label>Password</label>
              <input type="password" autocomplete="current-password" placeholder="Your password" value=${pw} onInput=${(ev) => setPw(ev.target.value)} />
            </div>
            ${stage === 'error' && html`<p class="rec-line warn" style="margin:0 0 10px"><${Icon} name="alert" /><span>${err}</span></p>`}
            <button class="btn btn-primary btn-block btn-lg" type="submit" disabled=${stage === 'working'}>
              <${Icon} name="user" /> ${stage === 'working' ? 'Signing in…' : 'Sign in'}
            </button>
            <p class="dim" style="font-size:12.5px;text-align:center;margin:12px 0 0">First time? Open your invite email to set your password · <a role="button" style="color:var(--gold);cursor:pointer" onClick=${() => { setView('forgot'); setStage('idle'); setErr(''); }}>Forgot password?</a></p>
          </form>`)
      : (wStage === 'joined'
        ? html`<div class="card center-col" style="gap:10px">
            <div class="badge-medal"><${Icon} name="check" /></div>
            <div class="book-title">You’re on the list 🌙</div>
            <p class="muted" style="line-height:1.55;margin:0">Thanks${wName.trim() ? ', ' + wName.trim().split(' ')[0] : ''}! I’ll reach out as spots open up.</p>
          </div>`
        : html`<form class="card" onSubmit=${join}>
            <p class="muted" style="margin:0 0 12px;font-size:13.5px;line-height:1.5">Not invited yet? Add your name and I’ll reach out as The Nightstand opens up to more readers.</p>
            <div class="field" style="margin-bottom:10px">
              <label>Your name</label>
              <input placeholder="First name is fine" value=${wName} onInput=${(ev) => setWName(ev.target.value)} />
            </div>
            <div class="field" style="margin-bottom:10px">
              <label>Your email</label>
              <input type="email" autocomplete="email" placeholder="you@example.com" value=${wEmail} onInput=${(ev) => setWEmail(ev.target.value)} />
            </div>
            <div class="field" style="margin-bottom:10px">
              <label>Anything you want me to know? <span style="color:var(--text-3);font-weight:400;text-transform:none;letter-spacing:0">(optional)</span></label>
              <textarea rows="2" placeholder="What you read, who sent you…" value=${wNote} onInput=${(ev) => setWNote(ev.target.value)}></textarea>
            </div>
            ${wStage === 'error' && html`<p class="rec-line warn" style="margin:0 0 10px"><${Icon} name="alert" /><span>${wErr}</span></p>`}
            <button class="btn btn-primary btn-block btn-lg" type="submit" disabled=${wStage === 'saving'}>
              <${Icon} name="sparkles" /> ${wStage === 'saving' ? 'Adding you…' : 'Add me to the waitlist'}
            </button>
          </form>`)}

    <p class="dim" style="font-size:11.5px;text-align:center;margin:18px auto 0;max-width:320px;line-height:1.6">📲 <b>Make it an app:</b> on iPhone, open in <b>Safari</b> → <b>Share → Add to Home Screen</b>. On Android, in <b>Chrome</b> → <b>⋮ → Add to Home screen</b>. It opens full-screen, like a real app.</p>
  </div></main></div>`;
}

/* ---------------- Signed in, but not on the allowlist ---------------- */
export function NotInvited({ email, onSignOut }) {
  const brand = getBrand();
  return html`<div class="app"><main class="app-main"><div class="screen onb">
    <div class="onb-hero">
      <div class="familiar-lg">${brand.fam.art()}</div>
      <h1>Almost in…</h1>
      <p>You're signed in${email ? html` as <b>${email}</b>` : ''}, but you're not on the guest list yet. Ask Chelsea to add your email to ${brand.name}, then sign in again.</p>
    </div>
    <button class="btn btn-block" onClick=${onSignOut}><${Icon} name="user" /> Sign out</button>
  </div></main></div>`;
}

/* ---------------- Set a password (invite accept / password reset) ---------------- */
export function SetPassword({ email, onDone }) {
  const brand = getBrand();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [stage, setStage] = useState('idle'); // idle | working | error
  const [err, setErr] = useState('');

  const save = async (e) => {
    if (e) e.preventDefault();
    if (stage === 'working') return;
    if (pw.length < 6) { setErr('Password needs to be at least 6 characters.'); setStage('error'); return; }
    if (pw !== pw2) { setErr('The two passwords don’t match.'); setStage('error'); return; }
    setStage('working'); setErr('');
    const { error } = await setPassword(pw);
    if (error) { setErr(error.message || 'Could not save your password.'); setStage('error'); return; }
    onDone && onDone();
  };

  return html`<div class="app"><main class="app-main"><div class="screen onb">
    <div class="onb-hero">
      <div class="familiar-lg">${brand.fam.art()}</div>
      <h1>Welcome to ${brand.name} 🌙</h1>
      <p>${email ? html`Setting up <b>${email}</b>. ` : ''}Pick a password you’ll use to sign in from now on.</p>
    </div>
    <form class="card" onSubmit=${save}>
      <div class="field" style="margin-bottom:10px">
        <label>New password</label>
        <input type="password" autocomplete="new-password" placeholder="At least 6 characters" value=${pw} onInput=${(e) => setPw(e.target.value)} />
      </div>
      <div class="field" style="margin-bottom:10px">
        <label>Confirm password</label>
        <input type="password" autocomplete="new-password" placeholder="Type it again" value=${pw2} onInput=${(e) => setPw2(e.target.value)} />
      </div>
      ${stage === 'error' && html`<p class="rec-line warn" style="margin:0 0 10px"><${Icon} name="alert" /><span>${err}</span></p>`}
      <button class="btn btn-primary btn-block btn-lg" type="submit" disabled=${stage === 'working'}>
        <${Icon} name="sparkles" /> ${stage === 'working' ? 'Saving…' : 'Save password & continue'}
      </button>
    </form>
  </div></main></div>`;
}

/* ---------------- Search & add a book ---------------- */
function SearchResult({ b }) {
  const [open, setOpen] = useState(false);
  const [enrich, setEnrich] = useState(undefined); // undefined = not fetched, null = none
  const [loadingE, setLoadingE] = useState(false);
  const [added, setAdded] = useState(null);        // shelf label once added
  const [addedStatus, setAddedStatus] = useState(null); // which shelf key (for the active button)
  const [busy, setBusy] = useState(false);

  const toggle = () => {
    const nx = !open; setOpen(nx);
    if (nx && enrich === undefined && !loadingE && advisorReady()) {
      setLoadingE(true);
      advisorEnrich({ title: b.title, author: b.author || '' })
        .then((e) => setEnrich(e || null)).catch(() => setEnrich(null))
        .finally(() => setLoadingE(false));
    }
  };

  const add = async (status) => {
    if (busy) return;
    setBusy(true);
    try {
      await addToShelf({ title: b.title, author: b.author, coverUrl: (enrich && enrich.coverUrl) || b.coverUrl, tags: b.tags }, status);
      setAdded(statusMove[status]);
      setAddedStatus(status);
      toast('Added to ' + statusMove[status]);
    } catch (e) { toast('Could not add'); }
    setBusy(false);
  };

  const cover = (enrich && enrich.coverUrl) || b.coverUrl;
  const desc = enrich && enrich.description ? stripHtml(enrich.description) : '';

  return html`<div class="card" style="padding:13px">
    <div class="book-row" onClick=${toggle} role="button">
      <${BookCover} book=${{ ...b, coverUrl: cover }} />
      <div class="book-meta">
        <div class="book-title">${b.title}</div>
        <div class="book-author">${b.author}${b.year ? ' · ' + b.year : ''}</div>
        ${added
          ? html`<div class="book-note gold">On your ${added} shelf</div>`
          : html`<div class="book-note">Tap for details & to pick a shelf</div>`}
      </div>
      <${Icon} name="chevright" cls="dim-ico" />
    </div>
    ${open && html`<div class="mt-12">
      ${loadingE ? html`<div class="bubble genie typing" style="align-self:flex-start"><i></i><i></i><i></i></div>` : ''}
      ${enrich && enrich.rating ? html`<div class="rec-line" style="margin-top:0"><${Icon} name="star" /><span><b>★ ${enrich.rating}</b>${enrich.ratingsCount ? ' · ' + Number(enrich.ratingsCount).toLocaleString() + ' ratings' : ''}</span></div>` : ''}
      ${desc ? html`<p class="muted" style="margin:8px 0 0;line-height:1.55;font-size:13px">${desc.length > 360 ? desc.slice(0, 360) + '…' : desc}</p>` : ''}
      ${!loadingE && enrich !== undefined && !desc && !(enrich && enrich.rating) ? html`<p class="dim" style="margin:0;font-size:12.5px">No extra details found — you can still add it.</p>` : ''}
      <div class="section-title mt-12">Add to…</div>
      <div class="tagrow mt-8">
        ${[['to_read', 'TBR'], ['reading', 'Reading'], ['finished', 'Finished'], ['dnf', 'DNF']].map(([s, label]) =>
          html`<button class="tag" disabled=${busy} style=${addedStatus === s ? 'background:var(--gold-soft);color:var(--gold);border-color:var(--gold)' : ''} onClick=${() => add(s)}>${addedStatus === s ? html`<${Icon} name="check" /> ` : ''}${label}</button>`)}
      </div>
    </div>`}
  </div>`;
}

export function Search() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    const query = q.trim();
    if (!query || loading) return;
    setLoading(true);
    try { setResults(await searchBooks(query)); }
    catch (e) { setResults([]); toast('Search failed — try again'); }
    setLoading(false);
  };

  return html`<div class="screen">
    <button class="back-btn" onClick=${() => history.back()}><${Icon} name="chevleft" /> Back</button>
    <div class="screen-title">Add a book</div>
    <div class="screen-sub">Search the catalog, peek at the details, and add it to any shelf.</div>

    <div class="row mt-8" style="gap:8px">
      <input style="flex:1;min-width:0;background:var(--bg-2);border:1px solid var(--line-2);border-radius:var(--r);padding:12px 14px;font-size:15px"
        placeholder="Title or author…" value=${q}
        onInput=${(e) => setQ(e.target.value)}
        onKeyDown=${(e) => { if (e.key === 'Enter') run(); }} />
      <button class="btn btn-primary" disabled=${loading} onClick=${run} aria-label="Search"><${Icon} name="search" /></button>
    </div>

    ${loading && html`<div class="empty"><div class="bubble genie typing" style="align-self:center"><i></i><i></i><i></i></div></div>`}
    ${!loading && results && results.length === 0 && html`<div class="empty"><${Icon} name="search" /><div>No matches — try different words.</div></div>`}
    ${!loading && !results && html`<div class="empty mt-20"><${Icon} name="search" /><div>Search by title or author to add any book.</div></div>`}

    <div class="mt-12">
      ${!loading && (results || []).map((b) => html`<${SearchResult} b=${b} key=${b.title + b.author} />`)}
    </div>
  </div>`;
}

/* ---------------- Import from Goodreads ---------------- */
export function Import() {
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(false);
  const [prog, setProg] = useState(null);
  const [done, setDone] = useState(null);
  const fileRef = useRef(null);

  const onFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const parsed = parseGoodreads(await file.text());
      if (!parsed.length) { toast('Couldn’t read that file — is it the Goodreads CSV?'); return; }
      setDone(null); setProg(null); setRows(parsed);
    } catch (err) { toast('Could not read the file'); }
  };

  const counts = rows ? rows.reduce((a, r) => { a[r.status] = (a[r.status] || 0) + 1; return a; }, {}) : {};

  const run = async () => {
    if (!rows || busy) return;
    setBusy(true); setProg({ done: 0, total: rows.length, added: 0, failed: 0 });
    try {
      const res = await importShelf(rows, setProg);
      setDone(res);
      toast(`Imported ${res.added} book${res.added === 1 ? '' : 's'}`);
    } catch (e) { toast('Import failed — try again'); }
    setBusy(false);
  };

  return html`<div class="screen">
    <button class="back-btn" onClick=${() => history.back()}><${Icon} name="chevleft" /> Back</button>
    <div class="screen-title">Import from Goodreads</div>
    <div class="screen-sub">Bring your whole library over in one go.</div>

    <div class="card">
      <div class="section-title">How to get your file</div>
      <ol class="muted" style="margin:10px 0 0;padding-left:20px;line-height:1.6;font-size:13.5px">
        <li>On the Goodreads <b>desktop</b> site: <b>My Books → Import and export</b>.</li>
        <li>Click <b>Export Library</b>, wait for the link to appear, and download the <b>.csv</b>.</li>
        <li>Come back here and choose that file below.</li>
      </ol>
    </div>

    <div class="card mt-12">
      <input ref=${fileRef} type="file" accept=".csv,text/csv" style="display:none" onChange=${onFile} />
      <button class="btn btn-primary btn-block" onClick=${() => fileRef.current && fileRef.current.click()}>
        <${Icon} name="arrow" /> ${rows ? 'Choose a different file' : 'Choose your Goodreads .csv'}
      </button>

      ${rows && html`<div class="mt-12">
        <div class="rec-line good"><${Icon} name="check" /><span>Found <b>${rows.length}</b> books — ${[['finished', 'Finished'], ['reading', 'Reading'], ['to_read', 'TBR'], ['dnf', 'DNF']].filter(([k]) => counts[k]).map(([k, l]) => counts[k] + ' ' + l).join(' · ')}.</span></div>
        ${!done && html`<button class="btn btn-primary btn-block mt-12" disabled=${busy} onClick=${run}>
          <${Icon} name="books" /> ${busy ? `Importing ${prog ? prog.done : 0}/${rows.length}…` : 'Add them to my shelves'}
        </button>`}
        ${busy && html`<${Progress} pct=${prog && prog.total ? Math.round(prog.done / prog.total * 100) : 0} />`}
        ${done && html`<div class="rec-line good mt-12"><${Icon} name="sparkles" /><span>Added <b>${done.added}</b> book${done.added === 1 ? '' : 's'}${done.failed ? ` · ${done.failed} skipped` : ''}. Covers are filling in now.</span></div>`}
        ${done && html`<button class="btn btn-block mt-12" onClick=${() => go('/shelf')}><${Icon} name="books" /> Go to your shelves</button>`}
      </div>`}
    </div>

    <p class="dim" style="font-size:12px;text-align:center;margin-top:14px">Ratings and shelves come across. Duplicates are merged, so it’s safe to re-import.</p>
  </div>`;
}

/* ---------------- Admin (owner only) ---------------- */
export function Admin() {
  const st = useStore();
  const [members, setMembers] = useState(null);
  const [pending, setPending] = useState([]);
  const [waitlist, setWaitlist] = useState([]);
  const [busy, setBusy] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);

  const load = async () => {
    try { const d = await adminList(); setMembers((d && d.members) || []); setPending((d && d.pendingInvites) || []); setWaitlist((d && d.waitlist) || []); setErr(''); }
    catch (e) { setErr(e.message || String(e)); setMembers([]); }
  };
  useEffect(() => { if (st.me.isOwner) load(); }, [st.me.isOwner]);

  const invite = async () => {
    const email = inviteEmail.trim();
    if (!email || inviting) return;
    setInviting(true);
    try { const res = await adminAct('invite', { email }); setInviteEmail(''); await load(); toast(res && res.already ? `${email} already has an account` : (res && res.emailed) ? `Invited ${email} — invite email sent ✉️` : `Invited ${email} (add again to resend the email)`); }
    catch (e) { toast(e.message || 'Could not invite'); }
    setInviting(false);
  };
  // email-based actions: uninvite, invite-from-waitlist, dismiss_waitlist
  const actEmail = async (action, email, okMsg) => {
    setBusy(action + ':' + email);
    try { await adminAct(action, { email }); await load(); toast(okMsg || 'Done'); }
    catch (e) { toast(e.message || 'Failed'); }
    setBusy('');
  };
  const uninvite = (email) => actEmail('uninvite', email, 'Invite canceled');

  if (!st.me.isOwner) {
    return html`<div class="screen"><button class="back-btn" onClick=${() => history.back()}><${Icon} name="chevleft" /> Back</button><div class="empty mt-20"><${Icon} name="alert" /><div>This area is just for the owner.</div></div></div>`;
  }

  const act = async (action, m, needConfirm) => {
    const key = action + ':' + m.id;
    if (needConfirm && confirm !== key) { setConfirm(key); return; }
    setConfirm(''); setBusy(key);
    try { await adminAct(action, { userId: m.id }); await load(); toast('Done'); }
    catch (e) { toast(e.message || 'Failed'); }
    setBusy('');
  };

  return html`<div class="screen">
    <button class="back-btn" onClick=${() => history.back()}><${Icon} name="chevleft" /> Back</button>
    <div class="screen-title">Admin</div>
    <div class="screen-sub">Invite people, see usage, and manage access.</div>

    <div class="card">
      <div class="section-title">Invite a friend</div>
      <div class="row mt-8" style="gap:8px">
        <input type="email" value=${inviteEmail} placeholder="friend@example.com"
          style="flex:1;min-width:0;background:var(--bg-2);border:1px solid var(--line-2);border-radius:var(--r);padding:10px 13px;font-size:14.5px"
          onInput=${(e) => setInviteEmail(e.target.value)}
          onKeyDown=${(e) => { if (e.key === 'Enter') invite(); }} />
        <button class="btn btn-primary" disabled=${inviting} onClick=${invite}><${Icon} name="plus" /> Invite</button>
      </div>
      <p class="dim" style="margin:8px 0 0;font-size:12px">Adds them to the guest list and emails them an invite — they click it, set a password, and they’re in.</p>
    </div>

    ${(pending || []).length ? html`<div class="section-head"><span class="section-title">Pending invites</span></div>
      ${pending.map((p) => html`<div class="card">
        <div class="row" style="gap:12px">
          <div class="blind-gift" style="width:40px;height:40px;margin:0;border-radius:11px;background:var(--gold-soft);color:var(--gold);box-shadow:none"><${Icon} name="mail" /></div>
          <div class="grow" style="min-width:0"><div class="book-title" style="word-break:break-word">${p.email}</div><div class="book-note">Invited — hasn't signed in yet</div></div>
          <button class="tag" style="color:var(--danger)" onClick=${() => uninvite(p.email)}>Cancel</button>
        </div>
      </div>`)}` : ''}

    ${(waitlist || []).length ? html`<div class="section-head"><span class="section-title">Waitlist · ${waitlist.length}</span></div>
      ${waitlist.map((w) => html`<div class="card">
        <div class="row" style="gap:12px">
          <div class="grow" style="min-width:0">
            <div class="book-title">${w.name || w.email}</div>
            <div class="book-note" style="word-break:break-word">${w.email}</div>
            ${w.note ? html`<div class="book-note" style="margin-top:6px">“${w.note}”</div>` : ''}
          </div>
        </div>
        <div class="tagrow mt-12">
          <button class="tag love" disabled=${!!busy} onClick=${() => actEmail('invite', w.email, 'Invited ' + w.email)}>Invite</button>
          <button class="tag" style="color:var(--text-3)" disabled=${!!busy} onClick=${() => actEmail('dismiss_waitlist', w.email, 'Dismissed')}>Dismiss</button>
        </div>
      </div>`)}` : ''}

    <div class="section-head"><span class="section-title">Members</span></div>

    ${err && html`<div class="card">
      <p class="rec-line warn" style="margin:0"><${Icon} name="alert" /><span>${err}</span></p>
      ${/not available|service_role|failed to send|not found|404|non-2xx/i.test(err) ? html`<p class="dim" style="margin:8px 0 0;font-size:12.5px">Make sure the <b>admin</b> function is deployed (see the setup steps). It runs only for you.</p>` : ''}
    </div>`}

    ${members === null && !err ? html`<div class="empty mt-20"><div class="bubble genie typing" style="align-self:center"><i></i><i></i><i></i></div></div>` : ''}

    ${(members || []).map((m) => html`<div class="card">
      <div class="row" style="gap:12px">
        <${Avatar} initial=${((m.display_name || m.email || '?')[0] || '?').toUpperCase()} color="#e9b85c" />
        <div class="grow" style="min-width:0">
          <div class="book-title">${m.display_name || m.email}${m.isOwner ? html` <span class="gold">· you</span>` : ''}</div>
          <div class="book-note" style="word-break:break-word">${m.email}</div>
          <div class="book-note">${m.calls30d} AI call${m.calls30d === 1 ? '' : 's'} / 30d · ${m.shelfCount} book${m.shelfCount === 1 ? '' : 's'}${m.onboarding_complete ? '' : ' · onboarding'}</div>
        </div>
        ${m.status === 'archived' ? html`<${Pill} tone="rose">Paused<//>` : ''}
      </div>
      ${!m.isOwner ? html`<div class="tagrow mt-12">
        ${m.status === 'archived'
          ? html`<button class="tag love" disabled=${!!busy} onClick=${() => act('unarchive', m)}>Switch AI back on</button>`
          : html`<button class="tag" disabled=${!!busy} onClick=${() => act('archive', m)}>Archive (pause AI)</button>`}
        <button class="tag" disabled=${!!busy} onClick=${() => act('reset', m, true)}>${confirm === 'reset:' + m.id ? 'Tap again to reset' : 'Reset to new'}</button>
        <button class="tag" style="color:var(--danger)" disabled=${!!busy} onClick=${() => act('remove', m, true)}>${confirm === 'remove:' + m.id ? 'Tap again to remove' : 'Remove'}</button>
      </div>` : ''}
    </div>`)}
  </div>`;
}
