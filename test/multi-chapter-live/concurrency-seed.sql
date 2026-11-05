-- For the isolated localhost:55439 test cluster only, removed by concurrency.mjs.
insert into auth.users (id,email,is_anonymous)
values ('fc100000-0000-4000-8000-000000000001','thaybao@minclass.local',false);
insert into public.subjects (id,teacher_id,name)
values ('fc200000-0000-4000-8000-000000000001','fc100000-0000-4000-8000-000000000001','Concurrency test');
insert into public.course_sections (id,subject_id,section_code)
values ('fc300000-0000-4000-8000-000000000001','fc200000-0000-4000-8000-000000000001','RACETEST01');
insert into public.chapters (id,course_section_id,name)
select ('fc400000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
 'fc300000-0000-4000-8000-000000000001','Chapter '||i from generate_series(1,4) i;
insert into public.lessons (id,course_section_id,chapter_id,title,markdown_source)
select ('fc500000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
 'fc300000-0000-4000-8000-000000000001',('fc400000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
 'Lesson '||i,'# Test' from generate_series(1,4) i;
insert into public.sections (lesson_id,position,type,title,content_md)
select ('fc500000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,0,'CONTENT','Section','Content' from generate_series(1,4) i;
insert into public.course_section_students (course_section_id,mssv)
values ('fc300000-0000-4000-8000-000000000001','SV001');
