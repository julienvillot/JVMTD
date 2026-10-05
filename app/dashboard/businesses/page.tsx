import { requireUser } from "@/lib/auth";
import { getUserBusinesses, createBusiness } from "./actions";

export const metadata = { title: "Businesses & Properties · TaxBridge UK" };

export default async function BusinessesPage() {
  await requireUser();
  const businesses = await getUserBusinesses();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Business &amp; Property Profiles</h1>
        <p className="text-sm text-zinc-600 mt-1">
          Configure your Sole Trader and UK Property businesses to import spreadsheets and submit quarterly MTD updates.
        </p>
      </div>

      {/* Existing Profiles */}
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-zinc-800">Your Registered Profiles ({businesses.length})</h2>
        {businesses.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 bg-zinc-50">
            No businesses registered yet. Add your first trading business or property portfolio below.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {businesses.map((b) => (
              <div key={b.id} className="rounded-lg border border-zinc-200 bg-white p-5 space-y-2">
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold text-zinc-900">{b.trading_name}</h3>
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${
                      b.business_type === "self_employment"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-purple-100 text-purple-800"
                    }`}
                  >
                    {b.business_type === "self_employment" ? "Sole Trader" : "UK Property"}
                  </span>
                </div>
                <div className="text-xs text-zinc-500 space-y-1">
                  <p>
                    Accounting Method: <span className="font-medium text-zinc-700">{b.accounting_type} Basis</span>
                  </p>
                  <p>
                    HMRC Business ID:{" "}
                    <span className="font-mono text-zinc-700">
                      {b.income_source_id ? b.income_source_id : "Not connected to HMRC yet"}
                    </span>
                  </p>
                </div>
                <div className="pt-2 flex gap-2">
                  <a
                    href={`/dashboard/upload?businessId=${b.id}`}
                    className="text-xs font-medium text-zinc-900 underline hover:text-blue-600"
                  >
                    Import Spreadsheet →
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add New Business Form */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 max-w-lg">
        <h2 className="text-base font-semibold text-zinc-900 mb-4">Add Business or Property Profile</h2>
        <form action={createBusiness} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Trading Name / Portfolio Name</label>
            <input
              name="trading_name"
              type="text"
              required
              placeholder="e.g. Acme Consulting or 14 Elm Street Rentals"
              className="w-full rounded border border-zinc-300 p-2 text-sm bg-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Entity Type</label>
            <select name="business_type" className="w-full rounded border border-zinc-300 p-2 text-sm bg-white">
              <option value="self_employment">Sole Trader / Self-Employment (Trade or Profession)</option>
              <option value="uk_property">UK Property (Residential Landlord - Sec 24 Compliant)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Accounting Basis</label>
            <select name="accounting_type" className="w-full rounded border border-zinc-300 p-2 text-sm bg-white">
              <option value="CASH">Cash Basis (Default for MTD)</option>
              <option value="ACCRUALS">Traditional Accruals Basis</option>
            </select>
          </div>

          <button
            type="submit"
            className="w-full rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Create Profile
          </button>
        </form>
      </div>
    </div>
  );
}
