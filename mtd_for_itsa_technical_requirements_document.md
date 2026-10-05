# Product Requirement Document (PRD) & Technical Specification

**Project Name:** `TaxBridge UK` (MTD for ITSA Spreadsheet Bridging & Quarterly Filing)  
**Target Architecture:** Next.js 14+ (App Router), Supabase (Postgres, RLS, Storage), Vercel  
**Target Compliance:** HMRC Making Tax Digital for Income Tax Self Assessment (ITSA)  
**Supported Entities:** Multi-Entity Hybrid (Sole Trader Self-Employment & UK Property Landlord)

---

## 1. System Objective & Non-Negotiable Invariants

TaxBridge UK is a micro-SaaS bridging tool that enables self-employed sole traders and residential landlords to fulfill their statutory Making Tax Digital (MTD) quarterly obligations directly from raw spreadsheets (`.csv`, `.xlsx`).

### Non-Negotiable Technical & Regulatory Invariants:
1. **Unbroken Digital Links (VAT Notice 700/22 & ITSA Regs):** Raw uploaded files must be saved with an immutable SHA-256 hash in object storage. No manual copying or pasting of data points across system boundaries.
2. **Strict Section 24 Separation (UK Property):** Residential mortgage interest is **never** deducted as an expense against property rental turnover. It must strictly be isolated and posted as `residentialFinancialCost` (basic rate 20% tax reducer).
3. **Mandatory HMRC Anti-Fraud Headers (`Gov-Client-*`):** Every single REST call to HMRC must contain valid, client-telemetry-derived anti-fraud headers under `WEB_APP_VIA_SERVER`. Missing or malformed headers will cause sandbox/production 400 rejection.
4. **Multi-Tenancy & Zero Leaks:** Database access is guarded with Supabase Row Level Security (RLS) bound to `auth.uid()`.

---

## 2. Technical Stack & Environment Variables

### 2.1 Tech Stack
* **Framework:** Next.js 14+ (App Router, Server Actions, Route Handlers, React 18/19)
* **Language:** TypeScript 5+ (Strict mode enabled)
* **Styling & Components:** Tailwind CSS, Radix UI primitives (`shadcn/ui`), Lucide React
* **Spreadsheet Processing:** `xlsx` (SheetJS) for client/server streaming parsing
* **Database & Auth:** Supabase (PostgreSQL 15+, Auth with SSR cookie handling, Supabase Storage)
* **AI Categorization (Fallback):** OpenAI API (`gpt-4o-mini`) via Vercel AI SDK (`ai`) with strict JSON schema outputs
* **Testing & HTTP:** `zod` for payload validation, native `fetch` for HMRC REST API calls

### 2.2 Environment Variables (`.env.local`)
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# HMRC Developer Hub Sandbox/Prod
HMRC_CLIENT_ID=your_hmrc_client_id
HMRC_CLIENT_SECRET=your_hmrc_client_secret
HMRC_API_BASE_URL=https://test-api.service.hmrc.gov.uk
HMRC_OAUTH_REDIRECT_URI=http://localhost:3000/api/auth/hmrc/callback

# AI Categorization
OPENAI_API_KEY=sk-...

# App Security
ENCRYPTION_KEY=32_character_hex_key_for_aes_256_gcm
```

---

## 3. Database Schema & Data Models (Supabase Migration)

Execute this DDL in PostgreSQL.

```sql
-- Extensions
create extension if not exists "pgcrypto";

-- Enums
create type business_type as enum ('self_employment', 'uk_property');
create type filing_status as enum ('pending', 'validated', 'submitted', 'rejected');
create type accounting_method as enum ('CASH', 'ACCRUALS');

