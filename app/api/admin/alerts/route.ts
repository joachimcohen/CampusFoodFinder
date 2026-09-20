import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { broadcastPush } from "@/lib/push";
import type { AlertSeverity } from "@/lib/types";

const SEVERITIES: AlertSeverity[] = ["recall", "advisory", "general"];

/**
 * Posts a new alert and broadcasts it via push. Unlike the other
 * AdminDashboard tabs, this can't just rely on the aal2 RLS policy
 * (0005_virtual_queue.sql's admin_alerts_admin_all) — it has to use the
 * service-role client anyway to read push_subscriptions (which has zero RLS
 * policies by design), so the aal2 check has to be made explicitly here in
 * code, the same check app/admin/(protected)/layout.tsx already does.
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { data: aal } = await admin.supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal && aal.currentLevel !== "aal2") {
    return NextResponse.json({ error: "MFA verification is required to post an alert." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const severity = body?.severity;

  if (!message) return NextResponse.json({ error: "Message is required." }, { status: 400 });
  if (!SEVERITIES.includes(severity)) return NextResponse.json({ error: "Invalid severity." }, { status: 400 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("admin_alerts")
    .insert({ message, severity, created_by: admin.user.id })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const titleBySeverity: Record<AlertSeverity, string> = {
    recall: "Recall notice",
    advisory: "Advisory",
    general: "Campus Food Finder",
  };
  await broadcastPush(supabase, { title: titleBySeverity[severity as AlertSeverity], body: message, url: "/" });

  return NextResponse.json({ alert: data }, { status: 201 });
}
