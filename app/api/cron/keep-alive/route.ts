import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { melbourneWeekStart } from "@/lib/listings";

// Pinged daily by Vercel Cron (see vercel.json) to keep the Supabase project
// active — free-tier Supabase projects pause after 7 days with no activity.
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("campuses").select("id").limit(1);

  if (error) {
    console.error("keep-alive ping failed", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Privacy clean-up. Weekly claims (device / student-number hashes) are
  // only needed for the current week, so anything from an earlier week is
  // deleted. Label acknowledgements hold no identifiers but are trimmed
  // after 14 days anyway.
  const [claimsCleanup, acksCleanup] = await Promise.all([
    supabase.from("listing_claims").delete().lt("week_start", melbourneWeekStart()),
    supabase
      .from("food_label_acks")
      .delete()
      .lt("acknowledged_at", new Date(Date.now() - 14 * 86_400_000).toISOString()),
  ]);
  if (claimsCleanup.error) console.error("claims clean-up failed", claimsCleanup.error);
  if (acksCleanup.error) console.error("acks clean-up failed", acksCleanup.error);

  return NextResponse.json({ ok: true, pinged_at: new Date().toISOString() });
}
