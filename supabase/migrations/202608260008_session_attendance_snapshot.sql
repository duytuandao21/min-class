create table public.session_attendance (
  session_id uuid not null references public.rooms(id) on delete cascade,
  mssv text not null,
  joined_at timestamptz,
  primary key (session_id, mssv),
  constraint session_attendance_mssv_valid check (
    mssv = upper(btrim(mssv))
    and mssv ~ '^[A-Z0-9][A-Z0-9._-]{2,31}$'
  )
);

create index session_attendance_session_joined_idx
on public.session_attendance (session_id, joined_at);

alter table public.session_attendance enable row level security;

create policy session_attendance_select_teacher
on public.session_attendance for select to authenticated
using (private.is_room_teacher(session_id));

revoke all on table public.session_attendance from public, anon, authenticated;
grant select on table public.session_attendance to authenticated;

insert into public.session_attendance (session_id, mssv, joined_at)
select
  rooms.id,
  course_section_students.normalized_mssv,
  participants.joined_at
from public.rooms
join public.lessons on lessons.id = rooms.lesson_id
join public.course_section_students
  on course_section_students.course_section_id = lessons.course_section_id
left join public.participants
  on participants.room_id = rooms.id
 and participants.mssv = course_section_students.normalized_mssv
where rooms.lesson_id is not null
on conflict (session_id, mssv) do update
set joined_at = coalesce(public.session_attendance.joined_at, excluded.joined_at);

insert into public.session_attendance (session_id, mssv, joined_at)
select participants.room_id, participants.mssv, participants.joined_at
from public.participants
join public.rooms on rooms.id = participants.room_id
where rooms.lesson_id is not null
on conflict (session_id, mssv) do update
set joined_at = coalesce(public.session_attendance.joined_at, excluded.joined_at);

