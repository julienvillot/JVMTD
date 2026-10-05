"use server";

import * as XLSX from "xlsx";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { computeSha256 } from "@/lib/security/hash";
import { type ColumnMapping } from "@/lib/ingestion/column-detect";
import { normaliseSheetRows } from "@/lib/ingestion/normalise";
import { classifyTransactions } from "@/lib/classification";

export interface IngestResponse {
  success: boolean;
  fileId?: string;
  error?: string;
  rowCount?: number;
  skippedCount?: number;
}

export async function ingestSpreadsheet(formData: FormData): Promise<IngestResponse> {
  try {
    const { supabase, user } = await requireUser();

    const file = formData.get("file") as File | null;
    const businessId = String(formData.get("businessId") ?? "").trim();
    const clientHash = String(formData.get("clientHash") ?? "").trim();
    const mappingJson = String(formData.get("mapping") ?? "");

    if (!file || !(file instanceof File)) {
      return { success: false, error: "Please provide a valid spreadsheet file." };
    }

    if (!businessId) {
      return { success: false, error: "Please select a business to link this upload to." };
    }

    let mapping: ColumnMapping;
    try {
      mapping = JSON.parse(mappingJson) as ColumnMapping;
    } catch {
      return { success: false, error: "Invalid column mapping provided." };
    }

    // Verify business exists and belongs to this user
    const { data: business, error: bizError } = await supabase
      .from("businesses")
      .select("*")
      .eq("id", businessId)
      .eq("user_id", user.id)
      .single();

    if (bizError || !business) {
      return { success: false, error: "Selected business could not be found or access is denied." };
    }

    // 1. Read binary buffer and calculate server-side SHA-256 checksum (Digital Links Invariant)
    const arrayBuffer = await file.arrayBuffer();
    const serverHash = await computeSha256(arrayBuffer);

    if (clientHash && serverHash.toLowerCase() !== clientHash.toLowerCase()) {
      return {
        success: false,
        error: "File checksum mismatch between browser and server. Upload integrity check failed.",
      };
    }

    // 2. Upload file to Supabase Storage audit vault (Immutable Audit Trail)
    const fileId = crypto.randomUUID();
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${user.id}/${fileId}/${cleanFileName}`;

    const { error: storageError } = await supabase.storage
      .from("audit-vault")
      .upload(storagePath, arrayBuffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (storageError) {
      console.warn("Audit vault storage warning (proceeding with db record):", storageError.message);
    }

    // 3. Parse spreadsheet into 2D row array using SheetJS
    const uint8 = new Uint8Array(arrayBuffer);
    const workbook = XLSX.read(uint8, { type: "array", cellDates: true });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return { success: false, error: "Spreadsheet contains no sheets." };
    }
    const sheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: false,
      defval: "",
    }) as unknown[][];

    if (!rawRows || rawRows.length < 2) {
      return { success: false, error: "Spreadsheet has insufficient data rows." };
    }

    // 4. Normalise transactions using the confirmed column mapping
    const { transactions, skippedRows } = normaliseSheetRows(rawRows, mapping, { hasHeaderRow: true });

    if (transactions.length === 0) {
      return {
        success: false,
        error: `Could not parse any valid transactions. ${skippedRows.length} rows were skipped due to formatting issues.`,
      };
    }

    // 5. Insert record into uploaded_files
    const { data: fileRecord, error: fileInsertError } = await supabase
      .from("uploaded_files")
      .insert({
        id: fileId,
        user_id: user.id,
        business_id: business.id,
        file_name: file.name,
        storage_path: storagePath,
        file_hash: serverHash,
        row_count: transactions.length,
      })
      .select()
      .single();

    if (fileInsertError || !fileRecord) {
      return { success: false, error: `Failed to create audit record: ${fileInsertError?.message}` };
    }

    // 6. Run hybrid classification pipeline (Deterministic rules + AI fallback)
    const classified = await classifyTransactions(transactions, business.business_type);

    // 7. Insert all transactions into transactions table with source_row link
    const transactionInserts = classified.map((c) => ({
      user_id: user.id,
      file_id: fileRecord.id,
      business_id: business.id,
      source_row: c.sourceRow,
      transaction_date: c.date,
      description: c.description,
      amount: c.amount,
      hmrc_category: c.hmrcCategory,
      is_excluded: c.isExcluded,
      classified_by: c.classifiedBy,
      confidence: c.confidence,
      is_reviewed: false,
    }));

    const BATCH_SIZE = 250;
    for (let i = 0; i < transactionInserts.length; i += BATCH_SIZE) {
      const batch = transactionInserts.slice(i, i + BATCH_SIZE);
      const { error: insertError } = await supabase.from("transactions").insert(batch);
      if (insertError) {
        throw new Error(`Failed inserting transactions batch: ${insertError.message}`);
      }
    }

    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/review/${fileRecord.id}`);

    return {
      success: true,
      fileId: fileRecord.id,
      rowCount: transactions.length,
      skippedCount: skippedRows.length,
    };
  } catch (err: unknown) {
    console.error("Ingestion action error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "An unexpected error occurred during ingestion.",
    };
  }
}
