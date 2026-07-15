"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function VerifyDevicePage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const sentRef = useRef(false);

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.email) {
        router.replace("/admin/login");
        return;
      }
      setEmail(user.email);

      if (!sentRef.current) {
        sentRef.current = true;
        await supabase.auth.signInWithOtp({ email: user.email, options: { shouldCreateUser: false } });
      }
      setLoading(false);
    }
    init();
  }, [router]);

  async function resend() {
    if (!email) return;
    setResending(true);
    const supabase = createClient();
    await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
    setResending(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setVerifying(true);
    setError(null);
    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
    if (verifyError) {
      setVerifying(false);
      setError("Incorrect or expired code. Please try again.");
      return;
    }
    const res = await fetch("/api/admin/device/trust", { method: "POST" });
    setVerifying(false);
    if (!res.ok) {
      setError("Verified, but couldn't remember this device — you may be asked again next time.");
    }
    router.replace("/admin");
    router.refresh();
  }

  if (loading) {
    return <div className="p-8 text-center text-[var(--color-foreground)]/60">Sending code…</div>;
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6">
      <div className="text-center">
        <h1 className="text-2xl font-extrabold">New device detected</h1>
        <p className="mt-1 text-sm text-[var(--color-foreground)]/60">
          We sent a code to <strong>{email}</strong> to confirm it&apos;s really you signing in from a new
          device or browser.
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
          {verifying ? "Verifying…" : "Confirm this device"}
        </button>
        <button
          type="button"
          onClick={resend}
          disabled={resending}
          className="text-sm font-medium text-[var(--color-accent)] disabled:opacity-50"
        >
          {resending ? "Resending…" : "Resend code"}
        </button>
      </form>
    </main>
  );
}
