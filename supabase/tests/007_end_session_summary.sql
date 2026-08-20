begin;

create extension if not exists pgtap with schema extensions;

select plan(29);

select ok(
  exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'participants'
  ),
  'Participant joins are published for Teacher Live Dashboard'
);

insert into auth.users (id, instance_id, aud, role, encrypted_password, created_at, updated_at, is_anonymous)
values
  ('17000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', now(), now(), true),
  ('17000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', now(), now(), true),
  ('27000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', now(), now(), true),
  ('27000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', now(), now(), true);

insert into public.rooms (id, code, teacher_user_id, title, status, teaching_section, released_through, started_at)
values ('37000000-0000-0000-0000-000000000001', 'SUM234', '17000000-0000-0000-0000-000000000001', 'Summary Room', 'ACTIVE', 1, 1, now());

insert into public.lessons (id, room_id, title, markdown_source)
values ('47000000-0000-0000-0000-000000000001', '37000000-0000-0000-0000-000000000001', 'Summary Lesson', '# Summary');

insert into public.sections (id, lesson_id, position, type, title, content_md)
values
  ('57000000-0000-0000-0000-000000000001', '47000000-0000-0000-0000-000000000001', 0, 'CONTENT', 'Feedback Section', 'Content'),
  ('57000000-0000-0000-0000-000000000002', '47000000-0000-0000-0000-000000000001', 1, 'QUIZ', 'Summary Quiz', '');

insert into public.participants (id, room_id, user_id, mssv, joined_at)
values
  ('67000000-0000-0000-0000-000000000001', '37000000-0000-0000-0000-000000000001', '27000000-0000-0000-0000-000000000001', 'SVSUM01', now() - interval '2 minutes'),
  ('67000000-0000-0000-0000-000000000002', '37000000-0000-0000-0000-000000000001', '27000000-0000-0000-0000-000000000002', 'SVSUM02', now() - interval '1 minute');

insert into public.quizzes (id, section_id, title)
values ('62000000-0000-0000-0000-000000000001', '57000000-0000-0000-0000-000000000002', 'Summary Quiz');

insert into public.quiz_questions (id, quiz_id, position, type, question_text)
values ('72000000-0000-0000-0000-000000000001', '62000000-0000-0000-0000-000000000001', 0, 'TRUE_FALSE', 'MINCLASS is live');

insert into public.quiz_options (id, question_id, position, content)
values
  ('82000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000001', 0, 'True'),
  ('82000000-0000-0000-0000-000000000002', '72000000-0000-0000-0000-000000000001', 1, 'False');

insert into public.quiz_answer_keys (question_id, correct_option_ids)
values ('72000000-0000-0000-0000-000000000001', array['82000000-0000-0000-0000-000000000001'::uuid]);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"17000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select throws_ok(
  $$select public.get_teacher_room_summary('37000000-0000-0000-0000-000000000001')$$,
  '42501',
  'Room summary is not available.',
  'Summary is unavailable before Room ends'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"27000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select lives_ok($$select * from public.set_section_reaction('57000000-0000-0000-0000-000000000001', 'UNDERSTAND')$$, 'Student 1 can react before Room ends');
select lives_ok($$select * from public.create_section_comment('57000000-0000-0000-0000-000000000001', 'Named summary comment', false)$$, 'Student can create a named comment before Room ends');
select lives_ok($$select * from public.create_section_comment('57000000-0000-0000-0000-000000000001', 'Anonymous summary comment', true)$$, 'Student can create an anonymous comment before Room ends');
select lives_ok($$select * from public.submit_quiz('62000000-0000-0000-0000-000000000001', '[{"question_id":"72000000-0000-0000-0000-000000000001","selected_option_ids":["82000000-0000-0000-0000-000000000001"]}]'::jsonb)$$, 'Student can submit Quiz before Room ends');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"27000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select lives_ok($$select * from public.set_section_reaction('57000000-0000-0000-0000-000000000001', 'UNSURE')$$, 'Student 2 can react before Room ends');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"17000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select lives_ok($$select * from public.end_room('37000000-0000-0000-0000-000000000001')$$, 'Teacher can end their ACTIVE Room');
select is((select status::text from public.rooms where id = '37000000-0000-0000-0000-000000000001'), 'ENDED', 'Room transitions to ENDED');
select ok((select ended_at is not null from public.rooms where id = '37000000-0000-0000-0000-000000000001'), 'Room records ended_at');

