begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(14);

insert into auth.users (id, instance_id, aud, role, encrypted_password, email, created_at, updated_at, is_anonymous)
values
  ('ac000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', 'thaybao@minclass.local', now(), now(), false),
  ('bc000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', 'other@example.com', now(), now(), false),
  ('cc000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', null, now(), now(), true);

insert into public.subjects (id, teacher_id, name, code)
values
  ('ac100000-0000-0000-0000-000000000001', 'ac000000-0000-0000-0000-000000000001', 'Subject A', 'SUBJECTA'),
  ('bc100000-0000-0000-0000-000000000001', 'bc000000-0000-0000-0000-000000000001', 'Subject B', 'SUBJECTB');

insert into public.course_sections (id, subject_id, section_code)
values
  ('ac200000-0000-0000-0000-000000000001', 'ac100000-0000-0000-0000-000000000001', 'SECTIONA01'),
  ('bc200000-0000-0000-0000-000000000001', 'bc100000-0000-0000-0000-000000000001', 'SECTIONB01');

insert into public.course_section_students (id, course_section_id, mssv)
values ('bc300000-0000-0000-0000-000000000001', 'bc200000-0000-0000-0000-000000000001', '23119999');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"ac000000-0000-0000-0000-000000000001","role":"authenticated","is_anonymous":false,"email":"thaybao@minclass.local"}', true);

select lives_ok(
  $$insert into public.course_section_students (course_section_id, mssv) values ('ac200000-0000-0000-0000-000000000001', '23110001')$$,
  'Owner can insert a roster student'
);

select throws_matching(
  $$insert into public.course_section_students (course_section_id, mssv) values ('ac200000-0000-0000-0000-000000000001', '23110001')$$,
  'course_section_students_mssv_unique',
  'Database rejects duplicate MSSV in one Course Section'
);

select is(
  (select count(*) from public.course_section_students where course_section_id = 'ac200000-0000-0000-0000-000000000001'),
  1::bigint,
  'Owner can read their roster'
);

select lives_ok(
  $$select public.replace_course_section_roster('ac200000-0000-0000-0000-000000000001', array['23110002', '23110003'])$$,
  'Owner can atomically replace their roster'
);

select is(
  (select count(*) from public.course_section_students where course_section_id = 'ac200000-0000-0000-0000-000000000001'),
  2::bigint,
  'Roster replacement persists all students'
);

select is(
  (select count(*) from public.course_section_students where course_section_id = 'bc200000-0000-0000-0000-000000000001'),
  0::bigint,
  'Teacher A cannot read Teacher B roster'
);

select lives_ok(
  $$update public.course_section_students set mssv = '23118888' where id = 'bc300000-0000-0000-0000-000000000001'$$,
  'Cross-owner roster update is filtered by RLS'
);

select lives_ok(
  $$delete from public.course_section_students where id = 'bc300000-0000-0000-0000-000000000001'$$,
  'Cross-owner roster delete is filtered by RLS'
);

select throws_ok(
  $$select public.replace_course_section_roster('bc200000-0000-0000-0000-000000000001', array['23117777'])$$,
  '42501',
  'Course Section is not available.',
  'Teacher A cannot replace Teacher B roster'
);

reset role;

select is(
  (select mssv from public.course_section_students where id = 'bc300000-0000-0000-0000-000000000001'),
  '23119999',
  'Teacher B roster remains unchanged and undeleted'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"bc000000-0000-0000-0000-000000000001","role":"authenticated","is_anonymous":false,"email":"other@example.com"}', true);

select throws_ok(
  $$select public.replace_course_section_roster('bc200000-0000-0000-0000-000000000001', array['23117777'])$$,
  '42501',
  'Teacher account required.',
  'Another permanent account cannot manage roster'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cc000000-0000-0000-0000-000000000001","role":"authenticated","is_anonymous":true}', true);

select is(
  (select count(*) from public.course_section_students),
  0::bigint,
  'Anonymous Student cannot download roster rows'
);

select throws_ok(
  $$select public.replace_course_section_roster('ac200000-0000-0000-0000-000000000001', array['23116666'])$$,
  '42501',
  'Teacher account required.',
  'Anonymous Student cannot replace roster'
);

reset role;

delete from public.course_sections where id = 'ac200000-0000-0000-0000-000000000001';

select is(
  (select count(*) from public.course_section_students where course_section_id = 'ac200000-0000-0000-0000-000000000001'),
  0::bigint,
  'Deleting a Course Section cascades its roster'
);

select * from finish();

rollback;
