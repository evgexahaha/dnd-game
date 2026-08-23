import { createClient } from '@supabase/supabase-js';

const customUrl = typeof window !== 'undefined' ? localStorage.getItem('dnd_supabase_url') : null;
const customKey = typeof window !== 'undefined' ? localStorage.getItem('dnd_supabase_key') : null;

// Only create live client if valid custom credentials are given
const SUPABASE_URL = customUrl || (import.meta.env.VITE_SUPABASE_URL && !import.meta.env.VITE_SUPABASE_URL.includes('xyzcompany') ? import.meta.env.VITE_SUPABASE_URL : null);
const SUPABASE_ANON_KEY = customKey || import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : {
  channel: () => ({
    on: function() { return this; },
    subscribe: function(cb) { if (cb) cb('SUBSCRIBED'); return this; },
    send: function() { return this; },
    track: function() { return this; }
  })
};

export function configureSupabase(url, key) {
  if (url && key) {
    localStorage.setItem('dnd_supabase_url', url);
    localStorage.setItem('dnd_supabase_key', key);
  } else {
    localStorage.removeItem('dnd_supabase_url');
    localStorage.removeItem('dnd_supabase_key');
  }
  window.location.reload();
}
