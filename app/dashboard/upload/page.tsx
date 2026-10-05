import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getUserBusinesses } from "../businesses/actions";
import { FileDropzone } from "@/components/file-dropzone";
import type { UploadedFileRow } from "@/lib/types/database";

export const metadata = { title: "Import Spreadsheet · TaxBridge UK" };

export default async function UploadPage() {
  const { supabase, user } = await requireUser();
  const businesses = await getUserBusinesses();

  // Fetch recent uploads
  const { data: uploads } = (await supabase
    .from("uploaded_files")
    .select("*, businesses(trading_name, business_type)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })) as {
    data:
      | (UploadedFileRow & {
          businesses: { trading_name: string; business_type: string } | null;
        })[]
      | null;
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Import Spreadsheet</h1>
        <p className="text-sm text-zinc-600 mt-1">
          Upload bank statements or bookkeeping spreadsheets (.csv, .xlsx). Columns will be detected automatically.
        </p>
      </div>

      <FileDropzone businesses={businesses} />

      {/* Uploaded Files History */}
      {uploads && uploads.length > 0 && (
        <div className="space-y-3 pt-6 border-t border-zinc-200">
          <h2 className="text-base font-semibold text-zinc-800">Previous Imports ({uploads.length})</h2>
          <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
            <table className="min-w-full text-xs text-left">
              <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-600">
                <tr>
                  <th className="p-3">File Name</th>
                  <th className="p-3">Linked Business</th>
                  <th className="p-3">Uploaded Date</th>
                  <th className="p-3">Transactions</th>
                  <th className="p-3">Audit SHA-256</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {uploads.map((file) => (
                  <tr key={file.id} className="hover:bg-zinc-50">
                    <td className="p-3 font-medium text-zinc-900">{file.file_name}</td>
                    <td className="p-3 text-zinc-700">
                      {file.businesses?.trading_name || "—"}
                    </td>
                    <td className="p-3 text-zinc-500">{new Date(file.created_at).toLocaleDateString("en-GB")}</td>
                    <td className="p-3 font-semibold text-zinc-800">{file.row_count} rows</td>
                    <td className="p-3 font-mono text-[10px] text-zinc-500 truncate max-w-[120px]" title={file.file_hash}>
                      {file.file_hash.slice(0, 12)}...
                    </td>
                    <td className="p-3 text-right">
                      <Link
                        href={`/dashboard/review/${file.id}`}
                        className="rounded bg-zinc-100 hover:bg-zinc-200 px-3 py-1 font-medium text-zinc-800"
                      >
                        Review &amp; Stage →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
