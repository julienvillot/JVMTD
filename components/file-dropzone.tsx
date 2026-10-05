"use client";

import { useState, useRef, type DragEvent, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { computeSha256 } from "@/lib/security/hash";
import { detectColumns, type DetectionResult, type ColumnMapping } from "@/lib/ingestion/column-detect";
import { ColumnMappingDialog } from "./column-mapping-dialog";
import { ingestSpreadsheet } from "@/app/dashboard/upload/actions";
import type { BusinessRow } from "@/lib/types/database";

interface Props {
  businesses: BusinessRow[];
}

export function FileDropzone({ businesses }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedBusinessId, setSelectedBusinessId] = useState<string>(businesses[0]?.id ?? "");
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileHash, setFileHash] = useState<string | null>(null);
  const [detection, setDetection] = useState<DetectionResult | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (businesses.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 p-8 text-center bg-zinc-50">
        <h3 className="text-base font-semibold text-zinc-800">No Business Registered</h3>
        <p className="mt-1 text-sm text-zinc-600">
          You must set up a Self-Employment or UK Property business profile before importing transactions.
        </p>
        <a
          href="/dashboard/businesses"
          className="mt-4 inline-block rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Create Business Profile
        </a>
      </div>
    );
  }

  async function handleFile(file: File) {
    setError(null);
    if (!file.name.match(/\.(csv|xlsx|xls)$/i)) {
      setError("Unsupported file format. Please upload a .csv, .xlsx, or .xls file.");
      return;
    }

    try {
      setIsProcessing(true);
      setSelectedFile(file);

      const arrayBuffer = await file.arrayBuffer();

      // 1. Calculate client-side SHA-256 (Digital Links mandate)
      const hash = await computeSha256(arrayBuffer);
      setFileHash(hash);

      // 2. Parse sheet in browser for header detection
      const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        throw new Error("Spreadsheet contains no sheets.");
      }

      const sheet = workbook.Sheets[firstSheetName];
      const rawRows = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        raw: false,
        defval: "",
      }) as unknown[][];

      if (!rawRows || rawRows.length < 2) {
        throw new Error("Spreadsheet has insufficient rows. At least a header row and one data row are required.");
      }

      const headers = (rawRows[0] || []).map((h) => String(h || "").trim());
      const sampleRows = rawRows.slice(1, 6);

      const detected = detectColumns(headers, sampleRows);
      setDetection(detected);
      setIsProcessing(false);
      setIsDialogOpen(true);
    } catch (err) {
      setIsProcessing(false);
      setError(err instanceof Error ? err.message : "Failed to parse spreadsheet file.");
    }
  }

  async function handleConfirmMapping(mapping: ColumnMapping) {
    if (!selectedFile || !fileHash || !selectedBusinessId) return;

    try {
      setIsProcessing(true);
      setError(null);

      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("businessId", selectedBusinessId);
      formData.append("clientHash", fileHash);
      formData.append("mapping", JSON.stringify(mapping));

      const result = await ingestSpreadsheet(formData);

      setIsProcessing(false);
      if (!result.success) {
        setError(result.error ?? "Failed to ingest spreadsheet.");
        return;
      }

      setIsDialogOpen(false);
      router.push(`/dashboard/review/${result.fileId}`);
    } catch (err) {
      setIsProcessing(false);
      setError(err instanceof Error ? err.message : "An unexpected error occurred during upload.");
    }
  }

  function onDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(true);
  }

  function onDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  }

  return (
    <div className="space-y-6">
      {/* Business selector */}
      <div className="max-w-md">
        <label className="block text-sm font-medium text-zinc-700 mb-1">
          Select Business / Property Portfolio
        </label>
        <select
          value={selectedBusinessId}
          onChange={(e) => setSelectedBusinessId(e.target.value)}
          disabled={isProcessing}
          className="w-full rounded border border-zinc-300 p-2 text-sm bg-white"
        >
          {businesses.map((b) => (
            <option key={b.id} value={b.id}>
              {b.trading_name} ({b.business_type === "self_employment" ? "Sole Trader" : "UK Property"})
            </option>
          ))}
        </select>
      </div>

      {/* Drag & Drop Area */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 text-center cursor-pointer transition-colors ${
          isDragging
            ? "border-blue-500 bg-blue-50/50"
            : "border-zinc-300 bg-zinc-50/50 hover:bg-zinc-50 hover:border-zinc-400"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={onFileChange}
          className="hidden"
        />

        <div className="rounded-full bg-zinc-100 p-3 text-zinc-600 mb-3">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
        </div>

        <p className="text-sm font-medium text-zinc-700">
          <span className="text-blue-600 underline">Click to upload</span> or drag and drop spreadsheet
        </p>
        <p className="mt-1 text-xs text-zinc-500">Supports .CSV, .XLSX, and .XLS files</p>

        {selectedFile && (
          <div className="mt-4 rounded bg-white border border-zinc-200 px-3 py-1.5 text-xs text-zinc-700 font-mono">
            {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
          </div>
        )}
      </div>

      {/* Digital Links Security Notice */}
      <div className="rounded-md border border-zinc-200 bg-zinc-50/60 p-4 text-xs text-zinc-600">
        <span className="font-semibold text-zinc-800">Unbroken Digital Links Guarantee:</span> Upon upload, an immutable
        SHA-256 checksum is computed and stored alongside the raw file in the audit vault, satisfying HMRC VAT Notice
        700/22 &amp; ITSA compliance rules.
      </div>

      {error && (
        <div role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Modal Dialog */}
      {detection && (
        <ColumnMappingDialog
          isOpen={isDialogOpen}
          detection={detection}
          onConfirm={handleConfirmMapping}
          onCancel={() => setIsDialogOpen(false)}
          isProcessing={isProcessing}
        />
      )}
    </div>
  );
}
