alter table public.rooms drop constraint rooms_title_length;
alter table public.rooms add constraint rooms_title_length check (
  title = btrim(title) and char_length(title) between 1 and 200
);

create unique index rooms_one_active_session_per_lesson_idx
on public.rooms (lesson_id)
where lesson_id is not null and status = 'ACTIVE';

create function private.lesson_id_for_room(p_room_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    rooms.lesson_id,
    (
      select lessons.id
      from public.lessons
      where lessons.room_id = rooms.id
      limit 1
    )
  )
  from public.rooms
  where rooms.id = p_room_id;
$$;

create function private.enforce_persistent_lesson_session()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_course_section_id uuid;
begin
  if new.lesson_id is null then
    return new;
  end if;

  if new.status = 'DRAFT' or new.started_at is null then
    raise exception 'Persistent Lesson Session must start as LIVE.' using errcode = '23514';
  end if;

  select lessons.course_section_id
  into v_course_section_id
  from public.lessons
  where lessons.id = new.lesson_id;

  if v_course_section_id is null then
    raise exception 'Persistent Lesson is not available.' using errcode = '23514';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_course_section_id::text, 0));

  if new.status = 'ACTIVE' and exists (
    select 1
    from public.rooms as active_rooms
    join public.lessons as active_lessons on active_lessons.id = active_rooms.lesson_id
    where active_lessons.course_section_id = v_course_section_id
      and active_rooms.status = 'ACTIVE'
      and active_rooms.id is distinct from new.id
  ) then
    raise exception 'Course Section already has a LIVE Lesson Session.' using errcode = '23505';
  end if;

  return new;
end;
$$;

create trigger rooms_enforce_persistent_lesson_session
before insert or update of lesson_id, status on public.rooms
for each row execute function private.enforce_persistent_lesson_session();

create function public.start_lesson_session(p_lesson_id uuid)
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
  normalized_code text := upper(btrim(p_room_code));
  normalized_mssv text := upper(btrim(p_mssv));
  created_participant_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '28000';
  end if;

  if coalesce((auth.jwt()->>'is_anonymous')::boolean, false) is not true
    or normalized_code !~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$'
    or normalized_mssv !~ '^[A-Z0-9][A-Z0-9._-]{2,31}$'
  then
    raise exception 'Room is not available.' using errcode = 'P0001';
  end if;

  select rooms.*
  into target_room
  from public.rooms
  where rooms.code = normalized_code
    and rooms.status = 'ACTIVE'
  for update;

  if not found then
    raise exception 'Room is not available.' using errcode = 'P0001';
  end if;

  if target_room.lesson_id is not null and not exists (
    select 1
    from public.lessons
    join public.course_section_students
      on course_section_students.course_section_id = lessons.course_section_id
    where lessons.id = target_room.lesson_id
      and course_section_students.normalized_mssv = normalized_mssv
  ) then
    raise exception 'Room is not available.' using errcode = 'P0001';
  end if;

  insert into public.participants (room_id, user_id, mssv)
  values (target_room.id, auth.uid(), normalized_mssv)
  returning id into created_participant_id;

  return query
  select target_room.id, target_room.code, target_room.title, target_room.status, created_participant_id;
exception
  when unique_violation then
    raise exception 'This MSSV or user has already joined the room.' using errcode = '23505';
end;
$$;

create function public.join_lesson_session(
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
declare
  v_room_id uuid;
begin
  select rooms.id
  into v_room_id
  from public.rooms
  where rooms.lesson_id = p_lesson_id
    and rooms.code = upper(btrim(p_join_code))
    and rooms.status = 'ACTIVE';

  if v_room_id is null then
    raise exception 'Lesson Session is not available.' using errcode = 'P0001';
  end if;

  return query select * from public.join_room(p_join_code, p_mssv);
end;
$$;

create or replace function private.can_interact_with_section(
  target_section_id uuid,
  target_participant_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.sections
    join public.participants on participants.id = target_participant_id
    join public.rooms on rooms.id = participants.room_id
    where sections.id = target_section_id
      and sections.lesson_id = private.lesson_id_for_room(rooms.id)
      and participants.user_id = auth.uid()
      and rooms.status = 'ACTIVE'
      and sections.position <= rooms.released_through
  );
$$;

create or replace function private.can_read_section(target_section_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.sections
    join public.rooms on private.lesson_id_for_room(rooms.id) = sections.lesson_id
    where sections.id = target_section_id
      and (
        rooms.teacher_user_id = auth.uid()
        or (
          sections.position <= rooms.released_through
          and exists (
            select 1
            from public.participants
            where participants.room_id = rooms.id
              and participants.user_id = auth.uid()
          )
        )
      )
  );
$$;

create or replace function private.validate_same_room()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  participant_room_id uuid;
begin
  select participants.room_id
  into participant_room_id
  from public.participants
  where participants.id = new.participant_id;

  if participant_room_id is null then
    raise exception 'Participant does not exist.' using errcode = '23514';
  end if;

  perform rooms.id
  from public.sections
  join public.rooms on rooms.id = participant_room_id
  where sections.id = new.section_id
    and sections.lesson_id = private.lesson_id_for_room(rooms.id)
    and rooms.status = 'ACTIVE'
    and sections.position <= rooms.released_through
  for share of rooms;

  if not found then
    raise exception 'Section is not available for interaction.' using errcode = '42501';
  end if;

  return new;
end;
$$;

create or replace function private.release_section(p_room_id uuid)
returns table (
  teaching_section integer,
  released_through integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_room public.rooms%rowtype;
  target_lesson_id uuid;
  next_position integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '28000';
  end if;

  select rooms.*
  into target_room
  from public.rooms
  where rooms.id = p_room_id
  for update;

  if not found
    or target_room.teacher_user_id is distinct from auth.uid()
    or target_room.status <> 'ACTIVE'
  then
    raise exception 'Room cannot advance a section.' using errcode = '42501';
  end if;

  target_lesson_id := private.lesson_id_for_room(target_room.id);

  select min(sections.position)
  into next_position
  from public.sections
  where sections.lesson_id = target_lesson_id
    and sections.position > target_room.teaching_section;

  if next_position is null then
    raise exception 'The final section has no next section.' using errcode = 'P0001';
  end if;

  update public.rooms
  set teaching_section = next_position, released_through = next_position
  where rooms.id = target_room.id;

  return query
  select rooms.teaching_section, rooms.released_through
  from public.rooms
  where rooms.id = target_room.id;
end;
$$;

create or replace function public.get_student_lesson_snapshot(p_room_id uuid)
returns table (
  room_id uuid,
  room_code text,
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
    select 1 from public.participants
    where participants.room_id = p_room_id and participants.user_id = auth.uid()
  ) then
    raise exception 'Room is not available to this participant.' using errcode = '42501';
  end if;

  return query
  select
    rooms.id,
    rooms.code,
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

revoke all on function private.lesson_id_for_room(uuid) from public, anon, authenticated;
revoke all on function private.enforce_persistent_lesson_session() from public, anon, authenticated;
revoke all on function public.start_lesson_session(uuid) from public, anon, authenticated;
revoke all on function public.join_lesson_session(uuid, text, text) from public, anon, authenticated;
grant execute on function public.start_lesson_session(uuid) to authenticated;
grant execute on function public.join_lesson_session(uuid, text, text) to authenticated;
