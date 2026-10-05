import { describe, expect, it } from "vitest";
import { normaliseSheetRows } from "@/lib/ingestion/normalise";
import type { ColumnMapping } from "@/lib/ingestion/column-detect";

describe("normaliseSheetRows", () => {
  const singleMapping: ColumnMapping = {
    dateColumn: 0,
    descriptionColumn: 1,
    amountMode: "single",
    amountColumn: 2,
  };

  it("normalises valid rows with single signed amount column", () => {
    const rawRows = [
      ["Date", "Description", "Amount"],
      ["01/05/2026", "Client Payment", "£1,500.00"],
      ["02/05/2026", "Screwfix Direct", "(45.50)"],
    ];

    const result = normaliseSheetRows(rawRows, singleMapping, { hasHeaderRow: true });

    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0]).toEqual({
      sourceRow: 2,
      date: "2026-05-01",
      description: "Client Payment",
      amount: 1500,
    });
    expect(result.transactions[1]).toEqual({
      sourceRow: 3,
      date: "2026-05-02",
      description: "Screwfix Direct",
      amount: -45.5,
    });
    expect(result.skippedRows).toHaveLength(0);
  });

  it("normalises dual debit/credit column rows", () => {
    const dualMapping: ColumnMapping = {
      dateColumn: 0,
      descriptionColumn: 1,
      amountMode: "dual",
      debitColumn: 2,
      creditColumn: 3,
    };

    const rawRows = [
      ["Date", "Description", "Debit", "Credit"],
      ["10/06/2026", "Invoice #101", "", "2000.00"],
      ["11/06/2026", "Trainline UK", "64.20", ""],
    ];

    const result = normaliseSheetRows(rawRows, dualMapping, { hasHeaderRow: true });

    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0].amount).toBe(2000);
    expect(result.transactions[1].amount).toBe(-64.2);
  });

  it("skips empty and invalid rows and tracks skipped count", () => {
    const rawRows = [
      ["Date", "Description", "Amount"],
      ["", "", ""], // completely empty
      ["invalid-date", "Test", "100.00"], // invalid date
      ["01/05/2026", "", "100.00"], // missing desc
      ["01/05/2026", "Zero amount", "0.00"], // zero amount
      ["02/05/2026", "Valid row", "150.00"],
    ];

    const result = normaliseSheetRows(rawRows, singleMapping, { hasHeaderRow: true });

    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].description).toBe("Valid row");
    expect(result.skippedRows.length).toBeGreaterThan(0);
  });
});
