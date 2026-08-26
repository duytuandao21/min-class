begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(28);

insert into auth.users (id, instance_id, aud, role, encrypted_password, created_at, updated_at, is_anonymous)
values
  ('16000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', now(), now(), false),
  ('16000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', now(), now(), false),
  ('26000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', now(), now(), true),
  ('26000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', now(), now(), true);

insert into public.rooms (id, code, teacher_user_id, title, status, teaching_section, released_through, started_at)
values (
  '36000000-0000-0000-0000-000000000001',
  'QAZ234',
  '16000000-0000-0000-0000-000000000001',
  'Quiz Room',
  'ACTIVE',
  0,
  0,
  now()
);

insert into public.lessons (id, room_id, title, markdown_source)
values ('46000000-0000-0000-0000-000000000001', '36000000-0000-0000-0000-000000000001', 'Quiz Lesson', '# Quiz');

insert into public.sections (id, lesson_id, position, type, title, content_md)
values
  ('56000000-0000-0000-0000-000000000001', '46000000-0000-0000-0000-000000000001', 0, 'QUIZ', 'Released Quiz', ''),
  ('56000000-0000-0000-0000-000000000002', '46000000-0000-0000-0000-000000000001', 1, 'QUIZ', 'Future Quiz', '');

insert into public.participants (id, room_id, user_id, mssv)
values
  ('66000000-0000-0000-0000-000000000001', '36000000-0000-0000-0000-000000000001', '26000000-0000-0000-0000-000000000001', 'SVQUIZ01'),
  ('66000000-0000-0000-0000-000000000002', '36000000-0000-0000-0000-000000000001', '26000000-0000-0000-0000-000000000002', 'SVQUIZ02');

insert into public.quizzes (id, section_id, title)
values
  ('61000000-0000-0000-0000-000000000001', '56000000-0000-0000-0000-000000000001', 'Released Quiz'),
  ('61000000-0000-0000-0000-000000000002', '56000000-0000-0000-0000-000000000002', 'Future Quiz');

insert into public.quiz_questions (id, quiz_id, position, type, question_text)
values
  ('71000000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000001', 0, 'SINGLE_CHOICE', 'Single choice'),
  ('71000000-0000-0000-0000-000000000002', '61000000-0000-0000-0000-000000000001', 1, 'MULTIPLE_CHOICE', 'Multiple choice'),
  ('71000000-0000-0000-0000-000000000003', '61000000-0000-0000-0000-000000000001', 2, 'TRUE_FALSE', 'True or false'),
  ('71000000-0000-0000-0000-000000000004', '61000000-0000-0000-0000-000000000002', 0, 'SINGLE_CHOICE', 'Future question');

insert into public.quiz_options (id, question_id, position, content)
values
  ('81000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', 0, 'Single correct'),
  ('81000000-0000-0000-0000-000000000002', '71000000-0000-0000-0000-000000000001', 1, 'Single wrong'),
  ('81000000-0000-0000-0000-000000000003', '71000000-0000-0000-0000-000000000002', 0, 'Multiple correct A'),
  ('81000000-0000-0000-0000-000000000004', '71000000-0000-0000-0000-000000000002', 1, 'Multiple wrong'),
  ('81000000-0000-0000-0000-000000000005', '71000000-0000-0000-0000-000000000002', 2, 'Multiple correct B'),
  ('81000000-0000-0000-0000-000000000006', '71000000-0000-0000-0000-000000000003', 0, 'True'),
  ('81000000-0000-0000-0000-000000000007', '71000000-0000-0000-0000-000000000003', 1, 'False'),
  ('81000000-0000-0000-0000-000000000008', '71000000-0000-0000-0000-000000000004', 0, 'Future correct'),
  ('81000000-0000-0000-0000-000000000009', '71000000-0000-0000-0000-000000000004', 1, 'Future wrong');

insert into public.quiz_answer_keys (question_id, correct_option_ids)
values
  ('71000000-0000-0000-0000-000000000001', array['81000000-0000-0000-0000-000000000001'::uuid]),
  ('71000000-0000-0000-0000-000000000002', array['81000000-0000-0000-0000-000000000003'::uuid, '81000000-0000-0000-0000-000000000005'::uuid]),
  ('71000000-0000-0000-0000-000000000003', array['81000000-0000-0000-0000-000000000006'::uuid]),
  ('71000000-0000-0000-0000-000000000004', array['81000000-0000-0000-0000-000000000008'::uuid]);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"26000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select is((select count(*) from public.quiz_answer_keys), 0::bigint, 'Student cannot read answer keys before submit');
select is((select count(*) from public.quizzes), 1::bigint, 'Student can read only released Quiz');
select is((select count(*) from public.quiz_questions), 3::bigint, 'Student can read only questions from released Quiz');
select is(jsonb_array_length(public.get_student_quiz_snapshot('56000000-0000-0000-0000-000000000001')->'questions'), 3, 'Released Quiz snapshot contains all questions');
select ok(not jsonb_path_exists(public.get_student_quiz_snapshot('56000000-0000-0000-0000-000000000001'), '$.**.correctOptionIds'), 'Student Quiz snapshot contains no answer key');
select ok(
  not jsonb_path_exists(
    public.get_session_student_quiz_snapshot(
      '36000000-0000-0000-0000-000000000001',
      '56000000-0000-0000-0000-000000000001'
    ),
    '$.**.correctOptionIds'
  ),
  'Session Quiz snapshot contains no answer key before submit'
);

