begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(11);

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  encrypted_password,
  created_at,
  updated_at,
  is_anonymous
)
values
  (
    '11000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    '',
    now(),
    now(),
    false
  ),
  (
    '21000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    '',
    now(),
    now(),
    true
  ),
  (
    '21000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    '',
    now(),
    now(),
    true
  );

insert into public.rooms (id, code, teacher_user_id, title, status, started_at, ended_at)
values
  (
    '31000000-0000-0000-0000-000000000001',
    'DRA234',
    '11000000-0000-0000-0000-000000000001',
    'Draft Room',
    'DRAFT',
    null,
    null
  ),
  (
    '31000000-0000-0000-0000-000000000002',
    'ACT234',
    '11000000-0000-0000-0000-000000000001',
    'Active Room',
    'ACTIVE',
    now(),
    null
  ),
  (
    '31000000-0000-0000-0000-000000000003',
    'END234',
    '11000000-0000-0000-0000-000000000001',
    'Ended Room',
    'ENDED',
    now() - interval '1 hour',
    now()
  );

insert into public.lessons (id, room_id, title, markdown_source)
values (
  '41000000-0000-0000-0000-000000000001',
  '31000000-0000-0000-0000-000000000001',
  'Draft Lesson',
  '# Draft lesson'
);

insert into public.sections (lesson_id, position, type, title, content_md)
values (
  '41000000-0000-0000-0000-000000000001',
  0,
  'CONTENT',
  'First section',
  'Content'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"21000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select throws_ok(
  $$select * from public.join_room('BAD', 'SV001')$$,
  '22023',
  'Invalid room code or MSSV.',
  'Invalid room code is rejected'
);

select throws_ok(
  $$select * from public.join_room('DRA234', 'SV001')$$,
  'P0001',
  'Room is not available.',
  'A DRAFT room cannot be joined'
);

select throws_ok(
  $$select * from public.join_room('END234', 'SV001')$$,
  'P0001',
  'Room is not available.',
  'An ENDED room cannot be joined'
);

select lives_ok(
  $$select * from public.join_room(' act234 ', ' sv001 ')$$,
  'A student can join an ACTIVE room'
);

select is(
  (
    select mssv
    from public.participants
    where room_id = '31000000-0000-0000-0000-000000000002'
      and user_id = auth.uid()
  ),
  'SV001',
  'Valid join stores the normalized MSSV'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"21000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);

select throws_ok(
  $$select * from public.join_room('ACT234', 'SV001')$$,
  '23505',
  'This MSSV or user has already joined the room.',
  'Duplicate MSSV is rejected'
);

select throws_ok(
  $$select * from public.start_room('31000000-0000-0000-0000-000000000001')$$,
  '42501',
  'Room cannot be started.',
  'A non-owner cannot start a DRAFT room'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11000000-0000-0000-0000-000000000001","role":"authenticated","is_anonymous":false,"email":"thaybao@minclass.local"}',
  true
);

select lives_ok(
  $$select * from public.start_room('31000000-0000-0000-0000-000000000001')$$,
  'Teacher can start their DRAFT room'
);

select is(
  (select status::text from public.rooms where id = '31000000-0000-0000-0000-000000000001'),
  'ACTIVE',
  'Starting a room changes its status to ACTIVE'
);

select is(
  (select released_through from public.rooms where id = '31000000-0000-0000-0000-000000000001'),
  0,
  'Starting a room immediately presents the first section to students'
);

select throws_ok(
  $$select * from public.start_room('31000000-0000-0000-0000-000000000001')$$,
  'P0001',
  'Only a DRAFT room can be started.',
  'An ACTIVE room cannot be started again'
);

select * from finish();
rollback;
