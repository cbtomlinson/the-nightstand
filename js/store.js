// Live data store backed by Supabase. Loads the signed-in user's profile +
// shelves, seeds the account from the kickstart list on first run, and exposes
// actions that persist. Screens read it reactively via useStore().
import { useState, useEffect } from 'preact/hooks';
import { supabase } from './supabase.js';
import * as D from './data.js';
import { advisorEnrich, advisorDescribe, advisorReady } from './advisor.js';
import { searchBooks } from './lib/openlibrary.js';

// Only this account gets kickstarted from js/data.js. Everyone else starts fresh
// (so friends never inherit Chelsea's shelves/taste).
const OWNER_EMAIL = 'tomlinson.chelsea@gmail.com';

let state = {
  ready: false,
  error: null,
  me: { id: null, name: 'Reader', initial: 'R', color: '#e9b85c', mood: '', joined: '' },
  profile: null,
  booksById: {},
  shelves: { to_read: [], reading: [], finished: [], dnf: [] },
  stats: { booksYear: 0, avgRating: 0, dnfRate: 0, hitRate: 0 },
};

const listeners = new Set();
export function getState() { return state; }
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function set(patch) { state = { ...state, ...patch }; listeners.forEach((fn) => fn(state)); }

// Drop junk (non-strings, single chars, blanks) and dedupe a taste list.
function cleanList(a) {
  const seen = new Set();
  const out = [];
  for (const x of (Array.isArray(a) ? a : [])) {
    if (typeof x !== 'string') continue;
    const t = x.trim();
    if (t.length < 2) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k); out.push(t);
  }
  return out;
}

export function useStore() {
  const [s, setS] = useState(state);
  useEffect(() => subscribe(setS), []);
  return s;
}

let started = false;
export async function init() {
  if (started) return;
  started = true;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    let profile = await fetchProfile(user.id);
    const { count } = await supabase
      .from('shelf_items').select('id', { count: 'exact', head: true }).eq('user_id', user.id);
    const isOwner = (user.email || '').toLowerCase() === OWNER_EMAIL;
    if (!count && isOwner) {
      console.log('[store] empty account — seeding from your reading list…');
      await seed(user.id);
      profile = await fetchProfile(user.id);
    }
    await refresh(user.id, profile);
  } catch (e) {
    console.error('[store] init failed:', e);
    set({ ready: true, error: e.message || String(e) });
  }
}

async function fetchProfile(userId) {
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  return data;
}

async function findOrCreateBook(mb) {
  const { data: existing } = await supabase
    .from('books').select('id').eq('title', mb.title).eq('author', mb.author || '').limit(1).maybeSingle();
  if (existing) return existing.id;
  const { data: created, error } = await supabase
    .from('books')
    .insert({ title: mb.title, author: mb.author, cover_color: mb.cover, cover_url: mb.coverUrl || null, meta: { tags: mb.tags || [], pages: mb.pages || null } })
    .select('id').single();
  if (error) {
    const { data: again } = await supabase
      .from('books').select('id').eq('title', mb.title).eq('author', mb.author || '').limit(1).maybeSingle();
    if (again) return again.id;
    throw error;
  }
  return created.id;
}

async function seed(userId) {
  try {
    await supabase.from('profiles').update({
      display_name: D.me.name,
      mood: D.me.mood,
      reading_profile: {
        loves: D.profile.loves, dislikes: D.profile.dislikes,
        patterns: D.profile.patterns, exceptions: D.profile.exceptions, evolution: D.profile.evolution,
      },
      onboarding_complete: true,
    }).eq('id', userId);
  } catch (e) { console.warn('[store] profile seed:', e.message || e); }

  const groups = [
    ['reading', D.shelves.reading], ['to_read', D.shelves.to_read],
    ['finished', D.shelves.finished], ['dnf', D.shelves.dnf],
  ];
  for (const [status, items] of groups) {
    for (const it of items) {
      const mb = D.getBook(it.bookId);
      if (!mb) continue;
      try {
        const bookId = await findOrCreateBook(mb);
        await supabase.from('shelf_items').insert({
          user_id: userId, book_id: bookId, status,
          rating: it.rating != null ? it.rating : null,
          progress: it.progress != null ? it.progress : 0,
          note: it.note || null,
          added_note: it.addedNote || null,
          source: it.source || null,
          dnf_at_pct: it.atPct != null ? it.atPct : null,
          dnf_reason: it.reason || null,
          is_public: true,
        });
      } catch (e) { console.warn('[store] seed item', mb.title, e.message || e); }
    }
  }
  console.log('[store] seed complete');
}

