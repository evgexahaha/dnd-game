import { createClient } from '@supabase/supabase-js';

// Read user configured Supabase credentials from localStorage or ENV
const customUrl = typeof window !== 'undefined' ? localStorage.getItem('dnd_supabase_url') : null;
const customKey = typeof window !== 'undefined' ? localStorage.getItem('dnd_supabase_key') : null;

const SUPABASE_URL = customUrl || import.meta.env.VITE_SUPABASE_URL || 'https://xyzcompany.supabase.co';
const SUPABASE_ANON_KEY = customKey || import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5emNvbXBhbnkiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTY3MjUxMjAwMCwiZXhwIjoyOTg4MDg4MDAwfQ.demo';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: {
    params: {
      eventsPerSecond: 20
    }
  }
});

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
