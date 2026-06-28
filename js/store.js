// Live data store backed by Supabase. Loads the signed-in user's profile +
// shelves, seeds the account from the kickstart list on first run, and exposes
// actions that persist. Screens read it reactively via useStore().
import { useState, useEffect } from 'preact/hooks';
import { supabase } from './supabase.js';
import * as D from './data.js';
import { advisorEnrich, advisorReady } from './advisor.js';
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
      };
    }
    const item = {
      id: row.id, bookId: row.book_id, status: row.status,
      rating: row.rating, progress: row.progress || 0,
      note: row.note, addedNote: row.added_note, source: row.source,
      atPct: row.dnf_at_pct, reason: row.dnf_reason,
      availability: row.availability || [], libbyHold: row.libby_hold || false,
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
  backfillCovers(booksById); // fire-and-forget: fill any missing covers
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
  const { error } = await supabase.from('shelf_items')
    .upsert({ user_id: user.id, book_id: bookId, status, is_public: true }, { onConflict: 'user_id,book_id' });
  if (error) { console.error('[store] addToShelf:', error.message); throw error; }
  await refresh(user.id, await fetchProfile(user.id));
}

export async function setStatus(itemId, status, extra = {}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase.from('shelf_items')
    .update({ status, ...extra, updated_at: new Date().toISOString() }).eq('id', itemId);
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
      const { error } = await supabase.from('shelf_items').upsert(patch, { onConflict: 'user_id,book_id' });
      if (error) throw error;
      added++;
    } catch (e) { failed++; }
    if (onProgress) onProgress({ done, total: (rows || []).length, added, failed });
  }
  await refresh(user.id, await fetchProfile(user.id));
  return { added, failed };
}

// Remove a book from the shelves entirely (no status change, just gone).
export async function removeFromShelf(itemId) {
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
export async function updateShelfItem(itemId, patch) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase.from('shelf_items')
    .update({ ...patch, updated_at: new Date().toISOString() }).eq('id', itemId);
  if (error) { console.error('[store] updateShelfItem:', error.message); throw error; }
  await refresh(user.id, await fetchProfile(user.id));
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

// Your circle: the friends you're connected to (1:1), each with their current read.
// RLS only returns connected people's profiles + their currently-reading items.
export async function getCircle() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data: conns } = await supabase.from('connections')
    .select('user_a, user_b').or(`user_a.eq.${user.id},user_b.eq.${user.id}`);
  const ids = (conns || []).map((c) => (c.user_a === user.id ? c.user_b : c.user_a));
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
