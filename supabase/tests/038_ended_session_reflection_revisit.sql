begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

insert into auth.users (id, instance_id, aud, role, encrypted_password, email, created_at, updated_at, is_anonymous)
values
  ('f8000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','','teacher-reflection@minclass.local',now(),now(),false),
  ('f8000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','',null,now(),now(),true),
  ('f8000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','',null,now(),now(),true),
  ('f8000000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','',null,now(),now(),true),
  ('f8000000-0000-4000-8000-000000000005','00000000-0000-0000-0000-000000000000','authenticated','authenticated','',null,now(),now(),true);
insert into public.subjects (id, teacher_id, name) values
  ('f8100000-0000-4000-8000-000000000001','f8000000-0000-4000-8000-000000000001','Review revisit');
insert into public.course_sections (id, subject_id, section_code) values
  ('f8200000-0000-4000-8000-000000000001','f8100000-0000-4000-8000-000000000001','REVISIT01');
insert into public.course_section_students (course_section_id, mssv) values
  ('f8200000-0000-4000-8000-000000000001','SV001'),
  ('f8200000-0000-4000-8000-000000000001','SV002');
insert into public.chapters (id, course_section_id, name) values
  ('f8300000-0000-4000-8000-000000000001','f8200000-0000-4000-8000-000000000001','Chapter 1');
insert into public.lessons (id, course_section_id, chapter_id, title, markdown_source) values
  ('f8400000-0000-4000-8000-000000000001','f8200000-0000-4000-8000-000000000001','f8300000-0000-4000-8000-000000000001','Lesson 1','# Lesson 1');
insert into public.sections (id, lesson_id, position, type, title, content_md) values
  ('f8500000-0000-4000-8000-000000000001','f8400000-0000-4000-8000-000000000001',0,'CONTENT','Section 1','Content');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"f8000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}',true);
select lives_ok($$select * from public.start_chapter_session('f8200000-0000-4000-8000-000000000001','f8300000-0000-4000-8000-000000000001')$$,'Teacher starts the Chapter Session');
select set_config('test.revisit_room_id',(select id::text from public.rooms where chapter_id='f8300000-0000-4000-8000-000000000001'),true);

select set_config('request.jwt.claims','{"sub":"f8000000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":true}',true);
select lives_ok($$select * from public.join_live_lesson('f8400000-0000-4000-8000-000000000001','SV001')$$,'Student joins the LIVE Chapter');

select set_config('request.jwt.claims','{"sub":"f8000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}',true);
select lives_ok($$select * from public.end_room(current_setting('test.revisit_room_id')::uuid)$$,'Teacher ends the Chapter Session');

select set_config('request.jwt.claims','{"sub":"f8000000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":true}',true);
select is((select count(*) from public.get_own_session_reflection(current_setting('test.revisit_room_id')::uuid)),0::bigint,'Joined Student has not submitted a reflection yet');

select set_config('request.jwt.claims','{"sub":"f8000000-0000-4000-8000-000000000003","role":"authenticated","is_anonymous":true}',true);
select lives_ok($$select * from public.access_ended_lesson_session('f8400000-0000-4000-8000-000000000001','SV001')$$,'Same MSSV verifies from another browser');
select is((select count(*) from public.get_own_session_reflection(current_setting('test.revisit_room_id')::uuid)),0::bigint,'Verified returning participant is eligible but has not submitted');
select lives_ok($$select * from public.save_own_session_reflection(current_setting('test.revisit_room_id')::uuid,2,'Buổi học hữu ích')$$,'Returning participant can submit once');
select is((select speaking_count from public.get_own_session_reflection(current_setting('test.revisit_room_id')::uuid)),2,'Returning participant can read the saved reflection');

select set_config('request.jwt.claims','{"sub":"f8000000-0000-4000-8000-000000000004","role":"authenticated","is_anonymous":true}',true);
select lives_ok($$select * from public.access_ended_lesson_session('f8400000-0000-4000-8000-000000000001','SV001')$$,'Same MSSV verifies in a third browser');
select is((select speaking_count from public.get_own_session_reflection(current_setting('test.revisit_room_id')::uuid)),2,'Submitted reflection is visible after another re-entry');
select throws_ok($$select * from public.save_own_session_reflection(current_setting('test.revisit_room_id')::uuid,3,null)$$,'23505','Session reflection has already been submitted.','One-time submission remains enforced');

select set_config('request.jwt.claims','{"sub":"f8000000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":true}',true);
select lives_ok($$select * from public.access_ended_lesson_session('f8400000-0000-4000-8000-000000000001','SV002')$$,'Original browser changes verified MSSV');
select throws_ok($$select * from public.get_own_session_reflection(current_setting('test.revisit_room_id')::uuid)$$,'42501','Session reflection is not available.','Old participation does not leak into another verified MSSV');
select throws_ok($$select * from public.save_own_session_reflection(current_setting('test.revisit_room_id')::uuid,1,null)$$,'42501','Session reflection is not available.','Changed MSSV cannot submit for the old participant');
select lives_ok($$select * from public.access_ended_lesson_session('f8400000-0000-4000-8000-000000000001','SV001')$$,'Original browser verifies the attended MSSV again');
select is((select speaking_count from public.get_own_session_reflection(current_setting('test.revisit_room_id')::uuid)),2,'Original browser sees the one-time submission after re-verification');

select set_config('request.jwt.claims','{"sub":"f8000000-0000-4000-8000-000000000005","role":"authenticated","is_anonymous":true}',true);
select lives_ok($$select * from public.access_ended_lesson_session('f8400000-0000-4000-8000-000000000001','SV002')$$,'Roster-only Student may review Lesson content');
select throws_ok($$select * from public.get_own_session_reflection(current_setting('test.revisit_room_id')::uuid)$$,'42501','Session reflection is not available.','Roster-only Student is not eligible to submit');
select throws_ok($$select * from public.save_own_session_reflection(current_setting('test.revisit_room_id')::uuid,1,null)$$,'42501','Session reflection is not available.','Roster-only Student cannot create a reflection');

select * from finish();
rollback;
