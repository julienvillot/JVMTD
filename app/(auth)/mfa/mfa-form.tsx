"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Props = {
  /** Id of an already-verified TOTP factor, if the user has one. */
  verifiedFactorId: string | null;
  next: string;
};

type Enrollment = { factorId: string; qrCode: string; secret: string };

export function MfaForm({ verifiedFactorId, next }: Props) {
  const router = useRouter();
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const factorId = verifiedFactorId ?? enrollment?.factorId ?? null;

  async function startEnrollment() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `Authenticator ${new Date().toISOString()}`,
    });
    setBusy(false);
    if (error || !data) {
      setError(error?.message ?? "Could not start authenticator setup.");
      return;
    }
    setEnrollment({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!factorId) return;
    const code = String(new FormData(event.currentTarget).get("code") ?? "").trim();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    setBusy(false);
    if (error) {
      setError("That code didn't work. Check the code and try again.");
      return;
    }
    router.replace(next);
    router.refresh();
  }

  if (!factorId) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-zinc-600">
          HMRC requires us to record how you signed in. Set up an authenticator app (Google Authenticator, 1Password, Authy…) to continue.
        </p>
        <button
          type="button"
          onClick={startEnrollment}
          disabled={busy}
          className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          Set up authenticator app
        </button>
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={verify} className="flex flex-col gap-4">
      {enrollment && (
        <div className="flex flex-col items-start gap-2">
          <p className="text-sm text-zinc-600">Scan this QR code with your authenticator app, then enter the 6-digit code.</p>
          {/* The QR code is an SVG data URI from Supabase, so next/image adds nothing here. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={enrollment.qrCode} alt="Authenticator QR code" width={192} height={192} />
          <p className="text-xs text-zinc-600">
            Can&apos;t scan? Enter this key manually: <code className="break-all">{enrollment.secret}</code>
          </p>
        </div>
      )}
      <label className="flex flex-col gap-1 text-sm font-medium">
        6-digit code
        <input
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          className="rounded-md border border-zinc-300 px-3 py-2 font-normal tracking-widest"
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
      >
        Verify
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </form>
  );
}
