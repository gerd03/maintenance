-- AOAS CRM Supabase Setup
-- Run this script once in Supabase SQL Editor for your project.

create extension if not exists pgcrypto;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.crm_sections (
  id text primary key,
  name text not null,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text not null default ''
);

create table if not exists public.crm_accounts (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  display_name text not null,
  first_name text not null default '',
  last_name text not null default '',
  recovery_email text not null default '',
  secret_question_1_key text not null default '',
  secret_question_2_key text not null default '',
  secret_question_3_key text not null default '',
  secret_answer_1_hash text not null default '',
  secret_answer_2_hash text not null default '',
  secret_answer_3_hash text not null default '',
  role text not null default 'viewer' check (role in ('admin', 'viewer')),
  password_hash text not null,
  is_active boolean not null default true,
  failed_login_attempts integer not null default 0,
  locked_until timestamptz,
  last_login_at timestamptz,
  password_changed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text not null default ''
);

alter table public.crm_accounts add column if not exists first_name text not null default '';
alter table public.crm_accounts add column if not exists last_name text not null default '';
alter table public.crm_accounts add column if not exists recovery_email text not null default '';
alter table public.crm_accounts add column if not exists secret_question_1_key text not null default '';
alter table public.crm_accounts add column if not exists secret_question_2_key text not null default '';
alter table public.crm_accounts add column if not exists secret_question_3_key text not null default '';
alter table public.crm_accounts add column if not exists secret_answer_1_hash text not null default '';
alter table public.crm_accounts add column if not exists secret_answer_2_hash text not null default '';
alter table public.crm_accounts add column if not exists secret_answer_3_hash text not null default '';
alter table public.crm_accounts add column if not exists failed_login_attempts integer not null default 0;
alter table public.crm_accounts add column if not exists locked_until timestamptz;
alter table public.crm_accounts add column if not exists last_login_at timestamptz;
alter table public.crm_accounts add column if not exists password_changed_at timestamptz;

create table if not exists public.crm_participants (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  contact_number text not null default '',
  email text not null default '',
  gender text not null default '',
  address text not null default '',
  age integer,
  birthdate date,
  skills jsonb not null default '[]'::jsonb,
  sections jsonb not null default '[]'::jsonb,
  status text not null default 'talent_pool' check (status in ('talent_pool', 'shortlisted', 'on_hold', 'inactive')),
  notes text not null default '',
  profile_picture jsonb,
  resume jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text not null default '',
  updated_by text not null default ''
);

alter table public.crm_participants add column if not exists profile_picture jsonb;

create table if not exists public.crm_client_requests (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  client_email text not null,
  client_company text not null default '',
  client_account_username text not null default '',
  client_account_id text not null default '',
  request_message text not null default '',
  interview_datetime timestamptz,
  interview_meeting_link text not null default '',
  ceo_meeting_datetime timestamptz,
  ceo_meeting_link text not null default '',
  ceo_included boolean not null default true,
  selected_participant_ids jsonb not null default '[]'::jsonb,
  selected_participant_snapshot jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'approved', 'scheduled', 'declined', 'finalized')),
  finalized_hire_mode text not null default '' check (finalized_hire_mode in ('', 'all', 'manual')),
  finalized_participant_ids jsonb not null default '[]'::jsonb,
  approval_notes text not null default '',
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text not null default '',
  updated_by text not null default ''
);

alter table public.crm_client_requests add column if not exists interview_meeting_link text not null default '';
alter table public.crm_client_requests add column if not exists ceo_meeting_link text not null default '';

create table if not exists public.crm_client_request_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.crm_client_requests(id) on delete cascade,
  event_type text not null check (event_type in ('submitted', 'approved', 'scheduled', 'declined', 'finalized')),
  status_after text not null check (status_after in ('pending', 'approved', 'scheduled', 'declined', 'finalized')),
  note text not null default '',
  interview_datetime timestamptz,
  interview_meeting_link text not null default '',
  ceo_meeting_datetime timestamptz,
  ceo_meeting_link text not null default '',
  finalized_participant_ids jsonb not null default '[]'::jsonb,
  actor_username text not null default '',
  actor_role text not null default '',
  notification_sent boolean not null default false,
  notification_error text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.crm_hired_profiles (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.crm_client_requests(id) on delete cascade,
  participant_id uuid not null references public.crm_participants(id) on delete cascade,
  participant_name text not null default '',
  client_name text not null default '',
  client_email text not null default '',
  client_company text not null default '',
  hired_at timestamptz not null default now(),
  created_by text not null default '',
  notes text not null default '',
  unique (request_id, participant_id)
);

