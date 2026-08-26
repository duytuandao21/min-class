begin;

create extension if not exists pgtap with schema extensions;
set local role postgres;
set local search_path = public, extensions;
select extensions.plan(5);

select extensions.is(
  (
    select constraints.confdeltype::text
    from pg_catalog.pg_constraint as constraints
    where constraints.conname = 'course_sections_subject_id_fkey'
      and constraints.conrelid = 'public.course_sections'::regclass
  ),
  'r',
  'Deleting a Subject is restricted while Course Sections exist'
);

select extensions.is(
  (
    select constraints.confdeltype::text
    from pg_catalog.pg_constraint as constraints
    where constraints.conname = 'lessons_course_section_id_fkey'
      and constraints.conrelid = 'public.lessons'::regclass
  ),
  'r',
  'Deleting a Course Section is restricted while Lessons exist'
);

select extensions.is(
  (
    select constraints.confdeltype::text
    from pg_catalog.pg_constraint as constraints
    where constraints.conname = 'rooms_lesson_id_fkey'
      and constraints.conrelid = 'public.rooms'::regclass
  ),
  'r',
  'Deleting a Lesson is restricted while Session history exists'
);

select extensions.like(
  pg_catalog.pg_get_functiondef('public.set_section_reaction(uuid,public.reaction_type)'::regprocedure),
  '%FOR SHARE OF rooms%',
  'Reaction writes lock the Session against concurrent End'
);

select extensions.like(
  pg_catalog.pg_get_functiondef('public.create_section_comment(uuid,text,boolean)'::regprocedure),
  '%FOR SHARE OF rooms%',
  'Comment writes lock the Session against concurrent End'
);

select * from extensions.finish();
rollback;
