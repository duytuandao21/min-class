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
  normalized_code text := upper(btrim(coalesce(p_join_code, '')));
  normalized_mssv text := upper(btrim(coalesce(p_mssv, '')));
begin
  if auth.uid() is null
    or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) is not true
  then
    raise exception 'Lesson Session is not available.' using errcode = 'P0001';
  end if;

  select rooms.*
  into target_room
  from public.rooms
  where rooms.lesson_id = p_lesson_id
    and rooms.code = normalized_code
    and rooms.status = 'ACTIVE'
  for share;

  if not found then
    raise exception 'Lesson Session is not available.' using errcode = 'P0001';
  end if;

  select participants.*
  into existing_participant
  from public.participants
  where participants.room_id = target_room.id
    and participants.user_id = auth.uid();

  if found then
    if existing_participant.mssv is distinct from normalized_mssv then
      raise exception 'This user has already joined the Session.' using errcode = '23505';
    end if;

    return query select
      target_room.id,
      target_room.code,
      target_room.title,
      target_room.status,
      existing_participant.id;
    return;
  end if;

  return query select * from public.join_room(normalized_code, normalized_mssv);
end;
$$;

revoke all on function public.join_lesson_session(uuid, text, text) from public, anon, authenticated;
grant execute on function public.join_lesson_session(uuid, text, text) to authenticated;
