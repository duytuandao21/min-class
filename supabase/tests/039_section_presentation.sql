-- Transactional integration checks; emits TAP without requiring pgTAP.
begin;
select '1..6';

insert into auth.users (id, instance_id, aud, role, encrypted_password, email, created_at, updated_at, is_anonymous)
values
 ('f9000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', 'thaybao@minclass.local', now(), now(), false),
 ('f9000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', null, now(), now(), true),
 ('f9000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', null, now(), now(), true),
 ('f9000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', null, now(), now(), true);
insert into public.subjects (id, teacher_id, name)
values ('f9100000-0000-4000-8000-000000000001', 'f9000000-0000-4000-8000-000000000001', 'Presentation');
insert into public.course_sections (id, subject_id, section_code)
values ('f9200000-0000-4000-8000-000000000001', 'f9100000-0000-4000-8000-000000000001', 'PRESENT01');
insert into public.chapters (id, course_section_id, name)
values ('f9300000-0000-4000-8000-000000000001', 'f9200000-0000-4000-8000-000000000001', 'Presentation');
insert into public.lessons (id, course_section_id, chapter_id, title, markdown_source, created_at)
values
 ('f9400000-0000-4000-8000-000000000001', 'f9200000-0000-4000-8000-000000000001', 'f9300000-0000-4000-8000-000000000001', 'Lesson A', '# A', now()-interval '1 minute'),
 ('f9400000-0000-4000-8000-000000000002', 'f9200000-0000-4000-8000-000000000001', 'f9300000-0000-4000-8000-000000000001', 'Lesson B', '# B', now());
insert into public.sections (id, lesson_id, position, type, title, content_md)
values
 ('f9500000-0000-4000-8000-000000000001', 'f9400000-0000-4000-8000-000000000001', 0, 'CONTENT', 'First', 'First'),
 ('f9500000-0000-4000-8000-000000000002', 'f9400000-0000-4000-8000-000000000001', 2, 'CONTENT', 'Second', 'Second'),
 ('f9500000-0000-4000-8000-000000000003', 'f9400000-0000-4000-8000-000000000001', 5, 'QUIZ', 'Quiz', ''),
 ('f9500000-0000-4000-8000-000000000004', 'f9400000-0000-4000-8000-000000000001', 8, 'CONTENT', 'Future', 'Secret future'),
 ('f9500000-0000-4000-8000-000000000005', 'f9400000-0000-4000-8000-000000000002', 0, 'CONTENT', 'Other Lesson', 'Other');
insert into public.quizzes (id, section_id, title)
values ('f9600000-0000-4000-8000-000000000001', 'f9500000-0000-4000-8000-000000000003', 'Quiz');
insert into public.quiz_questions (id, quiz_id, position, type, question_text)
values ('f9700000-0000-4000-8000-000000000001', 'f9600000-0000-4000-8000-000000000001', 0, 'SINGLE_CHOICE', 'Question');
insert into public.quiz_options (id, question_id, position, content)
values ('f9800000-0000-4000-8000-000000000001', 'f9700000-0000-4000-8000-000000000001', 0, 'Correct'),
       ('f9800000-0000-4000-8000-000000000002', 'f9700000-0000-4000-8000-000000000001', 1, 'Incorrect');
insert into public.quiz_answer_keys (question_id, correct_option_ids)
values ('f9700000-0000-4000-8000-000000000001', array['f9800000-0000-4000-8000-000000000001']::uuid[]);
insert into public.course_section_students (course_section_id, mssv)
values ('f9200000-0000-4000-8000-000000000001', 'SV001');

do $$ begin
  assert not has_function_privilege('anon', 'public.present_session_lesson_section(uuid,uuid,integer)', 'EXECUTE');
  assert not has_function_privilege('anon', 'public.get_student_session_lesson_flow_snapshot(uuid,uuid)', 'EXECUTE');
  assert not has_column_privilege('authenticated', 'public.session_lessons', 'teaching_section', 'UPDATE');
  assert (select relrowsecurity from pg_class where oid = 'public.quiz_answer_keys'::regclass);
