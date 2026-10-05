import { type ColumnMapping, parseAmountValue, parseDateValue } from "./column-detect";

export interface NormalizedTransaction {
  sourceRow: number; // 1-based row index in original file
  date: string; // YYYY-MM-DD
  description: string;
  amount: number; // positive = income, negative = expense
}

export interface ParseOptions {
  hasHeaderRow?: boolean;
}

export interface NormaliseResult {
  transactions: NormalizedTransaction[];
  skippedRows: { row: number; reason: string }[];
  totalRows: number;
}

/**
 * Normalises raw 2D sheet rows into typed transaction records using the confirmed column mapping.
 */
export function normaliseSheetRows(
  rows: unknown[][],
  mapping: ColumnMapping,
  options: ParseOptions = { hasHeaderRow: true }
): NormaliseResult {
  const transactions: NormalizedTransaction[] = [];
  const skippedRows: { row: number; reason: string }[] = [];

  const startIndex = options.hasHeaderRow ? 1 : 0;

  for (let i = startIndex; i < rows.length; i++) {
    const row = rows[i];
    const sourceRow = i + 1; // 1-based for human audit reference

    // Skip empty rows
    if (!row || row.length === 0 || row.every((c) => c === null || c === undefined || String(c).trim() === "")) {
      continue;
    }

    const rawDate = row[mapping.dateColumn];
    const rawDesc = row[mapping.descriptionColumn];

    const date = parseDateValue(rawDate);
    if (!date) {
      skippedRows.push({ row: sourceRow, reason: `Invalid date: "${rawDate ?? ""}"` });
      continue;
    }

    const description = rawDesc !== null && rawDesc !== undefined ? String(rawDesc).trim() : "";
    if (!description) {
      skippedRows.push({ row: sourceRow, reason: "Missing description" });
      continue;
    }

    let amount: number | null = null;

    if (mapping.amountMode === "single") {
      const colIdx = mapping.amountColumn ?? -1;
      if (colIdx >= 0 && colIdx < row.length) {
        amount = parseAmountValue(row[colIdx]);
      }
    } else {
      // Dual mode (Debit and Credit)
      const debitIdx = mapping.debitColumn ?? -1;
      const creditIdx = mapping.creditColumn ?? -1;

      const debitVal = debitIdx >= 0 ? parseAmountValue(row[debitIdx]) : null;
      const creditVal = creditIdx >= 0 ? parseAmountValue(row[creditIdx]) : null;

      if (creditVal !== null && creditVal > 0) {
        amount = Math.abs(creditVal);
      } else if (debitVal !== null && debitVal > 0) {
        amount = -Math.abs(debitVal);
      } else if (debitVal !== null && debitVal < 0) {
        amount = debitVal;
      } else if (creditVal !== null && creditVal < 0) {
        amount = creditVal;
      }
    }

    if (amount === null || isNaN(amount)) {
      skippedRows.push({ row: sourceRow, reason: "Could not parse amount" });
      continue;
    }

    // Ignore 0.00 zero-value transactions
    if (amount === 0) {
      continue;
    }

    transactions.push({
      sourceRow,
      date,
      description,
      amount,
    });
  }

  return {
    transactions,
    skippedRows,
    totalRows: rows.length,
  };
}