async function refresh(userId, profile) {
  const { data: rows, error } = await supabase
    .from('shelf_items').select('*, books(*)').eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;

  const booksById = {};
  const shelves = { to_read: [], reading: [], finished: [], dnf: [] };
  for (const row of (rows || [])) {
    const b = row.books;
    if (b) {
      booksById[b.id] = {
        id: b.id, title: b.title, author: b.author,
        cover: b.cover_color || '#3a3160',
        coverUrl: b.cover_url || null,
        tags: (b.meta && b.meta.tags) || [],
        pages: (b.meta && b.meta.pages) || null,
        description: (b.meta && b.meta.description) || null,
      };
    }
    const item = {
      id: row.id, bookId: row.book_id, status: row.status,
      rating: row.rating, progress: row.progress || 0,
      note: row.note, addedNote: row.added_note, source: row.source,
      atPct: row.dnf_at_pct, reason: row.dnf_reason,
      availability: row.availability || [], libbyHold: row.libby_hold || false,
      createdAt: row.created_at, updatedAt: row.updated_at, finishedAt: row.finished_at,
    };
    if (shelves[row.status]) shelves[row.status].push(item);
  }

  const name = (profile && profile.display_name) || 'Reader';
  const email = (profile && profile.email) || '';
  const me = {
    id: userId, name, email,
    isOwner: email.toLowerCase() === OWNER_EMAIL,
    initial: (name[0] || 'R').toUpperCase(),
    color: '#e9b85c',
    mood: (profile && profile.mood) || '',
    status: (profile && profile.status) || 'active',
    joined: (profile && profile.created_at) ? new Date(profile.created_at).getFullYear().toString() : '',
  };
  const rp = (profile && profile.reading_profile) || {};
  const prof = (rp && rp.loves) ? rp : { loves: [], dislikes: [], patterns: [], exceptions: [], evolution: [] };
  // Self-heal: strip junk (single chars / dupes) that a bad tool call may have
  // exploded a string into, and persist the cleaned version once.
  if (prof && prof.loves) {
    const before = JSON.stringify([prof.loves, prof.dislikes]);
    prof.loves = cleanList(prof.loves);
    prof.dislikes = cleanList(prof.dislikes);
    if (JSON.stringify([prof.loves, prof.dislikes]) !== before) {
      try { supabase.from('profiles').update({ reading_profile: prof }).eq('id', userId); } catch (_e) {}
    }
  }

  const fin = shelves.finished, dnf = shelves.dnf;
  const rated = fin.filter((i) => i.rating);
  const avg = rated.length ? rated.reduce((a, i) => a + i.rating, 0) / rated.length : 0;
  const five = fin.filter((i) => i.rating === 5).length;
  const stats = {
    booksYear: fin.length,
    avgRating: Math.round(avg * 10) / 10,
    dnfRate: (fin.length + dnf.length) ? Math.round(dnf.length / (fin.length + dnf.length) * 100) : 0,
    hitRate: fin.length ? Math.round(five / fin.length * 100) : 0,
  };

  set({ ready: true, error: null, me, profile: prof, booksById, shelves, stats });
  backfillAuthors(booksById);      // fire-and-forget: fill blank authors (Kindle import has none)
  backfillCovers(booksById);       // fire-and-forget: fill any missing covers
  backfillDescriptions(booksById); // fire-and-forget: cache descriptions so books open instantly
}

// Background author backfill: Kindle exports carry no author names, so imported
// books arrive with author ''. Look each one up on Open Library by title and,
// when the top results' title genuinely matches ours, persist the author. Same
// fire-and-forget pattern as covers; a session Set stops retrying misses.
const titleKey = (s) => (s || '')
  .toLowerCase().split(':')[0]
  .replace(/\([^)]*\)/g, ' ')
  .replace(/[^a-z0-9]+/g, ' ')
  .replace(/^(the|a|an)\s+/, '')
  .replace(/\s+/g, ' ')
  .trim();
let backfillingAuthors = false;
const authorTried = new Set();
async function backfillAuthors(booksById) {
  if (backfillingAuthors) return;
  const missing = Object.values(booksById).filter((b) => b && b.title && !(b.author || '').trim() && !authorTried.has(b.id));
  if (!missing.length) return;
  backfillingAuthors = true;
  try {
    for (let i = 0; i < missing.length; i += 4) {
      await Promise.all(missing.slice(i, i + 4).map(async (b) => {
        authorTried.add(b.id);
        try {
          const key = titleKey(b.title);
          const results = await searchBooks(b.title);
          const hit = (results || []).find((r) => {
            if (!r.author) return false;
            const k = titleKey(r.title);
            return k === key || k.startsWith(key + ' ') || key.startsWith(k + ' ');
          });
          if (hit) await persistAuthor(b.id, hit.author);
        } catch (_e) {}
      }));
    }
  } finally { backfillingAuthors = false; }
}

