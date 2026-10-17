"use client";

import { useEffect, useState } from "react";
import { UtensilsCrossed } from "lucide-react";
import { isValidStudentNumber } from "@/lib/student-number";

const CONFIRMED_KEY = "cff_student_confirmed";

function readConfirmed(): boolean {
  try {
    return localStorage.getItem(CONFIRMED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeConfirmed() {
  try {
    localStorage.setItem(CONFIRMED_KEY, "1");
  } catch {
    // Private browsing: they're let in for this visit and asked again next time.
  }
}

/**
 * "This Food Finder is for Deakin students only." Shown once per phone,
 * before the feed or a queue page. We trust students to be honest: the
 * number is only format-checked here on the phone and is never sent to the
 * server or saved. All the phone remembers is that the check was done.
 */
export default function StudentGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<"checking" | "ask" | "ok">("checking");
  const [studentNumber, setStudentNumber] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time localStorage read on mount
    setState(readConfirmed() ? "ok" : "ask");
  }, []);

  if (state === "ok") return <>{children}</>;
  if (state === "checking") return <div className="min-h-dvh" aria-busy="true" />;

  const numberOk = isValidStudentNumber(studentNumber);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!numberOk || !confirmed) return;
    writeConfirmed();
    setStudentNumber("");
    setState("ok");
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-6 pb-8 pt-12">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-muted)]">
        <UtensilsCrossed size={32} className="text-[var(--color-primary)]" aria-hidden="true" />
      </div>
      <h1 className="text-2xl font-extrabold leading-tight">This Food Finder is for Deakin students only</h1>
      <p className="text-[15px] leading-relaxed">
        Pop in your student number once and you&apos;re set. This phone will remember you&apos;ve done it, so you
        won&apos;t be asked again.
      </p>

      <form onSubmit={submit} className="flex flex-1 flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Student number
          <input
            inputMode="numeric"
            autoComplete="off"
            value={studentNumber}
            onChange={(e) => setStudentNumber(e.target.value.replace(/\s/g, ""))}
            className="min-h-12 rounded-xl border border-[var(--color-border)] px-4 text-lg tracking-wider"
          />
        </label>
        {studentNumber && !numberOk && (
          <p className="text-sm text-[var(--color-destructive)]">That doesn&apos;t look like a Deakin student number.</p>
        )}

        <label className="flex items-start gap-3 rounded-xl bg-[var(--color-muted)] p-3 text-sm">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-primary)]"
          />
          <span>I&apos;m a current Deakin student and this is my student number.</span>
        </label>

        <div className="flex-1" />
        <p className="text-xs leading-relaxed text-[var(--color-foreground)]/70">
          Your number is only checked on this phone. It&apos;s never sent to us or saved anywhere.
        </p>
        <button
          type="submit"
          disabled={!numberOk || !confirmed}
          className="min-h-12 rounded-xl bg-[var(--color-primary)] text-base font-semibold text-[var(--color-on-primary)] disabled:opacity-40"
        >
          Find free food
        </button>
      </form>
    </main>
  );
}
