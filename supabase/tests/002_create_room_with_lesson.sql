begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(16);

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  encrypted_password,
  created_at,
  updated_at,
  is_anonymous
)
values (
  '10000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  '',
  now(),
  now(),
  false
);

select ok(
  not has_function_privilege('anon', 'public.create_room_with_lesson(text,text,jsonb)', 'execute'),
  'Anonymous database role cannot execute the create RPC'
);

select ok(
  has_function_privilege('authenticated', 'public.create_room_with_lesson(text,text,jsonb)', 'execute'),
  'Authenticated users can execute the create RPC'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated","is_anonymous":false,"email":"thaybao@minclass.local"}',
  true
);

select lives_ok(
  $test$
    select * from public.create_room_with_lesson(
      'TCP Session',
      '# original markdown',
      $json${
        "title": "TCP Lesson",
        "description": "A short lesson",
        "sections": [
          {
            "id": "overview",
            "position": 0,
            "title": "Overview",
            "type": "CONTENT",
            "contentMd": "TCP is **reliable**."
          },
          {
            "id": "quick-check",
            "position": 1,
            "title": "Quick Check",
            "type": "QUIZ",
            "contentMd": "",
            "quiz": {
              "questions": [
                {
                  "id": "handshake-question",
                  "position": 0,
                  "type": "SINGLE_CHOICE",
                  "questionText": "Which packet completes the handshake?",
                  "options": [
                    {"id": "syn", "position": 0, "content": "SYN", "isCorrect": false},
                    {"id": "ack", "position": 1, "content": "ACK", "isCorrect": true}
                  ]
                }
              ]
            }
          }
        ]
      }$json$::jsonb
    )
  $test$,
  'Teacher can atomically create a room and parsed lesson'
);

select is((select count(*) from public.rooms where title = 'TCP Session'), 1::bigint, 'One room is created');
select is(
  (select teacher_user_id from public.rooms where title = 'TCP Session'),
  '10000000-0000-0000-0000-000000000003'::uuid,
  'Room belongs to the authenticated anonymous teacher'
);
select is((select status::text from public.rooms where title = 'TCP Session'), 'DRAFT', 'Room remains DRAFT');
select matches(
  (select code from public.rooms where title = 'TCP Session'),
  '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$',
  'Room code is short and excludes ambiguous characters'
);
select is(
  (select markdown_source from public.lessons where room_id = (select id from public.rooms where title = 'TCP Session')),
  '# original markdown',
  'Original Markdown source is stored'
);
select is(
  (select count(*) from public.sections where lesson_id = (select id from public.lessons where room_id = (select id from public.rooms where title = 'TCP Session'))),
  2::bigint,
  'All sections are stored'
);
select results_eq(
  $$
    select position from public.sections
    where lesson_id = (select id from public.lessons where room_id = (select id from public.rooms where title = 'TCP Session'))
    order by position
  $$,
  $$values (0), (1)$$,
  'Section order is preserved'
);
select is((select count(*) from public.quizzes), 1::bigint, 'Quiz is stored');
select is((select count(*) from public.quiz_questions), 1::bigint, 'Quiz question is stored');
select is((select count(*) from public.quiz_options), 2::bigint, 'Quiz options are stored');
select is((select cardinality(correct_option_ids) from public.quiz_answer_keys), 1, 'Answer key is stored server-side');

select throws_ok(
  $test$
    select * from public.create_room_with_lesson(
      'Duplicate IDs',
      '# duplicate',
      '{"title":"Duplicate","description":null,"sections":[{"id":"same","position":0,"title":"One","type":"CONTENT","contentMd":"One"},{"id":"same","position":1,"title":"Two","type":"CONTENT","contentMd":"Two"}]}'::jsonb
    )
  $test$,
  '22023',
  'Invalid or duplicate section',
  'Duplicate section ids are rejected'
);

select is((select count(*) from public.rooms), 1::bigint, 'Failed creation leaves no partial room');

select * from finish();
rollback;
