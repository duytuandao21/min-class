begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(22);

insert into auth.users (id, instance_id, aud, role, encrypted_password, email, created_at, updated_at, is_anonymous)
values
  ('af000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', 'thaybao@minclass.local', now(), now(), false),
  ('cf000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', null, now(), now(), true);

insert into public.subjects (id, teacher_id, name, code)
values ('af100000-0000-0000-0000-000000000001', 'af000000-0000-0000-0000-000000000001', 'Session Subject', 'SESSION');

insert into public.course_sections (id, subject_id, section_code)
values ('af200000-0000-0000-0000-000000000001', 'af100000-0000-0000-0000-000000000001', 'SESSIONA');

insert into public.course_section_students (course_section_id, mssv)
values ('af200000-0000-0000-0000-000000000001', '23110001');

insert into public.lessons (id, room_id, course_section_id, title, markdown_source)
values
  ('af300000-0000-0000-0000-000000000001', null, 'af200000-0000-0000-0000-000000000001', 'Persistent Session Lesson', '# Original immutable source'),
  ('af300000-0000-0000-0000-000000000002', null, 'af200000-0000-0000-0000-000000000001', 'Second Lesson', '# Second source');

insert into public.sections (id, lesson_id, position, type, title, content_md)
values
  ('af400000-0000-0000-0000-000000000001', 'af300000-0000-0000-0000-000000000001', 0, 'CONTENT', 'Content', 'Persistent content'),
  ('af400000-0000-0000-0000-000000000002', 'af300000-0000-0000-0000-000000000001', 1, 'QUIZ', 'Quiz', '');

insert into public.quizzes (id, section_id, title)
values ('af500000-0000-0000-0000-000000000001', 'af400000-0000-0000-0000-000000000002', 'Session Quiz');

insert into public.quiz_questions (id, quiz_id, position, type, question_text)
values ('af600000-0000-0000-0000-000000000001', 'af500000-0000-0000-0000-000000000001', 0, 'SINGLE_CHOICE', 'Correct option?');

insert into public.quiz_options (id, question_id, position, content)
values
  ('af700000-0000-0000-0000-000000000001', 'af600000-0000-0000-0000-000000000001', 0, 'Correct'),
  ('af700000-0000-0000-0000-000000000002', 'af600000-0000-0000-0000-000000000001', 1, 'Wrong');

insert into public.quiz_answer_keys (question_id, correct_option_ids)
values ('af600000-0000-0000-0000-000000000001', array['af700000-0000-0000-0000-000000000001'::uuid]);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"af000000-0000-0000-0000-000000000001","role":"authenticated","is_anonymous":false,"email":"thaybao@minclass.local"}', true);

