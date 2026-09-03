begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(31);

select has_table('public', 'session_attendance', 'Session attendance table exists');
select has_function('public', 'join_live_lesson', array['uuid', 'text'], 'MSSV-only LIVE Lesson join RPC exists');
select ok(
  has_function_privilege('authenticated', 'public.join_live_lesson(uuid, text)', 'EXECUTE'),
  'Authenticated sessions can invoke the LIVE Lesson join RPC'
);
select ok(
  not has_function_privilege('anon', 'public.join_live_lesson(uuid, text)', 'EXECUTE'),
  'Unauthenticated clients cannot invoke the LIVE Lesson join RPC'
);
select ok(
  exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'session_attendance'
  ),
  'Attendance updates are published for the Live Dashboard'
);
select ok(
  not has_table_privilege('authenticated', 'public.session_attendance', 'INSERT'),
  'Authenticated clients cannot insert attendance outside the snapshot RPC'
);

insert into auth.users (id, instance_id, aud, role, encrypted_password, email, created_at, updated_at, is_anonymous)
values
  ('a7100000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', 'attendance-teacher@minclass.test', now(), now(), false),
  ('a7100000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', 'other-teacher@minclass.local', now(), now(), false),
  ('c7100000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', null, now(), now(), true),
  ('c7100000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', null, now(), now(), true);

insert into public.subjects (id, teacher_id, name, code)
values ('a7110000-0000-0000-0000-000000000001', 'a7100000-0000-0000-0000-000000000001', 'Attendance Subject', 'ATTEND');

insert into public.course_sections (id, subject_id, section_code)
values ('a7120000-0000-0000-0000-000000000001', 'a7110000-0000-0000-0000-000000000001', 'ATTEND01');

insert into public.course_section_students (course_section_id, mssv)
values
  ('a7120000-0000-0000-0000-000000000001', '23110001'),
  ('a7120000-0000-0000-0000-000000000001', '23110002'),
  ('a7120000-0000-0000-0000-000000000001', '23110003');

insert into public.lessons (id, room_id, course_section_id, title, markdown_source)
values ('a7130000-0000-0000-0000-000000000001', null, 'a7120000-0000-0000-0000-000000000001', 'Attendance Lesson', '# Attendance');

insert into public.sections (id, lesson_id, position, type, title, content_md)
values ('a7140000-0000-0000-0000-000000000001', 'a7130000-0000-0000-0000-000000000001', 0, 'CONTENT', 'Attendance Section', 'Content');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a7100000-0000-0000-0000-000000000001","role":"authenticated","is_anonymous":false,"email":"thaybao@minclass.local"}', true);

select lives_ok(
  $$select * from public.start_lesson_session('a7130000-0000-0000-0000-000000000001')$$,
  'Teacher starts the Lesson Session'
);
select set_config(
  'test.session_id',
  (select id::text from public.rooms where lesson_id = 'a7130000-0000-0000-0000-000000000001'),
  true
);
select is(
  (select count(*) from public.session_attendance where session_id = current_setting('test.session_id')::uuid),
  3::bigint,
  'Start snapshots the complete current roster'
);
select is(
  (select count(*) from public.session_attendance where session_id = current_setting('test.session_id')::uuid and joined_at is not null),
  0::bigint,
  'Every snapshot row starts absent'
);

