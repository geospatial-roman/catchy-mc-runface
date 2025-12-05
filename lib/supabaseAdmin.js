// lib/supabaseAdmin.js
import { createClient } from "@supabase/supabase-js";

// lib/supabaseAdmin.js
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "Supabase config missing. Check SUPABASE_URL and SUPABASE_ANON_KEY env vars."
  );
}

export const supabase =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false }
      })
    : null;


export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});
console.log("ENV CHECK:", !!process.env.SUPABASE_URL, !!process.env.SUPABASE_ANON_KEY);
