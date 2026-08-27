alter table public.rooms
alter column code drop not null;

-- Room-code RPCs belong to the retired standalone Room flow. Keep their
-- definitions for migration compatibility, but make them inaccessible.
revoke all on function public.create_room_with_lesson(text, text, jsonb) from public, anon, authenticated;
revoke all on function public.start_room(uuid) from public, anon, authenticated;
revoke all on function public.join_room(text, text) from public, anon, authenticated;
revoke all on function public.join_lesson_session(uuid, text, text) from public, anon, authenticated;

drop function public.start_lesson_session(uuid);

create function public.start_lesson_session(p_lesson_id uuid)
returns table (
  session_id uuid,
  session_status public.room_status,
  started_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lesson public.lessons%rowtype;
  v_course_section_id uuid;
  v_first_position integer;
  v_room_id uuid;
  v_started_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '28000';
  end if;

  if coalesce((auth.jwt()->>'is_anonymous')::boolean, true)
    or lower(coalesce(auth.jwt()->>'email', '')) <> 'thaybao@minclass.local'
  then
    raise exception 'Teacher account required.' using errcode = '42501';
  end if;

  select lessons.*
  into v_lesson
  from public.lessons
  join public.course_sections on course_sections.id = lessons.course_section_id
  join public.subjects on subjects.id = course_sections.subject_id
  where lessons.id = p_lesson_id
    and lessons.room_id is null
    and subjects.teacher_id = auth.uid();

  if not found then
    raise exception 'Lesson is not available.' using errcode = '42501';
  end if;

  v_course_section_id := v_lesson.course_section_id;
  perform pg_advisory_xact_lock(hashtextextended(v_course_section_id::text, 0));

  if exists (
    select 1
    from public.rooms
    join public.lessons on lessons.id = rooms.lesson_id
    where lessons.course_section_id = v_course_section_id
      and rooms.status = 'ACTIVE'
  ) then
    raise exception 'Course Section already has a LIVE Lesson Session.' using errcode = '23505';
  end if;

  select min(sections.position)
  into v_first_position
  from public.sections
  where sections.lesson_id = v_lesson.id;

  if v_first_position is null then
    raise exception 'Lesson must have at least one Section.' using errcode = 'P0001';
  end if;

  insert into public.rooms (
    teacher_user_id,
    title,
    status,
    teaching_section,
    released_through,
    started_at,
    lesson_id
  )
  values (
    auth.uid(),
    v_lesson.title,
    'ACTIVE',
    v_first_position,
    v_first_position,
    now(),
    v_lesson.id
  )
  returning id, rooms.started_at into v_room_id, v_started_at;

  insert into public.session_attendance (session_id, mssv)
  select v_room_id, course_section_students.normalized_mssv
  from public.course_section_students
  where course_section_students.course_section_id = v_course_section_id;

  return query
  select v_room_id, 'ACTIVE'::public.room_status, v_started_at;
end;
$$;

revoke all on function public.start_lesson_session(uuid) from public, anon, authenticated;
grant execute on function public.start_lesson_session(uuid) to authenticated;

drop function public.join_live_lesson(uuid, text);

create function public.join_live_lesson(
  p_lesson_id uuid,
  p_mssv text
)
returns table (
  room_id uuid,
  room_title text,
  room_status public.room_status,
  participant_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_room public.rooms%rowtype;
  existing_participant public.participants%rowtype;
  created_participant_id uuid;
  v_normalized_mssv text := upper(btrim(coalesce(p_mssv, '')));
  v_joined_at timestamptz;
begin
  if auth.uid() is null
    or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) is not true
  then
    raise exception 'Lesson Session is not available.' using errcode = '42501';
  end if;

  select rooms.*
  into target_room
  from public.rooms
  where rooms.lesson_id = p_lesson_id
    and rooms.status = 'ACTIVE'
  for update;

  if not found then
    raise exception 'Lesson Session is not available.' using errcode = 'P0001';
  end if;

  if v_normalized_mssv !~ '^[A-Z0-9][A-Z0-9._-]{2,31}$'
    or not exists (
      select 1
      from public.session_attendance
      where session_attendance.session_id = target_room.id
        and session_attendance.mssv = v_normalized_mssv
    )
  then
    raise exception 'Student is not in the Course Section.' using errcode = 'P0003';
  end if;

  select participants.*
  into existing_participant
  from public.participants
  where participants.room_id = target_room.id
    and participants.user_id = auth.uid();

  if found then
    if existing_participant.mssv is distinct from v_normalized_mssv then
      raise exception 'This user has already joined the Lesson Session.' using errcode = '23505';
    end if;
    created_participant_id := existing_participant.id;
    v_joined_at := existing_participant.joined_at;
  else
    v_joined_at := now();
    insert into public.participants (room_id, user_id, mssv, joined_at)
    values (target_room.id, auth.uid(), v_normalized_mssv, v_joined_at)
    returning id into created_participant_id;
  end if;

  update public.session_attendance
  set joined_at = coalesce(session_attendance.joined_at, v_joined_at)
  where session_attendance.session_id = target_room.id
    and session_attendance.mssv = v_normalized_mssv;

  return query
  select target_room.id, target_room.title, target_room.status, created_participant_id;
exception
  when unique_violation then
    raise exception 'This MSSV or user has already joined the Lesson Session.' using errcode = '23505';
end;
$$;

revoke all on function public.join_live_lesson(uuid, text) from public, anon, authenticated;
grant execute on function public.join_live_lesson(uuid, text) to authenticated;

drop function public.get_student_lesson_snapshot(uuid);

create function public.get_student_lesson_snapshot(p_room_id uuid)
returns table (
  room_id uuid,
  room_title text,
  room_status public.room_status,
  released_through integer,
  section_id uuid,
  section_position integer,
  section_type public.section_type,
  section_title text,
  section_content_md text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '28000';
  end if;

  if not exists (
    select 1
    from public.participants
    where participants.room_id = p_room_id
      and participants.user_id = auth.uid()
  ) and not exists (
    select 1
    from public.lesson_session_access_grants
    join public.rooms on rooms.id = lesson_session_access_grants.room_id
    where lesson_session_access_grants.room_id = p_room_id
      and lesson_session_access_grants.user_id = auth.uid()
      and rooms.status = 'ENDED'
  ) then
    raise exception 'Lesson Session is not available to this Student.' using errcode = '42501';
  end if;

  return query
  select
    rooms.id,
    rooms.title,
    rooms.status,
    rooms.released_through,
    sections.id,
    sections.position,
    sections.type,
    sections.title,
    sections.content_md
  from public.rooms
  left join public.sections
    on sections.lesson_id = private.lesson_id_for_room(rooms.id)
   and sections.position <= rooms.released_through
  where rooms.id = p_room_id
  order by sections.position;
end;
$$;

revoke all on function public.get_student_lesson_snapshot(uuid) from public, anon, authenticated;
grant execute on function public.get_student_lesson_snapshot(uuid) to authenticated;

-- Keep the established RPC names while stripping obsolete codes at the
-- public boundary. The private functions retain compatibility with old rows.
create or replace function public.get_teacher_room_summary(p_room_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_summary jsonb;
begin
  v_summary := private.get_teacher_room_summary(p_room_id);
  return jsonb_set(
    v_summary,
    '{room}',
    (v_summary->'room') - 'code'
  );
end;
$$;

create or replace function public.get_teacher_class_voices(p_room_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select private.get_teacher_class_voices(p_room_id) - 'roomCode';
$$;

revoke all on function public.get_teacher_room_summary(uuid) from public, anon, authenticated;
revoke all on function public.get_teacher_class_voices(uuid) from public, anon, authenticated;
grant execute on function public.get_teacher_room_summary(uuid) to authenticated;
grant execute on function public.get_teacher_class_voices(uuid) to authenticated;
