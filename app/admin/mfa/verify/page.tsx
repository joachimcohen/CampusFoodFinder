"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function MfaVerifyPage() {
  const router = useRouter();
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

      // `.totp` is typed as verified-only factors already.
      const { data: factorsData } = await supabase.auth.mfa.listFactors();
      const verified = factorsData?.totp?.[0];
      if (!verified) {
        router.replace("/admin/mfa/enroll");
        return;
      }
      setFactorId(verified.id);
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
    return <div className="p-8 text-center text-[var(--color-foreground)]/60">Loading…</div>;
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6">
      <div className="text-center">
        <h1 className="text-2xl font-extrabold">Enter your code</h1>
        <p className="mt-1 text-sm text-[var(--color-foreground)]/60">
          Open your authenticator app and enter the 6-digit code.
        </p>
      </div>
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
          {verifying ? "Verifying…" : "Verify"}
        </button>
      </form>
    </main>
  );
}