create table if not exists public.crm_account_password_resets (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.crm_accounts(id) on delete cascade,
  token_hash text not null unique,
  requested_by_username text not null default '',
  requested_ip text not null default '',
  requested_user_agent text not null default '',
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_crm_sections_name on public.crm_sections (lower(name));
drop index if exists idx_crm_accounts_username;
create unique index if not exists idx_crm_accounts_username_lower on public.crm_accounts (lower(username));
create index if not exists idx_crm_accounts_recovery_email on public.crm_accounts (lower(recovery_email));
create index if not exists idx_crm_participants_updated on public.crm_participants (updated_at desc);
create index if not exists idx_crm_participants_status on public.crm_participants (status);
create index if not exists idx_crm_participants_sections on public.crm_participants using gin (sections);
create index if not exists idx_crm_client_requests_status on public.crm_client_requests (status);
create index if not exists idx_crm_client_requests_created on public.crm_client_requests (created_at desc);
create index if not exists idx_crm_client_requests_account on public.crm_client_requests (client_account_id);
create index if not exists idx_crm_client_request_events_request on public.crm_client_request_events (request_id);
create index if not exists idx_crm_client_request_events_created on public.crm_client_request_events (created_at desc);
create index if not exists idx_crm_hired_profiles_hired on public.crm_hired_profiles (hired_at desc);
create index if not exists idx_crm_hired_profiles_request on public.crm_hired_profiles (request_id);
create index if not exists idx_crm_password_resets_account on public.crm_account_password_resets (account_id);
create index if not exists idx_crm_password_resets_expires on public.crm_account_password_resets (expires_at);

drop trigger if exists trg_crm_sections_touch on public.crm_sections;
create trigger trg_crm_sections_touch
before update on public.crm_sections
for each row execute procedure public.touch_updated_at();

drop trigger if exists trg_crm_accounts_touch on public.crm_accounts;
create trigger trg_crm_accounts_touch
before update on public.crm_accounts
for each row execute procedure public.touch_updated_at();

drop trigger if exists trg_crm_participants_touch on public.crm_participants;
create trigger trg_crm_participants_touch
before update on public.crm_participants
for each row execute procedure public.touch_updated_at();

drop trigger if exists trg_crm_client_requests_touch on public.crm_client_requests;
create trigger trg_crm_client_requests_touch
before update on public.crm_client_requests
for each row execute procedure public.touch_updated_at();

-- Backend uses the service-role key on the server.
-- Keep RLS enabled so public API roles cannot read or mutate CRM data.
alter table public.crm_sections enable row level security;
alter table public.crm_accounts enable row level security;
alter table public.crm_participants enable row level security;
alter table public.crm_client_requests enable row level security;
alter table public.crm_client_request_events enable row level security;
alter table public.crm_hired_profiles enable row level security;
alter table public.crm_account_password_resets enable row level security;

revoke all on table public.crm_sections from anon, authenticated;
revoke all on table public.crm_accounts from anon, authenticated;
revoke all on table public.crm_participants from anon, authenticated;
revoke all on table public.crm_client_requests from anon, authenticated;
revoke all on table public.crm_client_request_events from anon, authenticated;
revoke all on table public.crm_hired_profiles from anon, authenticated;
revoke all on table public.crm_account_password_resets from anon, authenticated;

grant usage on schema public to service_role;
grant all on table public.crm_sections to service_role;
grant all on table public.crm_accounts to service_role;
grant all on table public.crm_participants to service_role;
grant all on table public.crm_client_requests to service_role;
grant all on table public.crm_client_request_events to service_role;
grant all on table public.crm_hired_profiles to service_role;
grant all on table public.crm_account_password_resets to service_role;
