import { requireUser, safeNextPath } from "@/lib/auth";
import { MfaForm } from "./mfa-form";

export const metadata = { title: "Two-factor authentication · TaxBridge UK" };

export default async function MfaPage({ searchParams }: PageProps<"/mfa">) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : null);
  const { supabase } = await requireUser();

  const { data } = await supabase.auth.mfa.listFactors();
  const verifiedFactorId = data?.totp[0]?.id ?? null; // `totp` only lists verified factors

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Two-factor authentication</h1>
        <p className="mt-1 text-sm text-zinc-600">
          {verifiedFactorId ? "Enter the code from your authenticator app." : "One-time setup required before connecting to HMRC."}
        </p>
      </header>
      <MfaForm verifiedFactorId={verifiedFactorId} next={next} />
    </main>
  );
}
