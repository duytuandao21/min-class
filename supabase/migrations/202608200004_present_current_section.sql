create or replace function public.start_room(p_room_id uuid)
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
  first_position integer;
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

  select min(sections.position)
  into first_position
  from public.sections
  join public.lessons on lessons.id = sections.lesson_id
  where lessons.room_id = target_room.id;

  if first_position is null then
    raise exception 'Room must have at least one section.' using errcode = 'P0001';
  end if;

  update public.rooms
  set
    status = 'ACTIVE',
    started_at = now(),
    teaching_section = first_position,
    released_through = first_position
  where rooms.id = target_room.id
  returning rooms.* into target_room;

  return query
  select target_room.id, target_room.code, target_room.status, target_room.started_at;
end;
$$;

create or replace function public.release_section(p_room_id uuid)
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
     or target_room.status <> 'ACTIVE' then
    raise exception 'Room cannot advance a section.' using errcode = '42501';
  end if;

  if target_room.released_through < target_room.teaching_section then
    update public.rooms
    set released_through = target_room.teaching_section
    where rooms.id = target_room.id;

    return query
    select rooms.teaching_section, rooms.released_through
    from public.rooms
    where rooms.id = target_room.id;
    return;
  end if;

  select min(sections.position)
  into next_position
  from public.sections
  join public.lessons on lessons.id = sections.lesson_id
  where lessons.room_id = target_room.id
    and sections.position > target_room.teaching_section;

  if next_position is null then
    raise exception 'The final section has no next section.' using errcode = 'P0001';
  end if;

  update public.rooms
  set
    teaching_section = next_position,
    released_through = next_position
  where rooms.id = target_room.id;

  return query
  select rooms.teaching_section, rooms.released_through
  from public.rooms
  where rooms.id = target_room.id;
end;
$$;

update public.rooms
set released_through = teaching_section
where status = 'ACTIVE'
  and released_through < teaching_section
  and exists (
    select 1
    from public.sections
    join public.lessons on lessons.id = sections.lesson_id
    where lessons.room_id = rooms.id
      and sections.position = rooms.teaching_section
  );
