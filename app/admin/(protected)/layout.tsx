import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { verifyAdminDeviceToken, ADMIN_DEVICE_COOKIE } from "@/lib/admin-device";
import SignOutButton from "./SignOutButton";

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/admin/login");

  // MFA is required for every admin account. currentLevel/nextLevel come from
  // the session's JWT: nextLevel === 'aal2' means a verified TOTP factor
  // exists and this session still needs to complete the challenge; otherwise
  // no factor is enrolled yet and (since it's required) enrollment is forced.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal && aal.currentLevel !== "aal2") {
    redirect(aal.nextLevel === "aal2" ? "/admin/mfa/verify" : "/admin/mfa/enroll");
  }

  // Past MFA — now check this browser/device has completed the one-time
  // email verification for new devices (see /admin/verify-device).
  const deviceCookie = (await cookies()).get(ADMIN_DEVICE_COOKIE)?.value;
  const deviceTrusted = deviceCookie ? await verifyAdminDeviceToken(deviceCookie, user.id) : false;
  if (!deviceTrusted) redirect("/admin/verify-device");

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">Admin Dashboard</h1>
          <p className="text-sm text-[var(--color-foreground)]/60">{user.email}</p>
        </div>
        <SignOutButton />
      </div>
      {children}
    </div>
  );
}
