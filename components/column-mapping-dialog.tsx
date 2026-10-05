"use client";

import { useState } from "react";
import type { ColumnMapping, DetectionResult } from "@/lib/ingestion/column-detect";

interface Props {
  isOpen: boolean;
  detection: DetectionResult;
  onConfirm: (mapping: ColumnMapping) => void;
  onCancel: () => void;
  isProcessing?: boolean;
}

export function ColumnMappingDialog({ isOpen, detection, onConfirm, onCancel, isProcessing }: Props) {
  const [mapping, setMapping] = useState<ColumnMapping>(detection.mapping);

  if (!isOpen) return null;

  const headers = detection.headers;
  const sampleRows = detection.sampleRows;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="mapping-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-lg bg-white p-6 shadow-xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
          <div>
            <h2 id="mapping-modal-title" className="text-lg font-semibold text-zinc-900">
              Confirm Column Mapping
            </h2>
            <p className="text-xs text-zinc-500">
              Auto-detection confidence: <span className="font-semibold text-zinc-800">{detection.confidence}%</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isProcessing}
            className="text-zinc-400 hover:text-zinc-600 disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            {/* Date Column */}
            <div>
              <label className="block font-medium text-zinc-700 mb-1">Date Column</label>
              <select
                value={mapping.dateColumn}
                onChange={(e) => setMapping({ ...mapping, dateColumn: parseInt(e.target.value, 10) })}
                className="w-full rounded border border-zinc-300 p-2 text-sm bg-white"
              >
                {headers.map((h, i) => (
                  <option key={i} value={i}>
                    Col {i + 1}: {h}
                  </option>
                ))}
              </select>
            </div>

            {/* Description Column */}
            <div>
              <label className="block font-medium text-zinc-700 mb-1">Description Column</label>
              <select
                value={mapping.descriptionColumn}
                onChange={(e) => setMapping({ ...mapping, descriptionColumn: parseInt(e.target.value, 10) })}
                className="w-full rounded border border-zinc-300 p-2 text-sm bg-white"
              >
                {headers.map((h, i) => (
                  <option key={i} value={i}>
                    Col {i + 1}: {h}
                  </option>
                ))}
              </select>
            </div>

            {/* Amount Mode */}
            <div className="md:col-span-2">
              <label className="block font-medium text-zinc-700 mb-1">Amount Layout</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="radio"
                    name="amountMode"
                    value="single"
                    checked={mapping.amountMode === "single"}
                    onChange={() =>
                      setMapping({
                        ...mapping,
                        amountMode: "single",
                        amountColumn: mapping.amountColumn ?? 2,
                      })
                    }
                  />
                  Single Signed Amount Column (+ / -)
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="radio"
                    name="amountMode"
                    value="dual"
                    checked={mapping.amountMode === "dual"}
                    onChange={() =>
                      setMapping({
                        ...mapping,
                        amountMode: "dual",
                        debitColumn: mapping.debitColumn ?? 2,
                        creditColumn: mapping.creditColumn ?? 3,
                      })
                    }
                  />
                  Separate Paid Out (Debit) & Paid In (Credit) Columns
                </label>
              </div>
            </div>

            {mapping.amountMode === "single" ? (
              <div className="md:col-span-2">
                <label className="block font-medium text-zinc-700 mb-1">Amount Column</label>
                <select
                  value={mapping.amountColumn ?? 0}
                  onChange={(e) => setMapping({ ...mapping, amountColumn: parseInt(e.target.value, 10) })}
                  className="w-full rounded border border-zinc-300 p-2 text-sm bg-white"
                >
                  {headers.map((h, i) => (
                    <option key={i} value={i}>
                      Col {i + 1}: {h}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <>
                <div>
                  <label className="block font-medium text-zinc-700 mb-1">Money Out (Debit / Expense)</label>
                  <select
                    value={mapping.debitColumn ?? 0}
                    onChange={(e) => setMapping({ ...mapping, debitColumn: parseInt(e.target.value, 10) })}
                    className="w-full rounded border border-zinc-300 p-2 text-sm bg-white"
                  >
                    {headers.map((h, i) => (
                      <option key={i} value={i}>
                        Col {i + 1}: {h}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-zinc-700 mb-1">Money In (Credit / Income)</label>
                  <select
                    value={mapping.creditColumn ?? 0}
                    onChange={(e) => setMapping({ ...mapping, creditColumn: parseInt(e.target.value, 10) })}
                    className="w-full rounded border border-zinc-300 p-2 text-sm bg-white"
                  >
                    {headers.map((h, i) => (
                      <option key={i} value={i}>
                        Col {i + 1}: {h}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>

          {/* Sample rows preview */}
          {sampleRows.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Sample Preview</p>
              <div className="overflow-x-auto rounded border border-zinc-200">
                <table className="min-w-full text-xs text-left">
                  <thead className="bg-zinc-50 border-b border-zinc-200">
                    <tr>
                      {headers.map((h, i) => {
                        const isDate = mapping.dateColumn === i;
                        const isDesc = mapping.descriptionColumn === i;
                        const isAmt = mapping.amountMode === "single" && mapping.amountColumn === i;
                        const isDebit = mapping.amountMode === "dual" && mapping.debitColumn === i;
                        const isCredit = mapping.amountMode === "dual" && mapping.creditColumn === i;

                        let tag = "";
                        if (isDate) tag = " [Date]";
                        if (isDesc) tag = " [Desc]";
                        if (isAmt) tag = " [Amount]";
                        if (isDebit) tag = " [Debit]";
                        if (isCredit) tag = " [Credit]";

                        return (
                          <th
                            key={i}
                            className={`p-2 font-medium truncate max-w-[140px] ${
                              tag ? "bg-blue-50 text-blue-900 font-semibold" : "text-zinc-700"
                            }`}
                          >
                            {h}
                            {tag && <span className="block text-[10px] text-blue-600">{tag}</span>}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 bg-white">
                    {sampleRows.map((row, rIdx) => (
                      <tr key={rIdx}>
                        {row.map((cell, cIdx) => (
                          <td key={cIdx} className="p-2 truncate max-w-[140px] text-zinc-600">
                            {cell !== null && cell !== undefined ? String(cell) : "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-zinc-200 pt-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isProcessing}
            className="rounded border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(mapping)}
            disabled={isProcessing}
            className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {isProcessing ? "Processing & Ingesting..." : "Confirm & Ingest"}
          </button>
        </div>
      </div>
    </div>
  );
}
