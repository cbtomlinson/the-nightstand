// Client connector for the "advisor" edge function (the live Claude brain).
// Everything here fails soft: callers wrap these in try/catch and fall back to
// the scripted preview, so the app keeps working until the function is deployed.
import { supabase } from './supabase.js';
import { isConfigured } from './config.js';

export const advisorReady = () => isConfigured();

async function call(body) {
  const { data, error } = await supabase.functions.invoke('advisor', { body });
  if (error) {
    // FunctionsHttpError buries the real message in the response body — dig it
    // out so "details below" shows what actually went wrong, not the generic
    // "non-2xx status code".
    let detail = '';
    try {
      if (error.context && typeof error.context.json === 'function') {
        const b = await error.context.json();
        detail = (b && (b.error || b.message)) || '';
      }
      if (error.context && error.context.status) detail = `[${error.context.status}] ${detail || error.message}`;
    } catch (_e) {}
    throw new Error(detail || error.message || 'advisor unreachable');
  }
  if (data && data.error) throw new Error(data.error);
  return data;
}

// messages: [{ role: 'user'|'assistant', content }]
// Returns { reply, suggestions } — suggestions are contextual tappable quick-replies.
export async function advisorChat({ kind = 'general', book = null, messages }) {
  const d = await call({ mode: 'chat', kind, book, messages });
  return { reply: (d && d.reply) || '', suggestions: (d && d.suggestions) || [] };
}

export async function advisorRecommend({ mood = null } = {}) {
  const d = await call({ mode: 'recommend', mood });
  return d || { items: [] }; // { items, raw?, reason? }
}

// Google Books metadata for one title (cover, description, rating, categories).
export async function advisorEnrich({ title, author = '' }) {
  const d = await call({ mode: 'enrich', title, author });
  return (d && d.enrichment) || null;
}

// Claude-written spoiler-free synopsis — used when Google's description is junk.
export async function advisorDescribe({ title, author = '' }) {
  const d = await call({ mode: 'describe', title, author });
  return (d && d.description) || null;
}
