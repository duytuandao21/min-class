begin;

create extension if not exists pgtap with schema extensions;

select plan(29);

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
values
  (
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    '',
    now(),
    now(),
    true
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    '',
    now(),
    now(),
    true
  ),
  (
    '20000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    '',
    now(),
    now(),
    true
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    '',
    now(),
    now(),
    true
  );

insert into public.rooms (
  id,
  code,
  teacher_user_id,
  title,
  status,
  started_at
)
values
  (
    '30000000-0000-0000-0000-000000000001',
    'ABC234',
    '10000000-0000-0000-0000-000000000001',
    'Teacher A Room',
    'ACTIVE',
    now()
  ),
  (
    '30000000-0000-0000-0000-000000000002',
    'XYZ789',
    '10000000-0000-0000-0000-000000000002',
    'Teacher B Room',
    'ACTIVE',
    now()
  );

insert into public.lessons (id, room_id, title, markdown_source)
values
  (
    '40000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    'Lesson A',
    'private markdown with correct answers'
  ),
  (
    '40000000-0000-0000-0000-000000000002',
    '30000000-0000-0000-0000-000000000002',
    'Lesson B',
    'private markdown'
  );

insert into public.sections (id, lesson_id, position, type, title, content_md)
values
  (
    '50000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000001',
    0,
    'CONTENT',
    'Released later',
    'Section zero'
  ),
  (
    '50000000-0000-0000-0000-000000000002',
    '40000000-0000-0000-0000-000000000001',
    1,
    'QUIZ',
    'Quiz section',
    ''
  );

insert into public.quizzes (id, section_id, title)
values (
  '60000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000002',
  'Quick check'
);

insert into public.quiz_questions (id, quiz_id, position, type, question_text)
values (
  '70000000-0000-0000-0000-000000000001',
  '60000000-0000-0000-0000-000000000001',
  0,
  'SINGLE_CHOICE',
  'Choose the correct answer'
);

insert into public.quiz_options (id, question_id, position, content)
values
  (
    '80000000-0000-0000-0000-000000000001',
    '70000000-0000-0000-0000-000000000001',
    0,
    'Correct'
  ),
  (
    '80000000-0000-0000-0000-000000000002',
    '70000000-0000-0000-0000-000000000001',
    1,
    'Incorrect'
  );

insert into public.quiz_answer_keys (question_id, correct_option_ids)
values (
  '70000000-0000-0000-0000-000000000001',
  array['80000000-0000-0000-0000-000000000001'::uuid]
);

select is(
  (
    select count(*)
    from pg_class
    join pg_namespace on pg_namespace.oid = pg_class.relnamespace
    where pg_namespace.nspname = 'public'
      and pg_class.relname = any (array[
        'rooms',
        'lessons',
        'sections',
        'participants',
        'section_reactions',
        'section_comments',
        'quizzes',
        'quiz_questions',
        'quiz_options',
        'quiz_answer_keys',
        'quiz_attempts',
        'quiz_answers'
      ])
      and pg_class.relrowsecurity
  ),
  12::bigint,
  'RLS is enabled on every public application table'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select is(
  (select count(*) from public.rooms),
  1::bigint,
  'Teacher A can only read their own room'
);

select is(
  (select count(*) from public.lessons),
  1::bigint,
  'Teacher A can read their own lesson'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"role":"authenticated"}',
  true
);

