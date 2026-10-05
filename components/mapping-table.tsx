"use client";

import { useState, useTransition } from "react";
import type { BusinessType, TransactionRow } from "@/lib/types/database";
import { getCategoriesForBusinessType } from "@/lib/taxonomies";
import { updateTransactionCategory, approveAllTransactions, deleteUploadedFile } from "@/app/dashboard/review/[fileId]/actions";

interface Props {
  transactions: TransactionRow[];
  businessType: BusinessType;
  fileId: string;
  fileName: string;
}

export function MappingTable({ transactions: initialTransactions, businessType, fileId, fileName }: Props) {
  const [transactions, setTransactions] = useState(initialTransactions);
  const [filter, setFilter] = useState<"all" | "unreviewed" | "ai" | "sec24" | "excluded">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  const categories = getCategoriesForBusinessType(businessType);

  // Totals calculation
  let totalIncome = 0;
  let totalExpenses = 0;
  let totalSec24 = 0;
  let totalExcluded = 0;
  let unreviewedCount = 0;

  for (const t of transactions) {
    if (!t.is_reviewed) unreviewedCount++;
    if (t.is_excluded) {
      totalExcluded += Math.abs(t.amount);
    } else if (t.hmrc_category === "residentialFinancialCost") {
      totalSec24 += Math.abs(t.amount);
    } else if (t.amount > 0) {
      totalIncome += t.amount;
    } else {
      totalExpenses += Math.abs(t.amount);
    }
  }

  const filteredTransactions = transactions.filter((t) => {
    if (searchTerm && !t.description.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    if (filter === "unreviewed") return !t.is_reviewed;
    if (filter === "ai") return t.classified_by === "ai";
    if (filter === "sec24") return t.hmrc_category === "residentialFinancialCost";
    if (filter === "excluded") return t.is_excluded;
    return true;
  });

  function handleCategoryChange(txnId: string, newCategory: string) {
    // Optimistic UI update
    setTransactions((prev) =>
      prev.map((t) =>
        t.id === txnId
          ? {
              ...t,
              hmrc_category: newCategory,
              is_excluded: newCategory === "excluded",
              classified_by: "user",
              confidence: 1.0,
              is_reviewed: true,
            }
          : t
      )
    );

    startTransition(async () => {
      try {
        await updateTransactionCategory(txnId, newCategory, fileId);
        setFeedback("Category updated.");
        setTimeout(() => setFeedback(null), 2500);
      } catch {
        setFeedback("Failed to update category.");
      }
    });
  }

  function handleApproveAll() {
    startTransition(async () => {
      try {
        await approveAllTransactions(fileId);
        setTransactions((prev) => prev.map((t) => ({ ...t, is_reviewed: true })));
        setFeedback("All transactions approved and staged for quarterly filing.");
        setTimeout(() => setFeedback(null), 3000);
      } catch {
        setFeedback("Failed to approve transactions.");
      }
    });
  }

  function handleDelete() {
    if (confirm("Are you sure you want to delete this file and all its imported transactions?")) {
      startTransition(async () => {
        await deleteUploadedFile(fileId);
      });
    }
  }

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Review &amp; Stage Transactions</h1>
          <p className="text-sm text-zinc-600">
            Source file: <span className="font-mono text-zinc-800">{fileName}</span> ({transactions.length} rows)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleDelete}
            disabled={isPending}
            className="rounded border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            Delete Upload
          </button>
          <button
            type="button"
            onClick={handleApproveAll}
            disabled={isPending || unreviewedCount === 0}
            className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {unreviewedCount > 0 ? `Approve All (${unreviewedCount} unreviewed)` : "All Approved ✓"}
          </button>
        </div>
      </div>

      {feedback && (
        <div className="rounded-md bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800 transition-all">
          {feedback}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Gross Income</p>
          <p className="text-xl font-bold text-emerald-600 mt-1">£{totalIncome.toFixed(2)}</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Allowable Expenses</p>
          <p className="text-xl font-bold text-zinc-900 mt-1">£{totalExpenses.toFixed(2)}</p>
        </div>
        {businessType === "uk_property" && (
          <div className="rounded-lg border border-purple-200 bg-purple-50/50 p-4">
            <p className="text-xs font-medium text-purple-700 uppercase tracking-wider">Sec 24 Mortgage (Reducer)</p>
            <p className="text-xl font-bold text-purple-900 mt-1">£{totalSec24.toFixed(2)}</p>
            <p className="text-[10px] text-purple-600 mt-0.5">20% Tax Credit: £{(totalSec24 * 0.2).toFixed(2)}</p>
          </div>
        )}
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Excluded (Personal/Tax)</p>
          <p className="text-xl font-bold text-zinc-400 mt-1">£{totalExcluded.toFixed(2)}</p>
        </div>
      </div>

      {/* Section 24 Notice if Property with Mortgage interest */}
      {businessType === "uk_property" && totalSec24 > 0 && (
        <div className="rounded-lg border border-purple-300 bg-purple-50 p-4 text-xs text-purple-900">
          <span className="font-semibold">Section 24 UK Tax Protection:</span> £{totalSec24.toFixed(2)} in mortgage
          interest has been isolated as <code className="font-semibold">residentialFinancialCost</code>. Under HMRC rules,
          this will not be deducted as an expense against your rental profit. Instead, HMRC applies a 20% basic rate tax
          reduction (£{(totalSec24 * 0.2).toFixed(2)}) against your final tax liability.
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-lg border border-zinc-200">
        <div className="flex flex-wrap gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`rounded px-3 py-1.5 font-medium ${
              filter === "all" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
            }`}
          >
            All ({transactions.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("unreviewed")}
            className={`rounded px-3 py-1.5 font-medium ${
              filter === "unreviewed" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
            }`}
          >
            Unreviewed ({unreviewedCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter("ai")}
            className={`rounded px-3 py-1.5 font-medium ${
              filter === "ai" ? "bg-amber-600 text-white" : "bg-amber-50 text-amber-800 hover:bg-amber-100"
            }`}
          >
            AI Categorised
          </button>
          {businessType === "uk_property" && (
            <button
              type="button"
              onClick={() => setFilter("sec24")}
              className={`rounded px-3 py-1.5 font-medium ${
                filter === "sec24" ? "bg-purple-700 text-white" : "bg-purple-50 text-purple-800 hover:bg-purple-100"
              }`}
            >
              Section 24
            </button>
          )}
          <button
            type="button"
            onClick={() => setFilter("excluded")}
            className={`rounded px-3 py-1.5 font-medium ${
              filter === "excluded" ? "bg-zinc-600 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            }`}
          >
            Excluded
          </button>
        </div>

        <div className="max-w-xs w-full">
          <input
            type="text"
            placeholder="Search description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded border border-zinc-300 px-3 py-1.5 text-xs bg-white"
          />
        </div>
      </div>

      {/* Transaction Table */}
      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="min-w-full text-xs text-left">
          <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-600 font-medium">
            <tr>
              <th className="p-3 w-16">Row</th>
              <th className="p-3 w-28">Date</th>
              <th className="p-3">Description</th>
              <th className="p-3 w-28 text-right">Amount</th>
              <th className="p-3 w-64">HMRC Category</th>
              <th className="p-3 w-32">Source / Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {filteredTransactions.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-zinc-500">
                  No transactions match the selected filter.
                </td>
              </tr>
            ) : (
              filteredTransactions.map((txn) => {
                const isSec24 = txn.hmrc_category === "residentialFinancialCost";
                const isIncome = txn.amount > 0;

                return (
                  <tr
                    key={txn.id}
                    className={`hover:bg-zinc-50/70 transition-colors ${
                      txn.is_excluded ? "bg-zinc-50/40 opacity-70" : isSec24 ? "bg-purple-50/30" : ""
                    }`}
                  >
                    <td className="p-3 text-zinc-400 font-mono text-[11px]">{txn.source_row}</td>
                    <td className="p-3 text-zinc-700 whitespace-nowrap">{txn.transaction_date}</td>
                    <td className="p-3 font-medium text-zinc-900">{txn.description}</td>
                    <td
                      className={`p-3 text-right font-mono font-semibold whitespace-nowrap ${
                        isIncome ? "text-emerald-600" : txn.is_excluded ? "text-zinc-500 line-through" : "text-zinc-900"
                      }`}
                    >
                      {isIncome ? `+£${txn.amount.toFixed(2)}` : `-£${Math.abs(txn.amount).toFixed(2)}`}
                    </td>
                    <td className="p-3">
                      <select
                        value={txn.hmrc_category}
                        onChange={(e) => handleCategoryChange(txn.id, e.target.value)}
                        className={`w-full rounded border p-1.5 text-xs ${
                          isSec24
                            ? "border-purple-300 bg-purple-50 text-purple-900 font-medium"
                            : txn.is_excluded
                            ? "border-zinc-200 bg-zinc-100 text-zinc-500"
                            : "border-zinc-300 bg-white text-zinc-800"
                        }`}
                      >
                        {categories.map((c) => (
                          <option key={c.key} value={c.key}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        {txn.is_excluded ? (
                          <span className="rounded bg-zinc-200 px-2 py-0.5 text-[10px] font-semibold text-zinc-700">
                            Excluded
                          </span>
                        ) : isSec24 ? (
                          <span className="rounded bg-purple-100 px-2 py-0.5 text-[10px] font-semibold text-purple-800">
                            Sec 24
                          </span>
                        ) : txn.classified_by === "rule" ? (
                          <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                            Rule 100%
                          </span>
                        ) : txn.classified_by === "ai" ? (
                          <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                            AI {Math.round(txn.confidence * 100)}%
                          </span>
                        ) : (
                          <span className="rounded bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-800">
                            User
                          </span>
                        )}

                        {txn.is_reviewed ? (
                          <span className="text-emerald-600 text-xs" title="Approved for quarterly filing">
                            ✓
                          </span>
                        ) : (
                          <span className="text-amber-500 text-xs font-bold" title="Needs review">
                            •
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
