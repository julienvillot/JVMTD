import type { BusinessType } from "@/lib/types/database";

export interface TaxonomyCategory {
  key: string;
  label: string;
  type: "income" | "expense" | "finance_cost" | "excluded";
  description?: string;
}

export const EXCLUDED_CATEGORY: TaxonomyCategory = {
  key: "excluded",
  label: "Personal / Non-Business / Tax (Excluded)",
  type: "excluded",
  description: "Drawings, personal transfers, HMRC payments, VAT payments, and dividends not included in MTD return.",
};

export const SELF_EMPLOYMENT_CATEGORIES: readonly TaxonomyCategory[] = [
  { key: "turnover", label: "Turnover / Sales Income", type: "income", description: "Gross sales, fees, and payments received." },
  { key: "costOfGoods", label: "Cost of Goods & Materials", type: "expense", description: "Raw materials, goods bought for resale, direct job costs." },
  { key: "carVanTravelExpenses", label: "Car, Van & Travel Expenses", type: "expense", description: "Fuel, train tickets, parking, public transport, vehicle insurance." },
  { key: "premisesRunningCosts", label: "Rent, Rates, Power & Insurance", type: "expense", description: "Office rent, business rates, light, heat, power, premises insurance." },
  { key: "repairsAndMaintenance", label: "Repairs & Renewals of Property/Tools", type: "expense", description: "Repairs, renewals and maintenance of equipment, tools, and work premises." },
  { key: "staffCosts", label: "Staff Salaries, Wages & Subcontractors", type: "expense", description: "Salaries, wages, employer NICs, pension costs, subcontractor fees." },
  { key: "professionalFees", label: "Accountancy, Legal & Professional Fees", type: "expense", description: "Accountants, solicitors, surveyors, professional subscriptions." },
  { key: "financialCharges", label: "Bank, Card, Loan Charges & Interest", type: "expense", description: "Business bank fees, merchant card fees, interest on business loans." },
  { key: "advertisingCosts", label: "Advertising, Website & Marketing", type: "expense", description: "Web hosting, online ads, print advertising, directories." },
  { key: "otherExpenses", label: "Other General Allowable Expenses", type: "expense", description: "Stationery, phone, broadband, office consumables, other allowable costs." },
  EXCLUDED_CATEGORY,
] as const;

export const PROPERTY_CATEGORIES: readonly TaxonomyCategory[] = [
  { key: "rentalIncome", label: "Rental Income Received", type: "income", description: "Gross rent, service charges received from tenants, insurance payouts." },
  { key: "premisesRunningCosts", label: "Rent, Rates, Insurance, Ground Rent", type: "expense", description: "Ground rent, landlord insurance, water rates, council tax paid by landlord." },
  { key: "repairsAndMaintenance", label: "Repairs & Maintenance (Non-Capital)", type: "expense", description: "Plumbing, electrical repairs, painting, decorating, replacing like-for-like." },
  { key: "professionalFees", label: "Letting Agent, Legal & Management Fees", type: "expense", description: "Letting agent commissions, tenancy agreement fees, legal costs." },
  { key: "costOfServices", label: "Direct Services (Cleaning, Gardening, Utilities)", type: "expense", description: "Communal cleaning, gardening, utilities provided for tenants." },
  { key: "otherPropertyExpenses", label: "Other Allowable Property Expenses", type: "expense", description: "Safety certificates (Gas, EICR, EPC), stationary, advertising for tenants." },
  // CRITICAL: Section 24 UK Tax Rule - NOT a deductible expense, isolated for 20% basic rate tax credit
  {
    key: "residentialFinancialCost",
    label: "Mortgage Interest (Sec 24 Reducer - NOT an expense)",
    type: "finance_cost",
    description: "Residential landlord mortgage interest. Must not be deducted from turnover; qualifies for 20% basic rate tax reduction.",
  },
  EXCLUDED_CATEGORY,
] as const;

export function getCategoriesForBusinessType(businessType: BusinessType): readonly TaxonomyCategory[] {
  return businessType === "self_employment" ? SELF_EMPLOYMENT_CATEGORIES : PROPERTY_CATEGORIES;
}

export function isValidCategory(businessType: BusinessType, categoryKey: string): boolean {
  const categories = getCategoriesForBusinessType(businessType);
  return categories.some((c) => c.key === categoryKey);
}

export function getCategoryMeta(businessType: BusinessType, categoryKey: string): TaxonomyCategory {
  const categories = getCategoriesForBusinessType(businessType);
  const found = categories.find((c) => c.key === categoryKey);
  if (found) return found;

  return {
    key: categoryKey,
    label: categoryKey,
    type: "expense",
  };
}

export function getDefaultIncomeCategory(businessType: BusinessType): string {
  return businessType === "self_employment" ? "turnover" : "rentalIncome";
}

export function getDefaultExpenseCategory(businessType: BusinessType): string {
  return businessType === "self_employment" ? "otherExpenses" : "otherPropertyExpenses";
}
