begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

insert into auth.users (id, instance_id, aud, role, encrypted_password, email, created_at, updated_at, is_anonymous)
values
  ('e7000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', 'teacher-access@minclass.local', now(), now(), false),
  ('e7000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', null, now(), now(), true);
insert into public.subjects (id, teacher_id, name) values
  ('e7100000-0000-4000-8000-000000000001', 'e7000000-0000-4000-8000-000000000001', 'Course access');
insert into public.course_sections (id, subject_id, section_code) values
  ('e7200000-0000-4000-8000-000000000001', 'e7100000-0000-4000-8000-000000000001', 'ACCESS01'),
  ('e7200000-0000-4000-8000-000000000002', 'e7100000-0000-4000-8000-000000000001', 'ACCESS02');
insert into public.course_section_students (course_section_id, mssv) values
  ('e7200000-0000-4000-8000-000000000001', 'SV001'),
  ('e7200000-0000-4000-8000-000000000002', 'SV002');
set constraints all immediate;

select ok(not has_function_privilege('anon', 'public.verify_course_section_student(uuid,text)', 'EXECUTE'), 'Unauthenticated role cannot verify Course Section access');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e7000000-0000-4000-8000-000000000001","is_anonymous":false,"email":"teacher-access@minclass.local"}', true);
select throws_ok($$select public.verify_course_section_student('e7200000-0000-4000-8000-000000000001', 'SV001')$$, '42501', 'Course Section access is not available.', 'Teacher identity cannot use Student access');

select set_config('request.jwt.claims', '{"sub":"e7000000-0000-4000-8000-000000000002","is_anonymous":true}', true);
select is(public.verify_course_section_student('e7200000-0000-4000-8000-000000000001', ' sv001 '), true, 'Roster Student is normalized and verified');
select throws_ok($$select public.verify_course_section_student('e7200000-0000-4000-8000-000000000001', 'SV999')$$, 'P0003', 'Student is not in the Course Section.', 'Non-roster Student is denied');
select throws_ok($$select public.verify_course_section_student('e7200000-0000-4000-8000-000000000002', 'SV001')$$, 'P0003', 'Student is not in the Course Section.', 'Class A MSSV cannot access Class B');
select throws_ok($$select public.verify_course_section_student('e7200000-0000-4000-8000-000000000001', '!')$$, '42501', 'Course Section access is not available.', 'Malformed MSSV is denied');
select is((select count(*) from public.course_section_students), 0::bigint, 'Verification does not expose roster rows');

select * from finish();
rollback;
