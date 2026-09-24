import { supabase } from "./supabase";

// fetch() for our own /api routes, carrying the signed-in user's Supabase
// session so the server can check they're on the staff roster.
export async function apiFetch(url, options = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = { ...(options.headers || {}) };
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
  return fetch(url, { ...options, headers });
}
