import { describe, expect, it } from "vitest";
import { matchDeterministicRule } from "@/lib/classification/rules";

describe("matchDeterministicRule", () => {
  describe("Section 24 UK Property Mortgage Rule", () => {
    it("classifies UK property mortgage expense as residentialFinancialCost", () => {
      const match = matchDeterministicRule({
        description: "Santander Mortgage Payment",
        amount: -850,
        businessType: "uk_property",
      });

      expect(match).not.toBeNull();
      expect(match?.category).toBe("residentialFinancialCost");
      expect(match?.isExcluded).toBe(false);
      expect(match?.confidence).toBe(1.0);
    });

    it("does NOT classify positive mortgage income/cashback as residentialFinancialCost", () => {
      const match = matchDeterministicRule({
        description: "Mortgage Cashback / Bonus",
        amount: 250,
        businessType: "uk_property",
      });

      // Positive amount should default to property rentalIncome, not residentialFinancialCost reducer
      expect(match?.category).toBe("rentalIncome");
    });

    it("does NOT apply residentialFinancialCost to self_employment businesses", () => {
      const match = matchDeterministicRule({
        description: "Mortgage",
        amount: -800,
        businessType: "self_employment",
      });

      // Should not match Section 24 rule for self-employed entity
      expect(match?.category).not.toBe("residentialFinancialCost");
    });
  });

  describe("Tax and Personal Exclusion Rules", () => {
    it("classifies HMRC payments as excluded", () => {
      const match = matchDeterministicRule({
        description: "HMRC SELF ASSESSMENT DIRECT DEBIT",
        amount: -1200,
        businessType: "self_employment",
      });

      expect(match?.category).toBe("excluded");
      expect(match?.isExcluded).toBe(true);
    });

    it("classifies VAT payments as excluded", () => {
      const match = matchDeterministicRule({
        description: "HMRC VAT PAYMENT",
        amount: -3500,
        businessType: "self_employment",
      });

      expect(match?.category).toBe("excluded");
      expect(match?.isExcluded).toBe(true);
    });

    it("does NOT falsely exclude TAXI expenses", () => {
      const match = matchDeterministicRule({
        description: "TAXI FARE TO CLIENT OFFICE",
        amount: -25,
        businessType: "self_employment",
      });

      expect(match?.category).not.toBe("excluded");
    });
  });

  describe("Trade Rules and Word Boundaries", () => {
    it("classifies tool/materials merchants as repairsAndMaintenance", () => {
      const match = matchDeterministicRule({
        description: "SCREWFIX DIRECT LTD",
        amount: -45.99,
        businessType: "self_employment",
      });

      expect(match?.category).toBe("repairsAndMaintenance");
    });

    it("classifies car/van travel expenses with word boundary", () => {
      const match = matchDeterministicRule({
        description: "BP PETROL STATION LONDON",
        amount: -65,
        businessType: "self_employment",
      });

      expect(match?.category).toBe("carVanTravelExpenses");
    });

    it("does not false-positive match BP within longer words like SUBPOENA or BPAY", () => {
      const match = matchDeterministicRule({
        description: "BPAY PAYMENT SERVICE",
        amount: -50,
        businessType: "self_employment",
      });

      expect(match?.category).not.toBe("carVanTravelExpenses");
    });

    it("classifies advertising expenses for self-employed", () => {
      const match = matchDeterministicRule({
        description: "GOOGLE ADS CC PAYMENT",
        amount: -150,
        businessType: "self_employment",
      });

      expect(match?.category).toBe("advertisingCosts");
    });

    it("classifies positive transactions as default turnover for sole traders", () => {
      const match = matchDeterministicRule({
        description: "Web Design Project Final Invoice",
        amount: 3200,
        businessType: "self_employment",
      });

      expect(match?.category).toBe("turnover");
    });

    it("classifies positive transactions as default rental income for property", () => {
      const match = matchDeterministicRule({
        description: "Monthly Rent Flat 2B",
        amount: 1250,
        businessType: "uk_property",
      });

      expect(match?.category).toBe("rentalIncome");
    });
  });
});