select throws_ok(
  $$select public.get_student_quiz_snapshot('56000000-0000-0000-0000-000000000002')$$,
  '42501',
  'Quiz is not available.',
  'Unreleased Quiz snapshot is inaccessible'
);

select throws_ok(
  $$select * from public.submit_quiz('61000000-0000-0000-0000-000000000002', '[{"question_id":"71000000-0000-0000-0000-000000000004","selected_option_ids":["81000000-0000-0000-0000-000000000008"]}]'::jsonb)$$,
  '42501',
  'Quiz is not available.',
  'Unreleased Quiz cannot be submitted'
);

select lives_ok(
  $$select * from public.submit_quiz('61000000-0000-0000-0000-000000000001', '[{"question_id":"71000000-0000-0000-0000-000000000001","selected_option_ids":["81000000-0000-0000-0000-000000000001"]},{"question_id":"71000000-0000-0000-0000-000000000002","selected_option_ids":["81000000-0000-0000-0000-000000000003","81000000-0000-0000-0000-000000000005"]},{"question_id":"71000000-0000-0000-0000-000000000003","selected_option_ids":["81000000-0000-0000-0000-000000000006"]}]'::jsonb)$$,
  'Student can submit all supported question types'
);

select is((select score from public.quiz_attempts), 3, 'Server calculates the correct score from private keys');
select is((select total_questions from public.quiz_attempts), 3, 'Server records the question total');
select is((select count(*) from public.quiz_answers), 3::bigint, 'Server records one answer per question');
select is(
  jsonb_array_length(
    public.get_session_student_quiz_snapshot(
      '36000000-0000-0000-0000-000000000001',
      '56000000-0000-0000-0000-000000000001'
    )->'attempt'->'answers'
  ),
  3,
  'Submitted Student receives review for every own answer'
);
select is(
  public.get_session_student_quiz_snapshot(
    '36000000-0000-0000-0000-000000000001',
    '56000000-0000-0000-0000-000000000001'
  )->'attempt'->'answers'->0->'correctOptionIds'->>0,
  '81000000-0000-0000-0000-000000000001',
  'Submitted Student receives the correct answer after submit'
);
select ok((select is_correct from public.quiz_answers where question_id = '71000000-0000-0000-0000-000000000001'), 'SINGLE_CHOICE is scored correctly');
select ok((select is_correct from public.quiz_answers where question_id = '71000000-0000-0000-0000-000000000002'), 'MULTIPLE_CHOICE is scored correctly');
select ok((select is_correct from public.quiz_answers where question_id = '71000000-0000-0000-0000-000000000003'), 'TRUE_FALSE is scored correctly');

select throws_ok(
  $$select * from public.submit_quiz('61000000-0000-0000-0000-000000000001', '[{"question_id":"71000000-0000-0000-0000-000000000001","selected_option_ids":["81000000-0000-0000-0000-000000000001"]},{"question_id":"71000000-0000-0000-0000-000000000002","selected_option_ids":["81000000-0000-0000-0000-000000000003","81000000-0000-0000-0000-000000000005"]},{"question_id":"71000000-0000-0000-0000-000000000003","selected_option_ids":["81000000-0000-0000-0000-000000000006"]}]'::jsonb)$$,
  '23505',
  'Quiz has already been submitted.',
  'Double submit is rejected'
);

select is((select count(*) from public.quiz_attempts), 1::bigint, 'Double submit does not create another attempt');
select is((select count(*) from public.room_feedback_events), 0::bigint, 'Student cannot read Quiz realtime events');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"16000000-0000-0000-0000-000000000001","role":"authenticated","is_anonymous":false,"email":"thaybao@minclass.local"}', true);

select is((public.get_teacher_quiz_analytics('36000000-0000-0000-0000-000000000001')->'quizzes'->0->>'submittedCount')::integer, 1, 'Teacher sees submitted Student count');
select is((public.get_teacher_quiz_analytics('36000000-0000-0000-0000-000000000001')->'quizzes'->0->>'participantCount')::integer, 2, 'Teacher analytics includes participant count');
select is((public.get_teacher_quiz_analytics('36000000-0000-0000-0000-000000000001')->'quizzes'->0->>'completionRate')::numeric, 50.00, 'Teacher sees completion rate');
select is((public.get_teacher_quiz_analytics('36000000-0000-0000-0000-000000000001')->'quizzes'->0->>'averageScore')::numeric, 3.00, 'Teacher sees average score');
select is((select count(*) from jsonb_array_elements(public.get_teacher_quiz_analytics('36000000-0000-0000-0000-000000000001')->'quizzes'->0->'questions') question where (question->>'correctPercentage')::numeric = 100.00), 3::bigint, 'Teacher sees correct percentage for every question');
select is((select sum((option->>'selectionCount')::integer) from jsonb_array_elements(public.get_teacher_quiz_analytics('36000000-0000-0000-0000-000000000001')->'quizzes'->0->'questions'->1->'options') option), 2::bigint, 'Teacher sees MULTIPLE_CHOICE answer distribution');
select is((select count(*) from public.room_feedback_events where kind = 'QUIZ'), 1::bigint, 'Quiz submit emits one Teacher realtime event');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"16000000-0000-0000-0000-000000000002","role":"authenticated","is_anonymous":false,"email":"thaybao@minclass.local"}', true);

select throws_ok(
  $$select public.get_teacher_quiz_analytics('36000000-0000-0000-0000-000000000001')$$,
  '42501',
  'Quiz analytics are not available.',
  'A different Teacher cannot read Quiz analytics'
);

select * from finish();

rollback;
