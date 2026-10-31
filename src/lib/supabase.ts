import { createClient } from "@supabase/supabase-js";
import { firebaseAuth } from "./firebase";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

if (!supabaseUrl || !supabaseKey) {
  console.warn("DEQANT: Supabase public configuration is missing.");
}

// Firebase is the identity provider; Supabase validates its ID token as a
// configured third-party JWT provider. Never put a Supabase secret/service key here.
export const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey, {
      accessToken: async () => (await firebaseAuth?.currentUser?.getIdToken()) ?? null,
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
  : null;