select throws_ok(
  $$select * from public.join_live_lesson(
    'a7130000-0000-0000-0000-000000000001',
    '23110001'
  )$$,
  '42501',
  'Lesson Session is not available.',
  'A permanent Teacher session cannot join as a Student'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c7100000-0000-0000-0000-000000000001","role":"authenticated","is_anonymous":true}', true);

select lives_ok(
  $$select * from public.join_live_lesson(
    'a7130000-0000-0000-0000-000000000001',
    '23110001'
  )$$,
  'A Student in the snapshot can join with MSSV only'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a7100000-0000-0000-0000-000000000001","role":"authenticated","is_anonymous":false,"email":"thaybao@minclass.local"}', true);
select ok(
  (select joined_at is not null from public.session_attendance where session_id = current_setting('test.session_id')::uuid and mssv = '23110001'),
  'Joining updates the snapshotted attendance joined_at'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c7100000-0000-0000-0000-000000000001","role":"authenticated","is_anonymous":true}', true);
select lives_ok(
  $$select * from public.join_live_lesson(
    'a7130000-0000-0000-0000-000000000001',
    '23110001'
  )$$,
  'Duplicate retry from the same anonymous Student is idempotent'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a7100000-0000-0000-0000-000000000001","role":"authenticated","is_anonymous":false,"email":"thaybao@minclass.local"}', true);
select is(
  (select count(*) from public.participants where room_id = current_setting('test.session_id')::uuid),
  1::bigint,
  'Duplicate retry does not create another participant'
);
select is(
  (select count(*) from public.session_attendance where session_id = current_setting('test.session_id')::uuid and joined_at is not null),
  1::bigint,
  'Duplicate retry does not change attendance cardinality'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a7100000-0000-0000-0000-000000000001","role":"authenticated","is_anonymous":false,"email":"thaybao@minclass.local"}', true);

select lives_ok(
  $$select public.replace_course_section_roster(
    'a7120000-0000-0000-0000-000000000001',
    array['23110001', '23110002', '23110004']
  )$$,
  'Teacher can change the Course Section roster after Session start'
);
select is(
  (select count(*) from public.session_attendance where session_id = current_setting('test.session_id')::uuid),
  3::bigint,
  'A LIVE Session attendance snapshot follows the latest roster size'
);
select ok(
  not exists (
    select 1 from public.session_attendance
    where session_id = current_setting('test.session_id')::uuid
      and mssv = '23110003'
  ),
  'A removed, not-yet-joined MSSV is removed from the LIVE Session'
);
select ok(
  exists (
    select 1 from public.session_attendance
    where session_id = current_setting('test.session_id')::uuid
      and mssv = '23110004'
  ),
  'A newly added roster MSSV is added to the LIVE Session immediately'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c7100000-0000-0000-0000-000000000002","role":"authenticated","is_anonymous":true}', true);

select lives_ok(
  $$select * from public.join_live_lesson(
    'a7130000-0000-0000-0000-000000000001',
    '23110004'
  )$$,
  'A newly synchronized Student can join the LIVE Session'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a7100000-0000-0000-0000-000000000001","role":"authenticated","is_anonymous":false,"email":"thaybao@minclass.local"}', true);

select lives_ok(
  $$select * from public.end_room(current_setting('test.session_id')::uuid)$$,
  'Teacher ends the Session without deleting attendance'
);
select is(
  (public.get_teacher_session_attendance(current_setting('test.session_id')::uuid)->>'rosterCount')::integer,
  3,
  'Ended Summary reports the snapshotted class size'
);
select is(
  (public.get_teacher_session_attendance(current_setting('test.session_id')::uuid)->>'joinedCount')::integer,
  2,
  'Ended Summary reports joined Students'
);
select is(
  (public.get_teacher_session_attendance(current_setting('test.session_id')::uuid)->>'absentCount')::integer,
  1,
  'Ended Summary calculates absent Students'
);
select is(
  public.get_teacher_session_attendance(current_setting('test.session_id')::uuid)->'absentMssvs',
  '["23110002"]'::jsonb,
  'Ended Summary returns the historical absent MSSV list'
);

select lives_ok(
  $$select public.replace_course_section_roster(
    'a7120000-0000-0000-0000-000000000001',
    array['99990001']
  )$$,
  'Teacher can change the Course Section roster after Session End'
);
select is(
  public.get_teacher_session_attendance(current_setting('test.session_id')::uuid)->'absentMssvs',
  '["23110002"]'::jsonb,
  'Roster changes after End do not alter historical attendance'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c7100000-0000-0000-0000-000000000002","role":"authenticated","is_anonymous":true}', true);
select is(
  (select count(*) from public.session_attendance where session_id = current_setting('test.session_id')::uuid),
  0::bigint,
  'Student cannot download the Session roster through RLS'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a7100000-0000-0000-0000-000000000002","role":"authenticated","is_anonymous":false,"email":"thaybao@minclass.local"}', true);
select is(
  (select count(*) from public.session_attendance),
  0::bigint,
  'A different Teacher cannot read Session attendance rows'
);
select throws_ok(
  $$select public.get_teacher_session_attendance(current_setting('test.session_id')::uuid)$$,
  '42501',
  'Session attendance is not available.',
  'A different Teacher cannot read attendance through the RPC'
);

set local role postgres;
delete from public.rooms where id = current_setting('test.session_id')::uuid;
select is(
  (select count(*) from public.session_attendance where session_id = current_setting('test.session_id')::uuid),
  0::bigint,
  'Deleting a Session cascades its attendance snapshot'
);

select * from finish();
rollback;
