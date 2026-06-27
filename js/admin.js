// Client connector for the owner-only "admin" edge function.
import { supabase } from './supabase.js';

async function call(body) {
  const { data, error } = await supabase.functions.invoke('admin', { body });
  if (error) {
    // Surface the function's own error message when present (more useful than the generic one).
    let msg = error.message || String(error);
    try { const ctx = await error.context?.json?.(); if (ctx && ctx.error) msg = ctx.error; } catch (_e) {}
    throw new Error(msg);
  }
  if (data && data.error) throw new Error(data.error);
  return data;
}

export const adminList = () => call({ action: 'list' });
// args is merged into the body — e.g. { userId } or { email }.
export const adminAct = (action, args = {}) => call({ action, ...args });
