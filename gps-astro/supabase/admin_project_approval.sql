-- Independent Admin construction approval fields.
-- Run once against an existing Supabase database.
alter table projects add column if not exists admin_approval_status text not null default 'pending';
alter table projects add column if not exists admin_rejection_reason text;
alter table projects add column if not exists admin_decided_by text;
alter table projects add column if not exists admin_decided_at timestamptz;

do $$
begin
  alter table projects add constraint projects_admin_approval_status_check
    check (admin_approval_status in ('pending', 'approved', 'rejected'));
exception when duplicate_object then null;
end $$;

create index if not exists idx_projects_admin_approval_status
  on projects(admin_approval_status);
