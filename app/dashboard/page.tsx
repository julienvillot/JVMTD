import Link from "next/link";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "Dashboard · TaxBridge UK" };

export default async function DashboardPage() {
  const { supabase, user } = await requireUser();
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const mfaDone = aal?.currentLevel === "aal2";

  // Quick stats
  const { count: businessCount } = await supabase
    .from("businesses")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  const { count: fileCount } = await supabase
    .from("uploaded_files")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  const { count: unreviewedCount } = await supabase
    .from("transactions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_reviewed", false);

  const { count: totalTxnCount } = await supabase
    .from("transactions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">TaxBridge Overview</h1>
        <p className="text-sm text-zinc-600 mt-1">
          Bridge your spreadsheets to HMRC Making Tax Digital for Income Tax Self Assessment (ITSA).
        </p>
      </div>

      {/* Two-Factor Authentication Status Card */}
      <div className="rounded-lg border border-zinc-200 bg-white p-5 text-sm flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-zinc-900">Two-Factor Authentication (HMRC Anti-Fraud Mandate)</h2>
          {mfaDone ? (
            <p className="text-emerald-700 text-xs mt-0.5">
              ✓ Verified for this session. Your session satisfies HMRC Gov-Client-Multi-Factor headers.
            </p>
          ) : (
            <p className="text-zinc-600 text-xs mt-0.5">
              Required by HMRC before connecting OAuth or submitting returns.
            </p>
          )}
        </div>
        {!mfaDone && (
          <Link
            href="/mfa?next=/dashboard"
            className="rounded bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800"
          >
            Configure MFA
          </Link>
        )}
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Profiles</p>
          <p className="text-2xl font-bold text-zinc-900 mt-1">{businessCount || 0}</p>
          <Link href="/dashboard/businesses" className="text-xs text-blue-600 hover:underline mt-2 inline-block">
            Manage profiles →
          </Link>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Imported Files</p>
          <p className="text-2xl font-bold text-zinc-900 mt-1">{fileCount || 0}</p>
          <Link href="/dashboard/upload" className="text-xs text-blue-600 hover:underline mt-2 inline-block">
            Upload spreadsheet →
          </Link>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Staged Transactions</p>
          <p className="text-2xl font-bold text-zinc-900 mt-1">{totalTxnCount || 0}</p>
          <span className="text-xs text-zinc-400 mt-2 inline-block">Total imported</span>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Needs Review</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{unreviewedCount || 0}</p>
          <span className="text-xs text-zinc-400 mt-2 inline-block">Pending approval</span>
        </div>
      </div>

      {/* Quick Action Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="rounded-lg border border-zinc-200 bg-white p-6 space-y-3">
          <div className="w-8 h-8 rounded bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-sm">
            1
          </div>
          <h3 className="font-semibold text-zinc-900">Manage Entities</h3>
          <p className="text-xs text-zinc-600">
            Set up sole trader self-employment trading names and UK residential property portfolios.
          </p>
          <Link
            href="/dashboard/businesses"
            className="inline-block text-xs font-medium text-zinc-900 underline hover:text-blue-600 pt-1"
          >
            Configure businesses →
          </Link>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-6 space-y-3">
          <div className="w-8 h-8 rounded bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-sm">
            2
          </div>
          <h3 className="font-semibold text-zinc-900">Import &amp; Categorise</h3>
          <p className="text-xs text-zinc-600">
            Upload CSV/XLSX spreadsheets with automatic column mapping, Section 24 mortgage checks, and AI classification.
          </p>
          <Link
            href="/dashboard/upload"
            className="inline-block text-xs font-medium text-zinc-900 underline hover:text-blue-600 pt-1"
          >
            Import new file →
          </Link>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-6 space-y-3">
          <div className="w-8 h-8 rounded bg-purple-100 text-purple-800 flex items-center justify-center font-bold text-sm">
            3
          </div>
          <h3 className="font-semibold text-zinc-900">HMRC Direct Filing</h3>
          <p className="text-xs text-zinc-600">
            Fetch quarterly obligations from HMRC, review cumulative period summaries, and submit updates with anti-fraud telemetry.
          </p>
          <Link
            href="/dashboard/filing"
            className="inline-block text-xs font-medium text-zinc-900 underline hover:text-blue-600 pt-1"
          >
            Go to filing →
          </Link>
        </div>
      </div>
    </div>
  );
}
