create extension if not exists pgcrypto;

create table if not exists public.care_cases (
  id uuid primary key default gen_random_uuid(),
  access_code text not null unique,
  patient_account_id text,
  patient_label text not null default 'Demo patient',
  report_summary jsonb not null default '{}'::jsonb,
  clinician_plan text not null,
  video_recommendations jsonb not null default '[]'::jsonb,
  clinician_approved boolean not null default false,
  feedback jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days')
);

alter table public.care_cases add column if not exists patient_account_id text;

create index if not exists care_cases_patient_account_id_idx on public.care_cases(patient_account_id);
create index if not exists care_cases_access_code_idx on public.care_cases(access_code);
create index if not exists care_cases_expires_at_idx on public.care_cases(expires_at);
alter table public.care_cases enable row level security;
