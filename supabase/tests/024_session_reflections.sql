begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(23);

select has_table('public', 'session_reflections', 'Session reflections table exists');
select has_function('public', 'save_own_session_reflection', array['uuid', 'integer', 'text'], 'Student save RPC exists');
select has_function('public', 'get_own_session_reflection', array['uuid'], 'Student own reflection RPC exists');
select has_function('public', 'get_teacher_session_reflections', array['uuid'], 'Teacher reflection snapshot RPC exists');
select has_function('public', 'get_ended_session_reflection', array['uuid'], 'Ended Lesson own reflection RPC exists');
select ok(has_table_privilege('authenticated', 'public.session_reflections', 'SELECT'), 'Authorized SELECT supports RLS-filtered Realtime delivery');
select ok(not has_table_privilege('authenticated', 'public.session_reflections', 'INSERT'), 'Clients cannot insert into the reflection table directly');
select ok(
  exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'session_reflections'
  ),
  'Session reflections publish Realtime changes'
);

insert into auth.users (id, instance_id, aud, role, encrypted_password, email, created_at, updated_at, is_anonymous)
values
  ('e1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', 'thaybao@minclass.local', now(), now(), false),
  ('e1000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', 'other@minclass.local', now(), now(), false),
  ('e1000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', null, now(), now(), true),
  ('e1000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', null, now(), now(), true);

insert into public.subjects (id, teacher_id, name, code)
values ('e1100000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'Reflection Subject', 'REFLECT');

insert into public.course_sections (id, subject_id, section_code)
values ('e1200000-0000-0000-0000-000000000001', 'e1100000-0000-0000-0000-000000000001', 'REFLECT01');

insert into public.lessons (id, room_id, course_section_id, title, markdown_source)
values ('e1300000-0000-0000-0000-000000000001', null, 'e1200000-0000-0000-0000-000000000001', 'Reflection Lesson', '# Reflection');

insert into public.sections (id, lesson_id, position, type, title, content_md)
values ('e1400000-0000-0000-0000-000000000001', 'e1300000-0000-0000-0000-000000000001', 0, 'CONTENT', 'Reflection Section', 'Content');

insert into public.rooms (
  id, code, teacher_user_id, title, status, teaching_section, released_through, started_at, lesson_id
)
values (
  'e1500000-0000-0000-0000-000000000001', 'REV234', 'e1000000-0000-0000-0000-000000000001',
  'Reflection Session', 'ACTIVE', 0, 0, now(), 'e1300000-0000-0000-0000-000000000001'
);

insert into public.participants (id, room_id, user_id, mssv)
values
  ('e1600000-0000-0000-0000-000000000001', 'e1500000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000003', '23162011'),
  ('e1600000-0000-0000-0000-000000000002', 'e1500000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000004', '23162012');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-0000-0000-000000000003","role":"authenticated","is_anonymous":true}', true);

select throws_ok(
  $$select * from public.save_own_session_reflection('e1500000-0000-0000-0000-000000000001', 2, 'Too early')$$,
  '42501',
  'Session reflection is not available.',
  'Student cannot submit before Session End'
);

set local role postgres;
update public.rooms
set status = 'ENDED', ended_at = now()
where id = 'e1500000-0000-0000-0000-000000000001';
insert into public.lesson_session_access_grants (room_id, user_id, mssv)
values ('e1500000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000003', '23162011');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-0000-0000-000000000003","role":"authenticated","is_anonymous":true}', true);

select throws_ok(
  $$select * from public.save_own_session_reflection('e1500000-0000-0000-0000-000000000001', -1, null)$$,
  '22023',
  'Speaking count must be between 0 and 999.',
  'Negative speaking count is rejected'
);

select throws_ok(
  $$select * from public.save_own_session_reflection('e1500000-0000-0000-0000-000000000001', 1, repeat('x', 1001))$$,
  '22023',
  'Review must contain at most 1000 characters.',
  'Oversized review is rejected'
);

select lives_ok(
  $$select * from public.save_own_session_reflection('e1500000-0000-0000-0000-000000000001', 3, 'Buổi học dễ hiểu.')$$,
  'Student saves speaking count and review after End'
);
select is(
  (select speaking_count from public.get_own_session_reflection('e1500000-0000-0000-0000-000000000001')),
  3,
  'Student can read their own speaking count'
);
select is(
  (select review_body from public.get_own_session_reflection('e1500000-0000-0000-0000-000000000001')),
  'Buổi học dễ hiểu.'::text,
  'Student can read their own review'
);
select throws_ok(
  $$select * from public.save_own_session_reflection('e1500000-0000-0000-0000-000000000001', 4, '  ')$$,
  '23505',
  'Session reflection has already been submitted.',
  'Student cannot update a submitted reflection'
);

select is(
  (select speaking_count from public.get_ended_session_reflection('e1500000-0000-0000-0000-000000000001')),
  3,
  'Student can view the submitted reflection in Ended Lesson Review'
);

set local role postgres;
select is(
  (select count(*) from public.session_reflections where participant_id = 'e1600000-0000-0000-0000-000000000001'),
  1::bigint,
  'One-time submission keeps one reflection per participant'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-0000-0000-000000000004","role":"authenticated","is_anonymous":true}', true);
select lives_ok(
  $$select * from public.save_own_session_reflection('e1500000-0000-0000-0000-000000000001', 1, 'Em tự tin hơn.')$$,
  'Another Student saves only their own reflection'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-0000-0000-000000000001","role":"authenticated","is_anonymous":false,"email":"thaybao@minclass.local"}', true);
select is(
  (public.get_teacher_session_reflections('e1500000-0000-0000-0000-000000000001')->>'submittedCount')::integer,
  2,
  'Teacher sees the submitted reflection count'
);
select is(
  (
    select (reflection->>'speakingCount')::integer
    from jsonb_array_elements(public.get_teacher_session_reflections('e1500000-0000-0000-0000-000000000001')->'reflections') reflection
    where reflection->>'mssv' = '23162011'
  ),
  3,
  'Teacher sees the correct speaking count for each MSSV'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-0000-0000-000000000002","role":"authenticated","is_anonymous":false,"email":"other@minclass.local"}', true);
select throws_ok(
  $$select public.get_teacher_session_reflections('e1500000-0000-0000-0000-000000000001')$$,
  '42501',
  'Session reflections are not available.',
  'Another account cannot read Teacher reflection data'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-0000-0000-000000000001","role":"authenticated","is_anonymous":false,"email":"thaybao@minclass.local"}', true);
select lives_ok(
  $$select public.delete_room('e1500000-0000-0000-0000-000000000001')$$,
  'Teacher deletes the Session'
);

set local role postgres;
select is((select count(*) from public.session_reflections), 0::bigint, 'Deleting a Session cascades its reflections');

select * from finish();
rollback;