export async function persistAuthor(bookId, author) {
  const a = (author || '').trim();
  if (!bookId || !a) return;
  const cur = getState().booksById[bookId];
  if (cur && (cur.author || '').trim()) return; // never overwrite a real author
  try { await supabase.from('books').update({ author: a }).eq('id', bookId); } catch (_e) { return; }
  const now = getState().booksById[bookId];
  if (now) set({ booksById: { ...getState().booksById, [bookId]: { ...now, author: a } } });
}

// Background description pre-fetch: quietly cache a description for every shelved
// book that lacks one (same pattern as covers), so opening a book feels instant.
// Descriptions persist on the shared books row, so this is a one-time backfill per
// book — later sessions find them already cached. Claude-written fallbacks (for the
// few titles Google can't describe) are capped per pass; stragglers fill lazily on open.
let backfillingDesc = false;
// Books already attempted this session — without this, titles that yield NO
// description get re-fetched on every refresh (each shelf edit / chat exchange).
const descTried = new Set();
async function backfillDescriptions(booksById) {
  if (backfillingDesc || !advisorReady()) return;
  const missing = Object.values(booksById).filter((b) => b && b.title && !b.description && !descTried.has(b.id));
  if (!missing.length) return;
  backfillingDesc = true;
  let genBudget = 8;
  try {
    for (let i = 0; i < missing.length; i += 3) {
      await Promise.all(missing.slice(i, i + 3).map(async (b) => {
        try {
          descTried.add(b.id);
          const e = await advisorEnrich({ title: b.title, author: b.author || '' });
          let d = (e && e.description) || null;
          if (!d && genBudget > 0) { genBudget--; d = await advisorDescribe({ title: b.title, author: b.author || '' }); }
          if (d) await persistDescription(b.id, d);
        } catch (_e) {}
      }));
    }
  } finally { backfillingDesc = false; }
}

// Saved advisor conversations (mid-read companion + post-read reflections) — one
// resumable thread per shelf item + kind, private to the user (RLS: owner-only).
export async function getReflection(shelfItemId, kind) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !shelfItemId) return null;
  const { data } = await supabase.from('reflections')
    .select('id, transcript')
    .eq('user_id', user.id).eq('shelf_item_id', shelfItemId).eq('kind', kind)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  return data || null;
}
export async function saveReflection(shelfItemId, kind, transcript) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !shelfItemId) return;
  const existing = await getReflection(shelfItemId, kind);
  if (existing) await supabase.from('reflections').update({ transcript }).eq('id', existing.id);
  else await supabase.from('reflections').insert({ user_id: user.id, shelf_item_id: shelfItemId, kind, transcript });
}

// Re-pull the current user's shelves into the store — call after the advisor may
// have added a book server-side, so it appears without a full page reload.
export async function reloadShelves() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
    await refresh(user.id, profile);
  } catch (_e) {}
}

// Cache a book's description on its row so we only ever fetch it once (kills the
// slow, repeated description loads on book detail).
export async function persistDescription(bookId, desc) {
  if (!bookId || !desc) return;
  try {
    const cur = (getState().booksById || {})[bookId];
    if (cur && cur.description) return; // already cached
    const { data: bk } = await supabase.from('books').select('meta').eq('id', bookId).maybeSingle();
    const meta = { ...((bk && bk.meta) || {}), description: desc };
    await supabase.from('books').update({ meta }).eq('id', bookId);
    if (cur) set({ booksById: { ...getState().booksById, [bookId]: { ...cur, description: desc } } });
  } catch (_e) {}
}

// ── Covers everywhere ───────────────────────────────────────────────────────
// Prefer Google Books (English-restricted, via the advisor function) so we get
// the real English cover; fall back to Open Library. Results are persisted, so
// each book is only looked up once.
async function coverFor(title, author) {
  if (!title) return null;
  if (advisorReady()) {
    try { const e = await advisorEnrich({ title, author: author || '' }); if (e && e.coverUrl) return e.coverUrl; } catch (_e) {}
  }
  try { const r = await searchBooks(`${title} ${author || ''}`.trim()); if (r && r[0] && r[0].coverUrl) return r[0].coverUrl; } catch (_e) {}
  return null;
}

let backfilling = false;
async function backfillCovers(booksById) {
  if (backfilling) return;
  const missing = Object.values(booksById).filter((b) => b && !b.coverUrl);
  if (!missing.length) return;
  backfilling = true;
  try {
    for (let i = 0; i < missing.length; i += 4) {
      await Promise.all(missing.slice(i, i + 4).map(async (b) => {
        const url = await coverFor(b.title, b.author);
        if (url) await persistCover(b.id, url);
      }));
    }
  } finally { backfilling = false; }
}