end $$;
select 'ok 1 - presentation and answer keys are guarded';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f9000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false,"email":"thaybao@minclass.local"}', true);
select set_config('test.presentation_room', session_id::text, true)
from public.start_chapter_session('f9200000-0000-4000-8000-000000000001', 'f9300000-0000-4000-8000-000000000001');
do $$ declare r uuid := current_setting('test.presentation_room')::uuid; l uuid := 'f9400000-0000-4000-8000-000000000001'; begin
  perform public.release_session_lesson_section(r, l);
  perform public.release_session_lesson_section(r, l);
  perform public.present_session_lesson_section(r, l, 0);
  assert (select teaching_section = 0 and released_through = 5 and presentation_revision = 3
    from public.session_lessons where session_id = r and lesson_id = l), 'Backward presentation preserves frontier';
  assert (select teaching_section = 0 and released_through = 5 from public.rooms where id = r), 'Legacy room remains compatible';
  perform public.release_session_lesson_section(r, l);
  assert (select teaching_section = 2 and released_through = 5 from public.session_lessons where session_id = r and lesson_id = l), 'Advance after back never shrinks frontier';
  perform public.present_session_lesson_section(r, l, 2);
  assert (select presentation_revision = 5 from public.session_lessons where session_id = r and lesson_id = l), 'Same-target command increments revision';
  assert (select teaching_section = 0 and released_through = 0 and presentation_revision = 0
    from public.session_lessons where session_id = r and lesson_id <> l), 'Other Lesson is unaffected';
  begin perform public.present_session_lesson_section(r, l, 8); raise exception 'Future section allowed'; exception when sqlstate '22023' then null; end;
  begin perform public.present_session_lesson_section(r, l, 1); raise exception 'Missing section allowed'; exception when sqlstate '22023' then null; end;
  begin perform public.present_session_lesson_section(r, l, -1); raise exception 'Negative position allowed'; exception when sqlstate '22023' then null; end;
  begin perform public.present_session_lesson_section(r, l, null); raise exception 'NULL position allowed'; exception when sqlstate '22023' then null; end;
  begin perform public.present_session_lesson_section(r, 'f9400000-0000-4000-8000-999999999999', 0); raise exception 'Foreign Lesson allowed'; exception when insufficient_privilege then null; end;
end $$;
select 'ok 2 - backward, forward, repeated and invalid commands preserve progress';

select set_config('request.jwt.claims', '{"sub":"f9000000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":true}', true);
select * from public.join_live_chapter_session(current_setting('test.presentation_room')::uuid, 'SV001');
select * from public.set_section_reaction('f9500000-0000-4000-8000-000000000001', 'UNDERSTAND');
select * from public.create_section_comment('f9500000-0000-4000-8000-000000000001', 'Preserve comment', true);
select * from public.submit_session_quiz(current_setting('test.presentation_room')::uuid, 'f9600000-0000-4000-8000-000000000001',
  '[{"question_id":"f9700000-0000-4000-8000-000000000001","selected_option_ids":["f9800000-0000-4000-8000-000000000001"]}]');
select set_config('request.jwt.claims', '{"sub":"f9000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false,"email":"thaybao@minclass.local"}', true);
select * from public.present_session_lesson_section(current_setting('test.presentation_room')::uuid, 'f9400000-0000-4000-8000-000000000001', 0);
select set_config('request.jwt.claims', '{"sub":"f9000000-0000-4000-8000-000000000003","role":"authenticated","is_anonymous":true}', true);
select * from public.join_live_chapter_session(current_setting('test.presentation_room')::uuid, 'SV001');
do $$ declare r uuid := current_setting('test.presentation_room')::uuid; l uuid := 'f9400000-0000-4000-8000-000000000001'; begin
  assert (select count(*) = 3 and bool_and(teaching_section = 0 and released_through = 5 and presentation_revision = 6)
    from public.get_student_session_lesson_flow_snapshot(r, l)), 'Second device gets pointer/revision without future content';
  assert (select count(*) = 3 from public.get_student_session_lesson_snapshot(r, l)), 'Old snapshot contract still works';
  assert (select count(*) = 0 from public.quiz_answer_keys), 'RLS hides direct answer keys';
  assert (public.get_session_student_quiz_snapshot(r, 'f9500000-0000-4000-8000-000000000003')->'attempt'->>'score')::integer = 1, 'Submitted quiz survives';
  begin perform public.present_session_lesson_section(r, l, 0); raise exception 'Student can present'; exception when insufficient_privilege then null; end;
  begin perform public.release_session_lesson_section(r, l); raise exception 'Student can release'; exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
  assert (select count(*) = 1 from public.section_reactions where section_id = 'f9500000-0000-4000-8000-000000000001');
  assert (select count(*) = 1 from public.section_comments where body = 'Preserve comment');
  assert (select count(*) = 1 from public.quiz_attempts where quiz_id = 'f9600000-0000-4000-8000-000000000001');
  assert (select count(*) = 1 from public.session_attendance where session_id = current_setting('test.presentation_room')::uuid and joined_at is not null);
