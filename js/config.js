// Supabase connection.
// The anon (public) key is SAFE to ship in the browser — Row-Level Security
// (see supabase/schema.sql) is what actually protects the data.
// NEVER put the service_role (secret) key in here.
//
// Paste the two values from Supabase → Project Settings → API:
export const SUPABASE_URL = 'https://qtinnaugpjhjsdmnltip.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_o8Hfx3kt819iBS1K_DikHg_qa6cpcK9';

export const isConfigured = () =>
  SUPABASE_URL.startsWith('http') && SUPABASE_ANON_KEY.length > 20;