// Store + persist a cover for one book (also used to correct wrong-language
// covers once the English edition is found on the detail screen).
export async function persistCover(bookId, url) {
  if (!bookId || !url) return;
  const cur = getState().booksById[bookId];
  if (cur && cur.coverUrl === url) return;
  try { await supabase.from('books').update({ cover_url: url }).eq('id', bookId); } catch (_e) {}
  const now = getState().booksById[bookId];
  if (now) set({ booksById: { ...getState().booksById, [bookId]: { ...now, coverUrl: url } } });
}

// ── Actions (persist, then refresh) ─────────────────────────────────────────
export async function addToShelf(mb, status = 'to_read') {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const bookId = await findOrCreateBook(mb);
  const row = { user_id: user.id, book_id: bookId, status, is_public: true };
  if (status === 'finished') row.finished_at = new Date().toISOString().slice(0, 10); // shelf ordering
  const { error } = await supabase.from('shelf_items')
    .upsert(row, { onConflict: 'user_id,book_id' });
  if (error) { console.error('[store] addToShelf:', error.message); throw error; }
  await refresh(user.id, await fetchProfile(user.id));
}

export async function setStatus(itemId, status, extra = {}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const patch = { status, ...extra, updated_at: new Date().toISOString() };
  // Landing on Finished stamps the date (drives shelf ordering) unless one was passed.
  if (status === 'finished' && !patch.finished_at) patch.finished_at = new Date().toISOString().slice(0, 10);
  const { error } = await supabase.from('shelf_items').update(patch).eq('id', itemId);
  if (error) { console.error('[store] setStatus:', error.message); throw error; }
  await refresh(user.id, await fetchProfile(user.id));
}

// Bulk import (e.g. a Goodreads export). Upserts each row, then refreshes once;
// covers fill in afterward via backfillCovers. onProgress({done,total,added,failed}).
export async function importShelf(rows, onProgress) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('not signed in');
  let added = 0, failed = 0, done = 0;
  for (const r of rows || []) {
    done++;
    try {
      const bookId = await findOrCreateBook({ title: r.title, author: r.author || '', tags: [] });
      const patch = { user_id: user.id, book_id: bookId, status: r.status || 'to_read', is_public: true };
      if (r.rating) patch.rating = r.rating;
      if (r.dateRead && (r.status === 'finished' || r.status === 'dnf')) patch.finished_at = r.dateRead; // preserve read date → shelf ordering

      const { error } = await supabase.from('shelf_items').upsert(patch, { onConflict: 'user_id,book_id' });
      if (error) throw error;
      added++;
    } catch (e) { failed++; }
    if (onProgress) onProgress({ done, total: (rows || []).length, added, failed });
  }
  await refresh(user.id, await fetchProfile(user.id));
  return { added, failed };
}

// Merge a duplicate shelf entry into the copy being kept: copy anything the
// kept item is missing (rating, read date, notes) off the duplicate, then
// delete the duplicate. Used by the Tidy screen so deduping never loses data.
export async function mergeShelfItems(keep, drop) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !keep || !drop) return;
  const patch = {};
  if (!keep.rating && drop.rating) patch.rating = drop.rating;
  if ((keep.status === 'finished' || keep.status === 'dnf') && !keep.finishedAt && drop.finishedAt) patch.finished_at = drop.finishedAt;
  if (!keep.note && drop.note) patch.note = drop.note;
  if (!keep.addedNote && drop.addedNote) patch.added_note = drop.addedNote;
  if (Object.keys(patch).length) {
    const { error } = await supabase.from('shelf_items').update(patch).eq('id', keep.id);
    if (error) { console.error('[store] mergeShelfItems:', error.message); throw error; }
  }
  removeLocalShelfItem(drop.id); // instant
  const { error: delErr } = await supabase.from('shelf_items').delete().eq('id', drop.id);
  if (delErr) { console.error('[store] mergeShelfItems:', delErr.message); throw delErr; }
  await refresh(user.id, await fetchProfile(user.id));
}

// Remove a book from the shelves entirely (no status change, just gone).
export async function removeFromShelf(itemId) {
  removeLocalShelfItem(itemId); // instant — drop it from the shelf right away
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase.from('shelf_items').delete().eq('id', itemId);
  if (error) { console.error('[store] removeFromShelf:', error.message); throw error; }
  await refresh(user.id, await fetchProfile(user.id));
}

// Set the reader's current "mood of the day" (home screen + advisor default).
export async function setMyMood(mood) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const m = (mood || '').trim();
  if (m === (getState().me.mood || '')) return;
  try { await supabase.from('profiles').update({ mood: m }).eq('id', user.id); } catch (e) { console.warn('[store] setMyMood:', e.message || e); return; }
  set({ me: { ...getState().me, mood: m } });
}