-- 1. Profiles
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  nino text, -- National Insurance Number (Encrypted or formatted)
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 2. Businesses (Supports multi-business hybrid portfolio)
create table public.businesses (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  business_type business_type not null,
  trading_name text not null,
  income_source_id text, -- Assigned by HMRC via Business Details API
  accounting_type accounting_method default 'CASH' not null,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 3. HMRC OAuth Vault (Single encrypted record per taxpayer)
create table public.hmrc_tokens (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade unique not null,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  scope text not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- 4. Uploaded Spreadsheets (Audit trail for Digital Links mandate)
create table public.uploaded_files (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  business_id uuid references public.businesses(id) on delete cascade not null,
  file_name text not null,
  storage_path text not null,
  file_hash text not null, -- SHA-256 hash of original file
  row_count int default 0 not null,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 5. Transactions
create table public.transactions (
  id uuid default gen_random_uuid() primary key,
  file_id uuid references public.uploaded_files(id) on delete cascade not null,
  business_id uuid references public.businesses(id) on delete cascade not null,
  transaction_date date not null,
  description text not null,
  amount numeric(12, 2) not null, -- Positive = Income, Negative = Expense
  hmrc_category text not null,
  confidence numeric(3, 2) default 1.00 not null,
  is_reviewed boolean default false not null,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 6. Quarterly Submissions
create table public.submissions (
  id uuid default gen_random_uuid() primary key,
  business_id uuid references public.businesses(id) on delete cascade not null,
  period_from date not null,
  period_to date not null,
  status filing_status default 'pending' not null,
  hmrc_submission_id text,
  hmrc_correlation_id text,
  payload jsonb not null,
  response_body jsonb,
  submitted_at timestamptz
);

-- Row Level Security (RLS)
alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.hmrc_tokens enable row level security;
alter table public.uploaded_files enable row level security;
alter table public.transactions enable row level security;
alter table public.submissions enable row level security;

create policy "Users manage own profile" on public.profiles for all using (auth.uid() = id);
create policy "Users manage own businesses" on public.businesses for all using (auth.uid() = user_id);
create policy "Users manage own tokens" on public.hmrc_tokens for all using (auth.uid() = user_id);
create policy "Users manage own files" on public.uploaded_files for all using (auth.uid() = user_id);
create policy "Users manage own transactions" on public.transactions for all using (
  exists (select 1 from public.businesses where businesses.id = transactions.business_id and businesses.user_id = auth.uid())
);
create policy "Users manage own submissions" on public.submissions for all using (
  exists (select 1 from public.businesses where businesses.id = submissions.business_id and businesses.user_id = auth.uid())
);
```

---

## 4. HMRC Taxonomies & Mapping Logic (`lib/taxonomies.ts`)

```typescript
export const SELF_EMPLOYMENT_CATEGORIES = [
  { key: 'turnover', label: 'Turnover / Sales Income', type: 'income' },
  { key: 'costOfGoods', label: 'Cost of Goods & Materials', type: 'expense' },
  { key: 'carVanTravelExpenses', label: 'Car, Van & Travel Expenses', type: 'expense' },
  { key: 'premisesRunningCosts', label: 'Rent, Rates, Power & Insurance', type: 'expense' },
  { key: 'repairsAndMaintenance', label: 'Repairs & Renewals of Property/Tools', type: 'expense' },
  { key: 'staffCosts', label: 'Staff Salaries, Wages & Subcontractors', type: 'expense' },
  { key: 'professionalFees', label: 'Accountancy, Legal & Professional Fees', type: 'expense' },
  { key: 'financialCharges', label: 'Bank, Card, Loan Charges & Interest', type: 'expense' },
  { key: 'advertisingCosts', label: 'Advertising, Website & Marketing', type: 'expense' },
  { key: 'otherExpenses', label: 'Other General Allowable Expenses', type: 'expense' }
] as const;

export const PROPERTY_CATEGORIES = [
  { key: 'rentalIncome', label: 'Rental Income Received', type: 'income' },
  { key: 'premisesRunningCosts', label: 'Rent, Rates, Insurance, Ground Rent', type: 'expense' },
  { key: 'repairsAndMaintenance', label: 'Repairs & Maintenance (Non-Capital)', type: 'expense' },
  { key: 'professionalFees', label: 'Letting Agent, Legal & Management Fees', type: 'expense' },
  { key: 'costOfServices', label: 'Direct Services (Cleaning, Gardening, Utilities)', type: 'expense' },
  { key: 'otherPropertyExpenses', label: 'Other Allowable Property Expenses', type: 'expense' },
  // CRITICAL: Section 24 UK Tax Rule
  { key: 'residentialFinancialCost', label: 'Mortgage Interest (Sec 24 Reducer - NOT an expense)', type: 'finance_cost' }
] as const;
```

---

## 5. Ingestion Engine & Classification Algorithm

### 5.1 Step 1: Client-Side Drag-and-Drop Ingestion
1. Component: `components/file-dropzone.tsx` using `xlsx` library.
2. Accepts `.xlsx`, `.csv`. Reads binary buffer, calculates client-side SHA-256 checksum for audit immutability.
3. Automatically maps headers by analyzing row strings:
   * **Date:** `/(date|time|txn_date|payment_date)/i`
   * **Description:** `/(description|desc|narrative|payee|details|memo|supplier)/i`
   * **Amount:** Checks for signed `/(amount|total|sum|value)/i` or separate `/(debit|out)/i` and `/(credit|in)/i`.
4. Visual column-confirmation modal allows user manual override if regex confidence is $< 100\%$.

### 5.2 Step 2: Hybrid Rules + LLM Classification Pipeline
The system classifies every transaction in priority order:
1. **Rule-Based Engine (Deterministic regex):**
   * If description matches `/(hmrc|vat|dividend|tax)/i` $\to$ Flag as `excluded` (Personal/Tax).
   * If `business_type == 'uk_property'` and description matches `/(mortgage|interest|nationwide|santander|barclays mortgage)/i` $\to$ Automatically classify as `residentialFinancialCost`.
   * If description matches `/(screwfix|toolstation|bandq|plumb)/i` $\to$ `repairsAndMaintenance`.
   * If description matches `/(google ads|meta ads|facebook|print)/i` $\to$ `advertisingCosts`.
   * If description matches `/(uber|trainline|shell|bp|petrol|tfl)/i` $\to$ `carVanTravelExpenses`.
2. **AI Fallback Classification:**
   * Any row failing deterministic rules is batched (up to 50 rows per batch) and sent to OpenAI `gpt-4o-mini`.
   * Prompt strictly constrains categorizations to the exact category keys of the respective business type.
   * Model returns `{ index: number, category: string, confidence: number }[]`.
3. **Transaction Staging Table:**
   * Rows are presented in an editable UI table with badges:
     * Green badge: High confidence / deterministic.
     * Amber badge: AI categorized (requires user glance).
   * User clicks **Approve & Stage for Quarter**.

---

## 6. HMRC API Client & Anti-Fraud Architecture

### 6.1 Required HMRC REST Endpoints
* **Base URL:** `https://test-api.service.hmrc.gov.uk`
* **OAuth Auth:** `/oauth/authorize`
* **OAuth Token:** `/oauth/token`
* **Obligations:** `GET /obligations/income-tax/nino/{nino}?from={from}&to={to}`
* **Sole Trader Periodic Return:** `POST /individuals/business/self-employment/{nino}/{incomeSourceId}/periodic-returns`
* **Property Periodic Return:** `POST /individuals/business/property/{nino}/{incomeSourceId}/periodic-returns`

### 6.2 Anti-Fraud Headers Engine (`Gov-Client-*`)
Every call to HMRC must invoke `buildGovClientHeaders()`, drawing parameters from client browser telemetry:

```typescript
// lib/hmrc/headers.ts
export interface AntiFraudParams {
  deviceId: string;
  userPublicIp: string;
  userPublicPort: string;
  screens: string;
  windowSize: string;
  timezone: string;
  browserUserAgent: string;
  browserPlugins: string;
  browserDoNotTrack: string;
  userId: string;
}

export function generateHmrcHeaders(params: AntiFraudParams, token: string): HeadersInit {
  return {
    'Accept': 'application/vnd.hmrc.2.0+json',
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'Gov-Client-Connection-Method': 'WEB_APP_VIA_SERVER',
    'Gov-Client-Device-ID': params.deviceId,
    'Gov-Client-User-IDs': `taxbridge=${params.userId}`,
    'Gov-Client-Timezone': params.timezone,
    'Gov-Client-Screens': params.screens,
    'Gov-Client-Window-Size': params.windowSize,
    'Gov-Client-Browser-JS-User-Agent': params.browserUserAgent,
    'Gov-Client-Browser-Do-Not-Track': params.browserDoNotTrack,
    'Gov-Client-Browser-Plugins': params.browserPlugins,
    'Gov-Client-Public-IP': params.userPublicIp,
    'Gov-Client-Public-Port': params.userPublicPort,
    'Gov-Vendor-Version': 'taxbridge-uk=1.0.0'
  };
}
```

---

## 7. Submission Aggregation Engine

Before dispatching to HMRC, the app calculates quarterly summaries from the staged transactions.

### 7.1 Sole Trader Payload Mapping
```typescript
interface SelfEmploymentPeriodicPayload {
  periodDates: { periodStartDate: string; periodEndDate: string };
  periodData: {
    incomes?: { turnover?: { amount: number } };
    deductions?: {
      costOfGoods?: { amount: number };
      premisesRunningCosts?: { amount: number };
      carVanTravelExpenses?: { amount: number };
      repairsAndMaintenance?: { amount: number };
      staffCosts?: { amount: number };
      professionalFees?: { amount: number };
      financialCharges?: { amount: number };
      advertisingCosts?: { amount: number };
      otherExpenses?: { amount: number };
    };
  };
}
```

### 7.2 UK Property Payload Mapping (Section 24 Compliant)
```typescript
interface PropertyPeriodicPayload {
  from: string;
  to: string;
  ukOtherProperty: {
    income?: {
      premiumsOfLeaseGrant?: number;
      reversePremiums?: number;
      periodAmount?: number; // Total Rental Income
    };
    expenses?: {
      premisesRunningCosts?: number;
      repairsAndMaintenance?: number;
      financialCosts?: number; // Commercial finance costs only
      professionalFees?: number;
      costOfServices?: number;
      other?: number;
      residentialFinancialCost?: number; // Section 24 Mortgage Interest
    };
  };
}
```

---

## 8. Step-by-Step Antigravity Implementation Directives

Instruct your agent to execute in these distinct phases:

### Phase 1: Database & Supabase Client
1. Set up `/lib/supabase/client.ts` and `/lib/supabase/server.ts` utilizing `@supabase/ssr`.
2. Generate TypeScript database types directly from the schema provided in Section 3.
3. Configure authentication screens (Sign in / Sign up) with standard Supabase email magic link / password.

### Phase 2: Ingestion & Telemetry Components
1. Create `/hooks/useHmrcTelemetry.ts` capturing device screen dimensions, window sizes, RFC4122 UUID device ID, and UTC offset timezone.
2. Build `/components/file-dropzone.tsx` using `xlsx` to parse `.xlsx` and `.csv` files in the browser and auto-detect columns.
3. Build `/components/mapping-table.tsx` with inline dropdowns allowing the user to reclassify transactions or accept AI suggestions.

### Phase 3: HMRC OAuth2 Engine
1. Create route `/app/api/auth/hmrc/route.ts` redirecting to `https://test-api.service.hmrc.gov.uk/oauth/authorize`.
2. Create callback `/app/api/auth/hmrc/callback/route.ts` exchanging the `code` for `access_token` and `refresh_token`, storing securely in table `hmrc_tokens`.
3. Create token refresh helper `/lib/hmrc/token-manager.ts` that auto-refreshes tokens before making downstream API calls.

### Phase 4: Quarterly Review & Direct Filing
1. Create page `/app/dashboard/filing/page.tsx` displaying active HMRC obligations fetched from the sandbox.
2. Build quarterly compilation logic grouping income and categorized expenses according to the schema in Section 7.
3. Implement Server Action `submitQuarterlyUpdate()` attaching all `Gov-Client-*` anti-fraud headers and persisting the return confirmation ID into table `submissions`.