-- TaxBridge UK initial schema
-- Based on the requirements doc (section 3) with the changes agreed in the plan:
--  * hmrc_tokens is server-only (RLS on, no policies => service role only)
--  * uploaded_files is immutable once written (Digital Links audit trail)
--  * insert policies verify ownership of referenced business / file rows
--  * transactions keep source_row for traceability back to the original file

create extension if not exists "pgcrypto";

-- Enums
create type business_type as enum ('self_employment', 'uk_property');
create type filing_status as enum ('pending', 'validated', 'submitted', 'rejected');
create type accounting_method as enum ('CASH', 'ACCRUALS');
create type classified_by as enum ('rule', 'ai', 'user');

-- 1. Profiles (nino holds an AES-256-GCM ciphertext, never the plain NINO)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  nino text,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 2. Businesses
create table public.businesses (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  business_type business_type not null,
  trading_name text not null,
  income_source_id text, -- HMRC businessId, from the Business Details API
  accounting_type accounting_method default 'CASH' not null,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 3. HMRC OAuth vault (one encrypted record per taxpayer). Server-only.
create table public.hmrc_tokens (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade unique not null,
  access_token text not null,  -- encrypted
  refresh_token text not null, -- encrypted
  expires_at timestamptz not null,
  scope text not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- 4. Uploaded spreadsheets (audit trail for Digital Links)
create table public.uploaded_files (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  business_id uuid references public.businesses(id) on delete cascade not null,
  file_name text not null,
  storage_path text not null,
  file_hash text not null, -- SHA-256 of the original file, verified server-side
  row_count int default 0 not null,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 5. Transactions
create table public.transactions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  file_id uuid references public.uploaded_files(id) on delete cascade not null,
  business_id uuid references public.businesses(id) on delete cascade not null,
  source_row int not null, -- row index in the original file
  transaction_date date not null,
  description text not null,
  amount numeric(12, 2) not null, -- positive = income, negative = expense
  hmrc_category text not null,
  is_excluded boolean default false not null,
  classified_by classified_by not null,
  confidence numeric(3, 2) default 1.00 not null,
  is_reviewed boolean default false not null,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 6. Quarterly submissions
create table public.submissions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  business_id uuid references public.businesses(id) on delete cascade not null,
  tax_year text not null, -- e.g. '2026-27'
  period_from date not null,
  period_to date not null,
  status filing_status default 'pending' not null,
  hmrc_submission_id text,
  hmrc_correlation_id text,
  payload jsonb not null,
  response_body jsonb,
  fraud_headers jsonb, -- snapshot sent to HMRC, Authorization removed
  submitted_at timestamptz
);

create index transactions_business_date_idx on public.transactions (business_id, transaction_date);
create index transactions_file_idx on public.transactions (file_id);
create index submissions_business_period_idx on public.submissions (business_id, period_to);
create index businesses_user_idx on public.businesses (user_id);
create index uploaded_files_business_idx on public.uploaded_files (business_id);

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.hmrc_tokens enable row level security; -- intentionally NO policies
alter table public.uploaded_files enable row level security;
alter table public.transactions enable row level security;
alter table public.submissions enable row level security;

create policy "profiles_own" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "businesses_own" on public.businesses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- uploaded_files: select / insert / delete only (no update policy)
create policy "files_select" on public.uploaded_files
  for select using (auth.uid() = user_id);
create policy "files_insert" on public.uploaded_files
  for insert with check (
    auth.uid() = user_id
    and exists (select 1 from public.businesses b where b.id = business_id and b.user_id = auth.uid())
  );
create policy "files_delete" on public.uploaded_files
  for delete using (auth.uid() = user_id);

create policy "transactions_select" on public.transactions
  for select using (auth.uid() = user_id);
create policy "transactions_insert" on public.transactions
  for insert with check (
    auth.uid() = user_id
    and exists (select 1 from public.businesses b where b.id = business_id and b.user_id = auth.uid())
    and exists (select 1 from public.uploaded_files f where f.id = file_id and f.user_id = auth.uid())
  );
create policy "transactions_update" on public.transactions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "transactions_delete" on public.transactions
  for delete using (auth.uid() = user_id);

-- submissions: kept as an audit trail, so no delete policy
create policy "submissions_select" on public.submissions
  for select using (auth.uid() = user_id);
create policy "submissions_insert" on public.submissions
  for insert with check (
    auth.uid() = user_id
    and exists (select 1 from public.businesses b where b.id = business_id and b.user_id = auth.uid())
  );
create policy "submissions_update" on public.submissions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Block changes to the original file's hash and storage path
create function public.prevent_file_mutation() returns trigger
language plpgsql as $$
begin
  if new.file_hash <> old.file_hash or new.storage_path <> old.storage_path then
    raise exception 'uploaded_files hash and storage_path are immutable';
  end if;
  return new;
end $$;

create trigger uploaded_files_immutable
  before update on public.uploaded_files
  for each row execute function public.prevent_file_mutation();

-- Storage: private audit vault, objects live under "<user id>/..."
insert into storage.buckets (id, name, public)
values ('audit-vault', 'audit-vault', false)
on conflict (id) do nothing;

create policy "vault_select_own" on storage.objects
  for select using (bucket_id = 'audit-vault' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "vault_insert_own" on storage.objects
  for insert with check (bucket_id = 'audit-vault' and (storage.foldername(name))[1] = auth.uid()::text);
-- No update/delete policies: stored originals cannot be altered by the user.

-- Create a profile row automatically when a user signs up
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
