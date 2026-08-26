begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(17);

insert into auth.users (id, instance_id, aud, role, encrypted_password, email, created_at, updated_at, is_anonymous)
values
  ('ae000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', 'thaybao@minclass.local', now(), now(), false),
  ('ce000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', null, now(), now(), true);

insert into public.subjects (id, teacher_id, name, code)
values ('ae100000-0000-0000-0000-000000000001', 'ae000000-0000-0000-0000-000000000001', 'Public Subject', 'PUBLIC');

insert into public.course_sections (id, subject_id, section_code, display_name)
values
  ('ae200000-0000-0000-0000-000000000001', 'ae100000-0000-0000-0000-000000000001', 'CLASSA', 'Class A'),
  ('ae200000-0000-0000-0000-000000000002', 'ae100000-0000-0000-0000-000000000001', 'CLASSB', 'Class B');

insert into public.chapters (id, subject_id, name)
values ('ae250000-0000-0000-0000-000000000001', 'ae100000-0000-0000-0000-000000000001', 'Chương 1: Public');

insert into public.course_section_students (course_section_id, mssv)
values
  ('ae200000-0000-0000-0000-000000000001', '23110001'),
  ('ae200000-0000-0000-0000-000000000002', '23110002');

insert into public.lessons (id, room_id, course_section_id, chapter_id, title, markdown_source)
values
  ('ae300000-0000-0000-0000-000000000001', null, 'ae200000-0000-0000-0000-000000000001', 'ae250000-0000-0000-0000-000000000001', 'Upcoming Lesson', '# Private upcoming content'),
  ('ae300000-0000-0000-0000-000000000002', null, 'ae200000-0000-0000-0000-000000000001', 'ae250000-0000-0000-0000-000000000001', 'Live Lesson', '# Private live content'),
  ('ae300000-0000-0000-0000-000000000003', null, 'ae200000-0000-0000-0000-000000000001', 'ae250000-0000-0000-0000-000000000001', 'Ended Lesson', '# Private ended content');

insert into public.rooms (id, code, teacher_user_id, title, status, started_at, ended_at, lesson_id)
values
  ('ae400000-0000-0000-0000-000000000002', 'LVAC24', 'ae000000-0000-0000-0000-000000000001', 'Live session', 'ACTIVE', now(), null, 'ae300000-0000-0000-0000-000000000002'),
  ('ae400000-0000-0000-0000-000000000003', 'ENDD24', 'ae000000-0000-0000-0000-000000000001', 'Ended session', 'ENDED', now() - interval '1 hour', now(), 'ae300000-0000-0000-0000-000000000003');

set local role anon;

select is((select count(*) from public.get_public_subjects()), 1::bigint, 'Public can browse Subjects');
select is((select count(*) from public.get_public_course_sections('ae100000-0000-0000-0000-000000000001')), 2::bigint, 'Public can browse Course Sections');
select results_eq(
  $$select chapter_name from public.get_public_course_section_chapters('ae200000-0000-0000-0000-000000000001')$$,
  $$values ('Chương 1: Public'::text)$$,
  'Public can browse sanitized Chapter names for a Course Section'
);
select results_eq(
  $$select lesson_title, lesson_status from public.get_public_course_section_lessons('ae200000-0000-0000-0000-000000000001') order by lesson_title$$,
  $$values ('Ended Lesson'::text, 'ENDED'::text), ('Live Lesson'::text, 'LIVE'::text), ('Upcoming Lesson'::text, 'UPCOMING'::text)$$,
  'Public Lesson list exposes only expected status metadata'
);
select is(
  (select count(*) from public.get_public_course_section_lessons('ae200000-0000-0000-0000-000000000001') where chapter_id = 'ae250000-0000-0000-0000-000000000001'),
  3::bigint,
  'Public Lesson rows are linked to their Chapter'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"ce000000-0000-0000-0000-000000000001","role":"authenticated","is_anonymous":true}', true);

select lives_ok(
  $$select * from public.access_public_lesson('ae300000-0000-0000-0000-000000000002', '23110001', 'LVAC24')$$,
  'Roster Student accesses a LIVE Lesson with the correct code'
);
select throws_ok(
  $$select * from public.access_public_lesson('ae300000-0000-0000-0000-000000000002', '99999999', 'LVAC24')$$,
  '42501', 'Lesson access denied.', 'Unknown MSSV is denied'
);
select throws_ok(
  $$select * from public.access_public_lesson('ae300000-0000-0000-0000-000000000002', '23110002', 'LVAC24')$$,
  '42501', 'Lesson access denied.', 'MSSV from Class B cannot access Class A'
);
select throws_ok(
  $$select * from public.access_public_lesson('ae300000-0000-0000-0000-000000000002', '23110001', null)$$,
  '42501', 'Lesson access denied.', 'LIVE Lesson requires a session code'
);
select throws_ok(
  $$select * from public.access_public_lesson('ae300000-0000-0000-0000-000000000002', '23110001', 'WRNG24')$$,
  '42501', 'Lesson access denied.', 'Wrong LIVE session code is denied'
);
select lives_ok(
  $$select * from public.access_public_lesson('ae300000-0000-0000-0000-000000000003', '23110001', null)$$,
  'ENDED Lesson does not require a session code'
);
select throws_ok(
  $$select * from public.access_public_lesson('ae300000-0000-0000-0000-000000000001', '23110001', 'DRFT24')$$,
  '42501', 'Lesson access denied.', 'DRAFT or unavailable Lesson access is denied'
);
select is(
  (select count(*) from public.course_section_students),
  0::bigint,
  'Anonymous Student cannot download the roster directly'
);
select throws_ok(
  $$select * from public.access_public_lesson('ae300000-0000-0000-0000-000000000002', 'BAD!', 'LVAC24')$$,
  '42501', 'Lesson access denied.', 'Invalid MSSV format uses the same denial response'
);
select is(
  (select session_id from public.access_public_lesson('ae300000-0000-0000-0000-000000000002', '23110001', 'lvac24')),
  'ae400000-0000-0000-0000-000000000002'::uuid,
  'LIVE code and MSSV are normalized server-side'
);

reset role;
set local role anon;
select throws_ok(
  $$select * from public.access_public_lesson('ae300000-0000-0000-0000-000000000002', '23110001', 'LVAC24')$$,
  '42501',
  'permission denied for function access_public_lesson',
  'Unauthenticated caller cannot invoke the access gate'
);

select is(
  (select count(*) from public.get_public_lesson_gate_context('ae300000-0000-0000-0000-000000000002')),
  1::bigint,
  'Public can load sanitized Lesson gate context'
);

select * from finish();
rollback;
