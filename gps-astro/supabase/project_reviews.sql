-- Citizen project ratings and public reviews.
-- Safe to run repeatedly in the Supabase SQL Editor.
create table if not exists public.project_reviews (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  citizen_identifier uuid not null,
  rating smallint not null check (rating between 1 and 5),
  comment text not null check (char_length(comment) between 3 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, citizen_identifier)
);

create index if not exists idx_project_reviews_project_created
  on public.project_reviews(project_id, created_at desc);

alter table public.project_reviews enable row level security;
drop policy if exists "project_reviews_public_read" on public.project_reviews;

-- Reviews are public through /api/project-reviews, which omits the private
-- citizen_identifier. Direct browser access remains blocked by RLS/grants.
revoke all privileges on table public.project_reviews from anon, authenticated;
grant all privileges on table public.project_reviews to service_role;
