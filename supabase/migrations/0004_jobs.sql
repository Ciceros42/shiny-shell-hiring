-- Jobs: company-wide open positions, each linked to a question set
create table jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  title text not null,
  slug text not null,
  description text,
  question_set_id uuid references question_sets(id),
  is_active bool not null default true,
  created_at timestamptz not null default now(),
  unique(company_id, slug)
);

alter table applications add column job_id uuid references jobs(id);

create index on jobs(company_id, is_active);

alter table jobs enable row level security;

create policy "company_jobs" on jobs for all using (
  company_id = (select company_id from profiles where id = auth.uid())
);

-- Seed: migrate existing question sets into jobs
insert into jobs (company_id, title, slug, question_set_id, is_active)
select
  company_id,
  job_title,
  lower(regexp_replace(job_title, '[^a-zA-Z0-9]+', '-', 'g')),
  id,
  is_active
from question_sets
where company_id = '00000000-0000-0000-0000-000000000001';
