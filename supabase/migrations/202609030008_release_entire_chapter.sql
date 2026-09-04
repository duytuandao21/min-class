create function public.release_entire_chapter(p_room_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_released_lesson_count integer;
begin
  if not private.is_room_teacher(p_room_id) then
    raise exception 'Chapter Session is not available.' using errcode = '42501';
  end if;

  perform 1
  from public.rooms
  where rooms.id = p_room_id
    and rooms.status = 'ACTIVE'
  for update;

  if not found then
    raise exception 'Only a LIVE Chapter Session can be completed.' using errcode = 'P0001';
  end if;

  with final_sections as (
    select
      session_lessons.lesson_id,
      max(sections.position)::integer as final_position
    from public.session_lessons
    join public.sections on sections.lesson_id = session_lessons.lesson_id
    where session_lessons.session_id = p_room_id
    group by session_lessons.lesson_id
  )
  update public.session_lessons
  set
    teaching_section = final_sections.final_position,
    released_through = final_sections.final_position
  from final_sections
  where session_lessons.session_id = p_room_id
    and session_lessons.lesson_id = final_sections.lesson_id;

  get diagnostics v_released_lesson_count = row_count;
  if v_released_lesson_count = 0 then
    raise exception 'Chapter Session has no Lesson content.' using errcode = 'P0001';
  end if;

  -- Preserve the scalar progress fields used by legacy single-Lesson readers.
  update public.rooms
  set
    teaching_section = session_lessons.teaching_section,
    released_through = session_lessons.released_through
  from public.session_lessons
  where rooms.id = p_room_id
    and session_lessons.session_id = rooms.id
    and session_lessons.lesson_id = rooms.lesson_id;

  return v_released_lesson_count;
end;
$$;

revoke all on function public.release_entire_chapter(uuid)
from public, anon, authenticated;
grant execute on function public.release_entire_chapter(uuid)
to authenticated;
