begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

insert into auth.users (id, instance_id, aud, role, encrypted_password, email, created_at, updated_at, is_anonymous)
values
 ('e1000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', 'thaybao@minclass.local', now(), now(), false),
 ('e1000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', 'other@example.com', now(), now(), false),
 ('e1000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', null, now(), now(), true);
insert into public.subjects (id, teacher_id, name) values
 ('e1100000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', 'Preview Subject'),
 ('e1100000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000002', 'Other Subject');
insert into public.course_sections (id, subject_id, section_code) values
 ('e1200000-0000-4000-8000-000000000001', 'e1100000-0000-4000-8000-000000000001', 'PREVIEW01'),
 ('e1200000-0000-4000-8000-000000000002', 'e1100000-0000-4000-8000-000000000002', 'PREVIEW02');
insert into public.chapters (id, course_section_id, name) values
 ('e1300000-0000-4000-8000-000000000001', 'e1200000-0000-4000-8000-000000000001', 'Chapter 1'),
 ('e1300000-0000-4000-8000-000000000002', 'e1200000-0000-4000-8000-000000000002', 'Chapter 2'),
 ('e1300000-0000-4000-8000-000000000003', 'e1200000-0000-4000-8000-000000000001', 'Empty chapter');
insert into public.lessons (id, course_section_id, chapter_id, title, markdown_source) values
 ('e1400000-0000-4000-8000-000000000001', 'e1200000-0000-4000-8000-000000000001', 'e1300000-0000-4000-8000-000000000001', 'Lesson A', 'PRIVATE_SOURCE_WITH_ANSWER_KEY'),
 ('e1400000-0000-4000-8000-000000000002', 'e1200000-0000-4000-8000-000000000001', 'e1300000-0000-4000-8000-000000000001', 'Lesson B', '# B'),
 ('e1400000-0000-4000-8000-000000000003', 'e1200000-0000-4000-8000-000000000002', 'e1300000-0000-4000-8000-000000000002', 'Lesson C', '# C');
insert into public.sections (id, lesson_id, position, type, title, content_md) values
 ('e1500000-0000-4000-8000-000000000001', 'e1400000-0000-4000-8000-000000000001', 0, 'CONTENT', 'A1', '**Content**'),
 ('e1500000-0000-4000-8000-000000000002', 'e1400000-0000-4000-8000-000000000001', 1, 'QUIZ', 'Quiz', 'PRIVATE_QUIZ_SOURCE'),
 ('e1500000-0000-4000-8000-000000000003', 'e1400000-0000-4000-8000-000000000002', 0, 'CONTENT', 'B1', 'Content B'),
 ('e1500000-0000-4000-8000-000000000004', 'e1400000-0000-4000-8000-000000000003', 0, 'CONTENT', 'C1', 'Content C');
insert into public.quizzes (id, section_id, title) values
 ('e1600000-0000-4000-8000-000000000001', 'e1500000-0000-4000-8000-000000000002', 'Quiz');
insert into public.quiz_questions (id, quiz_id, position, type, question_text) values
 ('e1700000-0000-4000-8000-000000000001', 'e1600000-0000-4000-8000-000000000001', 0, 'SINGLE_CHOICE', 'PRIVATE_QUESTION');
insert into public.quiz_options (id, question_id, position, content) values
 ('e1800000-0000-4000-8000-000000000001', 'e1700000-0000-4000-8000-000000000001', 0, 'Correct'),
 ('e1800000-0000-4000-8000-000000000002', 'e1700000-0000-4000-8000-000000000001', 1, 'Wrong');
insert into public.quiz_answer_keys (question_id, correct_option_ids) values
 ('e1700000-0000-4000-8000-000000000001', array['e1800000-0000-4000-8000-000000000001'::uuid]);
insert into public.course_section_students (course_section_id, mssv) values
 ('e1200000-0000-4000-8000-000000000001', 'SV001'),
 ('e1200000-0000-4000-8000-000000000002', 'SV002');
