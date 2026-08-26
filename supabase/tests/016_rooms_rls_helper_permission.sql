begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(2);

insert into auth.users (id, instance_id, aud, role, encrypted_password, email, created_at, updated_at, is_anonymous)
values
  ('a1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', 'thaybao@minclass.local', now(), now(), false),
  ('c1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', null, now(), now(), true);

insert into public.rooms (id, code, teacher_user_id, title)
values ('a1100000-0000-0000-0000-000000000001', 'RLS234', 'a1000000-0000-0000-0000-000000000001', 'RLS helper test');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a1000000-0000-0000-0000-000000000001","role":"authenticated","is_anonymous":false,"email":"thaybao@minclass.local"}', true);

select lives_ok(
  $$select id, lesson_id, status, started_at, ended_at from public.rooms$$,
  'Permanent Teacher can evaluate the rooms RLS policy'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-0000-0000-000000000001","role":"authenticated","is_anonymous":true}', true);

select is(
  (select count(*) from public.rooms),
  0::bigint,
  'Anonymous Student does not gain access to unrelated Rooms'
);

select * from finish();
rollback;
