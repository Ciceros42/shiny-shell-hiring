-- 20 test applicants for Shiny Shell Carwash Associate position
-- Spread: 7 screen_complete (needs decision), 4 passed, 9 failed
-- Scores calculated: (Q1×1 + Q3×3 + Q4×5 + Q5×2 + Q6×3 + Q7×2) / 16, threshold 60

DO $$
DECLARE
  v_company_id uuid;
  v_location_id uuid;
  v_job_id uuid;
  v_qs_id uuid;
  q1 uuid; q2 uuid; q3 uuid; q4 uuid; q5 uuid; q6 uuid; q7 uuid;
  v_aid uuid; v_app uuid; v_link uuid; v_call uuid;
BEGIN
  SELECT id INTO v_company_id FROM companies WHERE slug = 'shiny-shell';
  SELECT id INTO v_location_id FROM locations WHERE slug = 'main-st';
  SELECT id INTO v_qs_id FROM question_sets WHERE company_id = v_company_id AND job_title = 'Carwash Associate';
  SELECT id INTO v_job_id FROM jobs WHERE question_set_id = v_qs_id LIMIT 1;
  SELECT id INTO q1 FROM questions WHERE question_set_id = v_qs_id AND order_index = 1;
  SELECT id INTO q2 FROM questions WHERE question_set_id = v_qs_id AND order_index = 2;
  SELECT id INTO q3 FROM questions WHERE question_set_id = v_qs_id AND order_index = 3;
  SELECT id INTO q4 FROM questions WHERE question_set_id = v_qs_id AND order_index = 4;
  SELECT id INTO q5 FROM questions WHERE question_set_id = v_qs_id AND order_index = 5;
  SELECT id INTO q6 FROM questions WHERE question_set_id = v_qs_id AND order_index = 6;
  SELECT id INTO q7 FROM questions WHERE question_set_id = v_qs_id AND order_index = 7;

  -- ─────────────────────────────────────────────────────────────────────────
  -- 1. Marcus Johnson — Score 87 — screen_complete (strong pass)
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO applicants (id, phone, name) VALUES (gen_random_uuid(), '+15550001001', 'Marcus Johnson') RETURNING id INTO v_aid;
  INSERT INTO applications (id, applicant_id, company_id, location_id, job_id, question_set_id, availability, has_transportation, status, source, created_at)
    VALUES (gen_random_uuid(), v_aid, v_company_id, v_location_id, v_job_id, v_qs_id, '{"days":["monday","wednesday","friday","saturday"],"shifts":["morning","afternoon"]}'::jsonb, true, 'screen_complete', 'test', now() - interval '2 days') RETURNING id INTO v_app;
  INSERT INTO magic_links (id, type, application_id, token, expires_at, completed_at) VALUES (gen_random_uuid(), 'screen', v_app, 'test-tok-001', now() + interval '1 day', now() - interval '2 days') RETURNING id INTO v_link;
  INSERT INTO screen_calls (id, application_id, screen_link_id, status, ended_at) VALUES (gen_random_uuid(), v_app, v_link, 'completed', now() - interval '2 days') RETURNING id INTO v_call;
  INSERT INTO screen_answers (screen_call_id, question_id, answer_text, score, ai_reasoning, order_index) VALUES
    (v_call, q1, 'A friend who worked here said the team was solid and the hours were consistent. I need steady work and I like staying active.', 80, 'Genuine, practical motivation backed by a peer reference.', 1),
    (v_call, q2, 'I can work Monday through Saturday, mornings and afternoons. Sundays I have family time but everything else is open.', null, null, 2),
    (v_call, q3, 'I did two summers of landscaping so I know exactly what outdoor physical work feels like. Heat and rain don''t faze me once you''re used to it.', 90, 'Direct relevant experience. Confident and specific about acclimation.', 3),
    (v_call, q4, 'I haven''t missed a shift without calling in over a year. If something comes up I text my supervisor first thing and try to find coverage.', 92, 'Concrete track record, proactive communication, ownership of coverage. Very strong signal.', 4),
    (v_call, q5, 'I played rec league basketball and worked on a small landscaping crew. I like having teammates — it makes the work faster.', 85, 'Two concrete examples. Positive, natural framing of teamwork.', 5),
    (v_call, q6, 'One time a crew member didn''t show and we had a big job. I just put my head down and doubled up. Job got done.', 88, 'Calm, action-oriented. Shows grit without drama.', 6),
    (v_call, q7, 'I worked at a hardware store for a summer so I''m used to greeting people and being helpful. It doesn''t bother me at all.', 75, 'Relevant experience, relaxed and matter-of-fact.', 7);
  INSERT INTO screen_results (application_id, passed, qualitative_summary, manager_briefing, scores_json, total_score, threshold_at_time, notified_at) VALUES
    (v_app, true, 'Solid, experienced candidate with directly relevant outdoor work history. Dependable and team-oriented.', 'Strengths: Landscaping background, strong attendance record. Concern: None significant. Suggested question: What did you enjoy most about working on a crew?', '{}', 87, 60, now() - interval '2 days');

  -- ─────────────────────────────────────────────────────────────────────────
  -- 2. Sarah Chen — Score 84 — screen_complete (strong pass, retail background)
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO applicants (id, phone, name, email) VALUES (gen_random_uuid(), '+15550001002', 'Sarah Chen', 'sarah.chen.test@example.com') RETURNING id INTO v_aid;
  INSERT INTO applications (id, applicant_id, company_id, location_id, job_id, question_set_id, availability, has_transportation, status, source, created_at)
    VALUES (gen_random_uuid(), v_aid, v_company_id, v_location_id, v_job_id, v_qs_id, '{"days":["tuesday","thursday","saturday","sunday"],"shifts":["morning","afternoon","evening"]}'::jsonb, true, 'screen_complete', 'test', now() - interval '3 days') RETURNING id INTO v_app;
  INSERT INTO magic_links (id, type, application_id, token, expires_at, completed_at) VALUES (gen_random_uuid(), 'screen', v_app, 'test-tok-002', now() + interval '1 day', now() - interval '3 days') RETURNING id INTO v_link;
  INSERT INTO screen_calls (id, application_id, screen_link_id, status, ended_at) VALUES (gen_random_uuid(), v_app, v_link, 'completed', now() - interval '3 days') RETURNING id INTO v_call;
  INSERT INTO screen_answers (screen_call_id, question_id, answer_text, score, ai_reasoning, order_index) VALUES
    (v_call, q1, 'I''ve been looking for something active and consistent. I like the idea of working somewhere people actually see the results of your work.', 75, 'Thoughtful, genuine answer. Good self-awareness about what she wants.', 1),
    (v_call, q2, 'I''m available all week except Monday. Happy to do mornings, afternoons, or evenings — I''m flexible.', null, null, 2),
    (v_call, q3, 'I''m not someone who minds physical work. I was on my feet for six-hour shifts at my last retail job. The weather piece is new but I''m up for it.', 78, 'Prior standing-work experience is relevant. Honest about the weather being new but shows willingness.', 3),
    (v_call, q4, 'I''ve always been reliable. My last manager would tell you I was the person who covered shifts when others called out, not the one calling out.', 85, 'Strong framing — positions herself as the solution not the problem. Credible.', 4),
    (v_call, q5, 'At my last job in retail I was basically always in a team setting. You have to communicate constantly or the floor falls apart. I really liked that aspect.', 90, 'Specific, relatable example with an insight about why teamwork matters. High score.', 5),
    (v_call, q6, 'During a holiday rush one of our registers went down and the line was insane. I just focused on my lane, stayed calm, and kept things moving.', 82, 'Clear, specific scenario. Calm under pressure, focus on what''s controllable.', 6),
    (v_call, q7, 'Customer interaction is honestly one of my strengths. I worked retail for two years — being friendly comes naturally to me.', 92, 'Directly relevant experience stated with confidence.', 7);
  INSERT INTO screen_results (application_id, passed, qualitative_summary, manager_briefing, scores_json, total_score, threshold_at_time, notified_at) VALUES
    (v_app, true, 'Articulate, experienced candidate with strong customer and team skills from retail. Good reliability framing.', 'Strengths: Retail team experience, customer comfort. Concern: Outdoor/weather acclimation is untested. Suggested question: How did you handle a particularly difficult customer?', '{}', 84, 60, now() - interval '3 days');

  -- ─────────────────────────────────────────────────────────────────────────
  -- 3. David Park — Score 83 — passed (physical job vet)
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO applicants (id, phone, name) VALUES (gen_random_uuid(), '+15550001003', 'David Park') RETURNING id INTO v_aid;
  INSERT INTO applications (id, applicant_id, company_id, location_id, job_id, question_set_id, availability, has_transportation, status, source, created_at)
    VALUES (gen_random_uuid(), v_aid, v_company_id, v_location_id, v_job_id, v_qs_id, '{"days":["monday","tuesday","wednesday","saturday","sunday"],"shifts":["morning","afternoon"]}'::jsonb, true, 'passed', 'test', now() - interval '5 days') RETURNING id INTO v_app;
  INSERT INTO magic_links (id, type, application_id, token, expires_at, completed_at) VALUES (gen_random_uuid(), 'screen', v_app, 'test-tok-003', now() + interval '1 day', now() - interval '5 days') RETURNING id INTO v_link;
  INSERT INTO screen_calls (id, application_id, screen_link_id, status, ended_at) VALUES (gen_random_uuid(), v_app, v_link, 'completed', now() - interval '5 days') RETURNING id INTO v_call;
  INSERT INTO screen_answers (screen_call_id, question_id, answer_text, score, ai_reasoning, order_index) VALUES
    (v_call, q1, 'I need work and I like physical jobs. A carwash seemed like a good fit — steady, hands-on, not sitting at a desk.', 72, 'Practical and honest. Not enthusiastic but clear-eyed about what he wants.', 1),
    (v_call, q2, 'Available most days except Thursdays and Fridays. Mornings and afternoons work best for me.', null, null, 2),
    (v_call, q3, 'I worked construction for a season and did warehouse work before that. I''ve been outside in July heat and February cold. I can handle it.', 95, 'Extensive directly relevant experience. Completely unphased. Highest confidence of any answer.', 3),
    (v_call, q4, 'Pretty solid. I think I called out twice in two years at the warehouse, both times I was actually sick and I texted ahead. I don''t mess around with that.', 80, 'Concrete, credible record with specifics. Casual but genuine.', 4),
    (v_call, q5, 'I played soccer through high school and worked on construction crews. You learn fast that if one person slacks it hurts everyone.', 88, 'Two good examples with a clear lesson internalized.', 5),
    (v_call, q6, 'On a construction site we had a delivery not show up and we had to improvise the whole afternoon. I just adapted and followed the foreman''s lead.', 85, 'Specific scenario, adaptive response, appropriate followership.', 6),
    (v_call, q7, 'It''s fine. I''m not naturally a chatty person but I can be friendly and professional. Customers are just people.', 68, 'Honest and grounded. Not a strength but not a weakness either — right-sized answer.', 7);
  INSERT INTO screen_results (application_id, passed, qualitative_summary, manager_briefing, scores_json, total_score, threshold_at_time, notified_at) VALUES
    (v_app, true, 'Experienced physical worker with construction and warehouse background. Quiet but dependable. Will be comfortable with the work from day one.', 'Strengths: Extensive outdoor/physical experience, strong attendance. Concern: Quieter disposition — check customer comfort in person. Suggested question: Tell me about a time you had to be friendly with someone you didn''t click with.', '{}', 83, 60, now() - interval '5 days');

  -- ─────────────────────────────────────────────────────────────────────────
  -- 4. Isabella Rodriguez — Score 80 — screen_complete (honest, ownership-focused)
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO applicants (id, phone, name, email) VALUES (gen_random_uuid(), '+15550001004', 'Isabella Rodriguez', 'isabella.test@example.com') RETURNING id INTO v_aid;
  INSERT INTO applications (id, applicant_id, company_id, location_id, job_id, question_set_id, availability, has_transportation, status, source, created_at)
    VALUES (gen_random_uuid(), v_aid, v_company_id, v_location_id, v_job_id, v_qs_id, '{"days":["wednesday","thursday","friday","saturday","sunday"],"shifts":["afternoon","evening"]}'::jsonb, true, 'screen_complete', 'test', now() - interval '1 day') RETURNING id INTO v_app;
  INSERT INTO magic_links (id, type, application_id, token, expires_at, completed_at) VALUES (gen_random_uuid(), 'screen', v_app, 'test-tok-004', now() + interval '1 day', now() - interval '1 day') RETURNING id INTO v_link;
  INSERT INTO screen_calls (id, application_id, screen_link_id, status, ended_at) VALUES (gen_random_uuid(), v_app, v_link, 'completed', now() - interval '1 day') RETURNING id INTO v_call;
  INSERT INTO screen_answers (screen_call_id, question_id, answer_text, score, ai_reasoning, order_index) VALUES
    (v_call, q1, 'Honestly I just need a job and this one seemed like something I could actually show up to and do well. I''m not going to pretend I have a passion for carwashes.', 65, 'Disarmingly honest. Not inspiring but the self-awareness is a good sign.', 1),
    (v_call, q2, 'Wednesday through Sunday, afternoons and evenings. I have class Monday and Tuesday mornings so those are harder.', null, null, 2),
    (v_call, q3, 'I don''t have outdoor job experience specifically but I played varsity softball so I''m used to practicing in the heat and in rain. I don''t think the physical stuff will be an issue.', 75, 'No direct work experience but credible physical analogues. Self-assessment seems accurate.', 3),
    (v_call, q4, 'I''ll be upfront — I had some reliability issues at my last job two years ago during a hard time. But I took that seriously, and for the past year I haven''t missed anything. If something comes up I call early.', 90, 'Exceptional answer. Owns the past, demonstrates growth, specific current behavior. Highest reliability score of the batch.', 4),
    (v_call, q5, 'I was team captain sophomore year. Managing a team when things aren''t going well is the real test — anyone can get along when it''s easy.', 78, 'Leadership angle is interesting. Demonstrates understanding of team dynamics under stress.', 5),
    (v_call, q6, 'When we had a rough stretch in the season and morale was low, I stayed positive and tried to keep people focused on the next game. You can''t fix the past.', 80, 'Grounded, forward-looking response. Shows emotional maturity.', 6),
    (v_call, q7, 'I''m comfortable around people. Retail-style interaction is not my favorite thing in the world but I can be professional and warm.', 72, 'Honest self-assessment. Acceptable answer — she''ll do the job even if it''s not her forte.', 7);
  INSERT INTO screen_results (application_id, passed, qualitative_summary, manager_briefing, scores_json, total_score, threshold_at_time, notified_at) VALUES
    (v_app, true, 'Refreshingly honest candidate with genuine growth on reliability. Past issues acknowledged and evidently addressed. Strong potential.', 'Strengths: Extraordinary self-awareness on reliability, leadership experience. Concern: Past reliability history — verify the turnaround with a reference. Suggested question: What changed for you two years ago?', '{}', 80, 60, now() - interval '1 day');

  -- ─────────────────────────────────────────────────────────────────────────
  -- 5. Tyler Brooks — Score 78 — passed (young, enthusiastic, no prior work)
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO applicants (id, phone, name) VALUES (gen_random_uuid(), '+15550001005', 'Tyler Brooks') RETURNING id INTO v_aid;
  INSERT INTO applications (id, applicant_id, company_id, location_id, job_id, question_set_id, availability, has_transportation, status, source, created_at)
    VALUES (gen_random_uuid(), v_aid, v_company_id, v_location_id, v_job_id, v_qs_id, '{"days":["monday","tuesday","wednesday","thursday","friday","saturday","sunday"],"shifts":["morning","afternoon"]}'::jsonb, true, 'passed', 'test', now() - interval '4 days') RETURNING id INTO v_app;
  INSERT INTO magic_links (id, type, application_id, token, expires_at, completed_at) VALUES (gen_random_uuid(), 'screen', v_app, 'test-tok-005', now() + interval '1 day', now() - interval '4 days') RETURNING id INTO v_link;
  INSERT INTO screen_calls (id, application_id, screen_link_id, status, ended_at) VALUES (gen_random_uuid(), v_app, v_link, 'completed', now() - interval '4 days') RETURNING id INTO v_call;
  INSERT INTO screen_answers (screen_call_id, question_id, answer_text, score, ai_reasoning, order_index) VALUES
    (v_call, q1, 'This is actually my first real job application. I want to start building my work history and I figured a place like this is where I can actually prove myself.', 85, 'Mature framing for a first-time applicant. Self-motivated, long-term thinking.', 1),
    (v_call, q2, 'I''m completely open — any day, mornings or afternoons. I''m in school but online so my schedule is flexible.', null, null, 2),
    (v_call, q3, 'I don''t have work experience but I played football and practiced outside every day for four years including summer two-a-days. I know I can handle it.', 72, 'No work experience but relevant physical analogue is credible. Good self-awareness.', 3),
    (v_call, q4, 'I''ve never had a job before so I can''t point to a track record. But I was at every practice and every game for four years. Showing up is something I take seriously.', 78, 'Honest about the gap, offers a credible substitute signal. Promising for a first-timer.', 4),
    (v_call, q5, 'Football is all about the team. You can''t have one person doing their own thing. I''ve been part of a team my whole life and I genuinely prefer it.', 82, 'Direct, heartfelt answer. Team orientation clearly internalized.', 5),
    (v_call, q6, 'We were losing badly one game and guys were getting down. I tried to just focus on my job and not let the score affect my effort. Coach noticed that.', 75, 'Good example. Focuses on controllables, earned recognition for it.', 6),
    (v_call, q7, 'I''m comfortable talking to people. I was the one in my friend group who''d go ask strangers for directions or whatever. It doesn''t bother me.', 80, 'Charming, specific anecdote. Natural social comfort.', 7);
  INSERT INTO screen_results (application_id, passed, qualitative_summary, manager_briefing, scores_json, total_score, threshold_at_time, notified_at) VALUES
    (v_app, true, 'First-time job applicant but unusually self-aware and motivated. Strong athletic background substitutes credibly for work history. Worth the training investment.', 'Strengths: Intrinsic motivation, four-year attendance commitment in football. Concern: Zero work experience — full onboarding required. Suggested question: What''s the hardest thing you''ve ever had to push through?', '{}', 78, 60, now() - interval '4 days');

  -- ─────────────────────────────────────────────────────────────────────────
  -- 6. Jasmine Williams — Score 72 — screen_complete (good but vague on some)
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO applicants (id, phone, name) VALUES (gen_random_uuid(), '+15550001006', 'Jasmine Williams') RETURNING id INTO v_aid;
  INSERT INTO applications (id, applicant_id, company_id, location_id, job_id, question_set_id, availability, has_transportation, status, source, created_at)
    VALUES (gen_random_uuid(), v_aid, v_company_id, v_location_id, v_job_id, v_qs_id, '{"days":["monday","wednesday","friday","saturday"],"shifts":["morning","afternoon"]}'::jsonb, true, 'screen_complete', 'test', now() - interval '6 hours') RETURNING id INTO v_app;
  INSERT INTO magic_links (id, type, application_id, token, expires_at, completed_at) VALUES (gen_random_uuid(), 'screen', v_app, 'test-tok-006', now() + interval '1 day', now() - interval '6 hours') RETURNING id INTO v_link;
  INSERT INTO screen_calls (id, application_id, screen_link_id, status, ended_at) VALUES (gen_random_uuid(), v_app, v_link, 'completed', now() - interval '6 hours') RETURNING id INTO v_call;
  INSERT INTO screen_answers (screen_call_id, question_id, answer_text, score, ai_reasoning, order_index) VALUES
    (v_call, q1, 'I just want to find a good job. I heard Shiny Shell is a good place to work and it''s close to where I live.', 70, 'Reasonable answer. Vague but not disengaged.', 1),
    (v_call, q2, 'Available Monday, Wednesday, Friday and weekends. Mornings or afternoons.', null, null, 2),
    (v_call, q3, 'I think I can handle it. I''m not afraid of being outside or working hard. I''ve done some babysitting and dog walking so I''m used to being active.', 68, 'Shows willingness but examples are light. Acceptable but not confident.', 3),
    (v_call, q4, 'I''m pretty reliable. I usually show up to things when I say I will. If I can''t make it I try to let people know.', 75, 'Positive general statement but vague. No specific track record offered.', 4),
    (v_call, q5, 'I''ve worked in groups for school projects and stuff. I''m pretty easy to get along with.', 72, 'Minimal example. Doesn''t offer much but no red flags.', 5),
    (v_call, q6, 'When things get stressful I try to stay calm and focus on what I need to do. I don''t really get overwhelmed that easily.', 65, 'Generic answer. No specific situation offered but no avoidance either.', 6),
    (v_call, q7, 'I''m fine with it. I''ve talked to customers at a food stand before so it''s not new to me.', 78, 'Brief relevant example. Comfortable and matter-of-fact.', 7);
  INSERT INTO screen_results (application_id, passed, qualitative_summary, manager_briefing, scores_json, total_score, threshold_at_time, notified_at) VALUES
    (v_app, true, 'Adequate candidate. Answers lack specifics but are consistently positive and grounded. Proximity to job is practical. Low-risk hire.', 'Strengths: Relaxed customer comfort, no red flags anywhere. Concern: Vague answers throughout — hard to get a read on depth. Suggested question: Tell me about the last time you had to do something you didn''t feel like doing.', '{}', 72, 60, now() - interval '6 hours');

  -- ─────────────────────────────────────────────────────────────────────────
  -- 7. Cody Martinez — Score 70 — screen_complete (physical strength, weak on customers)
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO applicants (id, phone, name) VALUES (gen_random_uuid(), '+15550001007', 'Cody Martinez') RETURNING id INTO v_aid;
  INSERT INTO applications (id, applicant_id, company_id, location_id, job_id, question_set_id, availability, has_transportation, status, source, created_at)
    VALUES (gen_random_uuid(), v_aid, v_company_id, v_location_id, v_job_id, v_qs_id, '{"days":["tuesday","thursday","saturday","sunday"],"shifts":["morning","afternoon"]}'::jsonb, true, 'screen_complete', 'test', now() - interval '8 hours') RETURNING id INTO v_app;
  INSERT INTO magic_links (id, type, application_id, token, expires_at, completed_at) VALUES (gen_random_uuid(), 'screen', v_app, 'test-tok-007', now() + interval '1 day', now() - interval '8 hours') RETURNING id INTO v_link;
  INSERT INTO screen_calls (id, application_id, screen_link_id, status, ended_at) VALUES (gen_random_uuid(), v_app, v_link, 'completed', now() - interval '8 hours') RETURNING id INTO v_call;
  INSERT INTO screen_answers (screen_call_id, question_id, answer_text, score, ai_reasoning, order_index) VALUES
    (v_call, q1, 'I need work and I want something physical. I''m not built for an office.', 60, 'Direct and honest. Self-aware about his work preferences.', 1),
    (v_call, q2, 'Tuesday, Thursday, and weekends. Can do mornings or afternoons.', null, null, 2),
    (v_call, q3, 'I''ve been doing moving jobs on weekends for two years. Hauling furniture in July is no joke. This sounds easy compared to that.', 88, 'Excellent directly relevant experience. Confident, specific comparison.', 3),
    (v_call, q4, 'Pretty reliable. Moving work is on-demand so if you flake you don''t get called again. I''ve always been available when they call.', 72, 'Incentive-driven reliability signal. Credible given the job context described.', 4),
    (v_call, q5, 'Moving work is usually two or three guys. You learn to communicate quick or someone gets hurt. I work well in small teams.', 65, 'Interesting angle. Safety-motivated communication is credible.', 5),
    (v_call, q6, 'One time a couch wouldn''t fit through a door and the client was losing it. I just stayed focused, tried a different angle, got it done. Client calmed down once the job was done.', 70, 'Good specific scenario. Outcome-focused, doesn''t escalate.', 6),
    (v_call, q7, 'It''s not my favorite part of a job honestly. I''m more of a heads-down worker. But I can be professional about it.', 45, 'Honest admission of discomfort. Saves it slightly with professionalism pledge but it''s a genuine weak spot.', 7);
  INSERT INTO screen_results (application_id, passed, qualitative_summary, manager_briefing, scores_json, total_score, threshold_at_time, notified_at) VALUES
    (v_app, true, 'Strong physical worker with relevant moving experience. Customer-facing is a stated weak spot — worth probing in interview. Otherwise solid.', 'Strengths: Direct physical job experience, small-team communication. Concern: Customer interaction discomfort flagged explicitly. Suggested question: Describe the most customer-facing moment in your moving work — how''d it go?', '{}', 70, 60, now() - interval '8 hours');

  -- ─────────────────────────────────────────────────────────────────────────
  -- 8. Aisha Thompson — Score 70 — screen_complete (great teamwork, weaker reliability)
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO applicants (id, phone, name) VALUES (gen_random_uuid(), '+15550001008', 'Aisha Thompson') RETURNING id INTO v_aid;
  INSERT INTO applications (id, applicant_id, company_id, location_id, job_id, question_set_id, availability, has_transportation, status, source, created_at)
    VALUES (gen_random_uuid(), v_aid, v_company_id, v_location_id, v_job_id, v_qs_id, '{"days":["monday","wednesday","friday","saturday","sunday"],"shifts":["morning","afternoon"]}'::jsonb, true, 'screen_complete', 'test', now() - interval '10 hours') RETURNING id INTO v_app;
  INSERT INTO magic_links (id, type, application_id, token, expires_at, completed_at) VALUES (gen_random_uuid(), 'screen', v_app, 'test-tok-008', now() + interval '1 day', now() - interval '10 hours') RETURNING id INTO v_link;
  INSERT INTO screen_calls (id, application_id, screen_link_id, status, ended_at) VALUES (gen_random_uuid(), v_app, v_link, 'completed', now() - interval '10 hours') RETURNING id INTO v_call;
  INSERT INTO screen_answers (screen_call_id, question_id, answer_text, score, ai_reasoning, order_index) VALUES
    (v_call, q1, 'I''ve always liked places where people are actually doing something with their hands. My last job was all screen time and I missed being active.', 68, 'Specific contrast between what she had and what she wants. Genuine.', 1),
    (v_call, q2, 'Available Monday, Wednesday through Sunday. Mornings and afternoons work great.', null, null, 2),
    (v_call, q3, 'I did event setup work for a while — tables, chairs, tents outdoors in all weather. It was exhausting but I liked it.', 62, 'Relevant experience but somewhat light on enthusiasm about the physical piece.', 3),
    (v_call, q4, 'I''m usually reliable but I''ll be honest — I went through a period where I was juggling a lot and my schedule was a mess. That''s settled down now. I''ve been much more consistent this past year.', 62, 'Honest about a rough patch. Acknowledges it and claims improvement. Weaker than ideal — needs verification.', 4),
    (v_call, q5, 'I love working with a team. At the event job we had to coordinate constantly and I thrived in that. I was usually the one checking in on everyone.', 92, 'Outstanding answer. Specific, enthusiastic, and shows initiative within team context.', 5),
    (v_call, q6, 'At an outdoor event it started pouring mid-setup and everything was chaos. I just kept working and kept the energy up for the rest of the crew. Sometimes that''s the job.', 72, 'Excellent situational response. Leadership through attitude, not position.', 6),
    (v_call, q7, 'Very comfortable. I was always the one talking to event clients when questions came up. People tend to trust me.', 75, 'Confident with a specific role-based example.', 7);
  INSERT INTO screen_results (application_id, passed, qualitative_summary, manager_briefing, scores_json, total_score, threshold_at_time, notified_at) VALUES
    (v_app, true, 'High team-orientation and strong customer comfort. Reliability admitted as a past weak spot — watch this. Otherwise a very people-strong candidate.', 'Strengths: Exceptional teamwork instincts, outdoor event experience. Concern: Self-reported reliability wobble — dig into the timeline. Suggested question: What changed in the past year that stabilized your schedule?', '{}', 70, 60, now() - interval '10 hours');

  -- ─────────────────────────────────────────────────────────────────────────
  -- 9. Brandon Lee — Score 67 — passed (simple, honest, consistent mid-range)
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO applicants (id, phone, name) VALUES (gen_random_uuid(), '+15550001009', 'Brandon Lee') RETURNING id INTO v_aid;
  INSERT INTO applications (id, applicant_id, company_id, location_id, job_id, question_set_id, availability, has_transportation, status, source, created_at)
    VALUES (gen_random_uuid(), v_aid, v_company_id, v_location_id, v_job_id, v_qs_id, '{"days":["monday","tuesday","saturday","sunday"],"shifts":["morning","afternoon"]}'::jsonb, true, 'passed', 'test', now() - interval '7 days') RETURNING id INTO v_app;
  INSERT INTO magic_links (id, type, application_id, token, expires_at, completed_at) VALUES (gen_random_uuid(), 'screen', v_app, 'test-tok-009', now() + interval '1 day', now() - interval '7 days') RETURNING id INTO v_link;
  INSERT INTO screen_calls (id, application_id, screen_link_id, status, ended_at) VALUES (gen_random_uuid(), v_app, v_link, 'completed', now() - interval '7 days') RETURNING id INTO v_call;
  INSERT INTO screen_answers (screen_call_id, question_id, answer_text, score, ai_reasoning, order_index) VALUES
    (v_call, q1, 'I want a steady job. I live nearby. Seems like a decent place to work.', 58, 'Minimal but not dismissive. Honest and practical.', 1),
    (v_call, q2, 'Monday, Tuesday, and weekends. Mornings or afternoons are fine.', null, null, 2),
    (v_call, q3, 'I used to do yard work for neighbors growing up. Hot days, cold days — I don''t really mind.', 65, 'Light but legitimate. Normalizes physical outdoor work naturally.', 3),
    (v_call, q4, 'I show up when I say I will. I''ve never been fired and I''ve never been written up for attendance.', 70, 'Stated confidently with a concrete negative claim. Credible.', 4),
    (v_call, q5, 'I worked at a moving company with two other guys. Pretty small team. We got along fine.', 68, 'Basic answer. No drama, no enthusiasm — just functional team experience.', 5),
    (v_call, q6, 'If something goes wrong I just figure out what needs to happen and do it. I don''t get flustered.', 62, 'Brief, self-assured. Lacks a story but the tone is calm.', 6),
    (v_call, q7, 'I can be friendly. It''s not hard.', 70, 'Short but confident. His matter-of-fact tone is actually reassuring.', 7);
  INSERT INTO screen_results (application_id, passed, qualitative_summary, manager_briefing, scores_json, total_score, threshold_at_time, notified_at) VALUES
    (v_app, true, 'Quiet, no-frills candidate. Won''t dazzle anyone but answers are honest and clean record is a genuine positive. Reliable mid-tier hire.', 'Strengths: No attendance issues claimed, calm demeanor. Concern: Minimal engagement throughout — hard to assess depth. Suggested question: What does a good shift look like to you at the end of the day?', '{}', 67, 60, now() - interval '7 days');

  -- ─────────────────────────────────────────────────────────────────────────
  -- 10. Priya Patel — Score 67 — passed (thoughtful, email applicant)
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO applicants (id, phone, name, email, sms_opted_out) VALUES (gen_random_uuid(), '+15550001010', 'Priya Patel', 'priya.patel.test@example.com', true) RETURNING id INTO v_aid;
  INSERT INTO applications (id, applicant_id, company_id, location_id, job_id, question_set_id, availability, has_transportation, status, source, created_at)
    VALUES (gen_random_uuid(), v_aid, v_company_id, v_location_id, v_job_id, v_qs_id, '{"days":["wednesday","thursday","friday","saturday"],"shifts":["afternoon","evening"]}'::jsonb, true, 'passed', 'test', now() - interval '6 days') RETURNING id INTO v_app;
  INSERT INTO magic_links (id, type, application_id, token, expires_at, completed_at) VALUES (gen_random_uuid(), 'screen', v_app, 'test-tok-010', now() + interval '1 day', now() - interval '6 days') RETURNING id INTO v_link;
  INSERT INTO screen_calls (id, application_id, screen_link_id, status, ended_at) VALUES (gen_random_uuid(), v_app, v_link, 'completed', now() - interval '6 days') RETURNING id INTO v_call;
  INSERT INTO screen_answers (screen_call_id, question_id, answer_text, score, ai_reasoning, order_index) VALUES
    (v_call, q1, 'I''m looking for part-time work that fits around my studies and that gets me out of the house. A physical job that has a clear start and end appeals to me more than an office environment.', 72, 'Thoughtful, self-aware answer. Good self-knowledge about what kind of work suits her.', 1),
    (v_call, q2, 'Wednesday through Saturday, afternoons and evenings work best. I have morning classes most days.', null, null, 2),
    (v_call, q3, 'I''m not experienced with outdoor labor specifically but I run about four miles a day so the physical stamina piece isn''t a concern. The weather will be an adjustment I''m sure.', 60, 'Honest about the gap, credible fitness claim. Appropriately humble about weather.', 3),
    (v_call, q4, 'I haven''t had a formal job before but I''ve tutored privately for two years and I''ve never cancelled a session without rescheduling first. I take commitments seriously.', 68, 'No formal employment but a credible alternative accountability signal.', 4),
    (v_call, q5, 'I was part of a study group that met twice a week for two semesters. You have to be accountable to other people or the whole thing falls apart.', 75, 'Atypical but thoughtful example. Demonstrates accountability to group dynamics.', 5),
    (v_call, q6, 'When I was tutoring a student who was failing and parents were pressuring me, I just focused on what I could control each session and tried not to carry the stress home.', 68, 'Specific, mature scenario. Good compartmentalization.', 6),
    (v_call, q7, 'I interact with students and parents professionally as a tutor — handling different personalities is part of the job. I think I''d manage fine.', 65, 'Relevant experience. Measured confidence.', 7);
  INSERT INTO screen_results (application_id, passed, qualitative_summary, manager_briefing, scores_json, total_score, threshold_at_time, notified_at) VALUES
    (v_app, true, 'Thoughtful, self-directed candidate with no formal job experience but strong accountability signals from tutoring. Email preferred — plan accordingly.', 'Strengths: Demonstrated accountability in tutoring, self-aware about limitations. Concern: No formal employment — first real job dynamics. Suggested question: How do you think this job will be different from tutoring?', '{}', 67, 60, now() - interval '6 days');

  -- ─────────────────────────────────────────────────────────────────────────
  -- 11. James Okonkwo — Score 62 — screen_complete (barely passes)
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO applicants (id, phone, name) VALUES (gen_random_uuid(), '+15550001011', 'James Okonkwo') RETURNING id INTO v_aid;
  INSERT INTO applications (id, applicant_id, company_id, location_id, job_id, question_set_id, availability, has_transportation, status, source, created_at)
    VALUES (gen_random_uuid(), v_aid, v_company_id, v_location_id, v_job_id, v_qs_id, '{"days":["saturday","sunday"],"shifts":["morning","afternoon"]}'::jsonb, true, 'screen_complete', 'test', now() - interval '12 hours') RETURNING id INTO v_app;
  INSERT INTO magic_links (id, type, application_id, token, expires_at, completed_at) VALUES (gen_random_uuid(), 'screen', v_app, 'test-tok-011', now() + interval '1 day', now() - interval '12 hours') RETURNING id INTO v_link;
  INSERT INTO screen_calls (id, application_id, screen_link_id, status, ended_at) VALUES (gen_random_uuid(), v_app, v_link, 'completed', now() - interval '12 hours') RETURNING id INTO v_call;
  INSERT INTO screen_answers (screen_call_id, question_id, answer_text, score, ai_reasoning, order_index) VALUES
    (v_call, q1, 'I want to earn money over the weekends. I have time and I''d rather be working than sitting around.', 65, 'Practical motivation. Not inspiring but genuine.', 1),
    (v_call, q2, 'Weekends only for now. Saturday and Sunday, mornings or afternoons.', null, null, 2),
    (v_call, q3, 'I think I can handle it. I play basketball and I''m used to sweating. I haven''t worked outside before but I''m willing to.', 65, 'Reasonable analogue. Honest about no prior outdoor work but willing.', 3),
    (v_call, q4, 'I''m pretty good about showing up. I can''t think of a time I just didn''t show up somewhere without saying something.', 58, 'Vague positive claim. No specific story. Acceptable but uninspiring.', 4),
    (v_call, q5, 'I''ve played team sports my whole life. I know how to work with people.', 62, 'Generic sports reference. True enough but no specific insight.', 5),
    (v_call, q6, 'If a game gets hard I just focus on the fundamentals. I guess the same applies to work.', 60, 'Draws an analogy but doesn''t commit to a real-work example. Light.', 6),
    (v_call, q7, 'I don''t have a problem with it. I''m a pretty social person.', 68, 'Self-described as social. No example but the tone is confident.', 7);
  INSERT INTO screen_results (application_id, passed, qualitative_summary, manager_briefing, scores_json, total_score, threshold_at_time, notified_at) VALUES
    (v_app, true, 'Weekend-only availability limits scheduling flexibility. Answers are consistently vague but free of red flags. Marginal pass.', 'Strengths: No red flags, physically capable. Concern: Weekend-only and vague answers — limited data to work with. Suggested question: What would make you want to pick up weekday shifts eventually?', '{}', 62, 60, now() - interval '12 hours');

  -- ─────────────────────────────────────────────────────────────────────────
  -- 12. Kevin Walsh — Score 59 — failed (borderline, can't articulate)
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO applicants (id, phone, name) VALUES (gen_random_uuid(), '+15550001012', 'Kevin Walsh') RETURNING id INTO v_aid;
  INSERT INTO applications (id, applicant_id, company_id, location_id, job_id, question_set_id, availability, has_transportation, status, source, created_at)
    VALUES (gen_random_uuid(), v_aid, v_company_id, v_location_id, v_job_id, v_qs_id, '{"days":["monday","wednesday","friday"],"shifts":["morning","afternoon"]}'::jsonb, true, 'failed', 'test', now() - interval '9 days') RETURNING id INTO v_app;
  INSERT INTO magic_links (id, type, application_id, token, expires_at, completed_at) VALUES (gen_random_uuid(), 'screen', v_app, 'test-tok-012', now() + interval '1 day', now() - interval '9 days') RETURNING id INTO v_link;
  INSERT INTO screen_calls (id, application_id, screen_link_id, status, ended_at) VALUES (gen_random_uuid(), v_app, v_link, 'completed', now() - interval '9 days') RETURNING id INTO v_call;
  INSERT INTO screen_answers (screen_call_id, question_id, answer_text, score, ai_reasoning, order_index) VALUES
    (v_call, q1, 'I don''t know. I just need a job I guess.', 55, 'Disengaged opening. Not hostile but minimal.', 1),
    (v_call, q2, 'Monday, Wednesday, Friday. Morning or afternoon.', null, null, 2),
    (v_call, q3, 'Yeah I can handle it. I work out so I''m in shape.', 62, 'Brief and self-assured. Fitness claim is okay but no specific outdoor experience.', 3),
    (v_call, q4, 'I''m reliable. I show up.', 60, 'The shortest possible reliable answer. Technically an answer. No substance.', 4),
    (v_call, q5, 'Yeah I can work with people. I don''t have a problem with that.', 58, 'Barely qualifies. Negative framing ("don''t have a problem") instead of positive engagement.', 5),
    (v_call, q6, 'I just deal with it. I don''t really stress about stuff.', 55, 'Dismissive framing. Could signal either resilience or avoidance — unclear.', 6),
    (v_call, q7, 'Yeah that''s fine.', 62, 'Single sentence. Zero elaboration.', 7);
  INSERT INTO screen_results (application_id, passed, qualitative_summary, manager_briefing, scores_json, total_score, threshold_at_time, notified_at) VALUES
    (v_app, false, 'Disengaged throughout. Technically answered every question but gave almost no substance. Impossible to assess fit with confidence.', 'Strengths: No hostility, physically fit. Concern: Minimal engagement makes this essentially a blank profile. Suggested question: What would motivate you to actually try hard at this job?', '{}', 59, 60, now() - interval '9 days');

  -- ─────────────────────────────────────────────────────────────────────────
  -- 13. Destiny Brown — Score 59 — failed (reliability tanked overall score)
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO applicants (id, phone, name) VALUES (gen_random_uuid(), '+15550001013', 'Destiny Brown') RETURNING id INTO v_aid;
  INSERT INTO applications (id, applicant_id, company_id, location_id, job_id, question_set_id, availability, has_transportation, status, source, created_at)
    VALUES (gen_random_uuid(), v_aid, v_company_id, v_location_id, v_job_id, v_qs_id, '{"days":["tuesday","thursday","saturday","sunday"],"shifts":["morning","afternoon","evening"]}'::jsonb, true, 'failed', 'test', now() - interval '8 days') RETURNING id INTO v_app;
  INSERT INTO magic_links (id, type, application_id, token, expires_at, completed_at) VALUES (gen_random_uuid(), 'screen', v_app, 'test-tok-013', now() + interval '1 day', now() - interval '8 days') RETURNING id INTO v_link;
  INSERT INTO screen_calls (id, application_id, screen_link_id, status, ended_at) VALUES (gen_random_uuid(), v_app, v_link, 'completed', now() - interval '8 days') RETURNING id INTO v_call;
  INSERT INTO screen_answers (screen_call_id, question_id, answer_text, score, ai_reasoning, order_index) VALUES
    (v_call, q1, 'I like staying busy and I''ve heard good things about working here. I want something I can grow with.', 75, 'Positive, forward-looking. Mentions growth which is a good sign.', 1),
    (v_call, q2, 'Available Tuesday, Thursday, and full weekends. Any shift works.', null, null, 2),
    (v_call, q3, 'I''ve worked a food truck before which is basically outdoor work. Summer heat is rough but you adapt.', 70, 'Relevant experience. Matter-of-fact about the difficulty.', 3),
    (v_call, q4, 'Honestly my attendance hasn''t always been great. I''ve called out more than I should have at a couple jobs. I''m working on it but I can''t say I have a perfect record.', 25, 'Unusually candid admission of a significant weakness. No plan offered. Scores very low per rubric.', 4),
    (v_call, q5, 'I get along with people well. At the food truck it was just two of us and we had to be in sync all day.', 80, 'Close-quarters team experience. Good example.', 5),
    (v_call, q6, 'On the food truck we once ran out of a popular item mid-rush. I just kept moving, offered substitutes, stayed friendly. You can''t let it show.', 72, 'Specific, customer-service aware response. Shows composure.', 6),
    (v_call, q7, 'At the food truck we were talking to customers all day. I''m very comfortable with it.', 82, 'Direct customer experience. Confident.', 7);
  INSERT INTO screen_results (application_id, passed, qualitative_summary, manager_briefing, scores_json, total_score, threshold_at_time, notified_at) VALUES
    (v_app, false, 'Genuinely likeable candidate undone by an honest admission of poor attendance. Strong in every other dimension — worth reconsidering if she can demonstrate a turnaround.', 'Strengths: Customer comfort, food truck team experience. Concern: Self-reported attendance problems with no recovery plan stated. Suggested question: What specifically has changed since those jobs?', '{}', 59, 60, now() - interval '8 days');

  -- ─────────────────────────────────────────────────────────────────────────
  -- 14. Alicia Kim — Score 57 — failed (uncertain about physical demands)
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO applicants (id, phone, name) VALUES (gen_random_uuid(), '+15550001014', 'Alicia Kim') RETURNING id INTO v_aid;
  INSERT INTO applications (id, applicant_id, company_id, location_id, job_id, question_set_id, availability, has_transportation, status, source, created_at)
    VALUES (gen_random_uuid(), v_aid, v_company_id, v_location_id, v_job_id, v_qs_id, '{"days":["monday","wednesday","friday","saturday"],"shifts":["morning","afternoon"]}'::jsonb, true, 'failed', 'test', now() - interval '11 days') RETURNING id INTO v_app;
  INSERT INTO magic_links (id, type, application_id, token, expires_at, completed_at) VALUES (gen_random_uuid(), 'screen', v_app, 'test-tok-014', now() + interval '1 day', now() - interval '11 days') RETURNING id INTO v_link;
  INSERT INTO screen_calls (id, application_id, screen_link_id, status, ended_at) VALUES (gen_random_uuid(), v_app, v_link, 'completed', now() - interval '11 days') RETURNING id INTO v_call;
  INSERT INTO screen_answers (screen_call_id, question_id, answer_text, score, ai_reasoning, order_index) VALUES
    (v_call, q1, 'I''m looking for something part-time that I can fit around other things.', 60, 'Functional answer but low engagement.', 1),
    (v_call, q2, 'Monday, Wednesday, Friday, and Saturday. Mornings or afternoons.', null, null, 2),
    (v_call, q3, 'I''m not sure about the weather part. I don''t love being in the heat but I''ll try. I haven''t really done physical outdoor work before.', 42, 'Honest about apprehension. The "I''ll try" framing is a soft concern for a physically demanding role.', 3),
    (v_call, q4, 'I think I''m reliable. I try to show up to things. I sometimes run late but I always come.', 65, 'Mixed signal — "sometimes late" is a red flag even with the positive spin.', 4),
    (v_call, q5, 'I''ve done group projects in school. I''m usually the one who ends up doing more than my share, which can be frustrating.', 55, 'Latent resentment of team dynamics. May indicate difficulty in collaborative settings.', 5),
    (v_call, q6, 'I try to push through. Sometimes I need to step back for a minute and breathe.', 58, 'Acceptable coping strategy but the step-back instinct may not suit a fast carwash floor.', 6),
    (v_call, q7, 'I''m okay with it. Not my favorite thing but I can do it.', 62, 'Tepid but functional. Not a strength.', 7);
  INSERT INTO screen_results (application_id, passed, qualitative_summary, manager_briefing, scores_json, total_score, threshold_at_time, notified_at) VALUES
    (v_app, false, 'Candidate scored below threshold mainly due to concerns about physical readiness and a latent frustration with teammates. Multiple soft concerns add up.', 'Strengths: Honest and self-aware. Concern: Weather apprehension + latent resentment of group work + occasional lateness = three soft flags. Suggested question: What would need to be true for you to actually enjoy this kind of work?', '{}', 57, 60, now() - interval '11 days');

  -- ─────────────────────────────────────────────────────────────────────────
  -- 15. Marcus Torres — Failed (hard filter: no weekend availability)
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO applicants (id, phone, name) VALUES (gen_random_uuid(), '+15550001015', 'Marcus Torres') RETURNING id INTO v_aid;
  INSERT INTO applications (id, applicant_id, company_id, location_id, job_id, question_set_id, availability, has_transportation, status, source, created_at)
    VALUES (gen_random_uuid(), v_aid, v_company_id, v_location_id, v_job_id, v_qs_id, '{"days":["tuesday"],"shifts":["morning"]}'::jsonb, true, 'failed', 'test', now() - interval '10 days') RETURNING id INTO v_app;
  INSERT INTO magic_links (id, type, application_id, token, expires_at, completed_at) VALUES (gen_random_uuid(), 'screen', v_app, 'test-tok-015', now() + interval '1 day', now() - interval '10 days') RETURNING id INTO v_link;
  INSERT INTO screen_calls (id, application_id, screen_link_id, status, ended_at) VALUES (gen_random_uuid(), v_app, v_link, 'completed', now() - interval '10 days') RETURNING id INTO v_call;
  INSERT INTO screen_answers (screen_call_id, question_id, answer_text, score, ai_reasoning, order_index) VALUES
    (v_call, q1, 'I want extra income. This seemed like it could work.', 55, 'Minimal but honest.', 1),
    (v_call, q2, 'no availability for any shifts', null, null, 2),
    (v_call, q3, 'I can handle physical work, no problem.', 60, null, 3),
    (v_call, q4, 'I''m reliable when I commit to something.', 60, null, 4),
    (v_call, q5, 'I work fine with others.', 55, null, 5),
    (v_call, q6, 'I deal with it and move on.', 50, null, 6),
    (v_call, q7, 'That''s fine with me.', 55, null, 7);
  INSERT INTO screen_results (application_id, passed, hard_fail_question_id, hard_fail_answer, qualitative_summary, manager_briefing, scores_json, total_score, threshold_at_time, notified_at) VALUES
    (v_app, false, q2, 'no availability for any shifts', 'Candidate failed the scheduling availability filter. No viable shift windows available.', 'Hard filter fail on availability. No interview warranted.', '{}', 0, 60, now() - interval '10 days');

  -- ─────────────────────────────────────────────────────────────────────────
  -- 16. Jake Simmons — Score 48 — failed (dismissive about reliability)
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO applicants (id, phone, name) VALUES (gen_random_uuid(), '+15550001016', 'Jake Simmons') RETURNING id INTO v_aid;
  INSERT INTO applications (id, applicant_id, company_id, location_id, job_id, question_set_id, availability, has_transportation, status, source, created_at)
    VALUES (gen_random_uuid(), v_aid, v_company_id, v_location_id, v_job_id, v_qs_id, '{"days":["friday","saturday","sunday"],"shifts":["afternoon","evening"]}'::jsonb, true, 'failed', 'test', now() - interval '13 days') RETURNING id INTO v_app;
  INSERT INTO magic_links (id, type, application_id, token, expires_at, completed_at) VALUES (gen_random_uuid(), 'screen', v_app, 'test-tok-016', now() + interval '1 day', now() - interval '13 days') RETURNING id INTO v_link;
  INSERT INTO screen_calls (id, application_id, screen_link_id, status, ended_at) VALUES (gen_random_uuid(), v_app, v_link, 'completed', now() - interval '13 days') RETURNING id INTO v_call;
  INSERT INTO screen_answers (screen_call_id, question_id, answer_text, score, ai_reasoning, order_index) VALUES
    (v_call, q1, 'I want weekend money and this seemed easy enough.', 70, 'Honest, if blunt. No pretense.', 1),
    (v_call, q2, 'Fridays through Sundays. Afternoons and evenings.', null, null, 2),
    (v_call, q3, 'I work out six days a week. Physical work is nothing to me.', 68, 'Confident, physically capable. Slightly arrogant but the underlying claim is probably true.', 3),
    (v_call, q4, 'I mean, things come up. If I''m sick I''m sick. People act like that''s a crime. I''ll try to give notice if I can but I''m not going to lie about it.', 15, 'Explicitly normalizes calling out, challenges the premise, no ownership. Textbook low-reliability answer per rubric.', 4),
    (v_call, q5, 'I can work with people when they''re not annoying. I usually prefer to just do my job.', 65, 'Conditional acceptance of teamwork is a mild flag. Honest though.', 5),
    (v_call, q6, 'I just handle it. I don''t really have a method. I just do what needs doing.', 55, 'Vague non-answer. Doesn''t demonstrate any stress mechanism.', 6),
    (v_call, q7, 'I''ll be polite if people are polite. If they''re not, that''s a two-way street.', 60, 'Conditional politeness is a customer service risk. Noted.', 7);
  INSERT INTO screen_results (application_id, passed, qualitative_summary, manager_briefing, scores_json, total_score, threshold_at_time, notified_at) VALUES
    (v_app, false, 'Physically capable but the reliability answer was explicitly poor and the customer service framing was conditional. Core values misalignment.', 'Strengths: Physical fitness, blunt honesty. Concern: Actively justified no-call no-shows and conditional customer politeness. Do not advance. Suggested question: N/A', '{}', 48, 60, now() - interval '13 days');

  -- ─────────────────────────────────────────────────────────────────────────
  -- 17. Noah Garcia — Score 50 — failed (vague all-around, not hostile)
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO applicants (id, phone, name) VALUES (gen_random_uuid(), '+15550001017', 'Noah Garcia') RETURNING id INTO v_aid;
  INSERT INTO applications (id, applicant_id, company_id, location_id, job_id, question_set_id, availability, has_transportation, status, source, created_at)
    VALUES (gen_random_uuid(), v_aid, v_company_id, v_location_id, v_job_id, v_qs_id, '{"days":["saturday","sunday"],"shifts":["morning"]}'::jsonb, false, 'failed', 'test', now() - interval '14 days') RETURNING id INTO v_app;
  INSERT INTO magic_links (id, type, application_id, token, expires_at, completed_at) VALUES (gen_random_uuid(), 'screen', v_app, 'test-tok-017', now() + interval '1 day', now() - interval '14 days') RETURNING id INTO v_link;
  INSERT INTO screen_calls (id, application_id, screen_link_id, status, ended_at) VALUES (gen_random_uuid(), v_app, v_link, 'completed', now() - interval '14 days') RETURNING id INTO v_call;
  INSERT INTO screen_answers (screen_call_id, question_id, answer_text, score, ai_reasoning, order_index) VALUES
    (v_call, q1, 'I just need some work.', 45, 'Bare minimum answer.', 1),
    (v_call, q2, 'Weekends. Mornings mostly.', null, null, 2),
    (v_call, q3, 'I think I can handle it. I haven''t really done it but I''ll be okay.', 50, 'Hopeful without basis. No supporting evidence.', 3),
    (v_call, q4, 'I try to show up. Sometimes things happen. I don''t know.', 52, 'Passive framing with a vague concession. No ownership.', 4),
    (v_call, q5, 'Yeah, teamwork is fine.', 48, 'Minimal affirmation. No example, no insight.', 5),
    (v_call, q6, 'I don''t know, I just try to get through it.', 45, 'Passive. No strategy, no example.', 6),
    (v_call, q7, 'Sure, that''s fine.', 55, 'Accepting but entirely content-free.', 7);
  INSERT INTO screen_results (application_id, passed, qualitative_summary, manager_briefing, scores_json, total_score, threshold_at_time, notified_at) VALUES
    (v_app, false, 'Uniformly vague. No red flags but also no evidence of engagement or capability. Insufficient signal to make a hire decision.', 'Strengths: Not hostile. Concern: Every answer is below minimum specificity — cannot assess fit. No transportation also limits scheduling. Suggested question: N/A', '{}', 50, 60, now() - interval '14 days');

  -- ─────────────────────────────────────────────────────────────────────────
  -- 18. Crystal Hayes — Score 25 — failed (one-word answers throughout)
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO applicants (id, phone, name) VALUES (gen_random_uuid(), '+15550001018', 'Crystal Hayes') RETURNING id INTO v_aid;
  INSERT INTO applications (id, applicant_id, company_id, location_id, job_id, question_set_id, availability, has_transportation, status, source, created_at)
    VALUES (gen_random_uuid(), v_aid, v_company_id, v_location_id, v_job_id, v_qs_id, '{"days":["monday","tuesday"],"shifts":["morning"]}'::jsonb, true, 'failed', 'test', now() - interval '15 days') RETURNING id INTO v_app;
  INSERT INTO magic_links (id, type, application_id, token, expires_at, completed_at) VALUES (gen_random_uuid(), 'screen', v_app, 'test-tok-018', now() + interval '1 day', now() - interval '15 days') RETURNING id INTO v_link;
  INSERT INTO screen_calls (id, application_id, screen_link_id, status, ended_at) VALUES (gen_random_uuid(), v_app, v_link, 'completed', now() - interval '15 days') RETURNING id INTO v_call;
  INSERT INTO screen_answers (screen_call_id, question_id, answer_text, score, ai_reasoning, order_index) VALUES
    (v_call, q1, 'Money.', 22, 'Single word. Technically an answer.', 1),
    (v_call, q2, 'Monday and Tuesday. Mornings.', null, null, 2),
    (v_call, q3, 'Sure.', 25, 'One word. Zero elaboration.', 3),
    (v_call, q4, 'Yeah.', 28, 'One word.', 4),
    (v_call, q5, 'It''s fine.', 20, 'Two words.', 5),
    (v_call, q6, 'I deal.', 22, 'Two words.', 6),
    (v_call, q7, 'Whatever.', 30, 'One word with a slightly dismissive tone.', 7);
  INSERT INTO screen_results (application_id, passed, qualitative_summary, manager_briefing, scores_json, total_score, threshold_at_time, notified_at) VALUES
    (v_app, false, 'Near-zero engagement throughout. May have been distracted, uninterested, or simply not prepared for a conversational screen. Not enough data to consider.', 'Strengths: Showed up for the call. Concern: Every answer was one to two words. No information available. Suggested question: N/A', '{}', 25, 60, now() - interval '15 days');

  -- ─────────────────────────────────────────────────────────────────────────
  -- 19. Derek Phillips — Score 36 — failed (evasive, defensive)
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO applicants (id, phone, name) VALUES (gen_random_uuid(), '+15550001019', 'Derek Phillips') RETURNING id INTO v_aid;
  INSERT INTO applications (id, applicant_id, company_id, location_id, job_id, question_set_id, availability, has_transportation, status, source, created_at)
    VALUES (gen_random_uuid(), v_aid, v_company_id, v_location_id, v_job_id, v_qs_id, '{"days":["wednesday","thursday"],"shifts":["afternoon"]}'::jsonb, true, 'failed', 'test', now() - interval '12 days') RETURNING id INTO v_app;
  INSERT INTO magic_links (id, type, application_id, token, expires_at, completed_at) VALUES (gen_random_uuid(), 'screen', v_app, 'test-tok-019', now() + interval '1 day', now() - interval '12 days') RETURNING id INTO v_link;
  INSERT INTO screen_calls (id, application_id, screen_link_id, status, ended_at) VALUES (gen_random_uuid(), v_app, v_link, 'completed', now() - interval '12 days') RETURNING id INTO v_call;
  INSERT INTO screen_answers (screen_call_id, question_id, answer_text, score, ai_reasoning, order_index) VALUES
    (v_call, q1, 'I applied to a few places. I''d want to know more about the pay before committing to anything.', 40, 'Transactional framing, leads with compensation demands in an intro answer. Not a strong start.', 1),
    (v_call, q2, 'Wednesday and Thursday afternoons. That''s what I have.', null, null, 2),
    (v_call, q3, 'I guess I''d adapt. I haven''t really thought about it.', 38, 'Low engagement. Has not considered the basic job requirements.', 3),
    (v_call, q4, 'My last manager and I didn''t see eye to eye so I left. Before that I was fine.', 32, 'Doesn''t answer the reliability question, pivots to manager conflict. Significant flag.', 4),
    (v_call, q5, 'Depends on the people. Some people are hard to work with.', 42, 'Conditional teamwork again. Mild blame-external pattern.', 5),
    (v_call, q6, 'I''ve had jobs where management made things hard. That''s usually the issue.', 35, 'Externalizes stress to management. Does not offer a personal coping strategy.', 6),
    (v_call, q7, 'I can be friendly if the situation calls for it.', 38, 'Conditional again. Pattern of conditionality across the interview.', 7);
  INSERT INTO screen_results (application_id, passed, qualitative_summary, manager_briefing, scores_json, total_score, threshold_at_time, notified_at) VALUES
    (v_app, false, 'Consistent pattern of conditionality and external blame. Deflects reliability question to manager conflict, leads with pay demands, and views teamwork as optional. Not a fit.', 'Strengths: Honest about his reservations. Concern: Every answer shifts accountability outward — manager, teammates, "the situation." Not a culture fit. Suggested question: N/A', '{}', 36, 60, now() - interval '12 days');

  -- ─────────────────────────────────────────────────────────────────────────
  -- 20. Monique Davis — Score 45 — failed (contradicts herself, unreliable signals)
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO applicants (id, phone, name) VALUES (gen_random_uuid(), '+15550001020', 'Monique Davis') RETURNING id INTO v_aid;
  INSERT INTO applications (id, applicant_id, company_id, location_id, job_id, question_set_id, availability, has_transportation, status, source, created_at)
    VALUES (gen_random_uuid(), v_aid, v_company_id, v_location_id, v_job_id, v_qs_id, '{"days":["monday","tuesday","wednesday"],"shifts":["morning","afternoon"]}'::jsonb, true, 'failed', 'test', now() - interval '16 days') RETURNING id INTO v_app;
  INSERT INTO magic_links (id, type, application_id, token, expires_at, completed_at) VALUES (gen_random_uuid(), 'screen', v_app, 'test-tok-020', now() + interval '1 day', now() - interval '16 days') RETURNING id INTO v_link;
  INSERT INTO screen_calls (id, application_id, screen_link_id, status, ended_at) VALUES (gen_random_uuid(), v_app, v_link, 'completed', now() - interval '16 days') RETURNING id INTO v_call;
  INSERT INTO screen_answers (screen_call_id, question_id, answer_text, score, ai_reasoning, order_index) VALUES
    (v_call, q1, 'I love working with people and staying active. This seemed perfect for me honestly.', 65, 'Positive opener. Doesn''t match the tone of later answers.', 1),
    (v_call, q2, 'Monday, Tuesday, Wednesday mornings and afternoons.', null, null, 2),
    (v_call, q3, 'I''m an active person, I work out every day. I love being outside.', 55, 'Enthusiasm up front but no specific outdoor work experience to back it.', 3),
    (v_call, q4, 'I''m extremely reliable. My last job I never missed a single day. Well, there were a few days but those were emergencies. And I had to quit because of scheduling conflicts but that wasn''t my fault.', 20, 'Opens with strong claim then immediately undercuts it. "Never missed a day... well a few days" is a textbook contradictory answer. Lowest reliability score.', 4),
    (v_call, q5, 'I love working with people! Teams are the best. Although I can sometimes have trouble if someone on the team isn''t pulling their weight.', 70, 'Enthusiastic but introduces a friction point. Mixed signal.', 5),
    (v_call, q6, 'I deal with stress by talking things through. Sometimes I need to vent a little but then I''m good.', 42, 'Venting instinct in a work context is a mild concern. Functional but not ideal for a fast-paced floor.', 6),
    (v_call, q7, 'I''m great with customers! I worked at a nail salon and the clients loved me.', 60, 'Enthusiasm and a real example. This answer is genuinely good.', 7);
  INSERT INTO screen_results (application_id, passed, qualitative_summary, manager_briefing, scores_json, total_score, threshold_at_time, notified_at) VALUES
    (v_app, false, 'Enthusiastic opener that unravels on reliability — explicitly contradicts her "never missed a day" claim in the same answer. Pattern of overstating and then walking back.', 'Strengths: Genuine customer warmth, active lifestyle. Concern: Self-contradicted reliability claim is a clear warning sign. Good instincts undermined by credibility issues. Suggested question: Walk me through exactly why you left your last job.', '{}', 45, 60, now() - interval '16 days');

END $$;
