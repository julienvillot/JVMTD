import type { BusinessType } from "@/lib/types/database";
import { getDefaultIncomeCategory } from "@/lib/taxonomies";

export interface RuleContext {
  description: string;
  amount: number; // positive = income, negative = expense
  businessType: BusinessType;
}

export interface RuleMatch {
  category: string;
  confidence: number;
  ruleName: string;
  isExcluded: boolean;
}

interface DeterministicRule {
  name: string;
  test: RegExp;
  category: string;
  businessType?: BusinessType; // undefined = applies to both
  expenseOnly?: boolean;
  incomeOnly?: boolean;
  isExcluded?: boolean;
  when?: (ctx: RuleContext) => boolean;
}

const DETERMINISTIC_RULES: DeterministicRule[] = [
  // 1. Excluded / Personal / Tax drawings (Note: Accountant fees are allowable, so excluded if not accountant/fee)
  {
    name: "Tax and Personal Drawings Exclusion",
    test: /\b(hmrc|vat\b|dividends?|personal transfer|drawings|corporation tax payment)\b/i,
    category: "excluded",
    isExcluded: true,
    when: (ctx) => !/\b(accountan\w*|legal fee|management fee)\b/i.test(ctx.description),
  },

  // 2. Section 24 UK Property Mortgage Interest (MANDATORY REGULATORY INVARIANT)
  // Mortgage interest must NEVER be deducted as an expense against property turnover.
  // It must strictly be isolated and posted as residentialFinancialCost.
  {
    name: "Section 24 Residential Mortgage Finance Cost",
    test: /\b(mortgage|mortgage interest|nationwide|santander mortgage|barclays mortgage|halifax mortgage|natwest mortgage|the mortgage works|tmw|paragon|leeds building society|coventry building society)\b/i,
    category: "residentialFinancialCost",
    businessType: "uk_property",
    expenseOnly: true, // Only negative amounts (outgoings) can be mortgage costs
  },

  // 3. Repairs and Maintenance (both business types)
  {
    name: "Repairs & Maintenance Supplies",
    test: /\b(screwfix|toolstation|b&q|bandq|plumb\w*|wickes|travis perkins|selco|handyman|locksmith|decorator|roofing)\b/i,
    category: "repairsAndMaintenance",
    expenseOnly: true,
  },

  // 4. Advertising & Marketing (Self Employment only)
  {
    name: "Advertising & Marketing",
    test: /\b(google ads|meta ads|facebook ads?|instagram ads?|print\w*|flyers?|marketing|seo|squarespace|wix|canva)\b/i,
    category: "advertisingCosts",
    businessType: "self_employment",
    expenseOnly: true,
  },

  // 5. Travel & Vehicle (Self Employment only, careful with word boundary on \bbp\b)
  {
    name: "Car & Travel Expenses",
    test: /\b(uber|trainline|shell|bp|petrol|diesel|tfl|esso|texaco|applegreen|avanti|lner|national rail|parking)\b/i,
    category: "carVanTravelExpenses",
    businessType: "self_employment",
    expenseOnly: true,
  },

  // 6. Professional & Legal fees (both)
  {
    name: "Professional & Legal Fees",
    test: /\b(accountan\w*|solicitor|legal fee|auditor|conveyanc\w*|surveyor|letting agent|management fee)\b/i,
    category: "professionalFees",
    expenseOnly: true,
  },

  // 7. Premises Running Costs & Utilities (both)
  {
    name: "Premises & Utilities",
    test: /\b(british gas|edf energy|edf|e\.on|octopus energy|scottish power|thames water|severn trent|anglian water|council tax|ground rent|service charge)\b/i,
    category: "premisesRunningCosts",
    expenseOnly: true,
  },

  // 8. Cost of Direct Services (Property only: cleaners, gardeners)
  {
    name: "Direct Services (Property)",
    test: /\b(clean\w*|garden\w*|window clean\w*|waste collection)\b/i,
    category: "costOfServices",
    businessType: "uk_property",
    expenseOnly: true,
  },

  // 9. Financial & Card Charges (Self Employment only)
  {
    name: "Financial & Card Processing Charges",
    test: /\b(stripe|sumup|square|zettle|paypal fee|bank charge|merchant fee)\b/i,
    category: "financialCharges",
    businessType: "self_employment",
    expenseOnly: true,
  },

  // 10. Cost of Goods (Self Employment only)
  {
    name: "Materials & Resale Goods",
    test: /\b(wholesale|materials|stock purchase|inventory)\b/i,
    category: "costOfGoods",
    businessType: "self_employment",
    expenseOnly: true,
  },
];

/**
 * Evaluates deterministic classification rules against a transaction.
 * Returns RuleMatch if a deterministic rule matched with 100% confidence, or null otherwise.
 */
export function matchDeterministicRule(ctx: RuleContext): RuleMatch | null {
  for (const rule of DETERMINISTIC_RULES) {
    if (rule.businessType && rule.businessType !== ctx.businessType) {
      continue;
    }
    if (rule.expenseOnly && ctx.amount >= 0) {
      continue;
    }
    if (rule.incomeOnly && ctx.amount < 0) {
      continue;
    }
    if (rule.when && !rule.when(ctx)) {
      continue;
    }

    if (rule.test.test(ctx.description)) {
      return {
        category: rule.category,
        confidence: 1.0,
        ruleName: rule.name,
        isExcluded: Boolean(rule.isExcluded),
      };
    }
  }

  // If amount is positive and not matched by any expense or exclusion rule,
  // classify as default business turnover / rental income
  if (ctx.amount > 0) {
    const defaultIncome = getDefaultIncomeCategory(ctx.businessType);
    return {
      category: defaultIncome,
      confidence: 0.95,
      ruleName: "Default Income Classification",
      isExcluded: false,
    };
  }

  return null;
}