select throws_ok(
  $$select * from public.end_room('37000000-0000-0000-0000-000000000001')$$,
  '42501',
  'Room cannot be ended.',
  'Room cannot be ended twice'
);

select throws_ok(
  $$update public.rooms set status = 'ACTIVE', ended_at = null where id = '37000000-0000-0000-0000-000000000001'$$,
  '23514',
  'Room status transition is not allowed.',
  'ENDED is a terminal Room state'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"27000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select is((select count(*) from public.get_student_lesson_snapshot('37000000-0000-0000-0000-000000000001') where section_id is not null), 2::bigint, 'Student can still read released sections after Room ends');
select throws_ok($$select * from public.set_section_reaction('57000000-0000-0000-0000-000000000001', 'QUESTION')$$, '42501', 'Section is not available for interaction.', 'Student cannot change reaction after Room ends');
select throws_ok($$select * from public.create_section_comment('57000000-0000-0000-0000-000000000001', 'Too late', true)$$, '42501', 'Section is not available for interaction.', 'Student cannot comment after Room ends');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"27000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select throws_ok($$select * from public.submit_quiz('62000000-0000-0000-0000-000000000001', '[{"question_id":"72000000-0000-0000-0000-000000000001","selected_option_ids":["82000000-0000-0000-0000-000000000001"]}]'::jsonb)$$, '42501', 'Quiz is not available.', 'Student cannot submit a new Quiz after Room ends');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"17000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select is((public.get_teacher_room_summary('37000000-0000-0000-0000-000000000001')->>'participantCount')::integer, 2, 'Summary contains total participant count');
select is(jsonb_array_length(public.get_teacher_room_summary('37000000-0000-0000-0000-000000000001')->'participants'), 2, 'Summary contains joined MSSV list');
select is(public.get_teacher_room_summary('37000000-0000-0000-0000-000000000001')->'participants'->0->>'mssv', 'SVSUM01', 'Summary participant list uses MSSV');
select is((public.get_teacher_room_summary('37000000-0000-0000-0000-000000000001')->'quizzes'->0->>'completionRate')::numeric, 50.00, 'Summary contains Quiz completion');
select is((public.get_teacher_room_summary('37000000-0000-0000-0000-000000000001')->'quizzes'->0->>'averageScore')::numeric, 1.00, 'Summary contains average Quiz score');
select is((public.get_teacher_room_summary('37000000-0000-0000-0000-000000000001')->'quizzes'->0->'questions'->0->>'correctPercentage')::numeric, 100.00, 'Summary contains correct rate per question');
select is((public.get_teacher_room_summary('37000000-0000-0000-0000-000000000001')->'reactions'->0->>'understand')::integer, 1, 'Summary contains UNDERSTAND reaction count');
select is((public.get_teacher_room_summary('37000000-0000-0000-0000-000000000001')->'reactions'->0->>'unsure')::integer, 1, 'Summary contains UNSURE reaction count');
select is((public.get_teacher_room_summary('37000000-0000-0000-0000-000000000001')->'comments'->>'total')::integer, 2, 'Summary contains total comment count');
select is((public.get_teacher_room_summary('37000000-0000-0000-0000-000000000001')->'comments'->>'anonymous')::integer, 1, 'Summary contains anonymous comment count');
select is((public.get_teacher_room_summary('37000000-0000-0000-0000-000000000001')->'comments'->>'named')::integer, 1, 'Summary contains named comment count');
select is((public.get_teacher_room_summary('37000000-0000-0000-0000-000000000001')->'mostEngagedSection'->>'totalFeedback')::integer, 4, 'Summary identifies the section with most feedback');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"17000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select throws_ok($$select public.get_teacher_room_summary('37000000-0000-0000-0000-000000000001')$$, '42501', 'Room summary is not available.', 'A different Teacher cannot read Summary');

select * from finish();

rollback;
