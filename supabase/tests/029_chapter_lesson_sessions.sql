begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(23);

select has_table('public', 'session_lessons', 'Chapter Session Lesson association exists');
select has_column('public', 'rooms', 'course_section_id', 'Session stores Course Section');
select has_column('public', 'rooms', 'chapter_id', 'Session stores Chapter');

insert into auth.users (id, instance_id, aud, role, encrypted_password, email, created_at, updated_at, is_anonymous)
values
  ('a9000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', 'thaybao@minclass.local', now(), now(), false),
  ('a9000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', 'other@minclass.local', now(), now(), false),
  ('c9000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', null, now(), now(), true),
  ('c9000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', null, now(), now(), true);

insert into public.subjects (id, teacher_id, name, code)
values ('a9100000-0000-4000-8000-000000000001', 'a9000000-0000-4000-8000-000000000001', 'Chapter sessions', 'CHAPTER');
insert into public.course_sections (id, subject_id, section_code)
values ('a9200000-0000-4000-8000-000000000001', 'a9100000-0000-4000-8000-000000000001', 'CHAPTER01');
insert into public.chapters (id, course_section_id, name)
values
  ('a9300000-0000-4000-8000-000000000001', 'a9200000-0000-4000-8000-000000000001', 'Chapter 1'),
  ('a9300000-0000-4000-8000-000000000002', 'a9200000-0000-4000-8000-000000000001', 'Chapter 2');
insert into public.lessons (id, course_section_id, chapter_id, title, markdown_source)
values
  ('a9400000-0000-4000-8000-000000000001', 'a9200000-0000-4000-8000-000000000001', 'a9300000-0000-4000-8000-000000000001', 'Lesson A', '# A'),
  ('a9400000-0000-4000-8000-000000000002', 'a9200000-0000-4000-8000-000000000001', 'a9300000-0000-4000-8000-000000000001', 'Lesson B', '# B'),
  ('a9400000-0000-4000-8000-000000000003', 'a9200000-0000-4000-8000-000000000001', 'a9300000-0000-4000-8000-000000000002', 'Lesson C', '# C');
insert into public.sections (id, lesson_id, position, type, title, content_md)
values
  ('a9500000-0000-4000-8000-000000000001', 'a9400000-0000-4000-8000-000000000001', 0, 'CONTENT', 'A1', 'A1'),
  ('a9500000-0000-4000-8000-000000000002', 'a9400000-0000-4000-8000-000000000001', 1, 'CONTENT', 'A2', 'A2'),
  ('a9500000-0000-4000-8000-000000000003', 'a9400000-0000-4000-8000-000000000002', 0, 'CONTENT', 'B1', 'B1'),
  ('a9500000-0000-4000-8000-000000000004', 'a9400000-0000-4000-8000-000000000002', 1, 'CONTENT', 'B2', 'B2'),
  ('a9500000-0000-4000-8000-000000000005', 'a9400000-0000-4000-8000-000000000003', 0, 'CONTENT', 'C1', 'C1');
insert into public.course_section_students (course_section_id, mssv)
values
  ('a9200000-0000-4000-8000-000000000001', '23162011'),
  ('a9200000-0000-4000-8000-000000000001', '23162012');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a9000000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":false,"email":"other@minclass.local"}', true);
select throws_ok(
  $$select * from public.start_chapter_session('a9200000-0000-4000-8000-000000000001', 'a9300000-0000-4000-8000-000000000001')$$,
  '42501', 'Teacher account required.',
  'Another account cannot start the Teacher Chapter Session'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a9000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false,"email":"thaybao@minclass.local"}', true);
