begin;

create extension if not exists pgtap with schema extensions;
set local role postgres;
set local search_path = public, extensions;

select extensions.plan(9);

insert into auth.users (id, instance_id, aud, role, encrypted_password, email, created_at, updated_at, is_anonymous)
values
  ('ac000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', 'thaybao@minclass.local', now(), now(), false),
  ('bc000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', 'other@example.com', now(), now(), false),
  ('cc000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', null, now(), now(), true);

insert into public.subjects (id, teacher_id, name, code)
values
  ('ac100000-0000-0000-0000-000000000001', 'ac000000-0000-0000-0000-000000000001', 'Subject A', 'CHAPA'),
  ('bc100000-0000-0000-0000-000000000001', 'bc000000-0000-0000-0000-000000000001', 'Subject B', 'CHAPB');

insert into public.course_sections (id, subject_id, section_code)
values
  ('ac200000-0000-0000-0000-000000000001', 'ac100000-0000-0000-0000-000000000001', 'CHAPTERSECA');

insert into public.chapters (id, subject_id, name)
values
  ('ac250000-0000-0000-0000-000000000001', 'ac100000-0000-0000-0000-000000000001', 'Chương 1: Giới thiệu'),
  ('bc250000-0000-0000-0000-000000000001', 'bc100000-0000-0000-0000-000000000001', 'Chương riêng');

select extensions.has_table('public', 'chapters', 'Lesson Plan uses the chapters table');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"ac000000-0000-0000-0000-000000000001","role":"authenticated","is_anonymous":false,"email":"thaybao@minclass.local"}', true);

select extensions.is(
  (select count(*) from public.chapters),
  1::bigint,
  'Teacher reads only Chapters from owned Subjects'
);

select extensions.lives_ok(
  $$update public.chapters set name = 'Chapter One' where id = 'ac250000-0000-0000-0000-000000000001'$$,
  'Teacher updates an owned Chapter'
);

select extensions.is(
  (with changed as (
    update public.chapters
    set name = 'Unauthorized'
    where id = 'bc250000-0000-0000-0000-000000000001'
    returning id
  ) select count(*) from changed),
  0::bigint,
  'Teacher cannot update another owner Chapter'
);

select extensions.throws_matching(
  $$insert into public.chapters (subject_id, name) values ('ac100000-0000-0000-0000-000000000001', 'chapter one')$$,
  'duplicate key value',
  'Chapter names are unique per Subject without case sensitivity'
);

select extensions.throws_ok(
  $$select * from public.create_course_section_lesson(
    'ac200000-0000-0000-0000-000000000001',
    'bc250000-0000-0000-0000-000000000001',
    'Wrong Chapter',
    '# Wrong',
    '{"title":"Wrong","description":null,"sections":[{"id":"s","position":0,"type":"CONTENT","title":"S","contentMd":"Content"}]}'::jsonb
  )$$,
  '42501',
  'Chapter is not available for this Course Section.',
  'Lesson cannot use a Chapter from another Subject'
);

select extensions.lives_ok(
  $$select * from public.create_course_section_lesson(
    'ac200000-0000-0000-0000-000000000001',
    'ac250000-0000-0000-0000-000000000001',
    'Valid Chapter Lesson',
    '# Valid',
    '{"title":"Valid","description":null,"sections":[{"id":"s","position":0,"type":"CONTENT","title":"S","contentMd":"Content"}]}'::jsonb
  )$$,
  'Teacher creates a Lesson in an owned Chapter'
);

select extensions.is(
  (select chapters.course_section_id from public.lessons join public.chapters on chapters.id = lessons.chapter_id where lessons.title = 'Valid Chapter Lesson'),
  'ac200000-0000-0000-0000-000000000001'::uuid,
  'Lesson persists an independent Course Section Chapter'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cc000000-0000-0000-0000-000000000001","role":"authenticated","is_anonymous":true}', true);

select extensions.is(
  (select count(*) from public.chapters),
  0::bigint,
  'Anonymous Student cannot browse the Lesson Plan table'
);

select * from extensions.finish();
rollback;
