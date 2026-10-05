export interface ColumnMapping {
  dateColumn: number; // 0-based index
  descriptionColumn: number;
  amountMode: "single" | "dual"; // single amount column vs separate debit & credit columns
  amountColumn?: number;
  debitColumn?: number;
  creditColumn?: number;
}

export interface DetectionResult {
  headers: string[];
  mapping: ColumnMapping;
  confidence: number; // 0 to 100
  sampleRows: (string | number | null)[][];
}

const DATE_REGEX = /^(date|txn_date|transaction[ _]?date|payment[ _]?date|posted[ _]?date|booking[ _]?date)$/i;
const DATE_FALLBACK_REGEX = /(date|time)/i;

const DESC_REGEX = /^(description|narrative|details|payee|particulars|memo|supplier|merchant|reference)$/i;
const DESC_FALLBACK_REGEX = /(description|desc|narrative|payee|details|memo|supplier|particulars)/i;

const SINGLE_AMOUNT_REGEX = /^(amount|total|sum|value|net|gross)$/i;
const SINGLE_AMOUNT_FALLBACK_REGEX = /(amount|total|sum|value)/i;

const DEBIT_REGEX = /^(debit|money[ _]?out|paid[ _]?out|withdrawal|expense|charge)$/i;
const DEBIT_FALLBACK_REGEX = /(debit|out|withdrawal|expense)/i;

const CREDIT_REGEX = /^(credit|money[ _]?in|paid[ _]?in|deposit|income)$/i;
const CREDIT_FALLBACK_REGEX = /(credit|in|deposit|income)/i;

/**
 * Detect column mappings from a list of header strings.
 */
export function detectColumns(headers: string[], sampleRows: unknown[][] = []): DetectionResult {
  const cleanHeaders = headers.map((h, i) => (h ? String(h).trim() : `Column ${i + 1}`));

  let dateCol = cleanHeaders.findIndex((h) => DATE_REGEX.test(h));
  if (dateCol === -1) dateCol = cleanHeaders.findIndex((h) => DATE_FALLBACK_REGEX.test(h));

  let descCol = cleanHeaders.findIndex((h) => DESC_REGEX.test(h));
  if (descCol === -1) descCol = cleanHeaders.findIndex((h) => DESC_FALLBACK_REGEX.test(h));

  // Check for debit and credit columns first
  let debitCol = cleanHeaders.findIndex((h) => DEBIT_REGEX.test(h));
  if (debitCol === -1) debitCol = cleanHeaders.findIndex((h) => DEBIT_FALLBACK_REGEX.test(h));

  let creditCol = cleanHeaders.findIndex((h) => CREDIT_REGEX.test(h));
  if (creditCol === -1) creditCol = cleanHeaders.findIndex((h) => CREDIT_FALLBACK_REGEX.test(h));

  let amountCol = cleanHeaders.findIndex((h) => SINGLE_AMOUNT_REGEX.test(h));
  if (amountCol === -1) amountCol = cleanHeaders.findIndex((h) => SINGLE_AMOUNT_FALLBACK_REGEX.test(h));

  // Determine amount mode
  const hasDual = debitCol !== -1 && creditCol !== -1 && debitCol !== creditCol;
  let amountMode: "single" | "dual" = hasDual ? "dual" : "single";

  // If dual is detected but amountCol is exact match and debit/credit were just fallbacks, re-evaluate
  if (hasDual && amountCol !== -1 && SINGLE_AMOUNT_REGEX.test(cleanHeaders[amountCol])) {
    // Single column might be primary if headers literally say "Amount"
    if (!DEBIT_REGEX.test(cleanHeaders[debitCol]) || !CREDIT_REGEX.test(cleanHeaders[creditCol])) {
      amountMode = "single";
    }
  }

  // Fallbacks if not detected by header name: inspect sample row values
  if (dateCol === -1 && sampleRows.length > 0) {
    dateCol = findProbableDateColumn(sampleRows, cleanHeaders.length);
  }

  if (descCol === -1 && sampleRows.length > 0) {
    descCol = findProbableDescriptionColumn(sampleRows, [dateCol, amountCol, debitCol, creditCol]);
  }

  if (amountMode === "single" && amountCol === -1 && sampleRows.length > 0) {
    amountCol = findProbableAmountColumn(sampleRows, [dateCol, descCol]);
  }

  // Defaults if still -1
  if (dateCol === -1) dateCol = 0;
  if (descCol === -1) descCol = cleanHeaders.length > 1 ? 1 : 0;
  if (amountMode === "single" && amountCol === -1) {
    amountCol = cleanHeaders.length > 2 ? 2 : cleanHeaders.length - 1;
  }
  if (amountMode === "dual") {
    if (debitCol === -1) debitCol = cleanHeaders.length > 2 ? 2 : 0;
    if (creditCol === -1) creditCol = cleanHeaders.length > 3 ? 3 : 1;
  }

  // Calculate detection confidence
  let confidence = 0;
  if (DATE_REGEX.test(cleanHeaders[dateCol])) confidence += 35;
  else if (DATE_FALLBACK_REGEX.test(cleanHeaders[dateCol])) confidence += 20;

  if (DESC_REGEX.test(cleanHeaders[descCol])) confidence += 35;
  else if (DESC_FALLBACK_REGEX.test(cleanHeaders[descCol])) confidence += 20;

  if (amountMode === "single") {
    if (amountCol !== undefined && SINGLE_AMOUNT_REGEX.test(cleanHeaders[amountCol])) confidence += 30;
    else if (amountCol !== undefined && SINGLE_AMOUNT_FALLBACK_REGEX.test(cleanHeaders[amountCol])) confidence += 15;
  } else {
    if (debitCol !== undefined && DEBIT_REGEX.test(cleanHeaders[debitCol])) confidence += 15;
    if (creditCol !== undefined && CREDIT_REGEX.test(cleanHeaders[creditCol])) confidence += 15;
  }

  // Format sample rows as string/number/null matrix
  const formattedSamples: (string | number | null)[][] = sampleRows.slice(0, 5).map((row) =>
    Array.from({ length: cleanHeaders.length }, (_, i) => {
      const v = row[i];
      if (v === undefined || v === null || v === "") return null;
      if (typeof v === "number") return v;
      return String(v);
    })
  );

  return {
    headers: cleanHeaders,
    mapping: {
      dateColumn: dateCol,
      descriptionColumn: descCol,
      amountMode,
      ...(amountMode === "single" ? { amountColumn: amountCol } : { debitColumn: debitCol, creditColumn: creditCol }),
    },
    confidence,
    sampleRows: formattedSamples,
  };
}