// Onboarding: save name + emoji, and flip the onboarding flag when done.
export async function saveProfileBasics({ name, emoji }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const patch = {};
  if (name != null && name.trim()) patch.display_name = name.trim(); // only when actually provided
  if (emoji != null) patch.avatar_emoji = emoji;
  if (Object.keys(patch).length) await supabase.from('profiles').update(patch).eq('id', user.id);
}
export async function completeOnboarding() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from('profiles').update({ onboarding_complete: true }).eq('id', user.id);
}

// Update arbitrary fields on a shelf item (availability, libby_hold, …).
// Optimistically patch / drop a shelf item in local state so toggles (Libby hold,
// availability, progress…) and removals feel INSTANT instead of waiting on a full
// DB round-trip (which is why the Libby button & remove looked like no-ops).
const ITEM_FIELD_MAP = { libby_hold: 'libbyHold', dnf_at_pct: 'atPct', dnf_reason: 'reason', added_note: 'addedNote' };
function patchLocalShelfItem(itemId, patch) {
  const s = getState();
  if (!s.shelves) return;
  const shelves = { to_read: [...(s.shelves.to_read || [])], reading: [...(s.shelves.reading || [])], finished: [...(s.shelves.finished || [])], dnf: [...(s.shelves.dnf || [])] };
  for (const k of Object.keys(shelves)) {
    const idx = shelves[k].findIndex((i) => i.id === itemId);
    if (idx >= 0) {
      const local = { ...shelves[k][idx] };
      for (const [field, val] of Object.entries(patch)) local[ITEM_FIELD_MAP[field] || field] = val;
      shelves[k][idx] = local;
      set({ shelves });
      return;
    }
  }
}
function removeLocalShelfItem(itemId) {
  const s = getState();
  if (!s.shelves) return;
  const shelves = {};
  for (const k of ['to_read', 'reading', 'finished', 'dnf']) shelves[k] = (s.shelves[k] || []).filter((i) => i.id !== itemId);
  set({ shelves });
}

export async function updateShelfItem(itemId, patch) {
  patchLocalShelfItem(itemId, patch); // instant feedback
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase.from('shelf_items')
    .update({ ...patch, updated_at: new Date().toISOString() }).eq('id', itemId);
  if (error) { console.error('[store] updateShelfItem:', error.message); throw error; }
  await refresh(user.id, await fetchProfile(user.id)); // reconcile (covers shelf moves)
}

// "Never recommend this" — kept in the reading profile so the advisor excludes
// it forever. Patches state in place (no full reload) so the UI stays smooth.
export async function neverRecommend(title, author = '') {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !title) return;
  const { data } = await supabase.from('profiles').select('reading_profile').eq('id', user.id).maybeSingle();
  const rp = (data && data.reading_profile) || {};
  const never = rp.never || [];
  if (never.some((n) => (n.title || '').toLowerCase() === title.toLowerCase())) return;
  rp.never = [...never, { title, author }];
  const { error } = await supabase.from('profiles').update({ reading_profile: rp }).eq('id', user.id);
  if (error) { console.error('[store] neverRecommend:', error.message); throw error; }
  set({ profile: { ...getState().profile, never: rp.never } });
}

// "Not right now" — snooze a book so the advisor skips it for a while
// (default 90 days) and recommends other things first.
export async function snoozeBook(title, author = '', days = 90) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !title) return;
  const { data } = await supabase.from('profiles').select('reading_profile').eq('id', user.id).maybeSingle();
  const rp = (data && data.reading_profile) || {};
  const until = new Date(Date.now() + days * 86400000).toISOString();
  rp.snoozed = [...(rp.snoozed || []).filter((s) => (s.title || '').toLowerCase() !== title.toLowerCase()), { title, author, until }];
  const { error } = await supabase.from('profiles').update({ reading_profile: rp }).eq('id', user.id);
  if (error) { console.error('[store] snoozeBook:', error.message); throw error; }
  set({ profile: { ...getState().profile, snoozed: rp.snoozed } });
}

// Set a rating and, on strong signals (1★ / 5★), nudge the durable profile so
// the advisor learns from it. Refreshes (updates the stars + avg stat).
export async function setRatingAndNudge(itemId, book, rating) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase.from('shelf_items')
    .update({ rating, updated_at: new Date().toISOString() }).eq('id', itemId);
  if (error) { console.error('[store] setRating:', error.message); throw error; }
  if (book && book.title && (rating === 5 || rating === 1)) {
    try {
      const { data } = await supabase.from('profiles').select('reading_profile').eq('id', user.id).maybeSingle();
      const rp = (data && data.reading_profile) || {};
      const t = book.title;
      const add = (arr) => { const s = new Set((arr || []).map((x) => (x || '').toLowerCase())); return s.has(t.toLowerCase()) ? (arr || []) : [...(arr || []), t]; };
      const rm = (arr) => (arr || []).filter((x) => (x || '').toLowerCase() !== t.toLowerCase());
      if (rating === 5) { rp.loved = add(rp.loved); rp.disliked = rm(rp.disliked); }
      else { rp.disliked = add(rp.disliked); rp.loved = rm(rp.loved); }
      await supabase.from('profiles').update({ reading_profile: rp }).eq('id', user.id);
    } catch (_e) { /* nudge is best-effort */ }
  }
  await refresh(user.id, await fetchProfile(user.id));
}

