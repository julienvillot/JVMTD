import { describe, expect, it } from "vitest";
import {
  detectColumns,
  parseAmountValue,
  parseDateValue,
} from "@/lib/ingestion/column-detect";

describe("column-detect", () => {
  describe("detectColumns", () => {
    it("detects single amount column layout correctly", () => {
      const headers = ["Date", "Description", "Amount", "Balance"];
      const result = detectColumns(headers);

      expect(result.mapping.dateColumn).toBe(0);
      expect(result.mapping.descriptionColumn).toBe(1);
      expect(result.mapping.amountMode).toBe("single");
      expect(result.mapping.amountColumn).toBe(2);
      expect(result.confidence).toBeGreaterThanOrEqual(80);
    });

    it("detects dual debit and credit column layout correctly", () => {
      const headers = ["Transaction Date", "Particulars", "Paid Out", "Paid In", "Balance"];
      const result = detectColumns(headers);

      expect(result.mapping.dateColumn).toBe(0);
      expect(result.mapping.descriptionColumn).toBe(1);
      expect(result.mapping.amountMode).toBe("dual");
      expect(result.mapping.debitColumn).toBe(2);
      expect(result.mapping.creditColumn).toBe(3);
      expect(result.confidence).toBeGreaterThanOrEqual(80);
    });
  });

  describe("parseAmountValue", () => {
    it("parses numbers directly", () => {
      expect(parseAmountValue(123.45)).toBe(123.45);
      expect(parseAmountValue(-50)).toBe(-50);
      expect(parseAmountValue(0)).toBe(0);
    });

    it("parses currency strings with commas and symbols", () => {
      expect(parseAmountValue("£1,234.56")).toBe(1234.56);
      expect(parseAmountValue("$500.00")).toBe(500);
      expect(parseAmountValue("€ 75.20")).toBe(75.2);
    });

    it("handles accounting parentheses negatives", () => {
      expect(parseAmountValue("(150.00)")).toBe(-150);
      expect(parseAmountValue("£(2,500.50)")).toBe(-2500.5);
    });

    it("returns null for empty or non-numeric values", () => {
      expect(parseAmountValue(null)).toBeNull();
      expect(parseAmountValue("")).toBeNull();
      expect(parseAmountValue("N/A")).toBeNull();
    });
  });

  describe("parseDateValue", () => {
    it("parses UK format dd/mm/yyyy", () => {
      expect(parseDateValue("05/04/2026")).toBe("2026-04-05");
      expect(parseDateValue("15-08-2025")).toBe("2025-08-15");
      expect(parseDateValue("01.01.2026")).toBe("2026-01-01");
    });

    it("parses ISO format yyyy-mm-dd", () => {
      expect(parseDateValue("2026-04-05")).toBe("2026-04-05");
    });

    it("parses Excel serial date numbers", () => {
      // 45752 corresponds to 2025-04-05 in Excel 1900 date system
      const parsed = parseDateValue(45752);
      expect(parsed).toMatch(/^2025-04-0[45]$/); // Accounts for timezone offset
    });

    it("returns null for invalid dates", () => {
      expect(parseDateValue(null)).toBeNull();
      expect(parseDateValue("invalid-date")).toBeNull();
      expect(parseDateValue("32/13/2026")).toBeNull();
    });
  });
});
