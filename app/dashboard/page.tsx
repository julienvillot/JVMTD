import Link from "next/link";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "Dashboard · TaxBridge UK" };

export default async function DashboardPage() {
  const { supabase } = await requireUser();
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const mfaDone = aal?.currentLevel === "aal2";

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <div className="rounded-md border border-zinc-200 p-4 text-sm">
        <h2 className="font-medium">Two-factor authentication</h2>
        {mfaDone ? (
          <p className="mt-1 text-green-800">Verified for this session.</p>
        ) : (
          <p className="mt-1 text-zinc-600">
            Required before connecting to HMRC.{" "}
            <Link href="/mfa?next=/dashboard" className="font-medium underline">
              Set up or verify now
            </Link>
          </p>
        )}
      </div>
      <p className="text-sm text-zinc-600">Businesses, uploads and filing will appear here as the next phases land.</p>
    </section>
  );
}
