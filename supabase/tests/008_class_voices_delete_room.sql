begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(23);

insert into auth.users (id, instance_id, aud, role, encrypted_password, created_at, updated_at, is_anonymous)
values
  ('18000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', now(), now(), false),
  ('18000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', now(), now(), false),
  ('28000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', now(), now(), true);

insert into public.rooms (id, code, teacher_user_id, title, status, teaching_section, released_through, started_at)
values ('38000000-0000-0000-0000-000000000001', 'VCE234', '18000000-0000-0000-0000-000000000001', 'Voices Room', 'ACTIVE', 1, 1, now());

insert into public.lessons (id, room_id, title, markdown_source)
values ('48000000-0000-0000-0000-000000000001', '38000000-0000-0000-0000-000000000001', 'Voices Lesson', '# Voices');

insert into public.sections (id, lesson_id, position, type, title, content_md)
values
  ('58000000-0000-0000-0000-000000000001', '48000000-0000-0000-0000-000000000001', 0, 'CONTENT', 'First Voice', 'Content'),
  ('58000000-0000-0000-0000-000000000002', '48000000-0000-0000-0000-000000000001', 1, 'QUIZ', 'Voice Quiz', '');

insert into public.participants (id, room_id, user_id, mssv)
values ('68000000-0000-0000-0000-000000000001', '38000000-0000-0000-0000-000000000001', '28000000-0000-0000-0000-000000000001', 'SVVOICE1');

insert into public.quizzes (id, section_id, title)
values ('63000000-0000-0000-0000-000000000001', '58000000-0000-0000-0000-000000000002', 'Voice Quiz');

insert into public.quiz_questions (id, quiz_id, position, type, question_text)
values ('73000000-0000-0000-0000-000000000001', '63000000-0000-0000-0000-000000000001', 0, 'TRUE_FALSE', 'A voice matters');

insert into public.quiz_options (id, question_id, position, content)
values
  ('83000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000001', 0, 'True'),
  ('83000000-0000-0000-0000-000000000002', '73000000-0000-0000-0000-000000000001', 1, 'False');

insert into public.quiz_answer_keys (question_id, correct_option_ids)
values ('73000000-0000-0000-0000-000000000001', array['83000000-0000-0000-0000-000000000001'::uuid]);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"28000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select lives_ok($$select * from public.set_section_reaction('58000000-0000-0000-0000-000000000001', 'UNDERSTAND')$$, 'Student can create cascade reaction fixture');
select lives_ok($$select * from public.create_section_comment('58000000-0000-0000-0000-000000000001', 'Named class voice', false)$$, 'Student can create named Class Voice');
select lives_ok($$select * from public.create_section_comment('58000000-0000-0000-0000-000000000001', 'Anonymous class voice', true)$$, 'Student can create anonymous Class Voice');
select lives_ok($$select * from public.submit_quiz('63000000-0000-0000-0000-000000000001', '[{"question_id":"73000000-0000-0000-0000-000000000001","selected_option_ids":["83000000-0000-0000-0000-000000000001"]}]'::jsonb)$$, 'Student can create cascade Quiz fixture');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"18000000-0000-0000-0000-000000000001","role":"authenticated","is_anonymous":false,"email":"thaybao@minclass.local"}', true);
select lives_ok($$select * from public.end_room('38000000-0000-0000-0000-000000000001')$$, 'Owner ends Room before opening Class Voices');
select is((public.get_teacher_class_voices('38000000-0000-0000-0000-000000000001')->>'participantCount')::integer, 1, 'Class Voices derives participant count');
select is(jsonb_array_length(public.get_teacher_class_voices('38000000-0000-0000-0000-000000000001')->'sections'), 2, 'Class Voices includes every released Section');
select is(jsonb_array_length(public.get_teacher_class_voices('38000000-0000-0000-0000-000000000001')->'sections'->0->'comments'), 2, 'Class Voices returns all Section comments');
select is((public.get_teacher_class_voices('38000000-0000-0000-0000-000000000001')->'sections'->0->'reactions'->>'understand')::integer, 1, 'Class Voices derives Section reaction statistics');
select is(jsonb_array_length(public.get_teacher_class_voices('38000000-0000-0000-0000-000000000001')->'sections'->1->'comments'), 0, 'Released Section without comments has an empty comment array');
select is(public.get_teacher_class_voices('38000000-0000-0000-0000-000000000001')->'sections'->0->'comments'->0->>'authorLabel', 'SVVOICE1', 'Named comment label comes from participant MSSV');
select is(public.get_teacher_class_voices('38000000-0000-0000-0000-000000000001')->'sections'->0->'comments'->1->>'authorLabel', 'Anonymous', 'Anonymous comment remains masked');
select unlike(public.get_teacher_class_voices('38000000-0000-0000-0000-000000000001')::text, '%participantId%', 'Class Voices does not expose participant identity keys');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"18000000-0000-0000-0000-000000000002","role":"authenticated","is_anonymous":false,"email":"thaybao@minclass.local"}', true);
select throws_ok($$select public.get_teacher_class_voices('38000000-0000-0000-0000-000000000001')$$, '42501', 'Class Voices are not available.', 'Another Teacher cannot read Class Voices');
select throws_ok($$select public.delete_room('38000000-0000-0000-0000-000000000001')$$, '42501', 'Room cannot be deleted.', 'Another Teacher cannot delete Room');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"28000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select throws_ok($$select public.get_teacher_class_voices('38000000-0000-0000-0000-000000000001')$$, '42501', 'Class Voices are not available.', 'Student cannot read Teacher Class Voices RPC');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"18000000-0000-0000-0000-000000000001","role":"authenticated","is_anonymous":false,"email":"thaybao@minclass.local"}', true);
select is(public.delete_room('38000000-0000-0000-0000-000000000001'), '38000000-0000-0000-0000-000000000001'::uuid, 'Owner can delete Room');
select is((select count(*) from public.rooms where id = '38000000-0000-0000-0000-000000000001'), 0::bigint, 'Deleted Room is inaccessible');

reset role;
select is((select count(*) from public.lessons where room_id = '38000000-0000-0000-0000-000000000001') + (select count(*) from public.sections where lesson_id = '48000000-0000-0000-0000-000000000001'), 0::bigint, 'Lesson and Sections cascade delete');
select is((select count(*) from public.participants where room_id = '38000000-0000-0000-0000-000000000001'), 0::bigint, 'Participants cascade delete');
select is((select count(*) from public.section_reactions where section_id = '58000000-0000-0000-0000-000000000001') + (select count(*) from public.section_comments where section_id = '58000000-0000-0000-0000-000000000001'), 0::bigint, 'Reactions and Comments cascade delete');
select is((select count(*) from public.quizzes where id = '63000000-0000-0000-0000-000000000001') + (select count(*) from public.quiz_questions where quiz_id = '63000000-0000-0000-0000-000000000001') + (select count(*) from public.quiz_options where question_id = '73000000-0000-0000-0000-000000000001') + (select count(*) from public.quiz_answer_keys where question_id = '73000000-0000-0000-0000-000000000001') + (select count(*) from public.quiz_attempts where quiz_id = '63000000-0000-0000-0000-000000000001') + (select count(*) from public.quiz_answers where question_id = '73000000-0000-0000-0000-000000000001'), 0::bigint, 'Quiz tree cascades delete');
select is((select count(*) from public.room_feedback_events where room_id = '38000000-0000-0000-0000-000000000001'), 0::bigint, 'Realtime feedback events cascade delete');

select * from finish();

rollback;
