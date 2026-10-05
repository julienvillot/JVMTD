import { z } from "zod";
import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import type { BusinessType } from "@/lib/types/database";
import { getCategoriesForBusinessType, getDefaultExpenseCategory } from "@/lib/taxonomies";

export interface UnclassifiedItem {
  index: number;
  description: string;
  isIncome: boolean;
}

export interface AiClassificationResult {
  index: number;
  category: string;
  confidence: number;
}

/**
 * Batches unclassified items to OpenAI gpt-4o-mini with structured JSON output
 * strictly constrained to the allowed HMRC taxonomy keys for the given business type.
 */
export async function classifyWithAiFallback(
  items: UnclassifiedItem[],
  businessType: BusinessType
): Promise<AiClassificationResult[]> {
  if (items.length === 0) return [];

  const apiKey = process.env.OPENAI_API_KEY;
  const defaultExpense = getDefaultExpenseCategory(businessType);

  // If no OpenAI API key is configured, fallback safely to default other expenses
  if (!apiKey || apiKey.startsWith("sk-placeholder") || apiKey === "sk-...") {
    return items.map((item) => ({
      index: item.index,
      category: defaultExpense,
      confidence: 0.5,
    }));
  }

  const validCategories = getCategoriesForBusinessType(businessType).map((c) => c.key);
  // Ensure we have at least 2 enum values for Zod
  const categoryEnum = z.enum([validCategories[0], ...validCategories.slice(1)] as [string, ...string[]]);

  const responseSchema = z.object({
    classifications: z.array(
      z.object({
        index: z.number(),
        category: categoryEnum,
        confidence: z.number().min(0.1).max(0.85),
      })
    ),
  });

  const openai = createOpenAI({ apiKey });

  const entityName = businessType === "self_employment" ? "UK Sole Trader (Self-Employment)" : "UK Property Rental Landlord";

  const categoryListText = getCategoriesForBusinessType(businessType)
    .map((c) => `- "${c.key}": ${c.label} (${c.description || ""})`)
    .join("\n");

  try {
    const { object } = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: responseSchema,
      prompt: `You are an expert UK Making Tax Digital (MTD) for Income Tax Self Assessment (ITSA) accountant.
Classify each transaction description for a ${entityName} into one of these strict HMRC category keys:

${categoryListText}

RULES:
1. For UK Property: Residential mortgage interest MUST be classified as "residentialFinancialCost" (Section 24 UK tax reducer).
2. Personal drawings, taxes, dividends, or non-business items MUST be classified as "excluded".
3. Return only valid category keys from the provided list.
4. Set confidence between 0.5 and 0.85.

Transactions to classify:
${JSON.stringify(
  items.map((it) => ({
    index: it.index,
    description: it.description,
    type: it.isIncome ? "Income" : "Expense",
  }))
)}`,
    });

    const resultMap = new Map<number, { category: string; confidence: number }>();
    for (const c of object.classifications) {
      resultMap.set(c.index, { category: c.category, confidence: Math.min(0.85, Math.max(0.1, c.confidence)) });
    }

    return items.map((item) => {
      const found = resultMap.get(item.index);
      if (found) {
        return { index: item.index, category: found.category, confidence: found.confidence };
      }
      return { index: item.index, category: defaultExpense, confidence: 0.5 };
    });
  } catch (err) {
    console.error("AI classification error (falling back to default categories):", err);
    return items.map((item) => ({
      index: item.index,
      category: defaultExpense,
      confidence: 0.5,
    }));
  }
}
