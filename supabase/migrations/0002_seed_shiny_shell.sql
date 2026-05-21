-- Seed data for Shiny Shell Carwash v1

insert into companies (id, name, slug) values
  ('00000000-0000-0000-0000-000000000001', 'Shiny Shell Carwash', 'shiny-shell');

insert into locations (company_id, name, slug, timezone) values
  ('00000000-0000-0000-0000-000000000001', 'Shiny Shell — Main St', 'main-st', 'America/Denver');

insert into question_sets (id, company_id, job_title, pass_threshold) values
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Carwash Associate', 70);

update locations
  set active_question_set_id = '00000000-0000-0000-0000-000000000002'
  where slug = 'main-st';

insert into questions (question_set_id, type, variants, fail_value, order_index) values
  ('00000000-0000-0000-0000-000000000002', 'hard_filter',
   ARRAY['Do you have reliable transportation to get to work?', 'Are you able to reliably get to our location?'],
   'no', 1),
  ('00000000-0000-0000-0000-000000000002', 'scored',
   ARRAY['What days and times are you available to work?', 'Tell me about your availability — which days and shifts work for you?'],
   null, 2),
  ('00000000-0000-0000-0000-000000000002', 'scored',
   ARRAY['Why do you want to work at a carwash?', 'What made you apply to Shiny Shell?'],
   null, 3),
  ('00000000-0000-0000-0000-000000000002', 'informational',
   ARRAY['Have you worked a customer-facing or physical job before?'],
   null, 4);

-- After creating your Supabase auth user, run:
-- update locations set manager_user_id = '<your-auth-user-uuid>' where slug = 'main-st';
-- insert into profiles (id, company_id, role, name) values ('<your-auth-user-uuid>', '00000000-0000-0000-0000-000000000001', 'company_admin', 'Your Name');
