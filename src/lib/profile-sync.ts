import type { User } from "firebase/auth";
import { supabase } from "./supabase";

export async function syncCustomerProfile(user: User) {
  if (!supabase) return;
  const { error } = await supabase.from("customer_profiles").upsert({
    firebase_uid: user.uid,
    email: user.email,
    display_name: user.displayName,
    avatar_url: user.photoURL,
    updated_at: new Date().toISOString(),
  }, { onConflict: "firebase_uid" });
  if (error) throw error;
}
