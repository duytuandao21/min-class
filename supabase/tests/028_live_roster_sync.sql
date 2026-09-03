begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(9);

insert into auth.users (id, instance_id, aud, role, encrypted_password, email, created_at, updated_at, is_anonymous)
values
  ('a8000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', 'thaybao@minclass.local', now(), now(), false),
  ('c8000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', null, now(), now(), true);

insert into public.subjects (id, teacher_id, name, code)
values ('a8100000-0000-4000-8000-000000000001', 'a8000000-0000-4000-8000-000000000001', 'Live roster sync', 'LRS');

insert into public.course_sections (id, subject_id, section_code)
values ('a8200000-0000-4000-8000-000000000001', 'a8100000-0000-4000-8000-000000000001', 'LRS001');

insert into public.chapters (id, course_section_id, name)
values ('a8300000-0000-4000-8000-000000000001', 'a8200000-0000-4000-8000-000000000001', 'Chapter 1');

insert into public.lessons (id, course_section_id, chapter_id, title, markdown_source)
values ('a8400000-0000-4000-8000-000000000001', 'a8200000-0000-4000-8000-000000000001', 'a8300000-0000-4000-8000-000000000001', 'Lesson', '# Lesson');

insert into public.sections (id, lesson_id, position, type, title, content_md)
values ('a8500000-0000-4000-8000-000000000001', 'a8400000-0000-4000-8000-000000000001', 0, 'CONTENT', 'Section', 'Content');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a8000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false,"email":"thaybao@minclass.local"}', true);

select lives_ok(
  $$select * from public.start_lesson_session('a8400000-0000-4000-8000-000000000001')$$,
  'Teacher can start a Lesson before uploading a roster'
);
select set_config('test.live_session_id', (select id::text from public.rooms where lesson_id = 'a8400000-0000-4000-8000-000000000001'), true);
select is(
  (select count(*) from public.session_attendance where session_id = current_setting('test.live_session_id')::uuid),
  0::bigint,
  'The initial LIVE attendance is empty'
);
select lives_ok(
  $$select public.replace_course_section_roster('a8200000-0000-4000-8000-000000000001', array['23162011', '23162012'])$$,
  'Teacher uploads the roster while the Lesson is LIVE'
);
select is(
  (select count(*) from public.session_attendance where session_id = current_setting('test.live_session_id')::uuid),
  2::bigint,
  'The uploaded roster is synchronized into the LIVE Session'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c8000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":true}', true);
select lives_ok(
  $$select * from public.join_live_lesson('a8400000-0000-4000-8000-000000000001', '23162012')$$,
  'A synchronized Student can join immediately'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a8000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false,"email":"thaybao@minclass.local"}', true);
select ok(
  (select joined_at is not null from public.session_attendance where session_id = current_setting('test.live_session_id')::uuid and mssv = '23162012'),
  'Join updates the synchronized attendance row'
);
select lives_ok(
  $$select * from public.end_room(current_setting('test.live_session_id')::uuid)$$,
  'Teacher ends the Session'
);
select lives_ok(
  $$select public.replace_course_section_roster('a8200000-0000-4000-8000-000000000001', array['99990001'])$$,
  'Teacher can replace the Course Section roster after End'
);
select is(
  (select count(*) from public.session_attendance where session_id = current_setting('test.live_session_id')::uuid),
  2::bigint,
  'An ENDED Session keeps its historical roster snapshot'
);

select * from finish();
rollback;
