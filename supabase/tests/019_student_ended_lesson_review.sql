begin;

create extension if not exists pgtap with schema extensions;
set local role postgres;
set local search_path = public, extensions;
select extensions.plan(23);

insert into auth.users (id, instance_id, aud, role, encrypted_password, email, created_at, updated_at, is_anonymous)
values
  ('b9100000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', 'phase9-teacher@minclass.test', now(), now(), false),
  ('b9100000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', null, now(), now(), true),
  ('b9100000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', null, now(), now(), true),
  ('b9100000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', null, now(), now(), true);

insert into public.subjects (id, teacher_id, name, code)
values ('b9110000-0000-0000-0000-000000000001', 'b9100000-0000-0000-0000-000000000001', 'Phase 9 Subject', 'P9');

insert into public.course_sections (id, subject_id, section_code)
values ('b9120000-0000-0000-0000-000000000001', 'b9110000-0000-0000-0000-000000000001', 'PHASE9');

insert into public.course_section_students (course_section_id, mssv)
values
  ('b9120000-0000-0000-0000-000000000001', '23110001'),
  ('b9120000-0000-0000-0000-000000000001', '23110002');

insert into public.lessons (id, room_id, course_section_id, title, markdown_source)
values ('b9130000-0000-0000-0000-000000000001', null, 'b9120000-0000-0000-0000-000000000001', 'Ended Lesson Review', '# Review');

insert into public.sections (id, lesson_id, position, type, title, content_md)
values
  ('b9140000-0000-0000-0000-000000000001', 'b9130000-0000-0000-0000-000000000001', 0, 'CONTENT', 'Released content', 'First content'),
  ('b9140000-0000-0000-0000-000000000002', 'b9130000-0000-0000-0000-000000000001', 1, 'QUIZ', 'Review Quiz', ''),
  ('b9140000-0000-0000-0000-000000000003', 'b9130000-0000-0000-0000-000000000001', 2, 'CONTENT', 'Previously unreleased content', 'All sections are visible after End');

insert into public.rooms (id, code, teacher_user_id, title, status, teaching_section, released_through, started_at, lesson_id)
values ('b9150000-0000-0000-0000-000000000001', 'P9A234', 'b9100000-0000-0000-0000-000000000001', 'Ended Lesson Review', 'ACTIVE', 1, 1, now() - interval '2 hours', 'b9130000-0000-0000-0000-000000000001');

insert into public.session_attendance (session_id, mssv, joined_at)
values
  ('b9150000-0000-0000-0000-000000000001', '23110001', now() - interval '110 minutes'),
  ('b9150000-0000-0000-0000-000000000001', '23110002', null);

insert into public.participants (id, room_id, user_id, mssv, joined_at)
values ('b9160000-0000-0000-0000-000000000001', 'b9150000-0000-0000-0000-000000000001', 'b9100000-0000-0000-0000-000000000002', '23110001', now() - interval '110 minutes');

insert into public.quizzes (id, section_id, title)
values ('b9170000-0000-0000-0000-000000000001', 'b9140000-0000-0000-0000-000000000002', 'TCP Quiz');

insert into public.quiz_questions (id, quiz_id, position, type, question_text)
values ('b9180000-0000-0000-0000-000000000001', 'b9170000-0000-0000-0000-000000000001', 0, 'SINGLE_CHOICE', 'Server trả lời SYN bằng gì?');

insert into public.quiz_options (id, question_id, position, content)
values
  ('b9190000-0000-0000-0000-000000000001', 'b9180000-0000-0000-0000-000000000001', 0, 'ACK'),
  ('b9190000-0000-0000-0000-000000000002', 'b9180000-0000-0000-0000-000000000001', 1, 'SYN-ACK');

insert into public.quiz_answer_keys (question_id, correct_option_ids)
values ('b9180000-0000-0000-0000-000000000001', array['b9190000-0000-0000-0000-000000000002'::uuid]);

insert into public.quiz_attempts (id, quiz_id, participant_id, score, total_questions, submitted_at)
values ('b91a0000-0000-0000-0000-000000000001', 'b9170000-0000-0000-0000-000000000001', 'b9160000-0000-0000-0000-000000000001', 0, 1, now() - interval '90 minutes');

insert into public.quiz_answers (attempt_id, question_id, selected_option_ids, is_correct)
values ('b91a0000-0000-0000-0000-000000000001', 'b9180000-0000-0000-0000-000000000001', array['b9190000-0000-0000-0000-000000000001'::uuid], false);

update public.rooms
set status = 'ENDED', ended_at = now() - interval '1 hour'
where id = 'b9150000-0000-0000-0000-000000000001';

-- Prove that historical access uses the Session roster snapshot, not a mutable current roster.
delete from public.course_section_students
where course_section_id = 'b9120000-0000-0000-0000-000000000001'
  and normalized_mssv = '23110002';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b9100000-0000-0000-0000-000000000002","role":"authenticated","is_anonymous":true}', true);