set constraints all immediate;

select is((select preview_enabled from public.chapters where id = 'e1300000-0000-4000-8000-000000000001'), false, 'Preview defaults to closed');
select ok(not has_function_privilege('anon', 'public.get_student_chapter_preview(uuid,text)', 'EXECUTE'), 'No unauthenticated preview RPC');
select ok(not has_function_privilege('anon', 'public.set_chapter_preview(uuid,boolean)', 'EXECUTE'), 'No unauthenticated preview mutation');
select ok(not has_function_privilege('authenticated', 'private.chapter_has_session(uuid)', 'EXECUTE'), 'Private helper is not exposed');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-4000-8000-000000000001","is_anonymous":false,"email":"thaybao@minclass.local"}', true);
select is(public.set_chapter_preview('e1300000-0000-4000-8000-000000000001', true), true, 'Owner opens own chapter');
select throws_ok($$select public.set_chapter_preview('e1300000-0000-4000-8000-000000000002', true)$$, '42501', 'Chapter preview is not available.', 'Owner cannot open a different Teacher chapter');
select throws_ok($$select public.set_chapter_preview('e1300000-0000-4000-8000-000000000003', true)$$, '42501', 'Chapter preview is not available.', 'Empty chapter cannot open');
select is((select preview_enabled from public.get_public_course_section_chapters('e1200000-0000-4000-8000-000000000001') where chapter_id = 'e1300000-0000-4000-8000-000000000001'), true, 'Catalog exposes enabled metadata');
select throws_ok($$select public.get_student_chapter_preview('e1300000-0000-4000-8000-000000000001', 'SV001')$$, '42501', 'Chapter preview is not available.', 'Student preview rejects Teacher identity');

reset role;
update public.chapters set preview_enabled = true where id = 'e1300000-0000-4000-8000-000000000002';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-4000-8000-000000000003","is_anonymous":true}', true);
select throws_ok($$select public.set_chapter_preview('e1300000-0000-4000-8000-000000000001', false)$$, '42501', 'Chapter preview is not available.', 'Student cannot change preview');
with changed as (update public.chapters set preview_enabled = false where id = 'e1300000-0000-4000-8000-000000000001' returning id)
select is(count(*), 0::bigint, 'RLS blocks direct Student mutation') from changed;
select is((select count(*) from public.course_section_students), 0::bigint, 'Student cannot download roster');
select is((select count(*) from public.sections), 0::bigint, 'Preview does not broaden section RLS');
select is((select count(*) from public.lessons), 0::bigint, 'Preview does not expose original Markdown via RLS');
select is((select count(*) from public.quiz_answer_keys), 0::bigint, 'Answer keys remain private');
select throws_ok($$select public.get_student_chapter_preview('e1300000-0000-4000-8000-000000000002', 'SV001')$$, 'P0003', 'Student is not in the Course Section.', 'Class A MSSV cannot access Class B');
select throws_ok($$select public.get_student_chapter_preview('e1300000-0000-4000-8000-000000000001', 'SV999')$$, 'P0003', 'Student is not in the Course Section.', 'Non-roster receives the same guarded error as LIVE access');
select throws_ok($$select public.get_student_chapter_preview('e1300000-0000-4000-8000-000000000001', '!')$$, '42501', 'Chapter preview is not available.', 'Malformed MSSV denied');
select is(jsonb_array_length(public.get_student_chapter_preview('e1300000-0000-4000-8000-000000000001', ' sv001 ')->'lessons'), 2, 'Normalized roster Student sees all chapter lessons');
select is(public.get_student_chapter_preview('e1300000-0000-4000-8000-000000000001', 'SV001')->'lessons'->0->'sections'->0->>'contentMd', '**Content**', 'Saved section Markdown is reused');
select ok(public.get_student_chapter_preview('e1300000-0000-4000-8000-000000000001', 'SV001')::text not like '%PRIVATE_%', 'Original Markdown, quiz source and questions are absent');
select is(public.get_student_chapter_preview('e1300000-0000-4000-8000-000000000001', 'SV001')->'lessons'->0->'sections'->1->>'contentMd', '', 'Quiz is a placeholder only');

