begin;

create extension if not exists pgtap with schema extensions;
set local role postgres;
set local search_path = public, extensions;
select extensions.plan(7);

insert into auth.users (id, instance_id, aud, role, encrypted_password, email, created_at, updated_at, is_anonymous)
values
  ('ba100000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', 'phase9-fix-teacher@minclass.test', now(), now(), false),
  ('ba100000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', null, now(), now(), true),
  ('ba100000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', null, now(), now(), true);

insert into public.subjects (id, teacher_id, name, code)
values ('ba110000-0000-0000-0000-000000000001', 'ba100000-0000-0000-0000-000000000001', 'Review Fix Subject', 'RFX');

insert into public.course_sections (id, subject_id, section_code)
values ('ba120000-0000-0000-0000-000000000001', 'ba110000-0000-0000-0000-000000000001', 'REVIEWFIX');

insert into public.lessons (id, room_id, course_section_id, title, markdown_source)
values ('ba130000-0000-0000-0000-000000000001', null, 'ba120000-0000-0000-0000-000000000001', 'Review Reauthentication', '# Review');

insert into public.sections (id, lesson_id, position, type, title, content_md)
values ('ba140000-0000-0000-0000-000000000001', 'ba130000-0000-0000-0000-000000000001', 0, 'CONTENT', 'Content', 'Review content');

insert into public.rooms (id, code, teacher_user_id, title, status, teaching_section, released_through, started_at, lesson_id)
values ('ba150000-0000-0000-0000-000000000001', 'RFX234', 'ba100000-0000-0000-0000-000000000001', 'Review Reauthentication', 'ACTIVE', 0, 0, now() - interval '1 hour', 'ba130000-0000-0000-0000-000000000001');

insert into public.session_attendance (session_id, mssv)
values
  ('ba150000-0000-0000-0000-000000000001', '23162011'),
  ('ba150000-0000-0000-0000-000000000001', '23162012');

update public.rooms
set status = 'ENDED', ended_at = now()
where id = 'ba150000-0000-0000-0000-000000000001';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"ba100000-0000-0000-0000-000000000002","role":"authenticated","is_anonymous":true}', true);

select extensions.is((select count(*) from public.access_ended_lesson_session('ba130000-0000-0000-0000-000000000001', '23162011')), 1::bigint, 'First roster MSSV can open ended Review');
select extensions.is((select count(*) from public.access_ended_lesson_session('ba130000-0000-0000-0000-000000000001', '23162012')), 1::bigint, 'The same anonymous browser can reauthenticate with another roster MSSV');
select extensions.is((select mssv from public.lesson_session_access_grants where room_id = 'ba150000-0000-0000-0000-000000000001' and user_id = 'ba100000-0000-0000-0000-000000000002'), '23162012', 'Browser grant tracks the latest verified MSSV');
select extensions.is(public.get_student_ended_lesson_review('ba150000-0000-0000-0000-000000000001')->>'mssv', '23162012', 'Review data is scoped to the reauthenticated MSSV');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"ba100000-0000-0000-0000-000000000003","role":"authenticated","is_anonymous":true}', true);

select extensions.is((select count(*) from public.access_ended_lesson_session('ba130000-0000-0000-0000-000000000001', '23162012')), 1::bigint, 'The same roster MSSV can review from another anonymous browser');
set local role postgres;
select extensions.is((select count(*) from public.lesson_session_access_grants where room_id = 'ba150000-0000-0000-0000-000000000001' and mssv = '23162012'), 2::bigint, 'Read-only Review grants are not globally locked to the first browser');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"ba100000-0000-0000-0000-000000000003","role":"authenticated","is_anonymous":true}', true);
select extensions.throws_ok($$select * from public.access_ended_lesson_session('ba130000-0000-0000-0000-000000000001', '99999999')$$, '42501', 'Lesson access denied.', 'A non-roster MSSV remains denied');

select * from extensions.finish();
rollback;
