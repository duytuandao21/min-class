begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(12);

insert into auth.users (id, instance_id, aud, role, encrypted_password, email, created_at, updated_at, is_anonymous)
values
  ('e2000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', 'thaybao@minclass.local', now(), now(), false),
  ('e2000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', 'other@minclass.local', now(), now(), false);

insert into public.subjects (id, teacher_id, name, code)
values ('e2100000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000001', 'Template Batch Subject', 'TBATCH');
insert into public.chapters (id, subject_id, name)
values ('e2200000-0000-4000-8000-000000000001', 'e2100000-0000-4000-8000-000000000001', 'Template Chapter');
insert into public.course_sections (id, subject_id, section_code, display_name)
values
  ('e2300000-0000-4000-8000-000000000001', 'e2100000-0000-4000-8000-000000000001', 'TBATCHSEC01', 'Class One'),
  ('e2300000-0000-4000-8000-000000000002', 'e2100000-0000-4000-8000-000000000001', 'TBATCHSEC02', 'Class Two');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e2000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false,"email":"thaybao@minclass.local"}', true);

select is(
  jsonb_array_length(public.create_subject_template_lessons_batch(
    'e2100000-0000-4000-8000-000000000001',
    'e2200000-0000-4000-8000-000000000001',
    '[
      {"lessonTitle":"Template One","markdownSource":"# One","lesson":{"title":"Template One","description":null,"sections":[{"id":"one","position":0,"type":"CONTENT","title":"One","contentMd":"Content one"}]}},
      {"lessonTitle":"Template Two","markdownSource":"# Two","lesson":{"title":"Template Two","description":null,"sections":[{"id":"two","position":0,"type":"CONTENT","title":"Two","contentMd":"Content two"}]}}
    ]'::jsonb,
    true
  )),
  2,
  'batch returns one result for each template Lesson'
);

select is((select count(*) from public.lessons where subject_id = 'e2100000-0000-4000-8000-000000000001'), 2::bigint,
  'batch creates every Subject template Lesson');
select is((select count(*) from public.lessons where course_section_id in ('e2300000-0000-4000-8000-000000000001', 'e2300000-0000-4000-8000-000000000002')), 4::bigint,
  'default sync creates an independent copy in every existing Course Section');
select is((select count(*) from public.lessons where course_section_id is not null and template_lesson_id is not null), 4::bigint,
  'Course Lesson copies retain their template links');

select is(
  (public.create_subject_template_lessons_batch(
    'e2100000-0000-4000-8000-000000000001',
    'e2200000-0000-4000-8000-000000000001',
    '[{"lessonTitle":"Future Only","markdownSource":"# Future","lesson":{"title":"Future Only","description":null,"sections":[{"id":"future","position":0,"type":"CONTENT","title":"Future","contentMd":"Future"}]}}]'::jsonb,
    false
  )->0->>'appliedCount')::integer,
  0,
  'Teacher can keep the existing opt-out behavior for the complete batch'
);
select is((select count(*) from public.lessons where subject_id = 'e2100000-0000-4000-8000-000000000001'), 3::bigint,
  'opted-out template Lesson is still saved in the Lesson Plan');
select is((select count(*) from public.lessons where course_section_id is not null), 4::bigint,
  'opted-out batch does not modify existing Course Sections');

select throws_ok(
  $$select public.create_subject_template_lessons_batch(
    'e2100000-0000-4000-8000-000000000001', 'e2200000-0000-4000-8000-000000000001',
    '[
      {"lessonTitle":"Duplicate","markdownSource":"# A","lesson":{"sections":[{"id":"a","position":0,"type":"CONTENT","title":"A","contentMd":"A"}]}},
      {"lessonTitle":"duplicate","markdownSource":"# B","lesson":{"sections":[{"id":"b","position":0,"type":"CONTENT","title":"B","contentMd":"B"}]}}
    ]'::jsonb,
    true
  )$$,
  '23505', 'Lesson titles must be unique within a batch.',
  'duplicate template titles are rejected'
);
select is((select count(*) from public.lessons where subject_id = 'e2100000-0000-4000-8000-000000000001'), 3::bigint,
  'duplicate batch creates no template Lesson');

select throws_ok(
  $$select public.create_subject_template_lessons_batch(
    'e2100000-0000-4000-8000-000000000001', 'e2200000-0000-4000-8000-000000000001',
    '[
      {"lessonTitle":"Would Roll Back","markdownSource":"# Good","lesson":{"sections":[{"id":"good","position":0,"type":"CONTENT","title":"Good","contentMd":"Good"}]}},
      {"lessonTitle":" Invalid ","markdownSource":"# Invalid","lesson":{"sections":[{"id":"bad","position":0,"type":"CONTENT","title":"Bad","contentMd":"Bad"}]}}
    ]'::jsonb,
    true
  )$$,
  '22023', 'Invalid Lesson title.',
  'one invalid template rejects the complete batch'
);
select is((select count(*) from public.lessons where subject_id = 'e2100000-0000-4000-8000-000000000001'), 3::bigint,
  'failed template batch rolls back earlier items and their Course copies');

select set_config('request.jwt.claims', '{"sub":"e2000000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":false,"email":"other@minclass.local"}', true);
select throws_ok(
  $$select public.create_subject_template_lessons_batch(
    'e2100000-0000-4000-8000-000000000001', 'e2200000-0000-4000-8000-000000000001',
    '[{"lessonTitle":"Unauthorized","markdownSource":"# No","lesson":{"sections":[{"id":"no","position":0,"type":"CONTENT","title":"No","contentMd":"No"}]}}]'::jsonb,
    true
  )$$,
  '42501', 'Chapter is not available.',
  'another user cannot add template Lessons to this Subject'
);

select * from finish();
rollback;
