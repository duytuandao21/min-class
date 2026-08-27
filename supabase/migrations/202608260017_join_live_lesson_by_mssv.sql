create function public.join_live_lesson(
  p_lesson_id uuid,
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
  v_normalized_mssv text := upper(btrim(coalesce(p_mssv, '')));
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

  return query select * from public.join_room(target_room.code, v_normalized_mssv);
end;
$$;

revoke all on function public.join_live_lesson(uuid, text) from public, anon, authenticated;
grant execute on function public.join_live_lesson(uuid, text) to authenticated;
