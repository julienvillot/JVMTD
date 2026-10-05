import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { MappingTable } from "@/components/mapping-table";
import type { BusinessType, TransactionRow, UploadedFileRow } from "@/lib/types/database";

export const metadata = { title: "Review Transactions · TaxBridge UK" };

interface ReviewPageProps {
  params: Promise<{ fileId: string }>;
}

export default async function ReviewPage({ params }: ReviewPageProps) {
  const { fileId } = await params;
  const { supabase, user } = await requireUser();

  // Fetch file audit record with linked business
  const { data: file, error: fileError } = (await supabase
    .from("uploaded_files")
    .select("*, businesses(business_type, trading_name)")
    .eq("id", fileId)
    .eq("user_id", user.id)
    .single()) as {
    data: (UploadedFileRow & { businesses: { business_type: string; trading_name: string } | null }) | null;
    error: unknown;
  };

  if (fileError || !file) {
    notFound();
  }

  // Fetch all transactions for this file
  const { data: transactions, error: txnError } = await supabase
    .from("transactions")
    .select("*")
    .eq("file_id", fileId)
    .eq("user_id", user.id)
    .order("source_row", { ascending: true });

  if (txnError) {
    throw new Error(`Failed to load transactions: ${txnError.message}`);
  }

  const businessType = (file.businesses?.business_type || "self_employment") as BusinessType;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <a href="/dashboard/upload" className="hover:underline">
          ← Back to Imports
        </a>
        <span>/</span>
        <span>{file.file_name}</span>
      </div>

      <MappingTable
        transactions={(transactions || []) as TransactionRow[]}
        businessType={businessType}
        fileId={file.id}
        fileName={file.file_name}
      />
    </div>
  );
}
