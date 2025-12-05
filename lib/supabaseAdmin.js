// lib/supabaseAdmin.js
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "\n❌ Missing Supabase environment variables:\n" +
      "SUPABASE_URL or SUPABASE_ANON_KEY not found.\n" +
      "Create .env.local with these values or add them in Vercel.\n"
  );
}

export const supabase =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false },
      })
    : null;
