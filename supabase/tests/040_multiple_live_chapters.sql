-- Integration assertions, isolated by transaction; TAP output needs no extension.
begin;
select '1..8';
insert into auth.users (id, instance_id, aud, role, encrypted_password, email, created_at, updated_at, is_anonymous)
values
 ('fa100000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','','thaybao@minclass.local',now(),now(),false),
 ('fa100000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','',null,now(),now(),true),
 ('fa100000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','',null,now(),now(),true);
insert into public.subjects (id, teacher_id, name)
values ('fa200000-0000-4000-8000-000000000001','fa100000-0000-4000-8000-000000000001','Multi LIVE');
insert into public.course_sections (id, subject_id, section_code)
values ('fa300000-0000-4000-8000-000000000001','fa200000-0000-4000-8000-000000000001','MULTILIVE01'),
       ('fa300000-0000-4000-8000-000000000002','fa200000-0000-4000-8000-000000000001','MULTILIVE02');
insert into public.chapters (id, course_section_id, name)
values ('fa400000-0000-4000-8000-000000000001','fa300000-0000-4000-8000-000000000001','Chapter A'),
       ('fa400000-0000-4000-8000-000000000002','fa300000-0000-4000-8000-000000000001','Chapter B'),
       ('fa400000-0000-4000-8000-000000000003','fa300000-0000-4000-8000-000000000001','Empty'),
       ('fa400000-0000-4000-8000-000000000004','fa300000-0000-4000-8000-000000000002','Other course');
insert into public.lessons (id, course_section_id, chapter_id, title, markdown_source)
values ('fa500000-0000-4000-8000-000000000001','fa300000-0000-4000-8000-000000000001','fa400000-0000-4000-8000-000000000001','Lesson A1','# A1'),
       ('fa500000-0000-4000-8000-000000000002','fa300000-0000-4000-8000-000000000001','fa400000-0000-4000-8000-000000000001','Lesson A2','# A2'),
       ('fa500000-0000-4000-8000-000000000003','fa300000-0000-4000-8000-000000000001','fa400000-0000-4000-8000-000000000002','Lesson B','# B'),
       ('fa500000-0000-4000-8000-000000000004','fa300000-0000-4000-8000-000000000002','fa400000-0000-4000-8000-000000000004','Other','# Other');