select extensions.is((select count(*) from public.access_ended_lesson_session('b9130000-0000-0000-0000-000000000001', '23110001')), 1::bigint, 'Roster Student can access an ended Lesson');
select extensions.is(public.get_student_ended_lesson_review('b9150000-0000-0000-0000-000000000001')->>'mssv', '23110001', 'Review is scoped to the verified MSSV');
select extensions.is(jsonb_array_length(public.get_student_ended_lesson_review('b9150000-0000-0000-0000-000000000001')->'sections'), 3, 'Review exposes every Lesson Section after End');
select extensions.is(public.get_student_ended_lesson_review('b9150000-0000-0000-0000-000000000001')->'sections'->2->>'contentMd', 'All sections are visible after End', 'A previously unreleased Section is available only in ended Review Mode');
select extensions.is((public.get_student_ended_lesson_review('b9150000-0000-0000-0000-000000000001')->'sections'->1->'quiz'->'questions'->0->'options'->1->>'isCorrect')::boolean, true, 'Correct answer is exposed after End');
select extensions.is((public.get_student_ended_lesson_review('b9150000-0000-0000-0000-000000000001')->'sections'->1->'quiz'->'questions'->0->'options'->0->>'isSelected')::boolean, true, 'Student own selected answer is returned');
select extensions.is((public.get_student_ended_lesson_review('b9150000-0000-0000-0000-000000000001')->'sections'->1->'quiz'->'questions'->0->>'isCorrect')::boolean, false, 'Student own answer is marked incorrect');
select extensions.is((public.get_student_ended_lesson_review('b9150000-0000-0000-0000-000000000001')->'sections'->1->'quiz'->'attempt'->>'score')::integer, 0, 'Student own attempt score is returned');
select extensions.is((select count(*) from public.quiz_answer_keys where question_id = 'b9180000-0000-0000-0000-000000000001'), 0::bigint, 'Answer-key table remains inaccessible directly');
select extensions.throws_ok($$select * from public.set_section_reaction('b9140000-0000-0000-0000-000000000001', 'UNDERSTAND')$$, '42501', 'Section is not available for interaction.', 'Ended Review cannot change reactions');
select extensions.throws_ok($$select * from public.create_section_comment('b9140000-0000-0000-0000-000000000001', 'Late comment', false)$$, '42501', 'Section is not available for interaction.', 'Ended Review cannot add comments');
select extensions.throws_ok(
  $$select * from public.submit_session_quiz('b9150000-0000-0000-0000-000000000001', 'b9170000-0000-0000-0000-000000000001', '[{"question_id":"b9180000-0000-0000-0000-000000000001","selected_option_ids":["b9190000-0000-0000-0000-000000000002"]}]'::jsonb)$$,
  '42501',
  'Quiz is not available.',
  'Ended Review cannot submit Quiz again'
);
select extensions.throws_ok($$update public.session_attendance set joined_at = now() where session_id = 'b9150000-0000-0000-0000-000000000001' and mssv = '23110002'$$, '42501', 'permission denied for table session_attendance', 'Ended Review cannot change attendance');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b9100000-0000-0000-0000-000000000003","role":"authenticated","is_anonymous":true}', true);

select extensions.is((select count(*) from public.access_ended_lesson_session('b9130000-0000-0000-0000-000000000001', '23110002')), 1::bigint, 'Non-attendee from the Session roster snapshot can review');
select extensions.is(public.get_student_ended_lesson_review('b9150000-0000-0000-0000-000000000001')->'sections'->1->'quiz'->'attempt', 'null'::jsonb, 'Non-attendee review has no Quiz attempt');
select extensions.is((public.get_student_ended_lesson_review('b9150000-0000-0000-0000-000000000001')->'sections'->1->'quiz'->'questions'->0->'options'->1->>'isCorrect')::boolean, true, 'Non-attendee roster Student still sees correct answers');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b9100000-0000-0000-0000-000000000004","role":"authenticated","is_anonymous":true}', true);
select extensions.is((select count(*) from public.access_ended_lesson_session('b9130000-0000-0000-0000-000000000001', '23110001')), 1::bigint, 'Another browser can review with a roster MSSV');
select extensions.is(public.get_student_ended_lesson_review('b9150000-0000-0000-0000-000000000001')->'sections'->1->'quiz'->'attempt', 'null'::jsonb, 'A roster MSSV alone does not expose another browser Quiz attempt');
select extensions.throws_ok($$select * from public.access_ended_lesson_session('b9130000-0000-0000-0000-000000000001', '99999999')$$, '42501', 'Lesson access denied.', 'Non-roster MSSV is denied without roster enumeration details');

set local role postgres;
insert into public.rooms (id, code, teacher_user_id, title, status, teaching_section, released_through, started_at, lesson_id)
values ('b9150000-0000-0000-0000-000000000002', 'P9B234', 'b9100000-0000-0000-0000-000000000001', 'Live Lesson', 'ACTIVE', 0, 0, now(), 'b9130000-0000-0000-0000-000000000001');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b9100000-0000-0000-0000-000000000002","role":"authenticated","is_anonymous":true}', true);
select extensions.throws_ok($$select public.get_student_ended_lesson_review('b9150000-0000-0000-0000-000000000001')$$, '42501', 'Lesson review is not available.', 'Existing ended Review is blocked while the same Lesson is LIVE');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b9100000-0000-0000-0000-000000000004","role":"authenticated","is_anonymous":true}', true);
select extensions.throws_ok($$select * from public.access_ended_lesson_session('b9130000-0000-0000-0000-000000000001', '23110001')$$, '42501', 'Lesson access denied.', 'A new ended Review grant cannot be created while the Lesson is LIVE');
select extensions.is((select count(*) from public.quiz_answer_keys where question_id = 'b9180000-0000-0000-0000-000000000001'), 0::bigint, 'Answer-key table remains inaccessible during LIVE');
select extensions.throws_ok($$select public.get_session_student_quiz_snapshot('b9150000-0000-0000-0000-000000000002', 'b9140000-0000-0000-0000-000000000002')$$, '42501', 'Quiz is not available.', 'LIVE Quiz snapshot does not expose answers to a non-participant');

select * from extensions.finish();
rollback;
