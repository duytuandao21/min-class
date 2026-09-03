begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(10);

select has_function('public', 'delete_subject', array['uuid'], 'Subject cascade delete RPC exists');

insert into auth.users (id, instance_id, aud, role, encrypted_password, email, created_at, updated_at, is_anonymous)
values
  ('d1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', 'thaybao@minclass.local', now(), now(), false),
  ('d1000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', 'other@minclass.local', now(), now(), false),
  ('d1000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', null, now(), now(), true);

insert into public.subjects (id, teacher_id, name, code)
values ('d1100000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'Delete Subject', 'DELETE');

insert into public.course_sections (id, subject_id, section_code)
values ('d1200000-0000-0000-0000-000000000001', 'd1100000-0000-0000-0000-000000000001', 'DELETE01');

insert into public.chapters (id, course_section_id, name)
values ('d1300000-0000-0000-0000-000000000001', 'd1200000-0000-0000-0000-000000000001', 'Chapter');

insert into public.lessons (id, room_id, course_section_id, chapter_id, title, markdown_source)
values (
  'd1400000-0000-0000-0000-000000000001',
  null,
  'd1200000-0000-0000-0000-000000000001',
  'd1300000-0000-0000-0000-000000000001',
  'Delete Lesson',
  '# Delete Lesson'
);

insert into public.sections (id, lesson_id, position, type, title, content_md)
values ('d1500000-0000-0000-0000-000000000001', 'd1400000-0000-0000-0000-000000000001', 0, 'CONTENT', 'Section', 'Content');

insert into public.rooms (
  id,
  code,
  teacher_user_id,
  title,
  status,
  teaching_section,
  released_through,
  started_at,
  ended_at,
  lesson_id
)
values (
  'd1600000-0000-0000-0000-000000000001',
  'DEL234',
  'd1000000-0000-0000-0000-000000000001',
  'Delete Session',
  'ENDED',
  0,
  0,
  now() - interval '1 hour',
  now(),
  'd1400000-0000-0000-0000-000000000001'
);

insert into public.participants (id, room_id, user_id, mssv)
values (
  'd1700000-0000-0000-0000-000000000001',
  'd1600000-0000-0000-0000-000000000001',
  'd1000000-0000-0000-0000-000000000003',
  '23162011'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d1000000-0000-0000-0000-000000000002","role":"authenticated","is_anonymous":false,"email":"other@minclass.local"}', true);

select throws_ok(
  $$select public.delete_subject('d1100000-0000-0000-0000-000000000001')$$,
  '42501',
  'Teacher account required.',
  'A different account cannot invoke the Teacher delete RPC'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d1000000-0000-0000-0000-000000000001","role":"authenticated","is_anonymous":false,"email":"thaybao@minclass.local"}', true);

select lives_ok(
  $$select public.delete_subject('d1100000-0000-0000-0000-000000000001')$$,
  'The owner can delete a Subject with persisted Lesson and Session data'
);

reset role;

select is((select count(*) from public.subjects where id = 'd1100000-0000-0000-0000-000000000001'), 0::bigint, 'Subject is deleted');
select is((select count(*) from public.course_sections where id = 'd1200000-0000-0000-0000-000000000001'), 0::bigint, 'Course Section is deleted');
select is((select count(*) from public.chapters where id = 'd1300000-0000-0000-0000-000000000001'), 0::bigint, 'Chapter is deleted');
select is((select count(*) from public.lessons where id = 'd1400000-0000-0000-0000-000000000001'), 0::bigint, 'Lesson is deleted');
select is((select count(*) from public.sections where id = 'd1500000-0000-0000-0000-000000000001'), 0::bigint, 'Lesson Sections are deleted');
select is((select count(*) from public.rooms where id = 'd1600000-0000-0000-0000-000000000001'), 0::bigint, 'Lesson Sessions are deleted');
select is((select count(*) from public.participants where id = 'd1700000-0000-0000-0000-000000000001'), 0::bigint, 'Session participants are deleted');

select * from finish();
rollback;