select lives_ok(
  $$select * from public.start_lesson_session('af300000-0000-0000-0000-000000000001')$$,
  'Teacher starts a persistent Lesson Session'
);
select ok(
  (select code is null from public.rooms where lesson_id = 'af300000-0000-0000-0000-000000000001'),
  'A Lesson Session is created without a join code'
);
select ok(
  (select status = 'ACTIVE' and started_at is not null from public.rooms where lesson_id = 'af300000-0000-0000-0000-000000000001'),
  'New persistent Session starts LIVE'
);
select is(
  (select markdown_source from public.lessons where id = 'af300000-0000-0000-0000-000000000001'),
  '# Original immutable source'::text,
  'Starting a Session does not change Lesson content'
);
select throws_ok(
  $$select * from public.start_lesson_session('af300000-0000-0000-0000-000000000001')$$,
  '23505', 'Course Section already has a LIVE Lesson Session.',
  'Duplicate LIVE Session for the same Lesson is rejected'
);
select throws_ok(
  $$select * from public.start_lesson_session('af300000-0000-0000-0000-000000000002')$$,
  '23505', 'Course Section already has a LIVE Lesson Session.',
  'Accidental concurrent Session in the same Course Section is rejected'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cf000000-0000-0000-0000-000000000001","role":"authenticated","is_anonymous":true}', true);

select lives_ok(
  $$select * from public.join_live_lesson(
    'af300000-0000-0000-0000-000000000001',
    '23110001'
  )$$,
  'Roster Student joins the correct LIVE Session with MSSV only'
);
select is(
  (select count(*) from public.participants where user_id = 'cf000000-0000-0000-0000-000000000001'),
  1::bigint,
  'Participant is attached to exactly one Lesson Session'
);
select lives_ok(
  $$select * from public.join_live_lesson(
    'af300000-0000-0000-0000-000000000001',
    '23110001'
  )$$,
  'Retrying the same join is idempotent for the same anonymous Session'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"af000000-0000-0000-0000-000000000001","role":"authenticated","is_anonymous":false,"email":"thaybao@minclass.local"}', true);
select lives_ok(
  $$select * from public.release_section((select id from public.rooms where lesson_id = 'af300000-0000-0000-0000-000000000001' and status = 'ACTIVE'))$$,
  'Teacher releases the next Section using existing flow'
);
select is(
  (select released_through from public.rooms where lesson_id = 'af300000-0000-0000-0000-000000000001' and status = 'ACTIVE'),
  1,
  'Session release position advances'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cf000000-0000-0000-0000-000000000001","role":"authenticated","is_anonymous":true}', true);
select lives_ok(
  $$select * from public.set_section_reaction('af400000-0000-0000-0000-000000000001', 'UNDERSTAND')$$,
  'Reaction is stored for the Session participant'
);
select lives_ok(
  $$select * from public.create_section_comment('af400000-0000-0000-0000-000000000001', 'Session comment', false)$$,
  'Comment is stored for the Session participant'
);
select lives_ok(
  $$select * from public.submit_session_quiz(
    (select id from public.rooms where lesson_id = 'af300000-0000-0000-0000-000000000001' and status = 'ACTIVE'),
    'af500000-0000-0000-0000-000000000001',
    '[{"question_id":"af600000-0000-0000-0000-000000000001","selected_option_ids":["af700000-0000-0000-0000-000000000001"]}]'::jsonb
  )$$,
  'Quiz is submitted against the Lesson Session'
);
select is(
  (select score from public.quiz_attempts join public.participants on participants.id = quiz_attempts.participant_id where participants.user_id = 'cf000000-0000-0000-0000-000000000001'),
  1,
  'Quiz is scored server-side for the Session participant'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"af000000-0000-0000-0000-000000000001","role":"authenticated","is_anonymous":false,"email":"thaybao@minclass.local"}', true);
select lives_ok(
  $$select * from public.end_room((select id from public.rooms where lesson_id = 'af300000-0000-0000-0000-000000000001' and status = 'ACTIVE'))$$,
  'Teacher ends the Lesson Session using existing flow'
);
select ok(
  (select status = 'ENDED' and ended_at is not null from public.rooms where lesson_id = 'af300000-0000-0000-0000-000000000001'),
  'Ended Session persists with ended_at'
);
select is(
  (select count(*) from public.section_reactions join public.participants on participants.id = section_reactions.participant_id where participants.room_id = (select id from public.rooms where lesson_id = 'af300000-0000-0000-0000-000000000001')),
  1::bigint,
  'Reaction remains after End and refresh'
);
select is(
  (select count(*) from public.section_comments join public.participants on participants.id = section_comments.participant_id where participants.room_id = (select id from public.rooms where lesson_id = 'af300000-0000-0000-0000-000000000001')),
  1::bigint,
  'Comment remains after End and refresh'
);
select is(
  (select count(*) from public.quiz_attempts join public.participants on participants.id = quiz_attempts.participant_id where participants.room_id = (select id from public.rooms where lesson_id = 'af300000-0000-0000-0000-000000000001')),
  1::bigint,
  'Quiz Attempt remains after End and refresh'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cf000000-0000-0000-0000-000000000001","role":"authenticated","is_anonymous":true}', true);
select lives_ok(
  $$select * from public.get_student_lesson_snapshot((select id from public.rooms where lesson_id = 'af300000-0000-0000-0000-000000000001'))$$,
  'Student can refresh released Lesson content after End'
);
select throws_ok(
  $$select * from public.join_live_lesson(
    'af300000-0000-0000-0000-000000000001',
    '23110001'
  )$$,
  'P0001', 'Lesson Session is not available.',
  'MSSV-only join is unavailable after Session End'
);

select * from finish();
rollback;
