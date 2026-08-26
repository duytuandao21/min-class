begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(21);

insert into auth.users (id, instance_id, aud, role, encrypted_password, email, created_at, updated_at, is_anonymous)
values
  ('a8100000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', 'history-teacher-a@minclass.test', now(), now(), false),
  ('a8100000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', 'history-teacher-b@minclass.test', now(), now(), false),
  ('c8100000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', null, now(), now(), true);

insert into public.subjects (id, teacher_id, name, code)
values
  ('a8110000-0000-0000-0000-000000000001', 'a8100000-0000-0000-0000-000000000001', 'History Subject A', 'HISTA'),
  ('a8110000-0000-0000-0000-000000000002', 'a8100000-0000-0000-0000-000000000002', 'History Subject B', 'HISTB');

insert into public.course_sections (id, subject_id, section_code)
values
  ('a8120000-0000-0000-0000-000000000001', 'a8110000-0000-0000-0000-000000000001', 'HISTORYA'),
  ('a8120000-0000-0000-0000-000000000002', 'a8110000-0000-0000-0000-000000000002', 'HISTORYB');

insert into public.lessons (id, room_id, course_section_id, title, markdown_source, created_at, updated_at)
values
  ('a8130000-0000-0000-0000-000000000001', null, 'a8120000-0000-0000-0000-000000000001', 'Historical Lesson A', '# Persisted history content', now() - interval '2 days', now() - interval '2 days'),
  ('a8130000-0000-0000-0000-000000000002', null, 'a8120000-0000-0000-0000-000000000002', 'Historical Lesson B', '# Private Teacher B content', now() - interval '1 day', now() - interval '1 day');

insert into public.sections (id, lesson_id, position, type, title, content_md)
values
  ('a8140000-0000-0000-0000-000000000001', 'a8130000-0000-0000-0000-000000000001', 0, 'CONTENT', 'History Content', 'Persisted content'),
  ('a8140000-0000-0000-0000-000000000002', 'a8130000-0000-0000-0000-000000000001', 1, 'QUIZ', 'History Quiz Section', '');

insert into public.rooms (id, code, teacher_user_id, title, status, teaching_section, released_through, started_at, ended_at, lesson_id)
values
  ('a8150000-0000-0000-0000-000000000001', 'HST234', 'a8100000-0000-0000-0000-000000000001', 'Historical Session A', 'ACTIVE', 1, 1, now() - interval '1 day', null, 'a8130000-0000-0000-0000-000000000001'),
  ('a8150000-0000-0000-0000-000000000002', 'HST235', 'a8100000-0000-0000-0000-000000000002', 'Historical Session B', 'ACTIVE', 0, 0, now() - interval '1 day', null, 'a8130000-0000-0000-0000-000000000002');

insert into public.session_attendance (session_id, mssv, joined_at)
values
  ('a8150000-0000-0000-0000-000000000001', '23110001', now() - interval '1 day'),
  ('a8150000-0000-0000-0000-000000000001', '23110002', null);

insert into public.participants (id, room_id, user_id, mssv, joined_at)
values ('a8160000-0000-0000-0000-000000000001', 'a8150000-0000-0000-0000-000000000001', 'c8100000-0000-0000-0000-000000000001', '23110001', now() - interval '1 day');

insert into public.section_reactions (section_id, participant_id, reaction)
values ('a8140000-0000-0000-0000-000000000001', 'a8160000-0000-0000-0000-000000000001', 'UNDERSTAND');

insert into public.section_comments (section_id, participant_id, body, is_anonymous, created_at)
values
  ('a8140000-0000-0000-0000-000000000001', 'a8160000-0000-0000-0000-000000000001', 'Named historical comment', false, now() - interval '23 hours'),
  ('a8140000-0000-0000-0000-000000000001', 'a8160000-0000-0000-0000-000000000001', 'Anonymous historical comment', true, now() - interval '22 hours');

insert into public.quizzes (id, section_id, title)
values ('a8170000-0000-0000-0000-000000000001', 'a8140000-0000-0000-0000-000000000002', 'Historical Quiz');

insert into public.quiz_questions (id, quiz_id, position, type, question_text)
values ('a8180000-0000-0000-0000-000000000001', 'a8170000-0000-0000-0000-000000000001', 0, 'SINGLE_CHOICE', 'Historical question?');

insert into public.quiz_options (id, question_id, position, content)
values
  ('a8190000-0000-0000-0000-000000000001', 'a8180000-0000-0000-0000-000000000001', 0, 'Correct option'),
  ('a8190000-0000-0000-0000-000000000002', 'a8180000-0000-0000-0000-000000000001', 1, 'Wrong option');

insert into public.quiz_answer_keys (question_id, correct_option_ids)
values ('a8180000-0000-0000-0000-000000000001', array['a8190000-0000-0000-0000-000000000001'::uuid]);

