import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as XLSX from "xlsx";
import { detectColumns } from "@/lib/ingestion/column-detect";
import { normaliseSheetRows } from "@/lib/ingestion/normalise";
import { classifyTransactions } from "@/lib/classification";

describe("Ingestion pipeline end-to-end", () => {
  it("processes sole trader CSV fixture correctly", async () => {
    const csvPath = path.resolve(__dirname, "fixtures/sole-trader.csv");
    const buffer = fs.readFileSync(csvPath);
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" }) as unknown[][];

    const headers = (rawRows[0] || []).map((h) => String(h));
    const sampleRows = rawRows.slice(1, 6);

    const detected = detectColumns(headers, sampleRows);
    expect(detected.confidence).toBeGreaterThanOrEqual(80);
    expect(detected.mapping.amountMode).toBe("single");

    const { transactions, skippedRows } = normaliseSheetRows(rawRows, detected.mapping, { hasHeaderRow: true });
    expect(transactions).toHaveLength(6);
    expect(skippedRows).toHaveLength(0);

    const classified = await classifyTransactions(transactions, "self_employment");
    expect(classified).toHaveLength(6);

    // Row 1: Client Project Payment -> turnover
    expect(classified[0].hmrcCategory).toBe("turnover");
    expect(classified[0].isExcluded).toBe(false);

    // Row 2: Screwfix Power Drill -> repairsAndMaintenance
    expect(classified[1].hmrcCategory).toBe("repairsAndMaintenance");

    // Row 3: BP Petrol Station -> carVanTravelExpenses
    expect(classified[2].hmrcCategory).toBe("carVanTravelExpenses");

    // Row 4: Google Ads Advertising -> advertisingCosts
    expect(classified[3].hmrcCategory).toBe("advertisingCosts");

    // Row 5: Accountant Self Assessment Fee -> professionalFees
    expect(classified[4].hmrcCategory).toBe("professionalFees");

    // Row 6: HMRC Self Assessment Payment -> excluded
    expect(classified[5].hmrcCategory).toBe("excluded");
    expect(classified[5].isExcluded).toBe(true);
  });

  it("processes landlord dual-column CSV fixture correctly with Section 24", async () => {
    const csvPath = path.resolve(__dirname, "fixtures/landlord.csv");
    const buffer = fs.readFileSync(csvPath);
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" }) as unknown[][];

    const headers = (rawRows[0] || []).map((h) => String(h));
    const sampleRows = rawRows.slice(1, 6);

    const detected = detectColumns(headers, sampleRows);
    expect(detected.mapping.amountMode).toBe("dual");

    const { transactions, skippedRows } = normaliseSheetRows(rawRows, detected.mapping, { hasHeaderRow: true });
    expect(transactions).toHaveLength(5);
    expect(skippedRows).toHaveLength(0);

    const classified = await classifyTransactions(transactions, "uk_property");
    expect(classified).toHaveLength(5);

    // Row 1: Tenant Rent Payment -> rentalIncome (+1200)
    expect(classified[0].amount).toBe(1200);
    expect(classified[0].hmrcCategory).toBe("rentalIncome");

    // Row 2: Santander Mortgage (-650) -> residentialFinancialCost (SECTION 24 INVARIANT)
    expect(classified[1].amount).toBe(-650);
    expect(classified[1].hmrcCategory).toBe("residentialFinancialCost");
    expect(classified[1].isExcluded).toBe(false);

    // Row 3: Plumbing Services Direct (-140) -> repairsAndMaintenance
    expect(classified[2].amount).toBe(-140);
    expect(classified[2].hmrcCategory).toBe("repairsAndMaintenance");

    // Row 4: Garden Maintenance (-45) -> costOfServices
    expect(classified[3].amount).toBe(-45);
    expect(classified[3].hmrcCategory).toBe("costOfServices");

    // Row 5: Personal Drawings (-300) -> excluded
    expect(classified[4].amount).toBe(-300);
    expect(classified[4].hmrcCategory).toBe("excluded");
    expect(classified[4].isExcluded).toBe(true);
  });
});
