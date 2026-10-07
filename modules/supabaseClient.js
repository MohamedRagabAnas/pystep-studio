import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const url = window.PYSTEP_SUPABASE_URL || "";
const anonKey = window.PYSTEP_SUPABASE_ANON_KEY || "";

let client = null;

export function isSupabaseConfigured() {
  return Boolean(url && anonKey);
}

export function getSupabase() {
  if (!isSupabaseConfigured()) return null;
  if (!client) {
    client = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
  }
  return client;
}