insert into public.quiz_attempts (id, quiz_id, participant_id, score, total_questions, submitted_at)
values ('a81a0000-0000-0000-0000-000000000001', 'a8170000-0000-0000-0000-000000000001', 'a8160000-0000-0000-0000-000000000001', 1, 1, now() - interval '22 hours');

insert into public.quiz_answers (attempt_id, question_id, selected_option_ids, is_correct)
values ('a81a0000-0000-0000-0000-000000000001', 'a8180000-0000-0000-0000-000000000001', array['a8190000-0000-0000-0000-000000000001'::uuid], true);

update public.rooms
set status = 'ENDED', ended_at = now() - interval '21 hours'
where id in (
  'a8150000-0000-0000-0000-000000000001',
  'a8150000-0000-0000-0000-000000000002'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a8100000-0000-0000-0000-000000000001","role":"authenticated","is_anonymous":false,"email":"thaybao@minclass.local"}', true);

select is((select count(*) from public.lessons where id = 'a8130000-0000-0000-0000-000000000001'), 1::bigint, 'Teacher loads their historical Lesson');
select is((select markdown_source from public.lessons where id = 'a8130000-0000-0000-0000-000000000001'), '# Persisted history content', 'Historical Markdown source remains persisted');
select is((select count(*) from public.rooms where lesson_id = 'a8130000-0000-0000-0000-000000000001' and status = 'ENDED'), 1::bigint, 'Teacher loads the ended Session history');
select is((public.get_teacher_session_attendance('a8150000-0000-0000-0000-000000000001')->>'rosterCount')::integer, 2, 'History returns roster snapshot count');
select is((public.get_teacher_session_attendance('a8150000-0000-0000-0000-000000000001')->>'joinedCount')::integer, 1, 'History returns joined count');
select is((public.get_teacher_session_attendance('a8150000-0000-0000-0000-000000000001')->>'absentCount')::integer, 1, 'History returns absent count');
select is((public.get_teacher_room_summary('a8150000-0000-0000-0000-000000000001')->>'participantCount')::integer, 1, 'History returns joined MSSV data');
select is((public.get_teacher_room_summary('a8150000-0000-0000-0000-000000000001')->'reactions'->0->>'understand')::integer, 1, 'History returns reactions by Section');
select is((public.get_teacher_room_summary('a8150000-0000-0000-0000-000000000001')->'comments'->>'total')::integer, 2, 'History returns comments');
select is((public.get_teacher_room_summary('a8150000-0000-0000-0000-000000000001')->'quizzes'->0->>'submittedCount')::integer, 1, 'History returns Quiz submissions');
select is((public.get_teacher_room_summary('a8150000-0000-0000-0000-000000000001')->'quizzes'->0->>'averageScore')::numeric, 1.00, 'History returns average Quiz score');
select is((public.get_teacher_room_summary('a8150000-0000-0000-0000-000000000001')->'quizzes'->0->'questions'->0->>'correctPercentage')::numeric, 100.00, 'History returns correct rate');
select is((public.get_teacher_room_summary('a8150000-0000-0000-0000-000000000001')->'quizzes'->0->'questions'->0->'options'->0->>'selectionCount')::integer, 1, 'History returns answer distribution');
select is(public.get_teacher_class_voices('a8150000-0000-0000-0000-000000000001')->'sections'->0->'comments'->0->>'authorLabel', '23110001', 'Named historical comment shows MSSV');
select is(public.get_teacher_class_voices('a8150000-0000-0000-0000-000000000001')->'sections'->0->'comments'->1->>'authorLabel', 'Anonymous', 'Anonymous historical comment remains masked');
select is(
  public.get_teacher_room_summary('a8150000-0000-0000-0000-000000000001'),
  public.get_teacher_room_summary('a8150000-0000-0000-0000-000000000001'),
  'Historical review survives a repeated refresh query'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a8100000-0000-0000-0000-000000000002","role":"authenticated","is_anonymous":false,"email":"thaybao@minclass.local"}', true);

select is((select count(*) from public.lessons where id = 'a8130000-0000-0000-0000-000000000001'), 0::bigint, 'Teacher B cannot read Teacher A Lesson');
select is((select count(*) from public.rooms where id = 'a8150000-0000-0000-0000-000000000001'), 0::bigint, 'Teacher B cannot read Teacher A Session history');
select throws_ok($$select public.get_teacher_room_summary('a8150000-0000-0000-0000-000000000001')$$, '42501', 'Room summary is not available.', 'Teacher B cannot load Teacher A Summary');
select throws_ok($$select public.get_teacher_class_voices('a8150000-0000-0000-0000-000000000001')$$, '42501', 'Class Voices are not available.', 'Teacher B cannot load Teacher A Class Voices');
select throws_ok($$select public.get_teacher_session_attendance('a8150000-0000-0000-0000-000000000001')$$, '42501', 'Session attendance is not available.', 'Teacher B cannot load Teacher A attendance history');

select * from finish();
rollback;
