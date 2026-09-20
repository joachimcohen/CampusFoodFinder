import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionVendorId, isVendorActive } from "@/lib/vendor-auth";
import { assertVendorOwnsListing, findOrCreateTodaySession, getStaffSnapshot } from "@/lib/queue";
import { sendPush } from "@/lib/push";

type RouteParams = { params: Promise<{ listingId: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { listingId } = await params;
  const vendorId = await getSessionVendorId(req, req.headers.get("x-vendor-slug") ?? undefined);
  if (!vendorId || !(await isVendorActive(vendorId))) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const supabase = createAdminClient();
  if (!(await assertVendorOwnsListing(supabase, listingId, vendorId))) {
    return NextResponse.json({ error: "Listing not found." }, { status: 404 });
  }

  const session = await findOrCreateTodaySession(supabase, listingId);
  if ("error" in session) return NextResponse.json({ error: session.error }, { status: 400 });

  const body = await req.json().catch(() => null);
  const requestedSize = Number(body?.size);
  const size = Number.isInteger(requestedSize) && requestedSize > 0 ? requestedSize : session.batch_size;

  const { data: toCall } = await supabase
    .from("queue_entries")
    .select("id, push_subscription_id")
    .eq("session_id", session.id)
    .eq("status", "waiting")
    .order("joined_at", { ascending: true })
    .limit(size);

  if (!toCall || toCall.length === 0) {
    return NextResponse.json({ error: "Nobody is currently waiting." }, { status: 400 });
  }

  const calledAt = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("queue_entries")
    .update({ status: "called", called_at: calledAt })
    .in("id", toCall.map((e) => e.id));

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  await supabase.from("batch_calls").insert({ session_id: session.id, batch_size_called: toCall.length });

  await Promise.all(
    toCall
      .filter((e) => e.push_subscription_id)
      .map(async (e) => {
        const { data: sub } = await supabase
          .from("push_subscriptions")
          .select("endpoint, p256dh, auth")
          .eq("id", e.push_subscription_id)
          .maybeSingle();
        if (sub) {
          await sendPush(supabase, sub, {
            title: "You're up!",
            body: "Come to the counter now.",
            url: "/",
          });
        }
      })
  );

  const snapshot = await getStaffSnapshot(supabase, listingId);
  if ("error" in snapshot) return NextResponse.json({ error: snapshot.error }, { status: 400 });
  return NextResponse.json(snapshot);
}
