begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(6);

insert into auth.users (id, instance_id, aud, role, encrypted_password, email, created_at, updated_at, is_anonymous)
values
  ('1a000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', 'thaybao@minclass.local', now(), now(), false),
  ('1b000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', 'other@example.com', now(), now(), false),
  ('2a000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', null, now(), now(), true),
  ('2a000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', null, now(), now(), true);

insert into public.rooms (id, code, teacher_user_id, title)
values
  ('3a000000-0000-0000-0000-000000000001', 'AUTH24', '1a000000-0000-0000-0000-000000000001', 'Permanent Teacher Room'),
  ('3a000000-0000-0000-0000-000000000002', 'LEGACY', '2a000000-0000-0000-0000-000000000001', 'Anonymous Legacy Room'),
  ('3a000000-0000-0000-0000-000000000003', 'OTHER2', '1b000000-0000-0000-0000-000000000001', 'Other Account Room');

insert into public.lessons (id, room_id, title, markdown_source)
values
  ('4a000000-0000-0000-0000-000000000001', '3a000000-0000-0000-0000-000000000001', 'Auth Lesson', '# Auth'),
  ('4a000000-0000-0000-0000-000000000002', '3a000000-0000-0000-0000-000000000002', 'Legacy Lesson', '# Legacy');

insert into public.sections (id, lesson_id, position, type, title, content_md)
values
  ('5a000000-0000-0000-0000-000000000001', '4a000000-0000-0000-0000-000000000001', 0, 'CONTENT', 'Auth Section', 'Content'),
  ('5a000000-0000-0000-0000-000000000002', '4a000000-0000-0000-0000-000000000002', 0, 'CONTENT', 'Legacy Section', 'Content');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"2a000000-0000-0000-0000-000000000001","role":"authenticated","is_anonymous":true}', true);

select is(
  (select count(*) from public.rooms where id = '3a000000-0000-0000-0000-000000000002'),
  0::bigint,
  'Anonymous users cannot read Room data as a Teacher owner'
);
select throws_ok(
  $$select * from public.start_room('3a000000-0000-0000-0000-000000000002')$$,
  '42501',
  'Teacher account required.',
  'Anonymous users cannot invoke Teacher lifecycle RPCs'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"1b000000-0000-0000-0000-000000000001","role":"authenticated","is_anonymous":false,"email":"other@example.com"}', true);

select is(
  (select count(*) from public.rooms where id = '3a000000-0000-0000-0000-000000000003'),
  0::bigint,
  'A different permanent Supabase account is not a Teacher'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"1a000000-0000-0000-0000-000000000001","role":"authenticated","is_anonymous":false,"email":"thaybao@minclass.local"}', true);

select is(
  (select count(*) from public.rooms where id = '3a000000-0000-0000-0000-000000000001'),
  1::bigint,
  'Permanent Teacher can read their own Room'
);
select lives_ok(
  $$select * from public.start_room('3a000000-0000-0000-0000-000000000001')$$,
  'Permanent Teacher can start their own Room'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"2a000000-0000-0000-0000-000000000002","role":"authenticated","is_anonymous":true}', true);

select lives_ok(
  $$select * from public.join_room('AUTH24', 'SV-AUTH-01')$$,
  'Anonymous Student join flow remains available'
);

select * from finish();

rollback;