// ── Friend recommendations (the "recommendations" table; RLS-gated, no edge fn) ──
// The circle = your fellow members.
export async function listMembers() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase.from('profiles').select('id, display_name, email').neq('id', user.id);
  return (data || []).map((p) => ({ id: p.id, name: p.display_name || (p.email || '').split('@')[0] || 'Reader' }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Everyone you can see (Option D: 1:1 connections ∪ roommates). Uses the
// my_visible_ids RPC; falls back to the raw connections table pre-migration.
async function visibleIds(userId) {
  try {
    const { data, error } = await supabase.rpc('my_visible_ids');
    if (!error && Array.isArray(data)) {
      return data.map((r) => (typeof r === 'string' ? r : (r && r.my_visible_ids))).filter(Boolean);
    }
  } catch (_e) {}
  const { data: conns } = await supabase.from('connections')
    .select('user_a, user_b').or(`user_a.eq.${userId},user_b.eq.${userId}`);
  return (conns || []).map((c) => (c.user_a === userId ? c.user_b : c.user_a));
}

// Your circle: everyone you can see, each with their current read.
export async function getCircle() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const ids = await visibleIds(user.id);
  if (!ids.length) return [];
  const [{ data: profs }, { data: reads }] = await Promise.all([
    supabase.from('profiles').select('id, display_name, email').in('id', ids),
    supabase.from('shelf_items').select('user_id, books(id, title, author, cover_url, cover_color)').in('user_id', ids).eq('status', 'reading'),
  ]);
  const readingBy = {};
  for (const r of reads || []) { const bk = r.books; if (bk) (readingBy[r.user_id] = readingBy[r.user_id] || []).push({ id: bk.id, title: bk.title, author: bk.author, coverUrl: bk.cover_url, cover: bk.cover_color }); }
  return (profs || []).map((p) => {
    const nm = p.display_name || (p.email || '').split('@')[0] || 'Reader';
    return { id: p.id, name: nm, initial: (nm[0] || 'R').toUpperCase(), reading: readingBy[p.id] || [] };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

// How many unread friend recommendations are waiting (for the "new pick" badge).
export async function getPendingRecCount() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;
  const { count } = await supabase.from('recommendations')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id).eq('source', 'friend').eq('status', 'pending');
  return count || 0;
}

// The cozy feed: your circle's currently-reading + recently-finished, newest first.
// (RLS shares only currently-reading + finishes from the last ~30 days — not shelves.)
export async function getFeed() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const ids = await visibleIds(user.id);
  if (!ids.length) return [];
  const [{ data: profs }, { data: items }] = await Promise.all([
    supabase.from('profiles').select('id, display_name, email').in('id', ids),
    supabase.from('shelf_items').select('id, user_id, status, rating, updated_at, books(id, title, author, cover_url, cover_color)')
      .in('user_id', ids).in('status', ['reading', 'finished']).order('updated_at', { ascending: false }).limit(40),
  ]);
  const nameById = {};
  for (const p of (profs || [])) nameById[p.id] = p.display_name || (p.email || '').split('@')[0] || 'Reader';
  const list = (items || []).filter((i) => i.books).map((i) => {
    const nm = nameById[i.user_id] || 'A reader';
    return {
      id: i.id, who: nm, initial: (nm[0] || 'R').toUpperCase(), userId: i.user_id,
      type: i.status, rating: i.rating || 0, when: i.updated_at,
      book: { id: i.books.id, title: i.books.title, author: i.books.author, coverUrl: i.books.cover_url, cover: i.books.cover_color },
      reactions: {},
    };
  });
  // Attach reactions per item (best-effort — table may not exist until the migration runs).
  const itemIds = list.map((f) => f.id);
  if (itemIds.length) {
    try {
      const { data: rx } = await supabase.from('reactions').select('item_id, emoji, user_id').in('item_id', itemIds);
      const byItem = {};
      for (const r of (rx || [])) {
        byItem[r.item_id] = byItem[r.item_id] || {};
        byItem[r.item_id][r.emoji] = byItem[r.item_id][r.emoji] || { count: 0, mine: false };
        byItem[r.item_id][r.emoji].count++;
        if (r.user_id === user.id) byItem[r.item_id][r.emoji].mine = true;
      }
      for (const f of list) f.reactions = byItem[f.id] || {};
    } catch (_e) {}
  }
  return list;
}

// React / un-react to a feed item (a friend's currently-reading or just-finished).
export async function toggleReaction(itemId, emoji, currentlyOn) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  if (currentlyOn) await supabase.from('reactions').delete().match({ item_id: itemId, user_id: user.id, emoji });
  else await supabase.from('reactions').insert({ item_id: itemId, user_id: user.id, emoji });
}

