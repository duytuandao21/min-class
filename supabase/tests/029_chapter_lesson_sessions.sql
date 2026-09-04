begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(52);

select has_table('public', 'session_lessons', 'Chapter Session Lesson association exists');
select has_column('public', 'rooms', 'course_section_id', 'Session stores Course Section');
select has_column('public', 'rooms', 'chapter_id', 'Session stores Chapter');
select has_function('public', 'release_entire_chapter', array['uuid'], 'Release entire Chapter function exists');
select ok(
  has_function_privilege('authenticated', 'public.release_entire_chapter(uuid)', 'EXECUTE'),
  'Authenticated users can invoke the guarded Chapter release RPC'
);
select ok(
  not has_function_privilege('anon', 'public.release_entire_chapter(uuid)', 'EXECUTE'),
  'Unauthenticated clients cannot invoke the Chapter release RPC'
);
select has_function(
  'public',
  'delete_course_section_chapter',
  array['uuid', 'uuid', 'uuid'],
  'Course Section Chapter delete function exists'
);
select ok(
  has_function_privilege('authenticated', 'public.delete_course_section_chapter(uuid, uuid, uuid)', 'EXECUTE'),
  'Authenticated users can invoke the guarded Chapter delete RPC'
);
select ok(
  not has_function_privilege('anon', 'public.delete_course_section_chapter(uuid, uuid, uuid)', 'EXECUTE'),
  'Unauthenticated clients cannot invoke the Chapter delete RPC'
);
select has_function(
  'public',
  'get_teacher_lesson_feedback_snapshot',
  array['uuid', 'uuid'],
  'Lesson-scoped Teacher feedback function exists'
);
select ok(
  has_function_privilege('authenticated', 'public.get_teacher_lesson_feedback_snapshot(uuid, uuid)', 'EXECUTE'),
  'Authenticated users can invoke the guarded Lesson feedback RPC'
);
select ok(
  not has_function_privilege('anon', 'public.get_teacher_lesson_feedback_snapshot(uuid, uuid)', 'EXECUTE'),
  'Unauthenticated clients cannot invoke the Lesson feedback RPC'
);

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
  ('a9300000-0000-4000-8000-000000000002', 'a9200000-0000-4000-8000-000000000001', 'Chapter 2'),
  ('a9300000-0000-4000-8000-000000000003', 'a9200000-0000-4000-8000-000000000001', 'Empty Chapter');
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

select set_config('request.jwt.claims', '{"sub":"a9000000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":false,"email":"other@minclass.local"}', true);
select throws_ok(
  $$select public.release_entire_chapter(current_setting('test.chapter_session_id')::uuid)$$,
  '42501', 'Chapter Session is not available.',
  'Another Teacher cannot release a Chapter Session they do not own'
);
select throws_ok(
  $$select public.get_teacher_lesson_feedback_snapshot(current_setting('test.chapter_session_id')::uuid, 'a9400000-0000-4000-8000-000000000001')$$,
  '42501', 'Lesson feedback is not available.',
  'Another Teacher cannot read Lesson feedback from a Session they do not own'
);
select throws_ok(
  $$select public.delete_course_section_chapter('a9100000-0000-4000-8000-000000000001', 'a9200000-0000-4000-8000-000000000001', 'a9300000-0000-4000-8000-000000000002')$$,
  '42501', 'Course Section Chapter is not available.',
  'Another Teacher cannot delete a Chapter they do not own'
);