select throws_ok(
  $$select * from public.release_section('30000000-0000-0000-0000-000000000001')$$,
  '28000',
  'Authentication required.',
  'release_section fails closed when the JWT subject is missing'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select lives_ok(
  $$select * from public.join_room('abc234', ' sv001 ')$$,
  'Student can join an active room with normalized code and MSSV'
);

select throws_ok(
  $$select * from public.join_room('ABC234', 'SV001')$$,
  '23505',
  'This MSSV or user has already joined the room.',
  'Duplicate MSSV is rejected'
);

select throws_ok(
  $$select * from public.join_room('ABC234', 'SV999')$$,
  '23505',
  'This MSSV or user has already joined the room.',
  'One anonymous user cannot join the same room twice'
);

select is(
  (select count(*) from public.rooms),
  1::bigint,
  'Student can only read a room they joined'
);

select is(
  (select count(*) from public.lessons),
  0::bigint,
  'Student cannot read lesson markdown source'
);

select is(
  (select count(*) from public.sections),
  0::bigint,
  'Student cannot read unreleased sections'
);

update public.rooms
set title = 'Student changed this'
where id = '30000000-0000-0000-0000-000000000001';

reset role;

select is(
  (
    select title
    from public.rooms
    where id = '30000000-0000-0000-0000-000000000001'
  ),
  'Teacher A Room',
  'Student cannot update a room'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select lives_ok(
  $$select * from public.release_section('30000000-0000-0000-0000-000000000001')$$,
  'Teacher can release the current section'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select is(
  (select count(*) from public.sections),
  1::bigint,
  'Student can only read released sections'
);

select lives_ok(
  $$
    insert into public.section_reactions (section_id, participant_id, reaction)
    select
      '50000000-0000-0000-0000-000000000001',
      participants.id,
      'UNSURE'
    from public.participants
    where participants.user_id = auth.uid()
  $$,
  'Student can react to a released section as themselves'
);

select lives_ok(
  $$
    insert into public.section_comments (section_id, participant_id, body, is_anonymous)
    select
      '50000000-0000-0000-0000-000000000001',
      participants.id,
      'I need more explanation.',
      true
    from public.participants
    where participants.user_id = auth.uid()
  $$,
  'Student can comment on a released section as themselves'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);

select throws_ok(
  $$select * from public.join_room('ABC234', 'SV001')$$,
  '23505',
  'This MSSV or user has already joined the room.',
  'A second user cannot claim an existing MSSV in the room'
);

select lives_ok(
  $$select * from public.join_room('ABC234', 'SV002')$$,
  'A second user can join with a distinct MSSV'
);

update public.section_reactions
set reaction = 'QUESTION'
where section_id = '50000000-0000-0000-0000-000000000001';

reset role;

select is(
  (
    select reaction::text
    from public.section_reactions
    where section_id = '50000000-0000-0000-0000-000000000001'
  ),
  'UNSURE',
  'A student cannot update another participant reaction'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select is(
  (select count(*) from public.quiz_answer_keys),
  0::bigint,
  'Student cannot read quiz answer keys'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select lives_ok(
  $$select * from public.release_section('30000000-0000-0000-0000-000000000001')$$,
  'Teacher can release the quiz section in order'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select lives_ok(
  $$
    select *
    from public.submit_quiz(
      '60000000-0000-0000-0000-000000000001',
      jsonb_build_array(
        jsonb_build_object(
          'question_id', '70000000-0000-0000-0000-000000000001',
          'selected_option_ids', jsonb_build_array(
            '80000000-0000-0000-0000-000000000001'
          )
        )
      )
    )
  $$,
  'Student can submit a released quiz through the grading RPC'
);

select is(
  (select score from public.quiz_attempts),
  1,
  'Quiz is graded from the private answer key'
);

select throws_ok(
  $$
    select *
    from public.submit_quiz(
      '60000000-0000-0000-0000-000000000001',
      jsonb_build_array(
        jsonb_build_object(
          'question_id', '70000000-0000-0000-0000-000000000001',
          'selected_option_ids', jsonb_build_array(
            '80000000-0000-0000-0000-000000000001'
          )
        )
      )
    )
  $$,
  '23505',
  'Quiz has already been submitted.',
  'Student cannot submit the same quiz twice'
);

select throws_ok(
  $$
    insert into public.quiz_attempts (quiz_id, participant_id, score, total_questions)
    select
      '60000000-0000-0000-0000-000000000001',
      participants.id,
      0,
      1
    from public.participants
    where participants.user_id = auth.uid()
  $$,
  '42501',
  null,
  'Student cannot bypass submit_quiz with a direct insert'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select is(
  (select count(*) from public.quiz_attempts),
  1::bigint,
  'Teacher can read quiz results from their room'
);

update public.rooms
set status = 'ENDED', ended_at = now()
where id = '30000000-0000-0000-0000-000000000001';

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

update public.section_reactions
set reaction = 'QUESTION'
where section_id = '50000000-0000-0000-0000-000000000001';

select throws_ok(
  $$
    insert into public.section_comments (section_id, participant_id, body, is_anonymous)
    select
      '50000000-0000-0000-0000-000000000001',
      participants.id,
      'This must be rejected after the room ends.',
      true
    from public.participants
    where participants.user_id = auth.uid()
  $$,
  '42501',
  null,
  'Student cannot comment after the room ends'
);

reset role;

select is(
  (
    select reaction::text
    from public.section_reactions
    where section_id = '50000000-0000-0000-0000-000000000001'
  ),
  'UNSURE',
  'Student cannot update a reaction after the room ends'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);

select throws_ok(
  $$
    select *
    from public.submit_quiz(
      '60000000-0000-0000-0000-000000000001',
      jsonb_build_array(
        jsonb_build_object(
          'question_id', '70000000-0000-0000-0000-000000000001',
          'selected_option_ids', jsonb_build_array(
            '80000000-0000-0000-0000-000000000001'
          )
        )
      )
    )
  $$,
  '42501',
  'Quiz is not available.',
  'Student cannot submit a quiz after the room ends'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

delete from public.rooms
where id = '30000000-0000-0000-0000-000000000001';

reset role;

select is(
  (
    (select count(*) from public.lessons)
    + (select count(*) from public.sections)
    + (select count(*) from public.participants)
    + (select count(*) from public.section_reactions)
    + (select count(*) from public.section_comments)
    + (select count(*) from public.quizzes)
    + (select count(*) from public.quiz_questions)
    + (select count(*) from public.quiz_options)
    + (select count(*) from public.quiz_answer_keys)
    + (select count(*) from public.quiz_attempts)
    + (select count(*) from public.quiz_answers)
  ),
  1::bigint,
  'Deleting Room A cascades all of its data while preserving Room B lesson'
);

select * from finish();

rollback;
