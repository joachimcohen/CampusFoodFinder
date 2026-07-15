"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function MfaEnrollPage() {
  const router = useRouter();
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    async function init() {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/admin/login");
        return;
      }

      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.currentLevel === "aal2") {
        router.replace("/admin");
        return;
      }

      // Clear out any abandoned enrollment from a previous attempt so a
      // fresh enroll() call doesn't collide with it. `.totp` is typed as
      // verified-only factors, so unverified ones only show up in `.all`.
      const { data: factorsData } = await supabase.auth.mfa.listFactors();
      const existingUnverified = factorsData?.all?.find(
        (f) => f.factor_type === "totp" && f.status === "unverified"
      );
      if (existingUnverified) {
        await supabase.auth.mfa.unenroll({ factorId: existingUnverified.id });
      }

      const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: "totp" });
      if (enrollError || !data) {
        setError(enrollError?.message ?? "Could not start MFA enrollment.");
        setLoading(false);
        return;
      }
      setFactorId(data.id);
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
      setLoading(false);
    }
    init();
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setVerifying(true);
    setError(null);
    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    setVerifying(false);
    if (verifyError) {
      setError("Incorrect code. Please try again.");
      return;
    }
    router.replace("/admin");
    router.refresh();
  }

  if (loading) {
    return <div className="p-8 text-center text-[var(--color-foreground)]/60">Setting up…</div>;
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6">
      <div className="text-center">
        <h1 className="text-2xl font-extrabold">Set up two-factor authentication</h1>
        <p className="mt-1 text-sm text-[var(--color-foreground)]/60">
          Required for admin accounts. Scan this with Google Authenticator, Authy, or any TOTP app.
        </p>
      </div>

      {error && !qrCode && <p className="text-center text-sm text-[var(--color-destructive)]">{error}</p>}

      {qrCode && (
        <>
          <div className="flex justify-center rounded-xl border border-[var(--color-border)] bg-white p-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- data: URI SVG from Supabase, not a static asset */}
            <img src={qrCode} alt="Scan with your authenticator app" width={200} height={200} />
          </div>
          {secret && (
            <p className="text-center text-xs text-[var(--color-foreground)]/60">
              Can&apos;t scan? Enter this code manually: <span className="font-mono">{secret}</span>
            </p>
          )}
          <form onSubmit={submit} className="flex flex-col gap-4">
            <input
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="6-digit code"
              className="rounded-xl border border-[var(--color-border)] bg-white px-4 py-3 text-center text-2xl tracking-[0.3em] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
              autoFocus
            />
            {error && <p className="text-center text-sm text-[var(--color-destructive)]">{error}</p>}
            <button
              type="submit"
              disabled={verifying || code.length < 6}
              className="min-h-11 rounded-xl bg-[var(--color-primary)] font-semibold text-[var(--color-on-primary)] disabled:opacity-50"
            >
              {verifying ? "Verifying…" : "Confirm and enable"}
            </button>
          </form>
        </>
      )}
    </main>
  );
}