select lives_ok(
  $$select * from public.start_chapter_session('a9200000-0000-4000-8000-000000000001', 'a9300000-0000-4000-8000-000000000001')$$,
  'Teacher starts a Chapter Session'
);
select set_config('test.chapter_session_id', (select id::text from public.rooms where chapter_id = 'a9300000-0000-4000-8000-000000000001'), true);
select is((select count(*) from public.session_lessons where session_id = current_setting('test.chapter_session_id')::uuid), 2::bigint, 'Both Chapter Lessons are LIVE together');
select is((select count(*) from public.session_attendance where session_id = current_setting('test.chapter_session_id')::uuid), 2::bigint, 'Roster is snapshotted once for the Chapter Session');
select throws_ok(
  $$select * from public.start_chapter_session('a9200000-0000-4000-8000-000000000001', 'a9300000-0000-4000-8000-000000000002')$$,
  '23505', 'Course Section already has a LIVE Lesson Session.',
  'A Course Section cannot have two concurrent teaching Sessions'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c9000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":true}', true);
select lives_ok(
  $$select * from public.join_live_lesson('a9400000-0000-4000-8000-000000000002', '23162011')$$,
  'Student can join through any Lesson in the live Chapter'
);
select is((select count(*) from public.participants where room_id = current_setting('test.chapter_session_id')::uuid), 1::bigint, 'Student joins the Session once');
select is((select count(*) from public.get_student_session_lessons(current_setting('test.chapter_session_id')::uuid)), 2::bigint, 'Joined Student can browse both live Lessons');
select lives_ok(
  $$select * from public.join_live_lesson('a9400000-0000-4000-8000-000000000001', '23162011')$$,
  'Opening another Lesson does not ask Student to join again'
);
select is((select count(*) from public.participants where room_id = current_setting('test.chapter_session_id')::uuid), 1::bigint, 'Repeated access remains idempotent');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c9000000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":true}', true);
select throws_ok(
  $$select * from public.join_live_lesson('a9400000-0000-4000-8000-000000000001', '99999999')$$,
  'P0003', 'Student is not in the Course Section.',
  'Student outside the snapshot cannot join'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a9000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false,"email":"thaybao@minclass.local"}', true);
select lives_ok(
  $$select * from public.release_session_lesson_section(current_setting('test.chapter_session_id')::uuid, 'a9400000-0000-4000-8000-000000000002')$$,
  'Teacher advances Lesson B independently'
);
select is((select released_through from public.session_lessons where session_id = current_setting('test.chapter_session_id')::uuid and lesson_id = 'a9400000-0000-4000-8000-000000000001'), 0, 'Lesson A progress does not move');
select is((select released_through from public.session_lessons where session_id = current_setting('test.chapter_session_id')::uuid and lesson_id = 'a9400000-0000-4000-8000-000000000002'), 1, 'Lesson B progress moves to its next Section');
select is(
  (public.get_teacher_course_section_export('a9100000-0000-4000-8000-000000000001', 'a9200000-0000-4000-8000-000000000001')->>'totalClassMeetings')::integer,
  2,
  'The Course Section has two planned Chapter class meetings'
);
select is(
  (
    select (student->>'attendedClassMeetingCount')::integer
    from jsonb_array_elements(public.get_teacher_course_section_export('a9100000-0000-4000-8000-000000000001', 'a9200000-0000-4000-8000-000000000001')->'students') student
    where student->>'mssv' = '23162011'
  ),
  1,
  'Joining a multi-Lesson Chapter Session increments attendance once'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c9000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":true}', true);
select is((select count(*) from public.get_student_session_lesson_snapshot(current_setting('test.chapter_session_id')::uuid, 'a9400000-0000-4000-8000-000000000001')), 1::bigint, 'Student cannot read future Section from Lesson A');
select is((select count(*) from public.get_student_session_lesson_snapshot(current_setting('test.chapter_session_id')::uuid, 'a9400000-0000-4000-8000-000000000002')), 2::bigint, 'Student sees released Sections from Lesson B');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a9000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false,"email":"thaybao@minclass.local"}', true);
select lives_ok($$select * from public.end_room(current_setting('test.chapter_session_id')::uuid)$$, 'Teacher ends the Chapter Session once');
select is((select count(*) from public.session_lessons where session_id = current_setting('test.chapter_session_id')::uuid), 2::bigint, 'Ended Session keeps all Lesson history');

select * from finish();
rollback;
