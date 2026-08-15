import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAccessCode, MAX_FAILED_ATTEMPTS, LOCKOUT_MINUTES } from "@/lib/code";
import { signOrgSession, ORG_SESSION_COOKIE, ORG_SESSION_MAX_AGE } from "@/lib/org-session";

const GENERIC_ERROR = "Incorrect code. Please try again.";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const slug = typeof body?.slug === "string" ? body.slug : null;
  const code = typeof body?.code === "string" ? body.code : null;

  if (!slug || !code || !/^\d{4,6}$/.test(code)) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: org, error: fetchError } = await supabase
    .from("organisations")
    .select("id, access_code_hash, failed_attempts, locked_until, is_active")
    .eq("slug", slug)
    .maybeSingle();

  if (fetchError) {
    console.error("org login: failed to fetch organisation", fetchError);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }

  if (!org || !org.is_active) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  if (org.locked_until && new Date(org.locked_until).getTime() > Date.now()) {
    const minutesLeft = Math.ceil((new Date(org.locked_until).getTime() - Date.now()) / 60000);
    return NextResponse.json(
      { error: `Too many failed attempts. Try again in ${minutesLeft} minute(s).` },
      { status: 429 }
    );
  }

  const valid = await verifyAccessCode(code, org.access_code_hash);

  if (!valid) {
    const failedAttempts = org.failed_attempts + 1;
    const lockedUntil =
      failedAttempts >= MAX_FAILED_ATTEMPTS
        ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000).toISOString()
        : null;

    await supabase.from("organisations").update({ failed_attempts: failedAttempts, locked_until: lockedUntil }).eq("id", org.id);

    const message = lockedUntil
      ? `Too many failed attempts. Try again in ${LOCKOUT_MINUTES} minute(s).`
      : GENERIC_ERROR;
    return NextResponse.json({ error: message }, { status: lockedUntil ? 429 : 401 });
  }

  await supabase.from("organisations").update({ failed_attempts: 0, locked_until: null }).eq("id", org.id);

  const token = await signOrgSession(org.id, slug);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ORG_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ORG_SESSION_MAX_AGE,
  });
  return res;
}
