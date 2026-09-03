create or replace function public.get_student_session_lesson_snapshot(
  p_room_id uuid,
  p_lesson_id uuid
)
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
  if auth.uid() is null or not (
    exists (
      select 1
      from public.participants
      where participants.room_id = p_room_id
        and participants.user_id = auth.uid()
    )
    or exists (
      select 1
      from public.lesson_session_access_grants
      join public.rooms on rooms.id = lesson_session_access_grants.room_id
      where lesson_session_access_grants.room_id = p_room_id
        and lesson_session_access_grants.user_id = auth.uid()
        and rooms.status = 'ENDED'
    )
  ) then
    raise exception 'Lesson Session is not available to this Student.' using errcode = '42501';
  end if;

  return query
  select
    rooms.id,
    lessons.title,
    rooms.status,
    session_lessons.released_through,
    sections.id,
    sections.position,
    sections.type,
    sections.title,
    sections.content_md
  from public.rooms
  join public.session_lessons
    on session_lessons.session_id = rooms.id
   and session_lessons.lesson_id = p_lesson_id
  join public.lessons on lessons.id = session_lessons.lesson_id
  left join public.sections
    on sections.lesson_id = lessons.id
   and sections.position <= session_lessons.released_through
  where rooms.id = p_room_id
  order by sections.position;
end;
$$;

revoke all on function public.get_student_session_lesson_snapshot(uuid, uuid)
from public, anon, authenticated;
grant execute on function public.get_student_session_lesson_snapshot(uuid, uuid)
to authenticated;
