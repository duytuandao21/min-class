create function public.get_student_lesson_snapshot(p_room_id uuid)
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
    select 1
    from public.participants
    where participants.room_id = p_room_id
      and participants.user_id = auth.uid()
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
  left join public.lessons on lessons.room_id = rooms.id
  left join public.sections
    on sections.lesson_id = lessons.id
   and sections.position <= rooms.released_through
  where rooms.id = p_room_id
  order by sections.position;
end;
$$;

revoke all on function public.get_student_lesson_snapshot(uuid) from public, anon;
grant execute on function public.get_student_lesson_snapshot(uuid) to authenticated;