end $$;
select 'ok 3 - multi-device snapshots, quiz, feedback and attendance survive navigation';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f9000000-0000-4000-8000-000000000004","role":"authenticated","is_anonymous":true}', true);
do $$ declare r uuid := current_setting('test.presentation_room')::uuid; l uuid := 'f9400000-0000-4000-8000-000000000001'; begin
  begin perform public.get_student_session_lesson_flow_snapshot(r, l); raise exception 'Outsider can read snapshot'; exception when insufficient_privilege then null; end;
  begin perform public.present_session_lesson_section(r, l, 0); raise exception 'Outsider can present'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims', '{"sub":"f9000000-0000-4000-8000-000000000004","role":"authenticated","is_anonymous":false,"email":"thaybao@minclass.local"}', true);
do $$ begin
  begin
    perform public.present_session_lesson_section(current_setting('test.presentation_room')::uuid, 'f9400000-0000-4000-8000-000000000001', 0);
    raise exception 'Non-owner Teacher can present';
  exception when insufficient_privilege then null; end;
end $$;
select 'ok 4 - outsider and non-owner Teacher access denied';

select set_config('request.jwt.claims', '{"sub":"f9000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false,"email":"thaybao@minclass.local"}', true);
select public.release_entire_chapter(current_setting('test.presentation_room')::uuid);
do $$ declare r uuid := current_setting('test.presentation_room')::uuid; l uuid := 'f9400000-0000-4000-8000-000000000001'; begin
  assert (select teaching_section = 8 and released_through = 8 and presentation_revision = 7 from public.session_lessons where session_id = r and lesson_id = l), 'Done chapter bumps revision';
  perform public.present_session_lesson_section(r, l, 2);
  assert (select released_through = 8 from public.session_lessons where session_id = r and lesson_id = l);
end $$;
reset role;
do $$ begin
  begin
    update public.session_lessons set released_through = 0 where session_id = current_setting('test.presentation_room')::uuid and lesson_id = 'f9400000-0000-4000-8000-000000000001';
    raise exception 'Release frontier can regress';
  exception when check_violation then null; end;
end $$;
select 'ok 5 - Done chapter and database invariant keep all released sections';

set local role authenticated;
select * from public.end_room(current_setting('test.presentation_room')::uuid);
do $$ declare r uuid := current_setting('test.presentation_room')::uuid; l uuid := 'f9400000-0000-4000-8000-000000000001'; begin
  begin perform public.present_session_lesson_section(r, l, 0); raise exception 'Ended Session can present'; exception when insufficient_privilege then null; end;
  begin perform public.release_session_lesson_section(r, l); raise exception 'Ended Session can release'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims', '{"sub":"f9000000-0000-4000-8000-000000000003","role":"authenticated","is_anonymous":true}', true);
do $$ begin
  assert (select count(*) = 4 and bool_and(room_status = 'ENDED') from public.get_student_session_lesson_flow_snapshot(current_setting('test.presentation_room')::uuid, 'f9400000-0000-4000-8000-000000000001'));
end $$;
select 'ok 6 - ended sessions remain read-only and reviewable';
rollback;
