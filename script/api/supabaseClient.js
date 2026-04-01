/**
 * HABITLY — supabaseClient.js
 * Juan Lopez Loza
 * 01/04/2026
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabaseClient = supabase.createClient(
    supabaseUrl,
    supabaseKey,
);