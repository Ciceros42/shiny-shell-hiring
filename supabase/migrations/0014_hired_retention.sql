-- Add hired_at and terminated_at timestamps to applications
alter table applications
  add column hired_at timestamptz,
  add column terminated_at timestamptz;

-- Add 'terminated' to the status check constraint
alter table applications drop constraint if exists applications_status_check;
alter table applications add constraint applications_status_check check (status in (
  'applied','sms_sent','screen_link_clicked','screening','screen_complete',
  'passed','failed','scheduled','interviewed','hired','no_show','rejected',
  'dismissed','terminated'
));

-- Backfill: stamp hired_at = created_at for already-hired applications (best approximation)
update applications set hired_at = created_at where status = 'hired';

-- Drop the retention_checkins table — replaced by passive status-based tracking
drop table if exists retention_checkins cascade;
