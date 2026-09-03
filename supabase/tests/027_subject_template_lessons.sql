begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(17);

insert into auth.users (id, instance_id, aud, role, encrypted_password, email, created_at, updated_at, is_anonymous)
values
  ('a7000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', 'thaybao@minclass.local', now(), now(), false),
  ('b7000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', 'other@example.com', now(), now(), false);

insert into public.subjects (id, teacher_id, name, code)
values
  ('a7100000-0000-4000-8000-000000000001', 'a7000000-0000-4000-8000-000000000001', 'Template Subject', 'TMPL'),
  ('b7100000-0000-4000-8000-000000000001', 'b7000000-0000-4000-8000-000000000001', 'Private Subject', 'PRIVATE');

insert into public.chapters (id, subject_id, name)
values
  ('a7200000-0000-4000-8000-000000000001', 'a7100000-0000-4000-8000-000000000001', 'Chapter 1'),
  ('b7200000-0000-4000-8000-000000000001', 'b7100000-0000-4000-8000-000000000001', 'Private Chapter');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a7000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false,"email":"thaybao@minclass.local"}', true);

select lives_ok(
  $$select * from public.create_subject_template_lesson(
    'a7100000-0000-4000-8000-000000000001',
    'a7200000-0000-4000-8000-000000000001',
    'Template Lesson',
    '# Template',
    '{"title":"Template Lesson","description":"Subject source","sections":[
      {"id":"intro","position":0,"type":"CONTENT","title":"Introduction","contentMd":"Original content"},
      {"id":"quiz","position":1,"type":"QUIZ","title":"Quiz","contentMd":"","quiz":{"questions":[
        {"id":"q1","position":0,"type":"SINGLE_CHOICE","questionText":"Correct?","options":[
          {"id":"yes","position":0,"content":"Yes","isCorrect":true},
          {"id":"no","position":1,"content":"No","isCorrect":false}
        ]}
      ]}}
    ]}'::jsonb
  )$$,
  'Teacher creates a reusable Subject Lesson template'
);

select is((select count(*) from public.lessons where subject_id = 'a7100000-0000-4000-8000-000000000001'), 1::bigint,
  'Template uses the existing lessons table');

select lives_ok(
  $$select public.create_course_section_from_template('a7100000-0000-4000-8000-000000000001', 'TEMPLATESEC01', 'Morning')$$,
  'Creating a Course Section clones its Subject Lesson Plan'
);

select is((select count(*) from public.lessons where course_section_id is not null), 1::bigint,
  'Course Section receives one independent Lesson copy');

select isnt(
  (select id from public.lessons where subject_id is not null),
  (select id from public.lessons where course_section_id is not null),
  'Template and Course Lesson have different IDs'
);

reset role;
select is((select count(*) from public.sections join public.lessons on lessons.id = sections.lesson_id where lessons.course_section_id is not null), 2::bigint,
  'All Sections are cloned');
select is((select count(*) from public.quiz_answer_keys join public.quiz_questions on quiz_questions.id = quiz_answer_keys.question_id join public.quizzes on quizzes.id = quiz_questions.quiz_id join public.sections on sections.id = quizzes.section_id join public.lessons on lessons.id = sections.lesson_id where lessons.course_section_id is not null), 1::bigint,
  'Quiz answer keys are cloned server-side');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a7000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false,"email":"thaybao@minclass.local"}', true);
select lives_ok(
  $$select public.update_owned_lesson(
    (select id from public.lessons where subject_id = 'a7100000-0000-4000-8000-000000000001'),
    'a7200000-0000-4000-8000-000000000001', 'Updated Template', '# Updated',
    '{"title":"Updated Template","description":null,"sections":[{"id":"new","position":0,"type":"CONTENT","title":"New","contentMd":"Updated content"}]}'::jsonb
  )$$,
  'Teacher can update the Subject template'
);

select is((select title from public.lessons where course_section_id is not null), 'Template Lesson',
  'Updating the template does not mutate an existing Course Lesson');

select throws_ok(
  $$select public.create_course_section_from_template('b7100000-0000-4000-8000-000000000001', 'PRIVATESEC01', '')$$,
  '42501', 'Subject is not available.',
  'Teacher cannot clone another owner Subject'
);

select lives_ok(
  $$select public.delete_owned_lesson((select id from public.lessons where subject_id = 'a7100000-0000-4000-8000-000000000001'))$$,
  'Deleting a template is allowed'
);

select is((select count(*) from public.lessons where course_section_id is not null), 1::bigint,
  'Deleting the template does not delete existing Course copies');

reset role;
insert into public.rooms (teacher_user_id, title, status, started_at, ended_at, lesson_id)
select 'a7000000-0000-4000-8000-000000000001', 'Historical Session', 'ENDED', now(), now(), id
from public.lessons where course_section_id is not null;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a7000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false,"email":"thaybao@minclass.local"}', true);
select throws_ok(
  $$select public.update_owned_lesson(
    (select id from public.lessons where course_section_id is not null),
    (select chapter_id from public.lessons where course_section_id is not null),
    'Changed History', '# Changed',
    '{"title":"Changed","description":null,"sections":[{"id":"s","position":0,"type":"CONTENT","title":"S","contentMd":"Changed"}]}'::jsonb
  )$$,
  '23514', 'A Lesson with Session history cannot be edited.',
  'Course Lesson content is immutable after a Session exists'
);
select lives_ok(
  $$select public.delete_owned_lesson((select id from public.lessons where course_section_id is not null))$$,
  'Teacher can delete a Course Lesson after a Session exists'
);
select is((select count(*) from public.lessons where course_section_id is not null), 0::bigint,
  'Deleting the Course Lesson removes it');
select is((select count(*) from public.rooms where title = 'Historical Session'), 0::bigint,
  'Deleting the Course Lesson cascades its Session history');

select throws_ok(
  $$select public.create_course_section_from_template('a7100000-0000-4000-8000-000000000001', 'EMPTYPLAN01', '')$$,
  '23514', 'Create at least one template Lesson first.',
  'A Course Section cannot be created through the application RPC without a template Lesson'
);

select * from finish();
rollback;
