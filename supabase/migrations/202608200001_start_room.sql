create function public.start_room(p_room_id uuid)
returns table (
  room_id uuid,
  room_code text,
  room_status public.room_status,
  started_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_room public.rooms%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '28000';
  end if;

  select rooms.*
  into target_room
  from public.rooms
  where rooms.id = p_room_id
  for update;

  if not found or target_room.teacher_user_id is distinct from auth.uid() then
    raise exception 'Room cannot be started.' using errcode = '42501';
  end if;

  if target_room.status <> 'DRAFT' then
    raise exception 'Only a DRAFT room can be started.' using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.sections
    join public.lessons on lessons.id = sections.lesson_id
    where lessons.room_id = target_room.id
  ) then
    raise exception 'Room must have at least one section.' using errcode = 'P0001';
  end if;

  update public.rooms
  set status = 'ACTIVE', started_at = now()
  where rooms.id = target_room.id
  returning rooms.* into target_room;

  return query
  select target_room.id, target_room.code, target_room.status, target_room.started_at;
end;
$$;

revoke all on function public.start_room(uuid) from public, anon;
grant execute on function public.start_room(uuid) to authenticated;
