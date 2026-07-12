import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPin, MAX_FAILED_ATTEMPTS, LOCKOUT_MINUTES } from "@/lib/pin";
import { signVendorSession, VENDOR_SESSION_COOKIE, VENDOR_SESSION_MAX_AGE } from "@/lib/vendor-session";

const GENERIC_ERROR = "Incorrect PIN. Please try again.";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const slug = typeof body?.slug === "string" ? body.slug : null;
  const pin = typeof body?.pin === "string" ? body.pin : null;

  if (!slug || !pin || !/^\d{4,6}$/.test(pin)) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: vendor, error: fetchError } = await supabase
    .from("vendors")
    .select("id, pin_hash, failed_attempts, locked_until, is_active")
    .eq("slug", slug)
    .maybeSingle();

  if (fetchError) {
    // Surfaces mis-configured SUPABASE_SERVICE_ROLE_KEY (e.g. anon key pasted by
    // mistake, which can't read pin_hash) in Vercel's function logs instead of
    // silently presenting as a wrong PIN.
    console.error("vendor login: failed to fetch vendor", fetchError);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }

  if (!vendor || !vendor.is_active) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  if (vendor.locked_until && new Date(vendor.locked_until).getTime() > Date.now()) {
    const minutesLeft = Math.ceil(
      (new Date(vendor.locked_until).getTime() - Date.now()) / 60000
    );
    return NextResponse.json(
      { error: `Too many failed attempts. Try again in ${minutesLeft} minute(s).` },
      { status: 429 }
    );
  }

  const valid = await verifyPin(pin, vendor.pin_hash);

  if (!valid) {
    const failedAttempts = vendor.failed_attempts + 1;
    const lockedUntil =
      failedAttempts >= MAX_FAILED_ATTEMPTS
        ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000).toISOString()
        : null;

    await supabase
      .from("vendors")
      .update({ failed_attempts: failedAttempts, locked_until: lockedUntil })
      .eq("id", vendor.id);

    const message = lockedUntil
      ? `Too many failed attempts. Try again in ${LOCKOUT_MINUTES} minute(s).`
      : GENERIC_ERROR;
    return NextResponse.json({ error: message }, { status: lockedUntil ? 429 : 401 });
  }

  await supabase
    .from("vendors")
    .update({ failed_attempts: 0, locked_until: null })
    .eq("id", vendor.id);

  const token = await signVendorSession(vendor.id);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(VENDOR_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: VENDOR_SESSION_MAX_AGE,
  });
  return res;
}
