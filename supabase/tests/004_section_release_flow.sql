begin;

create extension if not exists pgtap with schema extensions;

select plan(17);

select ok(
  exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'rooms'
  ),
  'Room updates are published to Supabase Realtime'
);

insert into auth.users (id, instance_id, aud, role, encrypted_password, created_at, updated_at, is_anonymous)
values
  ('12000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', now(), now(), true),
  ('22000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', now(), now(), true);

insert into public.rooms (
  id, code, teacher_user_id, title, status, teaching_section, released_through, started_at
)
values (
  '32000000-0000-0000-0000-000000000001',
  'FLW234',
  '12000000-0000-0000-0000-000000000001',
  'Section Flow Room',
  'ACTIVE',
  0,
  0,
  now()
);

insert into public.lessons (id, room_id, title, markdown_source)
values (
  '42000000-0000-0000-0000-000000000001',
  '32000000-0000-0000-0000-000000000001',
  'Flow Lesson',
  '# Flow lesson'
);

insert into public.sections (id, lesson_id, position, type, title, content_md)
values
  ('52000000-0000-0000-0000-000000000001', '42000000-0000-0000-0000-000000000001', 0, 'CONTENT', 'First', 'First content'),
  ('52000000-0000-0000-0000-000000000002', '42000000-0000-0000-0000-000000000001', 1, 'CONTENT', 'Middle', 'Middle content'),
  ('52000000-0000-0000-0000-000000000003', '42000000-0000-0000-0000-000000000001', 2, 'CONTENT', 'Last', 'Last content');

insert into public.participants (room_id, user_id, mssv)
values (
  '32000000-0000-0000-0000-000000000001',
  '22000000-0000-0000-0000-000000000001',
  'SV005'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"12000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select throws_ok(
  $$select * from public.get_student_lesson_snapshot('32000000-0000-0000-0000-000000000001')$$,
  '42501',
  'Room is not available to this participant.',
  'Student snapshot RPC is restricted to a joined participant'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"22000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select results_eq(
  $$select position from public.sections order by position$$,
  $$values (0)$$,
  'Student immediately sees the section Teacher is presenting'
);
select is(
  (select count(section_id) from public.get_student_lesson_snapshot('32000000-0000-0000-0000-000000000001')),
  1::bigint,
  'Initial or reconnect snapshot contains the current section'
);
select is(
  (select count(*) from public.sections where id = '52000000-0000-0000-0000-000000000002'),
  0::bigint,
  'Student cannot directly read the next section'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"12000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select lives_ok(
  $$select * from public.release_section('32000000-0000-0000-0000-000000000001')$$,
  'Teacher moves to the middle section'
);
select is((select teaching_section from public.rooms where id = '32000000-0000-0000-0000-000000000001'), 1, 'Middle section becomes the teaching section');
select is((select released_through from public.rooms where id = '32000000-0000-0000-0000-000000000001'), 1, 'Middle section is immediately visible');

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"22000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select results_eq(
  $$select position from public.sections order by position$$,
  $$values (0), (1)$$,
  'Student reads through the middle teaching section only'
);
select is(
  (select count(section_id) from public.get_student_lesson_snapshot('32000000-0000-0000-0000-000000000001')),
  2::bigint,
  'Reconnect snapshot catches up through the middle section'
);
select is(
  (select count(*) from public.sections where id = '52000000-0000-0000-0000-000000000003'),
  0::bigint,
  'Student cannot directly read the final future section'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"12000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select lives_ok(
  $$select * from public.release_section('32000000-0000-0000-0000-000000000001')$$,
  'Teacher moves to the final section'
);
select is((select teaching_section from public.rooms where id = '32000000-0000-0000-0000-000000000001'), 2, 'Final section becomes the teaching section');
select is((select released_through from public.rooms where id = '32000000-0000-0000-0000-000000000001'), 2, 'Final section is immediately visible');

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"22000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select results_eq(
  $$select position from public.sections order by position$$,
  $$values (0), (1), (2)$$,
  'Student reads all sections when Teacher presents the final section'
);
select is(
  (select count(section_id) from public.get_student_lesson_snapshot('32000000-0000-0000-0000-000000000001')),
  3::bigint,
  'Reconnect snapshot includes the final teaching section'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"12000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select throws_ok(
  $$select * from public.release_section('32000000-0000-0000-0000-000000000001')$$,
  'P0001',
  'The final section has no next section.',
  'Teacher cannot advance past the final section'
);

select * from finish();
rollback;
