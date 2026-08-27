begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(7);

select ok(
  not has_function_privilege('authenticated', 'public.join_room(text, text)', 'EXECUTE'),
  'The obsolete Room Code join RPC is inaccessible'
);
select ok(
  not has_function_privilege('authenticated', 'public.join_lesson_session(uuid, text, text)', 'EXECUTE'),
  'The obsolete Lesson Session code RPC is inaccessible'
);
select ok(
  not has_function_privilege('authenticated', 'public.start_room(uuid)', 'EXECUTE'),
  'The obsolete standalone Room start RPC is inaccessible'
);
select ok(
  has_function_privilege('authenticated', 'public.join_live_lesson(uuid, text)', 'EXECUTE'),
  'Students can join a LIVE Lesson with MSSV only'
);
select results_eq(
  $$select parameter_name::text from information_schema.parameters
    where specific_schema = 'public'
      and specific_name like 'join_live_lesson_%'
      and parameter_mode = 'OUT'
    order by ordinal_position$$,
  $$values ('room_id'::text), ('room_title'::text), ('room_status'::text), ('participant_id'::text)$$,
  'The LIVE join result does not expose a Room Code'
);
select results_eq(
  $$select parameter_name::text from information_schema.parameters
    where specific_schema = 'public'
      and specific_name like 'get_student_lesson_snapshot_%'
      and parameter_mode = 'OUT'
    order by ordinal_position$$,
  $$values
    ('room_id'::text),
    ('room_title'::text),
    ('room_status'::text),
    ('released_through'::text),
    ('section_id'::text),
    ('section_position'::text),
    ('section_type'::text),
    ('section_title'::text),
    ('section_content_md'::text)$$,
  'The Student snapshot does not expose a Room Code'
);
select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'rooms'
      and column_name = 'code'
      and is_nullable = 'YES'
  ),
  'Legacy Room rows remain readable while new Lesson Sessions can omit code'
);

select * from finish();
rollback;
