begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(5);

insert into auth.users (id, instance_id, aud, role, encrypted_password, created_at, updated_at, is_anonymous)
values ('19000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', now(), now(), false);

insert into public.rooms (id, code, teacher_user_id, title)
values ('39000000-0000-0000-0000-000000000001', 'LFC234', '19000000-0000-0000-0000-000000000001', 'Lifecycle Room');

insert into public.lessons (id, room_id, title, markdown_source)
values ('49000000-0000-0000-0000-000000000001', '39000000-0000-0000-0000-000000000001', 'Lifecycle Lesson', '# Lifecycle');

insert into public.sections (id, lesson_id, position, type, title, content_md)
values ('59000000-0000-0000-0000-000000000001', '49000000-0000-0000-0000-000000000001', 0, 'CONTENT', 'First Section', 'Content');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"19000000-0000-0000-0000-000000000001","role":"authenticated","is_anonymous":false,"email":"thaybao@minclass.local"}', true);

select throws_ok(
  $$update public.rooms set status = 'ACTIVE', started_at = now() where id = '39000000-0000-0000-0000-000000000001'$$,
  '42501',
  'permission denied for table rooms',
  'Owner cannot bypass start_room with a direct lifecycle update'
);
select lives_ok(
  $$update public.rooms set title = 'Renamed Lifecycle Room' where id = '39000000-0000-0000-0000-000000000001'$$,
  'Allowed non-lifecycle Room update remains available'
);
select lives_ok(
  $$select * from public.start_room('39000000-0000-0000-0000-000000000001')$$,
  'Owner can still start Room through the guarded RPC'
);
select is((select status::text from public.rooms where id = '39000000-0000-0000-0000-000000000001'), 'ACTIVE', 'RPC transitions Room to ACTIVE');
select is((select released_through from public.rooms where id = '39000000-0000-0000-0000-000000000001'), 0, 'RPC preserves the current-section release invariant');

select * from finish();

rollback;