insert into public.sections (id, lesson_id, position, type, title, content_md)
select ('fa600000-0000-4000-8000-' || lpad((i*2+p)::text,12,'0'))::uuid,
       ('fa500000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid, p,
       case when p=1 and i in (1,3) then 'QUIZ'::public.section_type else 'CONTENT'::public.section_type end,
       'Section '||p, 'Content'
from generate_series(1,4) i cross join generate_series(0,1) p;
insert into public.quizzes (id,section_id,title)
values ('fa700000-0000-4000-8000-000000000001','fa600000-0000-4000-8000-000000000003','Quiz A'),
       ('fa700000-0000-4000-8000-000000000002','fa600000-0000-4000-8000-000000000007','Quiz B');
insert into public.quiz_questions (id,quiz_id,position,type,question_text)
select ('fa800000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
       ('fa700000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,0,'SINGLE_CHOICE','Question'
from generate_series(1,2) i;
insert into public.quiz_options (id,question_id,position,content)
select ('fa900000-0000-4000-8000-'||lpad((i*2+p)::text,12,'0'))::uuid,
       ('fa800000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,p,'Option '||p
from generate_series(1,2) i cross join generate_series(0,1) p;
insert into public.quiz_answer_keys (question_id,correct_option_ids)
select ('fa800000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
       array[('fa900000-0000-4000-8000-'||lpad((i*2)::text,12,'0'))::uuid]
from generate_series(1,2) i;
insert into public.course_section_students (course_section_id, mssv)
values ('fa300000-0000-4000-8000-000000000001','SV001'),
       ('fa300000-0000-4000-8000-000000000001','SV002'),
       ('fa300000-0000-4000-8000-000000000002','SV001');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"fa100000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false,"email":"thaybao@minclass.local"}',true);
select set_config('test.multi_a',session_id::text,true) from public.start_chapter_session('fa300000-0000-4000-8000-000000000001','fa400000-0000-4000-8000-000000000001');
select set_config('test.multi_b',session_id::text,true) from public.start_lesson_session('fa500000-0000-4000-8000-000000000003');
select set_config('test.multi_other',session_id::text,true) from public.start_chapter_session('fa300000-0000-4000-8000-000000000002','fa400000-0000-4000-8000-000000000004');
do $$ begin
  assert (select count(*)=2 from public.rooms where course_section_id='fa300000-0000-4000-8000-000000000001' and status='ACTIVE');
  assert (select count(*)=2 from public.session_lessons where session_id=current_setting('test.multi_a')::uuid);
  assert (select count(*)=1 from public.session_lessons where session_id=current_setting('test.multi_b')::uuid);
  assert (select count(*)=4 from public.session_attendance where session_id in (current_setting('test.multi_a')::uuid,current_setting('test.multi_b')::uuid));
end $$;
select 'ok 1 - distinct Chapters and compatibility entry point start independent LIVE Sessions';

do $$ begin
  begin perform public.start_chapter_session('fa300000-0000-4000-8000-000000000001','fa400000-0000-4000-8000-000000000001'); raise exception 'Duplicate Chapter allowed'; exception when unique_violation then null; end;
  begin perform public.start_lesson_session('fa500000-0000-4000-8000-000000000003'); raise exception 'Duplicate via legacy entry allowed'; exception when unique_violation then null; end;
  begin perform public.start_chapter_session('fa300000-0000-4000-8000-000000000001','fa400000-0000-4000-8000-000000000003'); raise exception 'Empty Chapter allowed'; exception when sqlstate 'P0001' then null; end;
  begin perform public.start_chapter_session('fa300000-0000-4000-8000-000000000001','fa400000-0000-4000-8000-000000000004'); raise exception 'Foreign course allowed'; exception when insufficient_privilege then null; end;
  assert not has_function_privilege('anon','public.start_chapter_session(uuid,uuid)','EXECUTE');
end $$;
reset role;
do $$ begin
  begin
    insert into public.rooms (teacher_user_id,title,status,started_at,lesson_id,course_section_id,chapter_id)
    values ('fa100000-0000-4000-8000-000000000001','Duplicate','ACTIVE',now(),'fa500000-0000-4000-8000-000000000001','fa300000-0000-4000-8000-000000000001','fa400000-0000-4000-8000-000000000001');
    raise exception 'Unique index failed';
  exception when unique_violation then null; end;
end $$;
select 'ok 2 - duplicate Chapter, invalid scope, empty input and direct index bypass rejected';

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"fa100000-0000-4000-8000-000000000003","role":"authenticated","is_anonymous":false,"email":"thaybao@minclass.local"}',true);
do $$ begin
  begin perform public.start_chapter_session('fa300000-0000-4000-8000-000000000001','fa400000-0000-4000-8000-000000000001'); raise exception 'Non-owner Teacher can start'; exception when insufficient_privilege then null; end;
end $$;

set local role anon;
do $$ declare catalog jsonb; begin
  assert (select count(*)=2 from public.get_public_live_sessions() where section_code='MULTILIVE01');
  catalog := public.get_public_course_section_catalog('fa200000-0000-4000-8000-000000000001','fa300000-0000-4000-8000-000000000001');
  assert (select count(*)=3 from jsonb_array_elements(catalog->'lessons') lesson where lesson->>'lesson_status'='LIVE');
end $$;
select 'ok 3 - public list and catalog expose every LIVE Chapter without requiring Student Auth';

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"fa100000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":true}',true);
select * from public.join_live_chapter_session(current_setting('test.multi_a')::uuid,'SV001');
do $$ begin
  begin perform public.get_student_session_lesson_flow_snapshot(current_setting('test.multi_b')::uuid,'fa500000-0000-4000-8000-000000000003'); raise exception 'Join A grants B access'; exception when insufficient_privilege then null; end;
  begin perform public.start_chapter_session('fa300000-0000-4000-8000-000000000001','fa400000-0000-4000-8000-000000000003'); raise exception 'Student can start'; exception when insufficient_privilege then null; end;
end $$;
select * from public.join_live_chapter_session(current_setting('test.multi_b')::uuid,'SV001');
select * from public.set_section_reaction('fa600000-0000-4000-8000-000000000002','UNDERSTAND');
select * from public.set_section_reaction('fa600000-0000-4000-8000-000000000006','QUESTION');
select set_config('request.jwt.claims','{"sub":"fa100000-0000-4000-8000-000000000003","role":"authenticated","is_anonymous":true}',true);
do $$ begin
  begin perform public.join_live_chapter_session(current_setting('test.multi_b')::uuid,'NOTINROSTER'); raise exception 'Outsider joins'; exception when sqlstate 'P0003' then null; end;
end $$;
reset role;
do $$ begin
  assert (select count(*)=2 from public.participants where user_id='fa100000-0000-4000-8000-000000000002');
  assert (select count(*)=2 from public.session_attendance where session_id in (current_setting('test.multi_a')::uuid,current_setting('test.multi_b')::uuid) and joined_at is not null);
  assert (select count(distinct participant_id)=2 from public.section_reactions where section_id in ('fa600000-0000-4000-8000-000000000002','fa600000-0000-4000-8000-000000000006'));
end $$;
select 'ok 4 - Student joins and reactions are independently authorized and counted per Session';

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"fa100000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false,"email":"thaybao@minclass.local"}',true);
select public.release_entire_chapter(current_setting('test.multi_a')::uuid);
do $$ begin
  assert (select bool_and(released_through=1) from public.session_lessons where session_id=current_setting('test.multi_a')::uuid);
  assert (select released_through=0 and presentation_revision=0 from public.session_lessons where session_id=current_setting('test.multi_b')::uuid);
end $$;
select * from public.end_room(current_setting('test.multi_a')::uuid);
do $$ begin
  assert (select status='ACTIVE' from public.rooms where id=current_setting('test.multi_b')::uuid);
  assert (select count(*)=1 from public.get_public_live_sessions() where section_code='MULTILIVE01');
  assert (public.get_teacher_room_summary_overview(current_setting('test.multi_a')::uuid)->'room'->>'id')=current_setting('test.multi_a');
end $$;
select set_config('request.jwt.claims','{"sub":"fa100000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":true}',true);
select * from public.save_own_session_reflection(current_setting('test.multi_a')::uuid,2,'Chapter A only');
select * from public.set_section_reaction('fa600000-0000-4000-8000-000000000006','UNSURE');
do $$ begin
  begin perform public.get_session_student_quiz_snapshot(current_setting('test.multi_b')::uuid,'fa600000-0000-4000-8000-000000000007'); raise exception 'A release opens B quiz'; exception when insufficient_privilege then null; end;
  begin perform public.get_session_student_quiz_snapshot(current_setting('test.multi_b')::uuid,'fa600000-0000-4000-8000-000000000003'); raise exception 'B accesses A quiz'; exception when insufficient_privilege then null; end;
  begin perform public.save_own_session_reflection(current_setting('test.multi_b')::uuid,9,'Too early'); raise exception 'Active Chapter reflection allowed'; exception when insufficient_privilege then null; end;
  assert (select speaking_count=2 from public.get_own_session_reflection(current_setting('test.multi_a')::uuid));
end $$;
select 'ok 5 - Done and End A leave B LIVE and interactive; reflection is scoped to the ended Chapter';

select set_config('request.jwt.claims','{"sub":"fa100000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false,"email":"thaybao@minclass.local"}',true);
select * from public.release_session_lesson_section(current_setting('test.multi_b')::uuid,'fa500000-0000-4000-8000-000000000003');
select set_config('request.jwt.claims','{"sub":"fa100000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":true}',true);
select * from public.submit_session_quiz(current_setting('test.multi_b')::uuid,'fa700000-0000-4000-8000-000000000002',
 '[{"question_id":"fa800000-0000-4000-8000-000000000002","selected_option_ids":["fa900000-0000-4000-8000-000000000004"]}]');
do $$ begin
  assert (public.get_session_student_quiz_snapshot(current_setting('test.multi_b')::uuid,'fa600000-0000-4000-8000-000000000007')->'attempt'->>'score')::integer=1;
  assert (public.get_session_student_quiz_snapshot(current_setting('test.multi_a')::uuid,'fa600000-0000-4000-8000-000000000003')->'attempt')='null'::jsonb, 'B submission does not create an A attempt';
end $$;
select set_config('request.jwt.claims','{"sub":"fa100000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false,"email":"thaybao@minclass.local"}',true);
select public.replace_course_section_roster('fa300000-0000-4000-8000-000000000001',array['SV001','SV003']);
select set_config('test.multi_a2',session_id::text,true) from public.start_chapter_session('fa300000-0000-4000-8000-000000000001','fa400000-0000-4000-8000-000000000001');
select public.replace_course_section_roster('fa300000-0000-4000-8000-000000000001',array['SV001','SV004']);
do $$ declare s uuid; begin
  foreach s in array array[current_setting('test.multi_a2')::uuid,current_setting('test.multi_b')::uuid] loop
    assert (select count(*)=2 from public.session_attendance where session_id=s);
    assert exists (select 1 from public.session_attendance where session_id=s and mssv='SV004');
    assert not exists (select 1 from public.session_attendance where session_id=s and mssv='SV003');
  end loop;
  assert exists (select 1 from public.session_attendance where session_id=current_setting('test.multi_a')::uuid and mssv='SV002'), 'Ended attendance is unchanged';
  assert (select count(*)=1 from public.session_attendance where session_id=current_setting('test.multi_other')::uuid), 'Other class is unchanged';
end $$;
select 'ok 6 - roster changes update every ACTIVE Session and preserve ended/other-course snapshots';

do $$ declare report jsonb; student jsonb; begin
  report := public.get_teacher_course_section_export('fa200000-0000-4000-8000-000000000001','fa300000-0000-4000-8000-000000000001');
  assert (report->>'totalClassMeetings')::integer=3;
  select value into student from jsonb_array_elements(report->'students') where value->>'mssv'='SV001';
  assert (student->>'attendedClassMeetingCount')::integer=2;
  assert (student->>'speakingCount')::integer=2;
end $$;
select 'ok 7 - repeated Chapter starts and simultaneous Chapters count once per Session in export';

select * from public.end_room(current_setting('test.multi_b')::uuid);
select set_config('request.jwt.claims','{"sub":"fa100000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":true}',true);
select * from public.save_own_session_reflection(current_setting('test.multi_b')::uuid,3,'Chapter B only');
select set_config('request.jwt.claims','{"sub":"fa100000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false,"email":"thaybao@minclass.local"}',true);
do $$ begin
  assert (public.get_teacher_room_summary_overview(current_setting('test.multi_b')::uuid)->'room'->>'id')=current_setting('test.multi_b');
  assert (select status='ACTIVE' from public.rooms where id=current_setting('test.multi_a2')::uuid);
end $$;
reset role;
do $$ begin
  assert (select count(*)=2 from public.session_reflections join public.participants on participants.id=session_reflections.participant_id where participants.user_id='fa100000-0000-4000-8000-000000000002');
end $$;
select 'ok 8 - ending B preserves the new A Session and separate reflection histories';
rollback;