create or replace function public.start_lesson_session(p_lesson_id uuid)
returns table (
  session_id uuid,
  join_code text,
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
  v_code text;
  v_started_at timestamptz;
  v_attempt integer;
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

  for v_attempt in 1..12 loop
    v_code := private.generate_room_code(6);
    begin
      insert into public.rooms (
        code,
        teacher_user_id,
        title,
        status,
        teaching_section,
        released_through,
        started_at,
        lesson_id
      )
      values (
        v_code,
        auth.uid(),
        v_lesson.title,
        'ACTIVE',
        v_first_position,
        v_first_position,
        now(),
        v_lesson.id
      )
      returning id, rooms.started_at into v_room_id, v_started_at;
      exit;
    exception
      when unique_violation then
        if exists (
          select 1 from public.rooms
          where rooms.lesson_id = v_lesson.id and rooms.status = 'ACTIVE'
        ) then
          raise;
        end if;
    end;
  end loop;

  if v_room_id is null then
    raise exception 'Could not generate a unique Lesson Session code.' using errcode = 'P0001';
  end if;

  insert into public.session_attendance (session_id, mssv)
  select v_room_id, course_section_students.normalized_mssv
  from public.course_section_students
  where course_section_students.course_section_id = v_course_section_id;

  return query select v_room_id, v_code, 'ACTIVE'::public.room_status, v_started_at;
end;
$$;

create or replace function public.join_room(p_room_code text, p_mssv text)
returns table (
  room_id uuid,
  room_code text,
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
  v_normalized_code text := upper(btrim(coalesce(p_room_code, '')));
  v_normalized_mssv text := upper(btrim(coalesce(p_mssv, '')));
  v_joined_at timestamptz;
begin
  if auth.uid() is null
    or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) is not true
    or v_normalized_code !~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$'
    or v_normalized_mssv !~ '^[A-Z0-9][A-Z0-9._-]{2,31}$'
  then
    raise exception 'Room is not available.' using errcode = 'P0001';
  end if;

  select rooms.*
  into target_room
  from public.rooms
  where rooms.code = v_normalized_code
    and rooms.status = 'ACTIVE'
  for update;

  if not found then
    raise exception 'Room is not available.' using errcode = 'P0001';
  end if;

  if target_room.lesson_id is not null and not exists (
    select 1
    from public.session_attendance
    where session_attendance.session_id = target_room.id
      and session_attendance.mssv = v_normalized_mssv
  ) then
    raise exception 'Room is not available.' using errcode = 'P0001';
  end if;

  select participants.*
  into existing_participant
  from public.participants
  where participants.room_id = target_room.id
    and participants.user_id = auth.uid();

  if found then
    if existing_participant.mssv is distinct from v_normalized_mssv then
      raise exception 'This user has already joined the room.' using errcode = '23505';
    end if;
    created_participant_id := existing_participant.id;
    v_joined_at := existing_participant.joined_at;
  else
    v_joined_at := now();
    insert into public.participants (room_id, user_id, mssv, joined_at)
    values (target_room.id, auth.uid(), v_normalized_mssv, v_joined_at)
    returning id into created_participant_id;
  end if;

  if target_room.lesson_id is not null then
    update public.session_attendance
    set joined_at = coalesce(session_attendance.joined_at, v_joined_at)
    where session_attendance.session_id = target_room.id
      and session_attendance.mssv = v_normalized_mssv;
  end if;

  return query select
    target_room.id,
    target_room.code,
    target_room.title,
    target_room.status,
    created_participant_id;
exception
  when unique_violation then
    raise exception 'This MSSV or user has already joined the room.' using errcode = '23505';
end;
$$;

create or replace function public.join_lesson_session(
  p_lesson_id uuid,
  p_join_code text,
  p_mssv text
)
returns table (
  room_id uuid,
  room_code text,
  room_title text,
  room_status public.room_status,
  participant_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.rooms
    where rooms.lesson_id = p_lesson_id
      and rooms.code = upper(btrim(coalesce(p_join_code, '')))
      and rooms.status = 'ACTIVE'
  ) then
    raise exception 'Lesson Session is not available.' using errcode = 'P0001';
  end if;

  return query select * from public.join_room(p_join_code, p_mssv);
end;
$$;

create function public.get_teacher_session_attendance(p_session_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_room public.rooms%rowtype;
  v_roster_count integer;
  v_joined_count integer;
  v_absent_mssvs jsonb;
begin
  select rooms.*
  into target_room
  from public.rooms
  where rooms.id = p_session_id
    and rooms.teacher_user_id = auth.uid();

  if not found then
    raise exception 'Session attendance is not available.' using errcode = '42501';
  end if;

  select
    count(*)::integer,
    count(*) filter (where session_attendance.joined_at is not null)::integer,
    coalesce(
      jsonb_agg(session_attendance.mssv order by session_attendance.mssv)
        filter (where session_attendance.joined_at is null),
      '[]'::jsonb
    )
  into v_roster_count, v_joined_count, v_absent_mssvs
  from public.session_attendance
  where session_attendance.session_id = target_room.id;

  if target_room.lesson_id is null then
    select count(*)::integer
    into v_roster_count
    from public.participants
    where participants.room_id = target_room.id;
    v_joined_count := v_roster_count;
    v_absent_mssvs := '[]'::jsonb;
  end if;

  return jsonb_build_object(
    'rosterCount', v_roster_count,
    'joinedCount', v_joined_count,
    'absentCount', v_roster_count - v_joined_count,
    'absentMssvs', v_absent_mssvs
  );
end;
$$;

revoke all on function public.start_lesson_session(uuid) from public, anon, authenticated;
revoke all on function public.join_room(text, text) from public, anon, authenticated;
revoke all on function public.join_lesson_session(uuid, text, text) from public, anon, authenticated;
revoke all on function public.get_teacher_session_attendance(uuid) from public, anon, authenticated;
grant execute on function public.start_lesson_session(uuid) to authenticated;
grant execute on function public.join_room(text, text) to authenticated;
grant execute on function public.join_lesson_session(uuid, text, text) to authenticated;
grant execute on function public.get_teacher_session_attendance(uuid) to authenticated;

create or replace function public.replace_course_section_roster(
  p_course_section_id uuid,
  p_mssv text[]
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer := coalesce(array_length(p_mssv, 1), 0);
begin
  if coalesce((auth.jwt()->>'is_anonymous')::boolean, true)
    or lower(coalesce(auth.jwt()->>'email', '')) <> 'thaybao@minclass.local'
  then
    raise exception using errcode = '42501', message = 'Teacher account required.';
  end if;

  if not exists (
    select 1
    from public.course_sections
    join public.subjects on subjects.id = course_sections.subject_id
    where course_sections.id = p_course_section_id
      and subjects.teacher_id = auth.uid()
  ) then
    raise exception using errcode = '42501', message = 'Course Section is not available.';
  end if;

  if v_count < 1 or v_count > 2000 then
    raise exception using errcode = '22023', message = 'Roster must contain between 1 and 2000 MSSV values.';
  end if;

  if exists (
    select 1
    from unnest(p_mssv) as roster(mssv)
    where roster.mssv is null
      or roster.mssv <> upper(btrim(roster.mssv))
      or roster.mssv !~ '^[A-Z0-9][A-Z0-9._-]{2,31}$'
  ) then
    raise exception using errcode = '22023', message = 'Roster contains an invalid MSSV.';
  end if;

  if (select count(distinct roster.mssv) from unnest(p_mssv) as roster(mssv)) <> v_count then
    raise exception using errcode = '23505', message = 'Roster contains duplicate MSSV values.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_course_section_id::text, 0));

  delete from public.course_section_students
  where course_section_id = p_course_section_id;

  insert into public.course_section_students (course_section_id, mssv)
  select p_course_section_id, roster.mssv
  from unnest(p_mssv) with ordinality as roster(mssv, position)
  order by roster.position;

  return v_count;
end;
$$;

revoke all on function public.replace_course_section_roster(uuid, text[]) from public, anon, authenticated;
grant execute on function public.replace_course_section_roster(uuid, text[]) to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'session_attendance'
  ) then
    alter publication supabase_realtime add table public.session_attendance;
  end if;
end;
$$;
