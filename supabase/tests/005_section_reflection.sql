begin;

create extension if not exists pgtap with schema extensions;

select plan(25);

select ok(
  exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'room_feedback_events'
  ),
  'Feedback events are published to Supabase Realtime'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.room_feedback_events'::regclass),
  'RLS is enabled on feedback events'
);

insert into auth.users (id, instance_id, aud, role, encrypted_password, created_at, updated_at, is_anonymous)
values
  ('15000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', now(), now(), true),
  ('15000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', now(), now(), true),
  ('25000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', now(), now(), true);

insert into public.rooms (id, code, teacher_user_id, title, status, teaching_section, released_through, started_at, ended_at)
values
  ('35000000-0000-0000-0000-000000000001', 'RFL234', '15000000-0000-0000-0000-000000000001', 'Reflection Room', 'ACTIVE', 0, 0, now(), null),
  ('35000000-0000-0000-0000-000000000002', 'END234', '15000000-0000-0000-0000-000000000001', 'Ended Room', 'ENDED', 0, 0, now() - interval '1 hour', now());

insert into public.lessons (id, room_id, title, markdown_source)
values
  ('45000000-0000-0000-0000-000000000001', '35000000-0000-0000-0000-000000000001', 'Reflection Lesson', '# Lesson'),
  ('45000000-0000-0000-0000-000000000002', '35000000-0000-0000-0000-000000000002', 'Ended Lesson', '# Ended');

insert into public.sections (id, lesson_id, position, type, title, content_md)
values
  ('55000000-0000-0000-0000-000000000001', '45000000-0000-0000-0000-000000000001', 0, 'CONTENT', 'Released Section', 'Content'),
  ('55000000-0000-0000-0000-000000000002', '45000000-0000-0000-0000-000000000002', 0, 'CONTENT', 'Ended Section', 'Content');

insert into public.participants (id, room_id, user_id, mssv)
values
  ('65000000-0000-0000-0000-000000000001', '35000000-0000-0000-0000-000000000001', '25000000-0000-0000-0000-000000000001', 'SVREF01'),
  ('65000000-0000-0000-0000-000000000002', '35000000-0000-0000-0000-000000000002', '25000000-0000-0000-0000-000000000001', 'SVREF01');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"25000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select lives_ok(
  $$select * from public.set_section_reaction('55000000-0000-0000-0000-000000000001', 'UNDERSTAND')$$,
  'Student can create a reaction on a released section'
);

select is(
  (select count(*) from public.section_reactions where section_id = '55000000-0000-0000-0000-000000000001'),
  1::bigint,
  'Creating a reaction stores one row'
);

select lives_ok(
  $$select * from public.set_section_reaction('55000000-0000-0000-0000-000000000001', 'UNSURE')$$,
  'Student can change a reaction'
);

select is(
  (select count(*) from public.section_reactions where section_id = '55000000-0000-0000-0000-000000000001'),
  1::bigint,
  'Changing a reaction does not create a duplicate'
);

select is(
  (select reaction::text from public.section_reactions where section_id = '55000000-0000-0000-0000-000000000001'),
  'UNSURE',
  'The latest reaction is persisted'
);

select lives_ok(
  $$select * from public.create_section_comment('55000000-0000-0000-0000-000000000001', '  Named feedback  ', false)$$,
  'Student can create a named comment'
);

select lives_ok(
  $$select * from public.create_section_comment('55000000-0000-0000-0000-000000000001', 'Anonymous feedback', true)$$,
  'Student can create an anonymous comment'
);

select is(
  (select count(*) from public.section_comments where section_id = '55000000-0000-0000-0000-000000000001'),
  2::bigint,
  'Student can create multiple comments'
);

select throws_ok(
  $$select * from public.create_section_comment('55000000-0000-0000-0000-000000000001', '   ', true)$$,
  '22023',
  'Comment must contain between 1 and 500 characters.',
  'Blank comments are rejected'
);

select throws_ok(
  $$select * from public.create_section_comment('55000000-0000-0000-0000-000000000002', 'Too late', true)$$,
  '42501',
  'Section is not available for interaction.',
  'Comments are rejected after the Room ends'
);

select is(
  (select count(*) from public.room_feedback_events),
  0::bigint,
  'Students cannot read realtime feedback events'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"15000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select is(
  (select count(*) from public.section_comments where section_id = '55000000-0000-0000-0000-000000000001'),
  1::bigint,
  'Teacher can directly read only named comments'
);

select is(
  (select count(*) from public.section_comments where is_anonymous),
  0::bigint,
  'Teacher cannot bypass masking by selecting anonymous rows directly'
);

select is(
  (public.get_teacher_feedback_snapshot('35000000-0000-0000-0000-000000000001')->'reactions'->0->>'understand')::integer,
  0,
  'Teacher aggregate reflects the changed UNDERSTAND count'
);

select is(
  (public.get_teacher_feedback_snapshot('35000000-0000-0000-0000-000000000001')->'reactions'->0->>'unsure')::integer,
  1,
  'Teacher aggregate contains the current UNSURE count'
);

select is(
  jsonb_array_length(public.get_teacher_feedback_snapshot('35000000-0000-0000-0000-000000000001')->'comments'),
  2,
  'Teacher snapshot includes named and masked anonymous comments'
);

select is(
  (
    select count(*)
    from jsonb_array_elements(public.get_teacher_feedback_snapshot('35000000-0000-0000-0000-000000000001')->'comments') as comment
    where comment->>'authorLabel' = 'Anonymous'
      and (comment->>'isAnonymous')::boolean
  ),
  1::bigint,
  'Anonymous comment is labeled only as Anonymous'
);

select is(
  (
    select count(*)
    from jsonb_array_elements(public.get_teacher_feedback_snapshot('35000000-0000-0000-0000-000000000001')->'comments') as comment
    where comment->>'authorLabel' = 'SVREF01'
      and not (comment->>'isAnonymous')::boolean
  ),
  1::bigint,
  'Named comment receives its MSSV from the database'
);

select is(
  (select count(*) from public.room_feedback_events where room_id = '35000000-0000-0000-0000-000000000001'),
  4::bigint,
  'Reaction and comment writes emit realtime sync events for Teacher'
);

select is(
  (select count(*) from public.room_feedback_events where section_id = '55000000-0000-0000-0000-000000000001' and kind = 'REACTION'),
  2::bigint,
  'Reaction create and change each trigger a realtime sync event'
);

select is(
  (select count(*) from public.room_feedback_events where section_id = '55000000-0000-0000-0000-000000000001' and kind = 'COMMENT'),
  2::bigint,
  'Each comment triggers a realtime sync event'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"15000000-0000-0000-0000-000000000002","role":"authenticated"}', true);

select throws_ok(
  $$select public.get_teacher_feedback_snapshot('35000000-0000-0000-0000-000000000001')$$,
  '42501',
  'Room feedback is not available.',
  'A different Teacher cannot read Room feedback'
);

select is(
  (select count(*) from public.room_feedback_events),
  0::bigint,
  'A different Teacher cannot read feedback events'
);

select * from finish();

rollback;