// ── Reading Rooms (Option D: the room is the relationship) ──────────────────
const nameFromProfile = (p) => (p && (p.display_name || (p.email || '').split('@')[0])) || 'Reader';

export async function getRooms() {
  const { data } = await supabase.from('reading_rooms')
    .select('id, name, emoji, created_by, room_members(user_id)')
    .order('created_at', { ascending: true });
  return (data || []).map((r) => ({
    id: r.id, name: r.name, emoji: r.emoji || '📚', createdBy: r.created_by,
    memberCount: (r.room_members || []).length,
  }));
}

export async function createRoom(name, emoji) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  const { data, error } = await supabase.from('reading_rooms')
    .insert({ name: (name || '').trim(), emoji: emoji || '📚', created_by: user.id })
    .select('id').single();
  if (error) throw error;
  const { error: mErr } = await supabase.from('room_members')
    .insert({ room_id: data.id, user_id: user.id, added_by: user.id });
  if (mErr) console.warn('[store] createRoom seat:', mErr.message);
  return data.id;
}

export async function getRoom(id) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: room } = await supabase.from('reading_rooms')
    .select('id, name, emoji, created_by').eq('id', id).maybeSingle();
  if (!room) return null;
  const [{ data: mems }, { data: posts }, { data: reads }] = await Promise.all([
    supabase.from('room_members').select('user_id').eq('room_id', id),
    supabase.from('room_posts').select('id, user_id, body, created_at').eq('room_id', id).order('created_at', { ascending: true }).limit(200),
    supabase.from('buddy_reads').select('id, member_ids, created_at, books(id, title, author, cover_url, cover_color)').eq('room_id', id).order('created_at', { ascending: false }).limit(1),
  ]);
  const ids = (mems || []).map((m) => m.user_id);
  const { data: profs } = ids.length
    ? await supabase.from('profiles').select('id, display_name, email').in('id', ids)
    : { data: [] };
  const nameOf = {};
  for (const p of (profs || [])) nameOf[p.id] = nameFromProfile(p);
  const gr = (reads || [])[0];
  return {
    id: room.id, name: room.name, emoji: room.emoji || '📚',
    mine: room.created_by === user.id, myId: user.id,
    members: ids.map((uid) => ({ id: uid, name: nameOf[uid] || 'Reader', initial: ((nameOf[uid] || 'R')[0] || 'R').toUpperCase() })),
    posts: (posts || []).map((p) => ({ id: p.id, me: p.user_id === user.id, who: nameOf[p.user_id] || 'Reader', body: p.body, at: p.created_at })),
    groupRead: gr && gr.books ? {
      id: gr.id, joined: (gr.member_ids || []).includes(user.id),
      book: { id: gr.books.id, title: gr.books.title, author: gr.books.author, coverUrl: gr.books.cover_url, cover: gr.books.cover_color },
    } : null,
  };
}

export async function postToRoom(roomId, body) {
  const { data: { user } } = await supabase.auth.getUser();
  const text = (body || '').trim();
  if (!user || !text) return;
  const { error } = await supabase.from('room_posts').insert({ room_id: roomId, user_id: user.id, body: text });
  if (error) throw error;
}

export async function addRoomMember(roomId, userId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase.from('room_members').insert({ room_id: roomId, user_id: userId, added_by: user.id });
  if (error) throw error;
}

export async function leaveRoom(roomId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from('room_members').delete().match({ room_id: roomId, user_id: user.id });
}

// ── Buddy reads (flexible: 1+ people, jump in anytime) ──────────────────────
export async function startBuddyRead(mb, memberIds, roomId = null) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  const bookId = await findOrCreateBook(mb);
  const members = [...new Set([user.id, ...(memberIds || [])])];
  const { data, error } = await supabase.from('buddy_reads')
    .insert({ book_id: bookId, created_by: user.id, member_ids: members, room_id: roomId })
    .select('id').single();
  if (error) throw error;
  return data.id;
}

