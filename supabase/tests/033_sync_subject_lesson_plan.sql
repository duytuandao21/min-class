begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(19);

insert into auth.users (id, instance_id, aud, role, encrypted_password, email, created_at, updated_at, is_anonymous)
values
  ('d1000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', 'thaybao@minclass.local', now(), now(), false),
  ('d1000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', 'other@minclass.local', now(), now(), false);

insert into public.subjects (id, teacher_id, name, code) values
  ('d1100000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 'Sync subject', 'SYNC'),
  ('d1100000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000002', 'Other subject', 'OTHER');
insert into public.chapters (id, subject_id, name) values
  ('d1200000-0000-4000-8000-000000000001', 'd1100000-0000-4000-8000-000000000001', 'Chapter 1'),
  ('d1200000-0000-4000-8000-000000000002', 'd1100000-0000-4000-8000-000000000002', 'Other chapter');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d1000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false,"email":"thaybao@minclass.local"}', true);

select public.create_subject_template_lesson(
  'd1100000-0000-4000-8000-000000000001', 'd1200000-0000-4000-8000-000000000001',
  'Seed Lesson', '# seed',
  '{"title":"Seed Lesson","description":null,"sections":[{"id":"one","position":0,"type":"CONTENT","title":"One","contentMd":"Seed"}]}'::jsonb
);
select pass('creates seed template');
select public.create_course_section_from_template('d1100000-0000-4000-8000-000000000001', 'SYNCSEC01', '');
select pass('creates first existing Course Section');
select public.create_course_section_from_template('d1100000-0000-4000-8000-000000000001', 'SYNCSEC02', '');
select pass('creates second existing Course Section');

select is(
  ((public.create_subject_chapter_synced('d1100000-0000-4000-8000-000000000001', 'Chapter synced', true))->>'appliedCount')::integer,
  2, 'new template Chapter is copied to existing Course Sections by default'
);
select is(
  ((public.create_subject_chapter_synced('d1100000-0000-4000-8000-000000000001', 'Chapter future only', false))->>'appliedCount')::integer,
  0, 'Teacher can opt out of applying a new Chapter'
);
select is((select count(*) from public.chapters where course_section_id is not null and name = 'Chapter future only'), 0::bigint,
  'opted-out Chapter is not copied');

select is(
  ((public.create_subject_template_lesson_synced(
    'd1100000-0000-4000-8000-000000000001',
    (select id from public.chapters where subject_id = 'd1100000-0000-4000-8000-000000000001' and name = 'Chapter future only'),
    'Late applied Lesson', '# late',
    '{"title":"Late applied Lesson","description":null,"sections":[{"id":"one","position":0,"type":"CONTENT","title":"One","contentMd":"Late"}]}'::jsonb,
    true
  ))->>'appliedCount')::integer,
  2, 'applying a Lesson also creates its previously opted-out linked Chapters'
);
select is((select count(*) from public.chapters where course_section_id is not null and name = 'Chapter future only'), 2::bigint,
  'late application restores the missing Chapter relationship');

select is(
  ((public.create_subject_template_lesson_synced(
    'd1100000-0000-4000-8000-000000000001',
    (select id from public.chapters where subject_id = 'd1100000-0000-4000-8000-000000000001' and name = 'Chapter synced'),
    'Synced Lesson', '# synced',
    '{"title":"Synced Lesson","description":null,"sections":[{"id":"one","position":0,"type":"CONTENT","title":"One","contentMd":"Original"}]}'::jsonb,
    true
  ))->>'appliedCount')::integer,
  2, 'new template Lesson is copied to all linked Chapters'
);
select is((select count(*) from public.lessons where course_section_id is not null and title = 'Synced Lesson'), 2::bigint,
  'each Course Section receives one linked Lesson copy');

reset role;
insert into public.rooms (teacher_user_id, title, status, started_at, ended_at, lesson_id)
select 'd1000000-0000-4000-8000-000000000001', 'Historical Session', 'ENDED', now(), now(), id
from public.lessons where course_section_id is not null and title = 'Synced Lesson' order by id limit 1;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d1000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false,"email":"thaybao@minclass.local"}', true);

select is(
  ((public.update_subject_template_lesson_synced(
    'd1100000-0000-4000-8000-000000000001',
    (select id from public.lessons where subject_id = 'd1100000-0000-4000-8000-000000000001' and title = 'Synced Lesson'),
    (select id from public.chapters where subject_id = 'd1100000-0000-4000-8000-000000000001' and name = 'Chapter synced'),
    'Updated Lesson', '# updated',
    '{"title":"Updated Lesson","description":null,"sections":[{"id":"one","position":0,"type":"CONTENT","title":"One","contentMd":"Updated"}]}'::jsonb,
    true
  ))->>'appliedCount')::integer,
  1, 'template Lesson update is applied only to mutable linked copies'
);
select is((select count(*) from public.lessons where course_section_id is not null and title = 'Updated Lesson'), 1::bigint,
  'mutable Course Lesson contains the updated title');
select is((select count(*) from public.lessons where course_section_id is not null and title = 'Synced Lesson'), 1::bigint,
  'Course Lesson with Session history remains unchanged');
select is((select count(*) from public.rooms where title = 'Historical Session'), 1::bigint,
  'sync preserves historical Session data');

select public.update_course_section_chapter_independent(
  'd1100000-0000-4000-8000-000000000001',
  (select course_section_id from public.lessons where course_section_id is not null and title = 'Updated Lesson'),
  (select chapter_id from public.lessons where course_section_id is not null and title = 'Updated Lesson'),
  'Customized Chapter'
);
select is((select template_lesson_id from public.lessons where course_section_id is not null and title = 'Updated Lesson'), null,
  'customizing a Course Chapter detaches its Lessons from the template');
select is(
  ((public.update_subject_template_lesson_synced(
    'd1100000-0000-4000-8000-000000000001',
    (select id from public.lessons where subject_id = 'd1100000-0000-4000-8000-000000000001' and title = 'Updated Lesson'),
    (select id from public.chapters where subject_id = 'd1100000-0000-4000-8000-000000000001' and name = 'Chapter synced'),
    'Updated Again', '# again',
    '{"title":"Updated Again","description":null,"sections":[{"id":"one","position":0,"type":"CONTENT","title":"One","contentMd":"Again"}]}'::jsonb,
    true
  ))->>'appliedCount')::integer,
  0, 'historical and customized Course Lessons are not overwritten'
);
select is((select count(*) from public.lessons where title = 'Updated Lesson'), 1::bigint,
  'customized Course Lesson stays unchanged');

reset role;
select throws_ok(
  $$update public.chapters set template_chapter_id = 'd1200000-0000-4000-8000-000000000002'
    where id = (select id from public.chapters where course_section_id is not null and name = 'Chapter 1' order by id limit 1)$$,
  '23514', 'Template Chapter must belong to the same Subject.',
  'invalid cross-Subject source update is rejected'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d1000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false,"email":"thaybao@minclass.local"}', true);
select is(
  ((public.delete_subject_template_lesson_synced(
    'd1100000-0000-4000-8000-000000000001',
    (select id from public.lessons where subject_id = 'd1100000-0000-4000-8000-000000000001' and title = 'Updated Again'),
    false
  ))->>'appliedCount')::integer,
  0, 'Teacher can delete a template without deleting existing Course copies'
);

select * from finish();
rollback;
