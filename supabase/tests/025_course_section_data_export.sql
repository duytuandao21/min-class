begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(9);

select has_function(
  'public',
  'get_teacher_course_section_export',
  array['uuid', 'uuid'],
  'Course Section export RPC exists'
);
select ok(
  has_function_privilege('authenticated', 'public.get_teacher_course_section_export(uuid, uuid)', 'EXECUTE'),
  'Authenticated Teacher can invoke the export RPC'
);
select ok(
  not has_function_privilege('anon', 'public.get_teacher_course_section_export(uuid, uuid)', 'EXECUTE'),
  'Unauthenticated clients cannot invoke the export RPC'
);

insert into auth.users (id, instance_id, aud, role, encrypted_password, email, created_at, updated_at, is_anonymous)
values
  ('f1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', 'thaybao@minclass.local', now(), now(), false),
  ('f1000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', 'other-export@minclass.local', now(), now(), false),
  ('f1000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', null, now(), now(), true);

insert into public.subjects (id, teacher_id, name, code)
values ('f1100000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'Export Subject', 'EXPORT');

insert into public.course_sections (id, subject_id, section_code, display_name)
values ('f1200000-0000-0000-0000-000000000001', 'f1100000-0000-0000-0000-000000000001', 'EXPORT01', 'Export Class');

insert into public.course_section_students (course_section_id, mssv)
values
  ('f1200000-0000-0000-0000-000000000001', '00123456'),
  ('f1200000-0000-0000-0000-000000000001', '23162012');

insert into public.chapters (id, course_section_id, name)
values ('f1250000-0000-0000-0000-000000000001', 'f1200000-0000-0000-0000-000000000001', 'Chapter 1');

insert into public.lessons (id, room_id, course_section_id, chapter_id, title, markdown_source)
values
  ('f1300000-0000-0000-0000-000000000001', null, 'f1200000-0000-0000-0000-000000000001', 'f1250000-0000-0000-0000-000000000001', 'Lesson 1', '# Lesson 1'),
  ('f1300000-0000-0000-0000-000000000002', null, 'f1200000-0000-0000-0000-000000000001', 'f1250000-0000-0000-0000-000000000001', 'Lesson 2', '# Lesson 2');

insert into public.rooms (
  id, code, teacher_user_id, title, status, teaching_section, released_through, started_at, ended_at,
  lesson_id, course_section_id, chapter_id
)
values
  ('f1400000-0000-0000-0000-000000000001', 'EXP234', 'f1000000-0000-0000-0000-000000000001', 'Lesson 1 - A', 'ENDED', 0, 0, now(), now(), 'f1300000-0000-0000-0000-000000000001', 'f1200000-0000-0000-0000-000000000001', 'f1250000-0000-0000-0000-000000000001'),
  ('f1400000-0000-0000-0000-000000000002', 'EXP235', 'f1000000-0000-0000-0000-000000000001', 'Lesson 1 - B', 'ENDED', 0, 0, now(), now(), 'f1300000-0000-0000-0000-000000000001', 'f1200000-0000-0000-0000-000000000001', 'f1250000-0000-0000-0000-000000000001'),
  ('f1400000-0000-0000-0000-000000000003', 'EXP236', 'f1000000-0000-0000-0000-000000000001', 'Lesson 2', 'ENDED', 0, 0, now(), now(), 'f1300000-0000-0000-0000-000000000002', 'f1200000-0000-0000-0000-000000000001', 'f1250000-0000-0000-0000-000000000001');

insert into public.session_attendance (session_id, mssv, joined_at)
values
  ('f1400000-0000-0000-0000-000000000001', '00123456', now()),
  ('f1400000-0000-0000-0000-000000000001', '23162012', null),
  ('f1400000-0000-0000-0000-000000000002', '00123456', now()),
  ('f1400000-0000-0000-0000-000000000002', '23162012', null),
  ('f1400000-0000-0000-0000-000000000003', '00123456', null),
  ('f1400000-0000-0000-0000-000000000003', '23162012', null);

insert into public.participants (id, room_id, user_id, mssv)
values
  ('f1500000-0000-0000-0000-000000000001', 'f1400000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000003', '00123456'),
  ('f1500000-0000-0000-0000-000000000002', 'f1400000-0000-0000-0000-000000000002', 'f1000000-0000-0000-0000-000000000003', '00123456');

insert into public.session_reflections (participant_id, speaking_count, review_body)
values
  ('f1500000-0000-0000-0000-000000000001', 2, null),
  ('f1500000-0000-0000-0000-000000000002', 3, null);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f1000000-0000-0000-0000-000000000001","role":"authenticated","is_anonymous":false,"email":"thaybao@minclass.local"}', true);

select is(
  (public.get_teacher_course_section_export('f1100000-0000-0000-0000-000000000001', 'f1200000-0000-0000-0000-000000000001')->>'totalClassMeetings')::integer,
  3,
  'Each started Chapter Session counts as one class meeting'
);
select is(
  (
    select (student->>'attendedClassMeetingCount')::integer
    from jsonb_array_elements(public.get_teacher_course_section_export('f1100000-0000-0000-0000-000000000001', 'f1200000-0000-0000-0000-000000000001')->'students') student
    where student->>'mssv' = '00123456'
  ),
  2,
  'Each joined Chapter Session counts as one attended class meeting'
);
select is(
  (
    select (student->>'speakingCount')::integer
    from jsonb_array_elements(public.get_teacher_course_section_export('f1100000-0000-0000-0000-000000000001', 'f1200000-0000-0000-0000-000000000001')->'students') student
    where student->>'mssv' = '00123456'
  ),
  5,
  'Speaking counts are summed across Sessions in the Course Section'
);
select is(
  (
    select count(*)
    from jsonb_array_elements(public.get_teacher_course_section_export('f1100000-0000-0000-0000-000000000001', 'f1200000-0000-0000-0000-000000000001')->'students')
  ),
  2::bigint,
  'Export contains every MSSV in the current uploaded roster'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f1000000-0000-0000-0000-000000000002","role":"authenticated","is_anonymous":false,"email":"thaybao@minclass.local"}', true);
select is(
  public.get_teacher_course_section_export('f1100000-0000-0000-0000-000000000001', 'f1200000-0000-0000-0000-000000000001'),
  null::jsonb,
  'Another Teacher cannot export a Course Section they do not own'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f1000000-0000-0000-0000-000000000003","role":"authenticated","is_anonymous":true}', true);
select throws_ok(
  $$select public.get_teacher_course_section_export('f1100000-0000-0000-0000-000000000001', 'f1200000-0000-0000-0000-000000000001')$$,
  '42501',
  'Teacher account required.',
  'Student cannot export Course Section data'
);

select * from finish();
rollback;
