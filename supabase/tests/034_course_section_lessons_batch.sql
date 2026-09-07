begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(9);

insert into auth.users (id, instance_id, aud, role, encrypted_password, email, created_at, updated_at, is_anonymous)
values
  ('e1000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', 'thaybao@minclass.local', now(), now(), false),
  ('e1000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', 'other@minclass.local', now(), now(), false);

insert into public.subjects (id, teacher_id, name, code)
values ('e1100000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', 'Batch Subject', 'BATCH');
insert into public.course_sections (id, subject_id, section_code, display_name)
values ('e1200000-0000-4000-8000-000000000001', 'e1100000-0000-4000-8000-000000000001', 'BATCHSEC01', 'Batch Class');
insert into public.chapters (id, course_section_id, name)
values ('e1300000-0000-4000-8000-000000000001', 'e1200000-0000-4000-8000-000000000001', 'Chapter 1');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false,"email":"thaybao@minclass.local"}', true);

select lives_ok(
  $$select public.create_course_section_lessons_batch(
    'e1200000-0000-4000-8000-000000000001',
    'e1300000-0000-4000-8000-000000000001',
    '[
      {"lessonTitle":"Lesson One","markdownSource":"# One","lesson":{"title":"Lesson One","description":null,"sections":[{"id":"one","position":0,"type":"CONTENT","title":"One","contentMd":"Content one"}]}},
      {"lessonTitle":"Lesson Two","markdownSource":"# Two","lesson":{"title":"Lesson Two","description":null,"sections":[{"id":"two","position":0,"type":"CONTENT","title":"Two","contentMd":"Content two"}]}}
    ]'::jsonb
  )$$,
  'Teacher creates multiple Lessons in one batch'
);

select is((select count(*) from public.lessons where course_section_id = 'e1200000-0000-4000-8000-000000000001'), 2::bigint,
  'batch persists every Lesson');
reset role;
select is((select count(*) from public.sections join public.lessons on lessons.id = sections.lesson_id where lessons.course_section_id = 'e1200000-0000-4000-8000-000000000001'), 2::bigint,
  'batch persists normalized Sections for every Lesson');
select is((select count(distinct chapter_id) from public.lessons where course_section_id = 'e1200000-0000-4000-8000-000000000001'), 1::bigint,
  'all Lessons are attached to the selected Chapter');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false,"email":"thaybao@minclass.local"}', true);

select throws_ok(
  $$select public.create_course_section_lessons_batch(
    'e1200000-0000-4000-8000-000000000001', 'e1300000-0000-4000-8000-000000000001',
    '[
      {"lessonTitle":"Duplicate","markdownSource":"# A","lesson":{"sections":[{"id":"a","position":0,"type":"CONTENT","title":"A","contentMd":"A"}]}},
      {"lessonTitle":"duplicate","markdownSource":"# B","lesson":{"sections":[{"id":"b","position":0,"type":"CONTENT","title":"B","contentMd":"B"}]}}
    ]'::jsonb
  )$$,
  '23505', 'Lesson titles must be unique within a batch.',
  'duplicate titles are rejected by the database'
);
select is((select count(*) from public.lessons where course_section_id = 'e1200000-0000-4000-8000-000000000001'), 2::bigint,
  'duplicate batch creates no Lesson');

select throws_ok(
  $$select public.create_course_section_lessons_batch(
    'e1200000-0000-4000-8000-000000000001', 'e1300000-0000-4000-8000-000000000001',
    '[
      {"lessonTitle":"Would Roll Back","markdownSource":"# Good","lesson":{"sections":[{"id":"good","position":0,"type":"CONTENT","title":"Good","contentMd":"Good"}]}},
      {"lessonTitle":" Invalid ","markdownSource":"# Invalid","lesson":{"sections":[{"id":"bad","position":0,"type":"CONTENT","title":"Bad","contentMd":"Bad"}]}}
    ]'::jsonb
  )$$,
  '22023', 'Invalid Lesson title.',
  'an invalid item rejects the complete batch'
);
select is((select count(*) from public.lessons where course_section_id = 'e1200000-0000-4000-8000-000000000001'), 2::bigint,
  'failed batch rolls back Lessons created earlier in the same call');

select set_config('request.jwt.claims', '{"sub":"e1000000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":false,"email":"other@minclass.local"}', true);
select throws_ok(
  $$select public.create_course_section_lessons_batch(
    'e1200000-0000-4000-8000-000000000001', 'e1300000-0000-4000-8000-000000000001',
    '[{"lessonTitle":"Unauthorized","markdownSource":"# No","lesson":{"sections":[{"id":"no","position":0,"type":"CONTENT","title":"No","contentMd":"No"}]}}]'::jsonb
  )$$,
  '42501', 'Chapter is not available.',
  'another user cannot add Lessons to the Course Section'
);

select * from finish();
rollback;