export async function myBuddyReads() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase.from('buddy_reads')
    .select('id, member_ids, room_id, created_at, books(id, title, author, cover_url, cover_color)')
    .order('created_at', { ascending: false }).limit(20);
  return (data || []).filter((b) => b.books && (b.member_ids || []).includes(user.id)).map((b) => ({
    id: b.id, count: (b.member_ids || []).length, roomId: b.room_id,
    book: { id: b.books.id, title: b.books.title, author: b.books.author, coverUrl: b.books.cover_url, cover: b.books.cover_color },
  }));
}

export async function getBuddyRead(id) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: bd } = await supabase.from('buddy_reads')
    .select('id, member_ids, created_by, room_id, book_id, books(id, title, author, cover_url, cover_color)')
    .eq('id', id).maybeSingle();
  if (!bd || !bd.books) return null;
  const ids = bd.member_ids || [];
  const [{ data: profs }, { data: msgs }, { data: prog }] = await Promise.all([
    ids.length ? supabase.from('profiles').select('id, display_name, email').in('id', ids) : Promise.resolve({ data: [] }),
    supabase.from('buddy_read_messages').select('id, user_id, body, at_pct, created_at').eq('buddy_read_id', id).order('created_at', { ascending: true }).limit(300),
    ids.length ? supabase.from('shelf_items').select('user_id, status, progress').eq('book_id', bd.book_id).in('user_id', ids) : Promise.resolve({ data: [] }),
  ]);
  const nameOf = {};
  for (const p of (profs || [])) nameOf[p.id] = nameFromProfile(p);
  const progOf = {};
  for (const s of (prog || [])) progOf[s.user_id] = s.status === 'finished' ? { done: true, pct: 100 } : { done: false, pct: s.progress || 0 };
  return {
    id: bd.id, joined: ids.includes(user.id), myId: user.id, roomId: bd.room_id, memberIds: ids,
    myPct: (progOf[user.id] && progOf[user.id].pct) || 0,
    book: { id: bd.books.id, title: bd.books.title, author: bd.books.author, coverUrl: bd.books.cover_url, cover: bd.books.cover_color },
    members: ids.map((uid) => ({ id: uid, name: nameOf[uid] || 'Reader', initial: ((nameOf[uid] || 'R')[0] || 'R').toUpperCase(), prog: progOf[uid] || null })),
    messages: (msgs || []).map((m) => ({ id: m.id, me: m.user_id === user.id, who: nameOf[m.user_id] || 'Reader', body: m.body, atPct: m.at_pct, at: m.created_at })),
  };
}

export async function postBuddyMessage(id, body, atPct) {
  const { data: { user } } = await supabase.auth.getUser();
  const text = (body || '').trim();
  if (!user || !text) return;
  const { error } = await supabase.from('buddy_read_messages')
    .insert({ buddy_read_id: id, user_id: user.id, body: text, at_pct: atPct == null ? null : atPct });
  if (error) throw error;
}

export async function joinBuddyRead(id, currentMemberIds) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const members = [...new Set([...(currentMemberIds || []), user.id])];
  const { error } = await supabase.from('buddy_reads').update({ member_ids: members }).eq('id', id);
  if (error) throw error;
}

// Recommend a book to one or more friends, with an optional note.
export async function recommendToFriends(mb, friendIds, note) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !friendIds || !friendIds.length) return 0;
  const bookId = await findOrCreateBook(mb);
  const rows = friendIds.map((fid) => ({
    user_id: fid, book_id: bookId, source: 'friend', recommended_by: user.id,
    rationale: (note || '').trim() || null, status: 'pending',
  }));
  const { error } = await supabase.from('recommendations').insert(rows);
  if (error) { console.error('[store] recommendToFriends:', error.message); throw error; }
  return rows.length;
}

// Incoming recommendations from friends (for the "From your circle" picks).
export async function getCircleRecs() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase.from('recommendations')
    .select('id, rationale, status, recommended_by, created_at, books(*)')
    .eq('user_id', user.id).eq('source', 'friend').neq('status', 'dismissed')
    .order('created_at', { ascending: false });
  const nameById = {};
  for (const m of await listMembers()) nameById[m.id] = m.name;
  return (data || []).map((r) => ({
    id: r.id, status: r.status, note: r.rationale, by: nameById[r.recommended_by] || 'a friend',
    book: r.books ? { id: r.books.id, title: r.books.title, author: r.books.author, cover: r.books.cover_color || '#3a3160', coverUrl: r.books.cover_url || null, tags: (r.books.meta && r.books.meta.tags) || [] } : null,
  })).filter((r) => r.book);
}

// Respond to a friend rec: 'accepted' (also adds it to your TBR) or 'dismissed'.
export async function respondToRec(recId, status, mb) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  if (status === 'accepted' && mb) { try { await addToShelf(mb, 'to_read'); } catch (_e) {} }
  await supabase.from('recommendations').update({ status }).eq('id', recId);
}
