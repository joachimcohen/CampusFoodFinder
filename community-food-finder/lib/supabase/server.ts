import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server client — uses the anon key, reads the admin's Supabase Auth session
 * from cookies. Safe for server components, route handlers, and server actions.
 * RLS still applies: this client is `authenticated` only when an admin is logged in.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // setAll is called from a Server Component in some paths;
            // safe to ignore since middleware refreshes the session.
          }
        },
      },
    }
  );
}
