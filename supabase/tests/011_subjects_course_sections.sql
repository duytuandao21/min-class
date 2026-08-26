begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(16);

insert into auth.users (id, instance_id, aud, role, encrypted_password, email, created_at, updated_at, is_anonymous)
values
  ('aa000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', 'thaybao@minclass.local', now(), now(), false),
  ('bb000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', 'other@example.com', now(), now(), false);

insert into public.subjects (id, teacher_id, name, code)
values ('bb100000-0000-0000-0000-000000000001', 'bb000000-0000-0000-0000-000000000001', 'Private Subject B', 'PRIVATEB');

insert into public.course_sections (id, subject_id, section_code, display_name)
values ('bb200000-0000-0000-0000-000000000001', 'bb100000-0000-0000-0000-000000000001', 'PRIVATEB01', 'Private Section B');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aa000000-0000-0000-0000-000000000001","role":"authenticated","is_anonymous":false,"email":"thaybao@minclass.local"}', true);

select lives_ok(
  $$insert into public.subjects (id, teacher_id, name, code) values ('aa100000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000001', 'Mạng máy tính', 'NETW420')$$,
  'Teacher can create their Subject'
);

select lives_ok(
  $$update public.subjects set name = 'Mạng máy tính nâng cao' where id = 'aa100000-0000-0000-0000-000000000001'$$,
  'Teacher can update their Subject'
);

select is(
  (select name from public.subjects where id = 'aa100000-0000-0000-0000-000000000001'),
  'Mạng máy tính nâng cao',
  'Subject update is persisted'
);

select lives_ok(
  $$insert into public.course_sections (id, subject_id, section_code, display_name) values ('aa200000-0000-0000-0000-000000000001', 'aa100000-0000-0000-0000-000000000001', '24110NETW42001', 'Ca sáng')$$,
  'Teacher can create a Course Section for their Subject'
);

select lives_ok(
  $$update public.course_sections set display_name = 'Lớp sáng' where id = 'aa200000-0000-0000-0000-000000000001'$$,
  'Teacher can update their Course Section'
);

select throws_matching(
  $$insert into public.course_sections (subject_id, section_code) values ('aa100000-0000-0000-0000-000000000001', 'INVALID CODE')$$,
  'course_sections_code_valid',
  'Invalid section code is rejected by the database'
);

select is(
  (select count(*) from public.subjects where id = 'bb100000-0000-0000-0000-000000000001'),
  0::bigint,
  'Teacher A cannot read Teacher B Subject'
);

select is(
  (select count(*) from public.course_sections where id = 'bb200000-0000-0000-0000-000000000001'),
  0::bigint,
  'Teacher A cannot read Teacher B Course Section'
);

select lives_ok(
  $$update public.subjects set name = 'Unauthorized update' where id = 'bb100000-0000-0000-0000-000000000001'$$,
  'Cross-owner Subject update is safely filtered by RLS'
);

select lives_ok(
  $$delete from public.subjects where id = 'bb100000-0000-0000-0000-000000000001'$$,
  'Cross-owner Subject delete is safely filtered by RLS'
);

select lives_ok(
  $$update public.course_sections set display_name = 'Unauthorized update' where id = 'bb200000-0000-0000-0000-000000000001'$$,
  'Cross-owner Course Section update is safely filtered by RLS'
);

reset role;

select is(
  (select name from public.subjects where id = 'bb100000-0000-0000-0000-000000000001'),
  'Private Subject B',
  'Teacher B Subject remains unchanged and undeleted'
);

select is(
  (select display_name from public.course_sections where id = 'bb200000-0000-0000-0000-000000000001'),
  'Private Section B',
  'Teacher B Course Section remains unchanged'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aa000000-0000-0000-0000-000000000001","role":"authenticated","is_anonymous":false,"email":"thaybao@minclass.local"}', true);

select lives_ok(
  $$delete from public.course_sections where id = 'aa200000-0000-0000-0000-000000000001'$$,
  'Teacher can delete their Course Section'
);

insert into public.course_sections (id, subject_id, section_code)
values ('aa200000-0000-0000-0000-000000000002', 'aa100000-0000-0000-0000-000000000001', '24110NETW42002');

select lives_ok(
  $$delete from public.subjects where id = 'aa100000-0000-0000-0000-000000000001'$$,
  'Teacher can delete their Subject and cascade its Course Sections'
);

reset role;

select is(
  (select count(*) from public.course_sections where id = 'aa200000-0000-0000-0000-000000000002'),
  0::bigint,
  'Deleting a Subject cascades to its Course Sections'
);

select * from finish();

rollback;