reset role;
select is((select count(*) from public.rooms), 0::bigint, 'Preview creates no Room');
select is((select count(*) from public.participants), 0::bigint, 'Preview creates no Participant');
select is((select count(*) from public.session_attendance), 0::bigint, 'Preview creates no attendance');
select is((select count(*) from public.lesson_session_access_grants), 0::bigint, 'Preview creates no LIVE/review access grants');
select is((select count(*) from public.quiz_attempts), 0::bigint, 'Preview creates no Quiz attempt');
delete from public.course_section_students where course_section_id = 'e1200000-0000-4000-8000-000000000001';
set local role authenticated;
select throws_ok($$select public.get_student_chapter_preview('e1300000-0000-4000-8000-000000000001', 'SV001')$$, 'P0003', 'Student is not in the Course Section.', 'Roster removal revokes the next preview read');
reset role;
insert into public.course_section_students (course_section_id, mssv) values ('e1200000-0000-4000-8000-000000000001', 'SV001');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-4000-8000-000000000001","is_anonymous":false,"email":"thaybao@minclass.local"}', true);
select is(public.set_chapter_preview('e1300000-0000-4000-8000-000000000001', false), false, 'Teacher closes preview');
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-4000-8000-000000000003","is_anonymous":true}', true);
select throws_ok($$select public.get_student_chapter_preview('e1300000-0000-4000-8000-000000000001', 'SV001')$$, '42501', 'Chapter preview is not available.', 'Closed preview is denied on refresh/direct RPC');
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-4000-8000-000000000001","is_anonymous":false,"email":"thaybao@minclass.local"}', true);
select is(public.set_chapter_preview('e1300000-0000-4000-8000-000000000001', true), true, 'Teacher can reopen before LIVE');
select lives_ok($$select * from public.start_chapter_session('e1200000-0000-4000-8000-000000000001', 'e1300000-0000-4000-8000-000000000001')$$, 'Existing Start flow works after preview');
select set_config('test.preview_room', (select id::text from public.rooms where chapter_id = 'e1300000-0000-4000-8000-000000000001'), true);
select is((select preview_enabled from public.get_public_course_section_chapters('e1200000-0000-4000-8000-000000000001') where chapter_id = 'e1300000-0000-4000-8000-000000000001'), false, 'LIVE overrides catalog preview setting');
select throws_ok($$select public.set_chapter_preview('e1300000-0000-4000-8000-000000000001', true)$$, '42501', 'Chapter preview is not available.', 'Teacher cannot enable preview during LIVE');
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-4000-8000-000000000003","is_anonymous":true}', true);
select throws_ok($$select public.get_student_chapter_preview('e1300000-0000-4000-8000-000000000001', 'SV001')$$, '42501', 'Chapter preview is not available.', 'Old preview credentials cannot bypass LIVE release');
select lives_ok($$select * from public.join_live_lesson('e1400000-0000-4000-8000-000000000001', 'SV001')$$, 'Student still joins LIVE normally');
select is((select count(*) from public.quiz_answer_keys), 0::bigint, 'LIVE join does not expose answer keys');
select is((select count(*) from public.sections where id = 'e1500000-0000-4000-8000-000000000002'), 0::bigint, 'Future QUIZ section stays hidden during LIVE');
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-4000-8000-000000000001","is_anonymous":false,"email":"thaybao@minclass.local"}', true);
select lives_ok($$select public.end_room(current_setting('test.preview_room')::uuid)$$, 'Existing End flow works after preview');
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-4000-8000-000000000003","is_anonymous":true}', true);
select throws_ok($$select public.get_student_chapter_preview('e1300000-0000-4000-8000-000000000001', 'SV001')$$, '42501', 'Chapter preview is not available.', 'ENDED must use existing authorized review, not preview');

select * from finish();
rollback;
