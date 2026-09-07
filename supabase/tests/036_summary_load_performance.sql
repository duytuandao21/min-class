begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

select has_function('public', 'get_teacher_room_summary_overview', array['uuid'], 'Lightweight Summary overview exists');
select has_function('public', 'get_teacher_room_attendance_detail', array['uuid'], 'Streamed attendance detail exists');
select has_function('public', 'get_teacher_room_summary_lessons', array['uuid'], 'Lightweight Summary Lesson list exists');
select has_function('public', 'get_teacher_room_lesson_summary', array['uuid', 'uuid'], 'Lazy Lesson Summary exists');
select ok(not has_function_privilege('anon', 'public.get_teacher_room_summary_overview(uuid)', 'EXECUTE'), 'Anon cannot execute Teacher Summary overview');
select ok(not has_function_privilege('anon', 'public.get_teacher_room_lesson_summary(uuid,uuid)', 'EXECUTE'), 'Anon cannot execute Lesson Summary');

insert into auth.users (id, instance_id, aud, role, encrypted_password, email, created_at, updated_at, is_anonymous)
values
  ('e6000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', 'thaybao@minclass.local', now(), now(), false),
  ('e6000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', 'other-summary@minclass.local', now(), now(), false),
  ('e6000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', null, now(), now(), true);
insert into public.subjects (id, teacher_id, name) values
  ('e6100000-0000-4000-8000-000000000001', 'e6000000-0000-4000-8000-000000000001', 'Summary performance');
insert into public.course_sections (id, subject_id, section_code) values
  ('e6200000-0000-4000-8000-000000000001', 'e6100000-0000-4000-8000-000000000001', 'SUMMARY01');
insert into public.chapters (id, course_section_id, name) values
  ('e6300000-0000-4000-8000-000000000001', 'e6200000-0000-4000-8000-000000000001', 'Chapter 1');
insert into public.lessons (id, course_section_id, chapter_id, title, markdown_source) values
  ('e6400000-0000-4000-8000-000000000001', 'e6200000-0000-4000-8000-000000000001', 'e6300000-0000-4000-8000-000000000001', 'Lesson 1', '# Lesson');
insert into public.sections (id, lesson_id, position, type, title, content_md) values
  ('e6500000-0000-4000-8000-000000000001', 'e6400000-0000-4000-8000-000000000001', 0, 'QUIZ', 'Quiz section', '');
insert into public.quizzes (id, section_id, title) values
  ('e6600000-0000-4000-8000-000000000001', 'e6500000-0000-4000-8000-000000000001', 'Quiz 1');
insert into public.quiz_questions (id, quiz_id, position, type, question_text) values
  ('e6700000-0000-4000-8000-000000000001', 'e6600000-0000-4000-8000-000000000001', 0, 'SINGLE_CHOICE', 'Question 1');
insert into public.quiz_options (id, question_id, position, content) values
  ('e6800000-0000-4000-8000-000000000001', 'e6700000-0000-4000-8000-000000000001', 0, 'Correct'),
  ('e6800000-0000-4000-8000-000000000002', 'e6700000-0000-4000-8000-000000000001', 1, 'Wrong');
insert into public.quiz_answer_keys (question_id, correct_option_ids) values
  ('e6700000-0000-4000-8000-000000000001', array['e6800000-0000-4000-8000-000000000001'::uuid]);
insert into public.course_section_students (course_section_id, mssv) values
  ('e6200000-0000-4000-8000-000000000001', 'SV001'),
  ('e6200000-0000-4000-8000-000000000001', 'SV002');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e6000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false,"email":"thaybao@minclass.local"}', true);
select lives_ok($$select * from public.start_chapter_session('e6200000-0000-4000-8000-000000000001', 'e6300000-0000-4000-8000-000000000001')$$, 'Teacher starts fixture Session');
select set_config('test.summary_room_id', (select id::text from public.rooms where chapter_id = 'e6300000-0000-4000-8000-000000000001'), true);

reset role;
insert into public.participants (id, room_id, user_id, mssv) values
  ('e6900000-0000-4000-8000-000000000001', current_setting('test.summary_room_id')::uuid, 'e6000000-0000-4000-8000-000000000003', 'SV001');
update public.session_attendance set joined_at = now()
where session_id = current_setting('test.summary_room_id')::uuid and mssv = 'SV001';
insert into public.section_reactions (section_id, participant_id, reaction) values
  ('e6500000-0000-4000-8000-000000000001', 'e6900000-0000-4000-8000-000000000001', 'UNDERSTAND');
insert into public.section_comments (section_id, participant_id, body, is_anonymous) values
  ('e6500000-0000-4000-8000-000000000001', 'e6900000-0000-4000-8000-000000000001', 'Useful', false);
insert into public.quiz_attempts (id, quiz_id, participant_id, score, total_questions) values
  ('e6a00000-0000-4000-8000-000000000001', 'e6600000-0000-4000-8000-000000000001', 'e6900000-0000-4000-8000-000000000001', 1, 1);
insert into public.quiz_answers (attempt_id, question_id, selected_option_ids, is_correct) values
  ('e6a00000-0000-4000-8000-000000000001', 'e6700000-0000-4000-8000-000000000001', array['e6800000-0000-4000-8000-000000000001'::uuid], true);
update public.rooms set status = 'ENDED', ended_at = now()
where id = current_setting('test.summary_room_id')::uuid;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e6000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false,"email":"thaybao@minclass.local"}', true);
select is((public.get_teacher_room_summary_overview(current_setting('test.summary_room_id')::uuid)->'attendance'->>'rosterCount')::integer, 2, 'Overview returns roster count');
select is((public.get_teacher_room_summary_overview(current_setting('test.summary_room_id')::uuid)->'attendance'->>'joinedCount')::integer, 1, 'Overview returns joined count');
select is((public.get_teacher_room_summary_overview(current_setting('test.summary_room_id')::uuid)->'comments'->>'total')::integer, 1, 'Overview returns comment count');
select is(jsonb_array_length(public.get_teacher_room_attendance_detail(current_setting('test.summary_room_id')::uuid)->'absentMssvs'), 1, 'Attendance detail returns absent roster members');
select is(jsonb_array_length(public.get_teacher_room_summary_lessons(current_setting('test.summary_room_id')::uuid)), 1, 'Lesson list is returned independently');
select is((public.get_teacher_room_summary_lessons(current_setting('test.summary_room_id')::uuid)->0->>'quizCount')::integer, 1, 'Lesson list includes lightweight Quiz count');
select is(jsonb_array_length(public.get_teacher_room_lesson_summary(current_setting('test.summary_room_id')::uuid, 'e6400000-0000-4000-8000-000000000001')->'quizzes'), 1, 'Lazy detail returns selected Lesson Quiz only');
select is((public.get_teacher_room_lesson_summary(current_setting('test.summary_room_id')::uuid, 'e6400000-0000-4000-8000-000000000001')->'reactions'->0->>'understand')::integer, 1, 'Lazy detail returns selected Lesson reactions');

select set_config('request.jwt.claims', '{"sub":"e6000000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":false,"email":"other-summary@minclass.local"}', true);
select throws_ok(format($$select public.get_teacher_room_summary_overview(%L::uuid)$$, current_setting('test.summary_room_id')), '42501', 'Room summary is not available.', 'Another Teacher cannot read overview');
select throws_ok(format($$select public.get_teacher_room_lesson_summary(%L::uuid, 'e6400000-0000-4000-8000-000000000001')$$, current_setting('test.summary_room_id')), '42501', 'Lesson summary is not available.', 'Another Teacher cannot read lazy detail');

select * from finish();
rollback;
