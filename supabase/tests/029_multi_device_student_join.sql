begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(9);

insert into auth.users (id, instance_id, aud, role, encrypted_password, email, created_at, updated_at, is_anonymous)
values
 ('a9000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','','teacher-multi@minclass.local',now(),now(),false),
 ('c9000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','',null,now(),now(),true),
 ('c9000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','',null,now(),now(),true);
insert into public.subjects (id, teacher_id, name) values
 ('a9100000-0000-4000-8000-000000000001','a9000000-0000-4000-8000-000000000001','Multi-device join');
insert into public.course_sections (id, subject_id, section_code) values
 ('a9200000-0000-4000-8000-000000000001','a9100000-0000-4000-8000-000000000001','MULTI001');
insert into public.course_section_students (course_section_id, mssv) values
 ('a9200000-0000-4000-8000-000000000001','23162011');
insert into public.chapters (id, course_section_id, name) values
 ('a9300000-0000-4000-8000-000000000001','a9200000-0000-4000-8000-000000000001','Chapter 1');
insert into public.lessons (id, course_section_id, chapter_id, title, markdown_source) values
 ('a9400000-0000-4000-8000-000000000001','a9200000-0000-4000-8000-000000000001','a9300000-0000-4000-8000-000000000001','Lesson 1','# Lesson 1');
insert into public.sections (id, lesson_id, position, type, title, content_md) values
 ('a9500000-0000-4000-8000-000000000001','a9400000-0000-4000-8000-000000000001',0,'CONTENT','Section 1','Content');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a9000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}',true);
select lives_ok($$select * from public.start_chapter_session('a9300000-0000-4000-8000-000000000001','a9200000-0000-4000-8000-000000000001')$$,'Teacher starts the Chapter Session');
select set_config('test.multi_room_id',(select id::text from public.rooms where chapter_id='a9300000-0000-4000-8000-000000000001'),true);

select set_config('request.jwt.claims','{"sub":"c9000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":true}',true);
select lives_ok($$select * from public.join_live_lesson('a9400000-0000-4000-8000-000000000001','23162011')$$,'First browser joins');
select set_config('test.multi_participant_id',(select id::text from public.participants where room_id=current_setting('test.multi_room_id')::uuid and mssv='23162011'),true);

select set_config('request.jwt.claims','{"sub":"c9000000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":true}',true);
select lives_ok($$select * from public.join_live_lesson('a9400000-0000-4000-8000-000000000001','23162011')$$,'Second browser joins the same MSSV');
select is((select count(*) from public.participants where room_id=current_setting('test.multi_room_id')::uuid and mssv='23162011'),1::bigint,'Both browsers reuse one participant');
select is((select count(*) from public.lesson_session_access_grants where room_id=current_setting('test.multi_room_id')::uuid and mssv='23162011'),2::bigint,'Both browsers receive access');
select ok(private.is_room_participant(current_setting('test.multi_room_id')::uuid),'Second browser is authorized');
select lives_ok($$select * from public.set_section_reaction('a9500000-0000-4000-8000-000000000001','UNDERSTAND')$$,'Second browser can react');

select set_config('request.jwt.claims','{"sub":"c9000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":true}',true);
select lives_ok($$select * from public.set_section_reaction('a9500000-0000-4000-8000-000000000001','UNSURE')$$,'First browser remains authorized');
select is((select count(*) from public.section_reactions where participant_id=current_setting('test.multi_participant_id')::uuid),1::bigint,'Reaction stays unique per Student');
select * from finish();
rollback;
