// The Nightstand — "advisor" edge function (the server-side brain).
// Secrets: ANTHROPIC_API_KEY (required), GOOGLE_BOOKS_API_KEY (optional, raises quota).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Sonnet is the cost-efficient workhorse. Opus ('claude-opus-4-8') is more perceptive
// but pricier; Haiku ('claude-haiku-4-5') is cheapest.
const MODEL = 'claude-sonnet-4-6';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const RATE_MAX_PER_HOUR = 100; // per-user cap on Claude calls (small private club)

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });

const stripTags = (s: string) => (s || '').replace(/<[^>]+>/g, '');
const textOf = (resp: any) =>
  (resp?.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('').trim();
const olIsbnCover = (isbn: string | null) => (isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg` : null);

// Google descriptions are sometimes copyright-page boilerplate or a lone pull-quote
// rather than a real synopsis. Flag those so we can fall back to a written one.
function looksBadDesc(d?: string | null): boolean {
  if (!d) return true;
  const s = d.trim();
  if (s.length < 80) return true;
  if (/all rights reserved|©|library of congress|cataloging-in-publication|reprinted by permission|a division of|penguin random house|hachette|©\s*\d{4}/i.test(s)) return true;
  if (/^["“'].{0,160}["”']\s*$/.test(s)) return true; // basically one quoted blurb
  return false;
}

// ── Google Books enrichment — English editions only, synopsis (not reviews) ──
async function googleBooks(title: string, author: string) {
  if (!title) return null;
  const key = Deno.env.get('GOOGLE_BOOKS_API_KEY');
  const q = `intitle:${title}${author ? ' inauthor:' + author : ''}`;
  let url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=1&printType=books&langRestrict=en&country=US`;
  if (key) url += `&key=${key}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const v = data?.items?.[0]?.volumeInfo;
    if (!v) return null;
    if (v.language && v.language !== 'en') return null; // English only
    const img = v.imageLinks?.thumbnail || v.imageLinks?.smallThumbnail || null;
    const isbn = (v.industryIdentifiers || []).map((i: any) => i.identifier)[0] || null;
    return {
      description: v.description || null, // publisher synopsis = "what it's about"
      categories: v.categories || [],
      rating: v.averageRating || null,
      ratingsCount: v.ratingsCount || null,
      coverUrl: (img ? img.replace('http://', 'https://') : null) || olIsbnCover(isbn),
      isbn,
      pageCount: v.pageCount || null,
    };
  } catch (_e) { return null; }
}

// ── Tools the advisor can actually use ───────────────────────────────────────
const ADD_TOOL = {
  name: 'add_to_shelf',
  description:
    "Add a real book to the reader's shelves. Call this whenever the reader asks you to add, save, queue, or put a book on a shelf. Default to 'to_read' (TBR). One call per book.",
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      author: { type: 'string' },
      status: { type: 'string', enum: ['to_read', 'reading', 'finished', 'dnf'] },
    },
    required: ['title'],
  },
};
const PROFILE_TOOL = {
  name: 'update_reading_profile',
  description:
    "Record DURABLE taste insights so future sessions remember them. Call this near the end of an interview when you've learned something lasting (a new love, a turn-off, or a pattern). Keep entries short and general — qualities, not single-book trivia.",
  input_schema: {
    type: 'object',
    properties: {
      add_loves: { type: 'array', items: { type: 'string' }, description: 'New stable things they love (short phrases)' },
      add_dislikes: { type: 'array', items: { type: 'string' }, description: 'New stable turn-offs (short phrases)' },
      insight: { type: 'string', description: 'One short sentence pattern/insight to remember' },
    },
  },
};

function profileToText(p: any): string {
  if (!p || typeof p !== 'object') return '';
  const strs = (a: any) => (Array.isArray(a) ? a : []).filter((x: any) => typeof x === 'string' && x.trim());
  const out: string[] = [];
  if (strs(p.loves).length) out.push('Loves: ' + strs(p.loves).join(', ') + '.');
  if (strs(p.dislikes).length) out.push('Turn-offs: ' + strs(p.dislikes).join(', ') + '.');
  if (strs(p.loved).length) out.push('Books they rated 5★ (anchors for what works): ' + strs(p.loved).join(', ') + '.');
  if (strs(p.disliked).length) out.push("Books they rated 1★ (what didn't land): " + strs(p.disliked).join(', ') + '.');
  if (p.patterns?.length) out.push('Patterns: ' + p.patterns.map((x: any) => stripTags(x.text)).join(' '));
  if (p.exceptions?.length) out.push('Exceptions: ' + p.exceptions.map((x: any) => stripTags(x.text)).join(' '));
  if (p.evolution?.length) out.push(p.evolution.map((e: any) => `${e.date}: ${e.text}`).join(' '));
  return out.join('\n');
}

function baseSystem(name: string, profileText: string): string {
  return `You are Mabel, the reading advisor for ${name} inside a cozy app called The Nightstand. A warm, perceptive, opinionated librarian — a knowledgeable friend with real taste, not a neutral summary engine.

Your long-term goal: learn ${name}'s taste so precisely your recommendations become uncannily good. Insight over numbers.

How you work:
- Match the moment. When they're CHOOSING what to read, happily talk it through and go back and forth — that's the part they enjoy. When they've just FINISHED or abandoned a book, keep reflection SHORT: acknowledge it, ask at most a question or two and only if it genuinely sharpens their profile, then warmly wrap up. Never quiz them.
- When you learn something durable about their taste, call update_reading_profile so it's remembered next time. Do this before you wrap up.
- Add books to their shelves with add_to_shelf when they ask — actually call the tool. And be proactive: whenever you suggest a specific book they seem interested in, offer to save it ("want it on your TBR?") and call add_to_shelf if they say yes — don't make them figure out how to add it themselves.
- Honesty about actions: ONLY say you added, saved, or updated something if you truly called the matching tool this turn and it succeeded. Never claim an action you didn't perform.
- Treat recommendations as hypotheses: why it fits THEM, what might not land, your confidence. Occasionally a gentle "experiment".
- Never recommend a book they've already finished, DNF'd, or that's already on a shelf. English-language books only.
- NO SPOILERS — a hard, non-negotiable rule. Never reveal plot twists, the ending, major deaths, a culprit / "whodunit", a big reveal, or anything a first-time reader would want to discover for themselves. Speak only to premise, setup, mood, themes, the *kind* of experience it is, and why it fits THEM — never what actually happens. If asked directly about a twist or ending, warmly decline and protect the surprise.
- For audiobooks, weigh narration.
- Stay on books. You're a reading advisor, not a general assistant — keep to reading, their taste, their mood, and what to read next. A little life context that shapes what they'd enjoy reading is welcome, but if they drift well off-topic, give a brief, friendly reply and warmly steer back to books. Gently, never sternly; don't lecture.

Two models of taste: STABLE preferences + CURRENT MOOD (ask if unknown). Genre is negotiable; emotional fit is not.

Voice: warm, direct, concrete, honest. Brief — a sentence or three, like texting a well-read friend. One question at a time.

WHAT YOU KNOW ABOUT ${name.toUpperCase()} (stable profile):
${profileText || '(Still learning their taste — ask, don\'t assume.)'}`;
}

function scenario(kind: string, book?: string, mood?: string): string {
  const m = mood ? `\nCurrent mood: ${mood}.` : '';
  if (kind === 'intake')
    return `\n\nRIGHT NOW: First conversation — learn their taste from scratch. Open warmly, ask one inviting question about a book they loved. Keep it to a few questions, then wrap up and save what you learned.${m}`;
  if (kind === 'dnf')
    return `\n\nRIGHT NOW: They set down "${book}" unfinished. DNFs are data, not failures. Keep it light — one or two questions to learn whether it was the book, mood, timing, or pacing — then save the insight and wrap up.${m}`;
  if (kind === 'post_read')
    return `\n\nRIGHT NOW: They just finished "${book}". Keep this VERY light — they don't enjoy long post-read quizzes. Warmly acknowledge it, ask AT MOST one short question and only if it would genuinely sharpen their profile, save anything durable with update_reading_profile, then wrap up quickly.${m}`;
  if (kind === 'choose')
    return `\n\nRIGHT NOW: Help them choose between specific books they already have. Run it like a short, thoughtful interview they'll enjoy: OPEN with one or two sharp questions that genuinely narrow the decision (what they want to FEEL, energy level, hooked-fast vs. slow-burn investment, escape vs. challenge, time they have). React to their answers — don't just barrel to a pick. THEN land it with specific, reasoned recommendations grounded in their taste and past reads (name names). You do NOT have to choose just one — conditional picks are ideal, e.g. "Book A if you want a fast, twisty page-turner tonight; Book B if you're ready to slowly fall for the characters." Always back each pick with concrete reasons. One question at a time. No spoilers.${m}`;
  if (kind === 'fit')
    return `\n\nRIGHT NOW: Give your honest read on whether "${book}" is a good fit for THEM specifically — using their stable taste + current mood. Lead with a clear verdict and a rough confidence, give 1–2 concrete reasons it should land and one honest caveat that might not, and reference their patterns or past books BY NAME (e.g. why it's like/unlike something they loved or bailed on). Tight and warm, no spoilers, then invite a follow-up question.${m}`;
  if (kind === 'midread')
    return `\n\nRIGHT NOW: They're PARTWAY THROUGH "${book}" and want a companion as they read — impressions, doubts, "should I hang in there?". React to what they share; be honest about whether it's likely to pay off for THEM (use their taste — and blessing a DNF is a real kindness when warranted, they don't need permission to quit). SPOILER DISCIPLINE IS ABSOLUTE here: they'll say how far along they are — never reveal or hint at anything past that point, and if you're unsure where they are, ask before discussing specifics. Short, warm turns; one question at a time.${m}`;
  return `\n\nRIGHT NOW: Chatting about books. Warm, opinionated reading friend.${m}`;
}

async function anthropic(apiKey: string, system: string, messages: any[], maxTokens: number, tools?: any[]) {
  const body: any = { model: MODEL, max_tokens: maxTokens, system, messages };
  if (tools) body.tools = tools;
  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

async function findOrCreateBook(supa: any, title: string, author: string) {
  const a = author || '';
  const { data: existing } = await supa.from('books').select('id').eq('title', title).eq('author', a).limit(1).maybeSingle();
  if (existing) return existing.id;
  const { data: created, error } = await supa.from('books').insert({ title, author: a }).select('id').single();
  if (error) {
    const { data: again } = await supa.from('books').select('id').eq('title', title).eq('author', a).limit(1).maybeSingle();
    if (again) return again.id;
    throw error;
  }
  return created.id;
}

async function doAddToShelf(supa: any, userId: string, title: string, author: string, status: string) {
  const bookId = await findOrCreateBook(supa, title, author);
  const { error } = await supa.from('shelf_items')
    .upsert({ user_id: userId, book_id: bookId, status, is_public: true }, { onConflict: 'user_id,book_id' });
  if (error) throw error;
}

async function mergeProfile(supa: any, userId: string, input: any) {
  const { data: p } = await supa.from('profiles').select('reading_profile').eq('id', userId).maybeSingle();
  const rp: any = (p && p.reading_profile) || {};
  // Coerce to a clean array of trimmed phrases — a model may pass a string,
  // and iterating a string would explode it into single characters.
  const toArr = (x: any): string[] =>
    (Array.isArray(x) ? x : (typeof x === 'string' ? x.split(/[,;]+/) : []))
      .map((s: any) => String(s).trim()).filter((s: string) => s.length > 1);
  const clean = (arr: any) => (Array.isArray(arr) ? arr : []).filter((x: any) => typeof x === 'string' && x.trim().length > 1);
  const dedupe = (arr: any, add: string[]) => {
    const base = clean(arr);
    const seen = new Set(base.map((x: string) => x.toLowerCase()));
    const out = [...base];
    for (const a of add) { if (!seen.has(a.toLowerCase())) { out.push(a); seen.add(a.toLowerCase()); } }
    return out;
  };
  rp.loves = dedupe(rp.loves, toArr(input.add_loves));
  rp.dislikes = dedupe(rp.dislikes, toArr(input.add_dislikes));
  if (input.insight) rp.patterns = [...(rp.patterns || []), { kind: 'note', text: String(input.insight) }];
  await supa.from('profiles').update({ reading_profile: rp }).eq('id', userId);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) return json({ error: 'ANTHROPIC_API_KEY secret not set' }, 500);

    const authHeader = req.headers.get('Authorization') || '';
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: 'not signed in' }, 401);

    const body = await req.json();
    const { mode = 'chat', kind = 'general', book = null, messages = [], mood = null } = body;

    // enrich = Google Books only (FREE, no Anthropic spend). Archived members keep
    // this so their shelves still get real covers/ratings. Not rate-limited.
    if (mode === 'enrich') {
      const gb = await googleBooks(body.title || '', body.author || '');
      if (gb && looksBadDesc(gb.description)) gb.description = null;
      return json({ enrichment: gb });
    }

    // Everything below spends the Anthropic key. Load the member + gate archived
    // accounts here (enrich above stays on for them — Google Books is free).
    const { data: profile } = await supabase.from('profiles').select('display_name, mood, reading_profile, status').eq('id', user.id).maybeSingle();
    if (profile?.status === 'archived')
      return json({ error: 'archived', reply: 'Your advisor is paused on this account — you can still use all your shelves. Ask Chelsea to switch Mabel back on.' }, 403);

    // Rate-limit the Claude-calling modes (fail-soft if the table isn't set up yet).
    try {
      await supabase.from('advisor_calls').insert({ user_id: user.id });
      const since = new Date(Date.now() - 3600_000).toISOString();
      const { count } = await supabase.from('advisor_calls').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', since);
      if ((count || 0) > RATE_MAX_PER_HOUR)
        return json({ error: 'rate_limited', reply: "You've reached the hourly limit — let's give it a little breather and pick this up again soon." }, 429);
    } catch (_e) { /* advisor_calls table not created yet — skip limiting */ }

    const name = profile?.display_name || 'the reader';
    const profileText = profileToText(profile?.reading_profile);
    const currentMood = mood || profile?.mood || null;

    // A clean, spoiler-free synopsis when Google Books has nothing usable.
    if (mode === 'describe') {
      const sys = `You are a knowledgeable, trustworthy librarian. In 2–3 sentences, describe what the book "${body.title}"${body.author ? ' by ' + body.author : ''} is about and what readers tend to love about it — a real sense of the premise and its appeal. STRICT: NO SPOILERS (never reveal twists, major deaths, the culprit, or the ending — only the setup), English only, no quotes from the book, no copyright or marketing boilerplate. If you genuinely don't know the book, reply with exactly: (no description available).`;
      const txt = textOf(await anthropic(apiKey, sys, [{ role: 'user', content: 'Describe it.' }], 320));
      return json({ description: txt && !/no description available/i.test(txt) ? txt : null });
    }

    if (mode === 'recommend') {
      const { data: items } = await supabase
        .from('shelf_items').select('status, rating, books(title, author)').eq('user_id', user.id).limit(60);
      const hist = (items || []).map((i: any) =>
        `${i.books?.title || '?'}${i.books?.author ? ' by ' + i.books.author : ''} [${i.status}${i.rating ? ' ' + i.rating + '★' : ''}]`).join('; ');

      const exclude = new Set<string>();
      for (const i of items || []) { const t = (i.books?.title || '').trim().toLowerCase(); if (t) exclude.add(t); }
      const never = (profile?.reading_profile?.never || []) as any[];
      const neverList = never.map((n) => (n?.title || '').trim()).filter(Boolean);
      for (const t of neverList) exclude.add(t.toLowerCase());
      // "Not right now" snoozes: skip while still within their cooldown window.
      const snoozed = (profile?.reading_profile?.snoozed || []) as any[];
      const nowMs = Date.now();
      const snoozedList = snoozed.filter((s) => s?.until && Date.parse(s.until) > nowMs).map((s) => (s.title || '').trim()).filter(Boolean);
      for (const t of snoozedList) exclude.add(t.toLowerCase());

      const system = baseSystem(name, profileText) +
        `\n\nTHEIR SHELVES (never recommend any of these): ${hist || '(empty)'}` +
        (neverList.length ? `\n\nNEVER recommend these: ${neverList.join('; ')}.` : '') +
        (snoozedList.length ? `\n\nAVOID for now (recently set aside — pick other books first): ${snoozedList.join('; ')}.` : '') +
        `\n\nRIGHT NOW: Recommend 2–3 specific real English-language books${currentMood ? ` (mood: ${currentMood})` : ''} that they have NOT finished, DNF'd, are reading, or already saved — nothing on the lists above. At least one confident match; optionally one gentle "experiment".` +
        `\n\nRespond with ONLY a JSON array, no prose, no fences. Each item: {"title": string, "author": string, "confidence": number 0-100, "moodFit": string, "good": [string, string], "warn": [string], "experiment": boolean}. No spoilers.`;

      const extract = (txt: string): any[] => {
        let t = (txt || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
        const s = t.indexOf('['), e = t.lastIndexOf(']');
        if (s >= 0 && e > s) t = t.slice(s, e + 1);
        const v = JSON.parse(t);
        return Array.isArray(v) ? v : (Array.isArray(v?.recommendations) ? v.recommendations : []);
      };
      let raw = textOf(await anthropic(apiKey, system, [{ role: 'user', content: 'Recommend my next read.' }], 2000));
      let parsed: any[] = [];
      try { parsed = extract(raw); }
      catch (_e) {
        try { // one retry, nudging for clean JSON only
          raw = textOf(await anthropic(apiKey, system + '\n\nReturn ONLY the JSON array — no prose, no code fences.', [{ role: 'user', content: 'Recommend my next read. JSON array only.' }], 2000));
          parsed = extract(raw);
        } catch (_e2) { return json({ items: [], raw, reason: 'parse_failed' }); }
      }
      const before = parsed.length;
      parsed = parsed.filter((it: any) => !exclude.has((it.title || '').trim().toLowerCase())); // hard guarantee
      const enriched = await Promise.all(parsed.map(async (it: any) => {
        const gb = await googleBooks(it.title, it.author);
        return { ...it, coverUrl: gb?.coverUrl || null, rating: gb?.rating || null, ratingsCount: gb?.ratingsCount || null };
      }));
      return json(enriched.length ? { items: enriched } : { items: [], raw, reason: before ? 'all_excluded' : 'empty_model' });
    }

    // mode: chat — short interview, with add_to_shelf + update_reading_profile tools.
    const system = baseSystem(name, profileText) + scenario(kind, book, currentMood) +
      `\n\nQUICK REPLIES: When your message ends by asking them to choose — an either/or, "do you want X or Y", or picking among options — or any time 2–4 short tappable answers would let them reply in one tap, append as the VERY LAST line, exactly:\n[[CHIPS: option one | option two | option three]]\nEach option a few words, written as the reader's own reply and matching what you just asked. Use 2–4. Omit the line entirely when there's no natural choice. Never mention these chips in your prose.`;
    const convo = (messages || [])
      .filter((m: any) => m && typeof m.content === 'string' && m.content.trim())
      .map((m: any) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }));
    if (!convo.length || convo[0].role !== 'user') convo.unshift({ role: 'user', content: book ? `Let's talk about "${book}".` : 'Hi.' });

    let reply = '';
    for (let step = 0; step < 4; step++) {
      const resp = await anthropic(apiKey, system, convo, 600, [ADD_TOOL, PROFILE_TOOL]);
      if (resp.stop_reason !== 'tool_use') { reply = textOf(resp); break; }
      convo.push({ role: 'assistant', content: resp.content });
      const results: any[] = [];
      for (const blk of resp.content || []) {
        if (blk.type !== 'tool_use') continue;
        try {
          if (blk.name === 'add_to_shelf') {
            const status = ['to_read', 'reading', 'finished', 'dnf'].includes(blk.input?.status) ? blk.input.status : 'to_read';
            await doAddToShelf(supabase, user.id, String(blk.input?.title || '').trim(), String(blk.input?.author || '').trim(), status);
            results.push({ type: 'tool_result', tool_use_id: blk.id, content: `Added "${blk.input.title}" to ${status}.` });
          } else if (blk.name === 'update_reading_profile') {
            await mergeProfile(supabase, user.id, blk.input || {});
            results.push({ type: 'tool_result', tool_use_id: blk.id, content: 'Saved to their reading profile.' });
          } else {
            results.push({ type: 'tool_result', tool_use_id: blk.id, content: 'Unknown tool', is_error: true });
          }
        } catch (e: any) {
          results.push({ type: 'tool_result', tool_use_id: blk.id, content: 'Failed: ' + String(e?.message || e), is_error: true });
        }
      }
      convo.push({ role: 'user', content: results });
    }
    // Pull out the optional tappable quick-replies and strip them from the prose.
    let suggestions: string[] = [];
    const cm = reply.match(/\[\[\s*chips:\s*([^\]]+)\]\]/i);
    if (cm) suggestions = cm[1].split('|').map((s) => s.trim()).filter(Boolean).slice(0, 4);
    reply = reply.replace(/\[\[\s*chips:[^\]]*\]\]/ig, '').trim();
    return json({ reply: reply || 'Done.', suggestions });
  } catch (e: any) {
    return json({ error: String(e?.message || e) }, 500);
  }
});
