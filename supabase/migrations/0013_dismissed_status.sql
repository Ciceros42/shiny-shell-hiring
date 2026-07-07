-- Add 'dismissed' to application status: applicants removed from pipeline
-- but retained in applicant history (not the same as rejected).
alter table applications
  drop constraint if exists applications_status_check;

alter table applications
  add constraint applications_status_check check (status in (
    'applied','sms_sent','screen_link_clicked','screening','screen_complete',
    'passed','failed','scheduled','interviewed','hired','no_show','rejected',
    'dismissed'
  ));