function findProbableDateColumn(samples: unknown[][], numCols: number): number {
  for (let c = 0; c < numCols; c++) {
    let dateHits = 0;
    for (const row of samples) {
      if (parseDateValue(row[c]) !== null) dateHits++;
    }
    if (dateHits >= Math.min(3, samples.length)) return c;
  }
  return -1;
}

function findProbableDescriptionColumn(samples: unknown[][], excludeCols: (number | undefined)[]): number {
  const excludeSet = new Set(excludeCols.filter((c): c is number => c !== undefined && c !== -1));
  let bestCol = -1;
  let maxAvgLen = 0;

  for (let c = 0; c < 20; c++) {
    if (excludeSet.has(c)) continue;
    let totalLen = 0;
    let count = 0;
    for (const row of samples) {
      const val = row[c];
      if (typeof val === "string" && isNaN(Number(val))) {
        totalLen += val.length;
        count++;
      }
    }
    if (count > 0 && totalLen / count > maxAvgLen) {
      maxAvgLen = totalLen / count;
      bestCol = c;
    }
  }
  return bestCol;
}

function findProbableAmountColumn(samples: unknown[][], excludeCols: (number | undefined)[]): number {
  const excludeSet = new Set(excludeCols.filter((c): c is number => c !== undefined && c !== -1));
  for (let c = 0; c < 20; c++) {
    if (excludeSet.has(c)) continue;
    let numHits = 0;
    for (const row of samples) {
      if (parseAmountValue(row[c]) !== null) numHits++;
    }
    if (numHits >= Math.min(2, samples.length)) return c;
  }
  return -1;
}

/**
 * Parses numeric currency amount:
 * - "£1,234.56" -> 1234.56
 * - "(150.00)" -> -150.00
 * - "-45.20" -> -45.20
 * - 45.20 -> 45.20
 */
export function parseAmountValue(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") {
    if (isNaN(value) || !isFinite(value)) return null;
    return Math.round(value * 100) / 100;
  }

  let str = String(value).trim();
  if (!str) return null;

  // Remove currency signs and spaces first so both £(100) and (£100) are recognized
  str = str.replace(/[£$€\s]/g, "");

  // Check for accounting parentheses negative: (100.00)
  const isParenNegative = /^\(.*\)$/.test(str);
  if (isParenNegative) {
    str = str.slice(1, -1).trim();
  }

  // Remove commas
  str = str.replace(/,/g, "");

  const num = Number(str);
  if (isNaN(num)) return null;

  const finalVal = isParenNegative ? -Math.abs(num) : num;
  return Math.round(finalVal * 100) / 100;
}

/**
 * Parses various date formats into standard YYYY-MM-DD:
 * - UK dd/mm/yyyy or dd.mm.yyyy or dd-mm-yyyy
 * - ISO yyyy-mm-dd
 * - Date object
 * - Excel serial number (days since 1899-12-30)
 */
export function parseDateValue(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;

  // Date object
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  // Excel serial number (numbers typically between 30000 and 70000)
  if (typeof value === "number") {
    if (value > 20000 && value < 90000) {
      // Excel 1900 leap year bug accounts for 25569 offset from 1970-01-01
      const date = new Date(Math.round((value - 25569) * 86400 * 1000));
      if (!isNaN(date.getTime())) {
        return date.toISOString().slice(0, 10);
      }
    }
    return null;
  }

  const str = String(value).trim();
  if (!str) return null;

  // ISO yyyy-mm-dd
  const isoMatch = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(str);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10);
    const d = parseInt(isoMatch[3], 10);
    return isValidDateParts(y, m, d) ? formatDateParts(y, m, d) : null;
  }

  // UK dd/mm/yyyy or dd.mm.yyyy or dd-mm-yyyy
  const ukMatch = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/.exec(str);
  if (ukMatch) {
    const d = parseInt(ukMatch[1], 10);
    const m = parseInt(ukMatch[2], 10);
    let y = parseInt(ukMatch[3], 10);
    if (y < 100) y += 2000;
    return isValidDateParts(y, m, d) ? formatDateParts(y, m, d) : null;
  }

  // Try standard JS Date parse
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 1990 && parsed.getFullYear() < 2100) {
    return parsed.toISOString().slice(0, 10);
  }

  return null;
}

function isValidDateParts(year: number, month: number, day: number): boolean {
  if (year < 1990 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  return true;
}

function formatDateParts(year: number, month: number, day: number): string {
  const y = year.toString().padStart(4, "0");
  const m = month.toString().padStart(2, "0");
  const d = day.toString().padStart(2, "0");
  return `${y}-${m}-${d}`;
}
