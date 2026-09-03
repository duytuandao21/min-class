begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(3);

insert into auth.users (id, instance_id, aud, role, encrypted_password, email, created_at, updated_at, is_anonymous)
values
  ('aa000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', 'thaybao@minclass.local', now(), now(), false),
  ('ca000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', null, now(), now(), true);

insert into public.subjects (id, teacher_id, name)
values ('aa100000-0000-4000-8000-000000000001', 'aa000000-0000-4000-8000-000000000001', 'Snapshot');
insert into public.course_sections (id, subject_id, section_code)
values ('aa200000-0000-4000-8000-000000000001', 'aa100000-0000-4000-8000-000000000001', 'SNAPSHOT01');
insert into public.chapters (id, course_section_id, name)
values ('aa300000-0000-4000-8000-000000000001', 'aa200000-0000-4000-8000-000000000001', 'Chapter');
insert into public.lessons (id, course_section_id, chapter_id, title, markdown_source)
values ('aa400000-0000-4000-8000-000000000001', 'aa200000-0000-4000-8000-000000000001', 'aa300000-0000-4000-8000-000000000001', 'Lesson', '# Lesson');
insert into public.sections (id, lesson_id, position, type, title, content_md)
values ('aa500000-0000-4000-8000-000000000001', 'aa400000-0000-4000-8000-000000000001', 0, 'CONTENT', 'Section', 'Content');
insert into public.course_section_students (course_section_id, mssv)
values ('aa200000-0000-4000-8000-000000000001', '23162011');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aa000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false,"email":"thaybao@minclass.local"}', true);
select lives_ok(
  $$select * from public.start_chapter_session('aa200000-0000-4000-8000-000000000001', 'aa300000-0000-4000-8000-000000000001')$$,
  'Teacher starts the Session'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"ca000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":true}', true);
select lives_ok(
  $$select * from public.join_live_lesson('aa400000-0000-4000-8000-000000000001', '23162011')$$,
  'Roster Student joins the Session'
);
select lives_ok(
  $$select * from public.get_student_session_lesson_snapshot(
    (select session_id from public.session_lessons where lesson_id = 'aa400000-0000-4000-8000-000000000001'),
    'aa400000-0000-4000-8000-000000000001'
  )$$,
  'Joined Student loads the Lesson snapshot without ambiguous output columns'
);

select * from finish();
rollback;
