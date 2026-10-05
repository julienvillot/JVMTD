import type { BusinessType, ClassifiedBy } from "@/lib/types/database";
import type { NormalizedTransaction } from "@/lib/ingestion/normalise";
import { matchDeterministicRule } from "./rules";
import { classifyWithAiFallback, type UnclassifiedItem } from "./ai-fallback";

export interface ClassifiedTransaction {
  sourceRow: number;
  date: string;
  description: string;
  amount: number;
  hmrcCategory: string;
  isExcluded: boolean;
  classifiedBy: ClassifiedBy;
  confidence: number;
  isReviewed: boolean;
}

/**
 * Classifies an array of normalized transactions using the hybrid pipeline:
 * 1. Deterministic regex rules (100% confidence, Section 24, known suppliers, exclusions)
 * 2. AI Fallback (OpenAI gpt-4o-mini via Vercel AI SDK in batches of up to 50)
 */
export async function classifyTransactions(
  transactions: NormalizedTransaction[],
  businessType: BusinessType
): Promise<ClassifiedTransaction[]> {
  const results: ClassifiedTransaction[] = new Array(transactions.length);
  const unclassifiedItems: UnclassifiedItem[] = [];

  // Step 1: Run deterministic rules
  for (let i = 0; i < transactions.length; i++) {
    const t = transactions[i];
    const match = matchDeterministicRule({
      description: t.description,
      amount: t.amount,
      businessType,
    });

    if (match) {
      results[i] = {
        sourceRow: t.sourceRow,
        date: t.date,
        description: t.description,
        amount: t.amount,
        hmrcCategory: match.category,
        isExcluded: match.isExcluded,
        classifiedBy: "rule",
        confidence: match.confidence,
        isReviewed: false,
      };
    } else {
      unclassifiedItems.push({
        index: i,
        description: t.description,
        isIncome: t.amount > 0,
      });
    }
  }

  // Step 2: Batch AI fallback for unclassified items
  const BATCH_SIZE = 50;
  for (let offset = 0; offset < unclassifiedItems.length; offset += BATCH_SIZE) {
    const batch = unclassifiedItems.slice(offset, offset + BATCH_SIZE);
    const aiResults = await classifyWithAiFallback(batch, businessType);

    for (const res of aiResults) {
      const orig = transactions[res.index];
      results[res.index] = {
        sourceRow: orig.sourceRow,
        date: orig.date,
        description: orig.description,
        amount: orig.amount,
        hmrcCategory: res.category,
        isExcluded: res.category === "excluded",
        classifiedBy: "ai",
        confidence: res.confidence,
        isReviewed: false,
      };
    }
  }

  return results;
}
