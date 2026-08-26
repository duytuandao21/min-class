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
declare
  target_room public.rooms%rowtype;
  existing_participant public.participants%rowtype;
  created_participant_id uuid;
  v_normalized_code text := upper(btrim(coalesce(p_join_code, '')));
  v_normalized_mssv text := upper(btrim(coalesce(p_mssv, '')));
begin
  if auth.uid() is null
    or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) is not true
    or v_normalized_code !~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$'
    or v_normalized_mssv !~ '^[A-Z0-9][A-Z0-9._-]{2,31}$'
  then
    raise exception 'Lesson Session is not available.' using errcode = 'P0001';
  end if;

  select rooms.*
  into target_room
  from public.rooms
  where rooms.lesson_id = p_lesson_id
    and rooms.code = v_normalized_code
    and rooms.status = 'ACTIVE'
  for update;

  if not found or not exists (
    select 1
    from public.lessons
    join public.course_section_students
      on course_section_students.course_section_id = lessons.course_section_id
    where lessons.id = target_room.lesson_id
      and course_section_students.normalized_mssv = v_normalized_mssv
  ) then
    raise exception 'Lesson Session is not available.' using errcode = 'P0001';
  end if;

  select participants.*
  into existing_participant
  from public.participants
  where participants.room_id = target_room.id
    and participants.user_id = auth.uid();

  if found then
    if existing_participant.mssv is distinct from v_normalized_mssv then
      raise exception 'This user has already joined the Session.' using errcode = '23505';
    end if;
    created_participant_id := existing_participant.id;
  else
    insert into public.participants (room_id, user_id, mssv)
    values (target_room.id, auth.uid(), v_normalized_mssv)
    returning id into created_participant_id;
  end if;

  return query select
    target_room.id,
    target_room.code,
    target_room.title,
    target_room.status,
    created_participant_id;
exception
  when unique_violation then
    raise exception 'This MSSV has already joined the Session.' using errcode = '23505';
end;
$$;

revoke all on function public.join_lesson_session(uuid, text, text) from public, anon, authenticated;
grant execute on function public.join_lesson_session(uuid, text, text) to authenticated;
