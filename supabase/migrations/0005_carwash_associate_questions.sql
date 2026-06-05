-- Replace Carwash Associate question set with improved questions and rubrics

-- Clear FK dependents before removing old questions
delete from screen_answers
  where question_id in (
    select id from questions where question_set_id = '00000000-0000-0000-0000-000000000002'
  );

delete from screen_results
  where hard_fail_question_id in (
    select id from questions where question_set_id = '00000000-0000-0000-0000-000000000002'
  );

-- Update pass threshold
update question_sets
  set pass_threshold = 60
  where id = '00000000-0000-0000-0000-000000000002';

-- Remove old questions
delete from questions where question_set_id = '00000000-0000-0000-0000-000000000002';

-- Insert new questions
insert into questions (question_set_id, type, variants, rubric, weight, fail_value, order_index) values

  ('00000000-0000-0000-0000-000000000002', 'scored',
   ARRAY['What made you want to apply at Shiny Shell?', 'Why are you interested in working here?'],
   'Score high if the applicant gives any genuine reason — needing income, liking physical work, wanting a consistent schedule, or interest in the company. Score lower if the answer is entirely hollow or they seem confused about what the job is. This is a warm-up question; do not penalize vague answers heavily.',
   1, null, 1),

  ('00000000-0000-0000-0000-000000000002', 'hard_filter',
   ARRAY['What days and hours are you available to work?', 'Are you available to work weekends and some early mornings?'],
   'Fail only if the applicant explicitly states they cannot work weekends or their availability makes them entirely unschedulable for shift-based work. Part-time and limited availability are fine as long as some workable hours exist.',
   1, 'no availability for any shifts', 2),

  ('00000000-0000-0000-0000-000000000002', 'scored',
   ARRAY['This job has you on your feet outside the whole shift — heat, cold, rain. How do you feel about that kind of work?', 'You would be working outdoors in all weather conditions, on your feet the entire shift. Is that something you are comfortable with?'],
   'Score high if they show awareness and acceptance of the physical nature — prior outdoor or physical jobs are a bonus but not required. Score in the middle if they seem willing but naive. Score low if they seem surprised or reluctant. Not looking for an athlete — looking for someone who will not quit after their first hot shift.',
   3, null, 3),

  ('00000000-0000-0000-0000-000000000002', 'scored',
   ARRAY['Reliability is really important to us — our team counts on everyone showing up. How would you describe your track record with that, and what do you do when something unexpected comes up?', 'If something came up and you might miss a shift, what would you do?'],
   'This is the most important question. Score high for any answer showing ownership — they communicate early, find coverage, take it seriously. Score in the middle for general statements of reliability without specifics. Score low for answers that treat no-call no-shows as acceptable, blame outside forces without ownership, or show a pattern of just not showing up. A difficult past is fine — what matters is whether they take responsibility now.',
   5, null, 4),

  ('00000000-0000-0000-0000-000000000002', 'scored',
   ARRAY['Have you worked as part of a team before? What was that like?', 'Tell me about a time you worked closely with other people.'],
   'Score high if they describe a functional team dynamic — sports, school, previous jobs all count. Score in the middle if they have limited experience but seem open and positive. Score low if they express a strong preference for working alone, describe consistent conflict with coworkers, or seem indifferent to teamwork. No specific story required — looking for attitude.',
   2, null, 5),

  ('00000000-0000-0000-0000-000000000002', 'scored',
   ARRAY['Tell me about a time work got tough or stressful — how did you handle it?', 'What do you do when a shift gets really busy or something goes wrong?'],
   'Score high for any answer showing they stay calm, push through, or ask for help appropriately. Score in the middle if they acknowledge difficulty but do not have a clear coping strategy. Score low if they describe shutting down, walking off, or responding with hostility. Experience level does not matter — a story from school, sports, or daily life counts.',
   3, null, 6),

  ('00000000-0000-0000-0000-000000000002', 'scored',
   ARRAY['Part of this job involves greeting customers and being friendly on the lot. How do you feel about that?', 'Are you comfortable talking to customers and giving them a good experience?'],
   'Score high if they are comfortable and natural about it — any customer-facing experience is a plus. Score in the middle if they are shy but willing. Score low only if they express clear aversion to interacting with people. This is a carwash, not a sales job — basic friendliness is all that is needed.',
   2, null, 7);
