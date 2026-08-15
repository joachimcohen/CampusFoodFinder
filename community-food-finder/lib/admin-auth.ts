import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Returns the Supabase client plus the logged-in admin's user, or null if not authenticated. */
export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { supabase, user };
}
