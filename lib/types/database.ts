// Hand-written to match supabase/migrations/20261003000000_initial_schema.sql.
// Replace with `supabase gen types typescript` output once a project exists.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type BusinessType = "self_employment" | "uk_property";
export type FilingStatus = "pending" | "validated" | "submitted" | "rejected";
export type AccountingMethod = "CASH" | "ACCRUALS";
export type ClassifiedBy = "rule" | "ai" | "user";

type Table<Row, Required extends keyof Row> = {
  Row: Row;
  Insert: Pick<Row, Required> & Partial<Omit<Row, Required>>;
  Update: Partial<Row>;
  Relationships: [];
};

export type ProfileRow = {
  id: string;
  full_name: string | null;
  nino: string | null;
  created_at: string;
};

export type BusinessRow = {
  id: string;
  user_id: string;
  business_type: BusinessType;
  trading_name: string;
  income_source_id: string | null;
  accounting_type: AccountingMethod;
  created_at: string;
};

export type HmrcTokenRow = {
  id: string;
  user_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  scope: string;
  updated_at: string;
};

export type UploadedFileRow = {
  id: string;
  user_id: string;
  business_id: string;
  file_name: string;
  storage_path: string;
  file_hash: string;
  row_count: number;
  created_at: string;
};

export type TransactionRow = {
  id: string;
  user_id: string;
  file_id: string;
  business_id: string;
  source_row: number;
  transaction_date: string;
  description: string;
  amount: number;
  hmrc_category: string;
  is_excluded: boolean;
  classified_by: ClassifiedBy;
  confidence: number;
  is_reviewed: boolean;
  created_at: string;
};

export type SubmissionRow = {
  id: string;
  user_id: string;
  business_id: string;
  tax_year: string;
  period_from: string;
  period_to: string;
  status: FilingStatus;
  hmrc_submission_id: string | null;
  hmrc_correlation_id: string | null;
  payload: Json;
  response_body: Json | null;
  fraud_headers: Json | null;
  submitted_at: string | null;
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<ProfileRow, "id">;
      businesses: Table<BusinessRow, "user_id" | "business_type" | "trading_name">;
      hmrc_tokens: Table<HmrcTokenRow, "user_id" | "access_token" | "refresh_token" | "expires_at" | "scope">;
      uploaded_files: Table<
        UploadedFileRow,
        "user_id" | "business_id" | "file_name" | "storage_path" | "file_hash"
      >;
      transactions: Table<
        TransactionRow,
        | "user_id"
        | "file_id"
        | "business_id"
        | "source_row"
        | "transaction_date"
        | "description"
        | "amount"
        | "hmrc_category"
        | "classified_by"
      >;
      submissions: Table<
        SubmissionRow,
        "user_id" | "business_id" | "tax_year" | "period_from" | "period_to" | "payload"
      >;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      business_type: BusinessType;
      filing_status: FilingStatus;
      accounting_method: AccountingMethod;
      classified_by: ClassifiedBy;
    };
    CompositeTypes: Record<string, never>;
  };
};
