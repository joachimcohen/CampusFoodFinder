import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runCleanup } from "@/lib/cleanup";

// Pinged daily by Vercel Cron (see vercel.json) to keep the Supabase project
// active — free-tier Supabase projects pause after 7 days with no activity —
// and to run the daily data clean-up.
//
// Set CRON_SECRET in Vercel and Vercel sends it automatically, so only the
// scheduled job can trigger this.
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

  // Daily clean-up: old listings and their photos, unused photos, past
  // queues, last week's claims and old label ticks. See lib/cleanup.ts for
  // the retention periods. Returns counts only.
  const cleanup = await runCleanup(supabase);

  return NextResponse.json({ ok: true, pinged_at: new Date().toISOString(), cleanup });
}