select set_config('request.jwt.claims', '{"sub":"a9000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false,"email":"thaybao@minclass.local"}', true);
select throws_ok(
  $$select * from public.start_chapter_session('a9200000-0000-4000-8000-000000000001', 'a9300000-0000-4000-8000-000000000002')$$,
  '23505', 'Course Section already has a LIVE Lesson Session.',
  'A Course Section cannot have two concurrent teaching Sessions'
);
select lives_ok(
  $$select public.delete_course_section_chapter('a9100000-0000-4000-8000-000000000001', 'a9200000-0000-4000-8000-000000000001', 'a9300000-0000-4000-8000-000000000002')$$,
  'Teacher cascade-deletes an owned Chapter that contains Lessons'
);
select is(
  (select count(*) from public.lessons where id = 'a9400000-0000-4000-8000-000000000003'),
  0::bigint,
  'Cascade-deleting a Chapter removes its Lessons'
);
select lives_ok(
  $$select public.delete_course_section_chapter('a9100000-0000-4000-8000-000000000001', 'a9200000-0000-4000-8000-000000000001', 'a9300000-0000-4000-8000-000000000003')$$,
  'Teacher deletes an empty owned Course Section Chapter'
);
select is(
  (select count(*) from public.chapters where id = 'a9300000-0000-4000-8000-000000000003'),
  0::bigint,
  'Deleted Course Section Chapter no longer exists'
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
select lives_ok(
  $$select public.release_entire_chapter(current_setting('test.chapter_session_id')::uuid)$$,
  'Teacher releases every Lesson in the live Chapter at once'
);
select is(
  (select released_through from public.session_lessons where session_id = current_setting('test.chapter_session_id')::uuid and lesson_id = 'a9400000-0000-4000-8000-000000000001'),
  1,
  'Done entire Chapter releases the final Section of Lesson A'
);
select is(
  jsonb_array_length(public.get_teacher_lesson_feedback_snapshot(
    current_setting('test.chapter_session_id')::uuid,
    'a9400000-0000-4000-8000-000000000001'
  )->'reactions'),
  2,
  'Lesson feedback contains only released Sections from the selected Lesson'
);
select is(
  (public.get_teacher_course_section_export('a9100000-0000-4000-8000-000000000001', 'a9200000-0000-4000-8000-000000000001')->>'totalClassMeetings')::integer,
  1,
  'Only the started Chapter Session counts as a class meeting'
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
select is((select count(*) from public.get_student_session_lesson_snapshot(current_setting('test.chapter_session_id')::uuid, 'a9400000-0000-4000-8000-000000000001')), 2::bigint, 'Student sees every Lesson A Section after Teacher completes the Chapter');
select is((select count(*) from public.get_student_session_lesson_snapshot(current_setting('test.chapter_session_id')::uuid, 'a9400000-0000-4000-8000-000000000002')), 2::bigint, 'Student sees released Sections from Lesson B');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a9000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false,"email":"thaybao@minclass.local"}', true);
select lives_ok($$select * from public.end_room(current_setting('test.chapter_session_id')::uuid)$$, 'Teacher ends the Chapter Session once');
select is((select count(*) from public.session_lessons where session_id = current_setting('test.chapter_session_id')::uuid), 2::bigint, 'Ended Session keeps all Lesson history');
select is(
  (
    select count(distinct section->>'lessonId')
    from jsonb_array_elements(
      public.get_teacher_class_voices(current_setting('test.chapter_session_id')::uuid)->'sections'
    ) as section
  ),
  2::bigint,
  'Class Voices identifies each Lesson represented in the Chapter Session'
);
select ok(
  (
    select bool_and(nullif(section->>'lessonTitle', '') is not null)
    from jsonb_array_elements(
      public.get_teacher_class_voices(current_setting('test.chapter_session_id')::uuid)->'sections'
    ) as section
  ),
  'Every Class Voices Section includes its Lesson title'
);
select lives_ok(
  $$select * from public.start_chapter_session('a9200000-0000-4000-8000-000000000001', 'a9300000-0000-4000-8000-000000000001')$$,
  'Teacher can start a later Session for the same Chapter'
);
select is(
  (public.get_teacher_course_section_export('a9100000-0000-4000-8000-000000000001', 'a9200000-0000-4000-8000-000000000001')->>'totalClassMeetings')::integer,
  2,
  'Each started Chapter Session adds one class meeting'
);
select is(
  (
    select (student->>'attendedClassMeetingCount')::integer
    from jsonb_array_elements(public.get_teacher_course_section_export('a9100000-0000-4000-8000-000000000001', 'a9200000-0000-4000-8000-000000000001')->'students') student
    where student->>'mssv' = '23162011'
  ),
  1,
  'A Student is absent from a later Session until that Session is joined'
);
select lives_ok(
  $$select public.delete_course_section_chapter('a9100000-0000-4000-8000-000000000001', 'a9200000-0000-4000-8000-000000000001', 'a9300000-0000-4000-8000-000000000001')$$,
  'Teacher cascade-deletes a Chapter with active and ended Sessions'
);
select is(
  (select count(*) from public.rooms where chapter_id = 'a9300000-0000-4000-8000-000000000001'),
  0::bigint,
  'Cascade-deleting a Chapter removes all of its Sessions'
);
select is(
  (select count(*) from public.session_attendance where session_id = current_setting('test.chapter_session_id')::uuid),
  0::bigint,
  'Deleting Chapter Sessions cascades their attendance data'
);
select is(
  (select count(*) from public.lessons where chapter_id = 'a9300000-0000-4000-8000-000000000001'),
  0::bigint,
  'Cascade-deleting a Chapter removes all of its Lesson content'
);
select is(
  (select count(*) from public.chapters where id = 'a9300000-0000-4000-8000-000000000001'),
  0::bigint,
  'Cascade-deleted Chapter no longer exists'
);

select * from finish();
rollback;
