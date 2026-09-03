begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(14);

insert into auth.users (id, instance_id, aud, role, encrypted_password, email, created_at, updated_at, is_anonymous)
values
  ('ad000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', 'thaybao@minclass.local', now(), now(), false),
  ('bd000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', 'other@example.com', now(), now(), false),
  ('cd000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', null, now(), now(), true);

insert into public.subjects (id, teacher_id, name, code)
values
  ('ad100000-0000-0000-0000-000000000001', 'ad000000-0000-0000-0000-000000000001', 'Subject A', 'LESSONA'),
  ('bd100000-0000-0000-0000-000000000001', 'bd000000-0000-0000-0000-000000000001', 'Subject B', 'LESSONB');

insert into public.course_sections (id, subject_id, section_code)
values
  ('ad200000-0000-0000-0000-000000000001', 'ad100000-0000-0000-0000-000000000001', 'LESSONSECA'),
  ('bd200000-0000-0000-0000-000000000001', 'bd100000-0000-0000-0000-000000000001', 'LESSONSECB');

insert into public.chapters (id, subject_id, name)
values
  ('ad250000-0000-0000-0000-000000000001', 'ad100000-0000-0000-0000-000000000001', 'Chapter A'),
  ('bd250000-0000-0000-0000-000000000001', 'bd100000-0000-0000-0000-000000000001', 'Chapter B');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"ad000000-0000-0000-0000-000000000001","role":"authenticated","is_anonymous":false,"email":"thaybao@minclass.local"}', true);

select lives_ok(
  $$select * from public.create_course_section_lesson(
    'ad200000-0000-0000-0000-000000000001',
    'ad250000-0000-0000-0000-000000000001',
    'TCP Introduction',
    '# TCP Introduction',
    '{
      "title":"Markdown TCP",
      "description":"Persistent Lesson",
      "sections":[
        {"id":"intro","position":0,"type":"CONTENT","title":"Introduction","contentMd":"TCP content"},
        {"id":"quiz","position":1,"type":"QUIZ","title":"TCP Quiz","contentMd":"","quiz":{"questions":[
          {"id":"q1","position":0,"type":"SINGLE_CHOICE","questionText":"TCP là gì?","options":[
            {"id":"o1","position":0,"content":"Transport","isCorrect":true},
            {"id":"o2","position":1,"content":"Application","isCorrect":false}
          ]}
        ]}}
      ]
    }'::jsonb
  )$$,
  'Teacher creates a persistent Lesson with existing Section and Quiz entities'
);

select is(
  (select course_section_id from public.lessons where title = 'TCP Introduction'),
  'ad200000-0000-0000-0000-000000000001'::uuid,
  'Lesson is linked to the correct Course Section'
);

select is(
  (select room_id from public.lessons where title = 'TCP Introduction'),
  null::uuid,
  'Persistent Lesson is not linked to a live Room'
);

select is(
  (select chapters.course_section_id from public.lessons join public.chapters on chapters.id = lessons.chapter_id where lessons.title = 'TCP Introduction'),
  'ad200000-0000-0000-0000-000000000001'::uuid,
  'Persistent Lesson receives a Course Section-specific Chapter copy'
);

select ok(
  (select created_at between transaction_timestamp() and clock_timestamp() from public.lessons where title = 'TCP Introduction'),
  'Lesson created_at is stored by the database'
);

reset role;

select is(
  (select count(*) from public.sections join public.lessons on lessons.id = sections.lesson_id where lessons.title = 'TCP Introduction'),
  2::bigint,
  'Persistent Lesson reuses the sections table'
);

select is(
  (select count(*) from public.quizzes join public.sections on sections.id = quizzes.section_id join public.lessons on lessons.id = sections.lesson_id where lessons.title = 'TCP Introduction'),
  1::bigint,
  'Persistent Lesson reuses the quizzes table'
);

select is(
  (select count(*) from public.quiz_questions join public.quizzes on quizzes.id = quiz_questions.quiz_id join public.sections on sections.id = quizzes.section_id join public.lessons on lessons.id = sections.lesson_id where lessons.title = 'TCP Introduction'),
  1::bigint,
  'Persistent Lesson reuses the quiz_questions table'
);

select is(
  (select count(*) from public.quiz_answer_keys join public.quiz_questions on quiz_questions.id = quiz_answer_keys.question_id join public.quizzes on quizzes.id = quiz_questions.quiz_id join public.sections on sections.id = quizzes.section_id join public.lessons on lessons.id = sections.lesson_id where lessons.title = 'TCP Introduction'),
  1::bigint,
  'Persistent Lesson stores its answer key in the existing private table'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"ad000000-0000-0000-0000-000000000001","role":"authenticated","is_anonymous":false,"email":"thaybao@minclass.local"}', true);

select throws_ok(
  $$select * from public.create_course_section_lesson('bd200000-0000-0000-0000-000000000001', 'bd250000-0000-0000-0000-000000000001', 'Unauthorized', '# Invalid', '{"title":"Invalid","description":null,"sections":[{"id":"s","position":0,"type":"CONTENT","title":"S","contentMd":"Content"}]}'::jsonb)$$,
  '42501',
  'Chapter is not available for this Course Section.',
  'Teacher cannot create a Lesson in another owner Course Section'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"bd000000-0000-0000-0000-000000000001","role":"authenticated","is_anonymous":false,"email":"other@example.com"}', true);

select throws_ok(
  $$select * from public.create_course_section_lesson('bd200000-0000-0000-0000-000000000001', 'bd250000-0000-0000-0000-000000000001', 'Unauthorized', '# Invalid', '{"title":"Invalid","description":null,"sections":[{"id":"s","position":0,"type":"CONTENT","title":"S","contentMd":"Content"}]}'::jsonb)$$,
  '42501',
  'Teacher account required.',
  'Another permanent account cannot create persistent Lessons'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cd000000-0000-0000-0000-000000000001","role":"authenticated","is_anonymous":true}', true);

select is(
  (select count(*) from public.lessons where course_section_id is not null),
  0::bigint,
  'Anonymous Student cannot read persistent Lessons'
);

reset role;

select throws_matching(
  $$insert into public.lessons (title, markdown_source) values ('No parent', '# Invalid')$$,
  'lessons_exactly_one_parent',
  'Lesson cannot exist without Room or Course Section parent'
);

insert into public.rooms (id, code, teacher_user_id, title)
values ('dd000000-0000-0000-0000-000000000001', 'PARNT2', 'ad000000-0000-0000-0000-000000000001', 'Parent test');

select throws_matching(
  $$insert into public.lessons (room_id, course_section_id, title, markdown_source) values ('dd000000-0000-0000-0000-000000000001', 'ad200000-0000-0000-0000-000000000001', 'Two parents', '# Invalid')$$,
  'lessons_exactly_one_parent',
  'Lesson cannot belong to both Room and Course Section'
);

select * from finish();

rollback;
