create or replace function public.delete_course_section_chapter(
  p_subject_id uuid,
  p_course_section_id uuid,
  p_chapter_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_permanent_user() or not exists (
    select 1
    from public.chapters
    join public.course_sections on course_sections.id = chapters.course_section_id
    join public.subjects on subjects.id = course_sections.subject_id
    where chapters.id = p_chapter_id
      and course_sections.id = p_course_section_id
      and subjects.id = p_subject_id
      and subjects.teacher_id = auth.uid()
  ) then
    raise exception 'Course Section Chapter is not available.' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_course_section_id::text, 0));
  perform chapters.id
  from public.chapters
  where chapters.id = p_chapter_id
    and chapters.course_section_id = p_course_section_id
  for update;

  -- A Session is the aggregate root for attendance, participants, feedback,
  -- quiz attempts and reflections. Deleting it lets existing foreign-key
  -- cascades remove all Session-scoped data before Lesson content is removed.
  delete from public.rooms
  where rooms.course_section_id = p_course_section_id
    and (
      rooms.chapter_id = p_chapter_id
      or rooms.lesson_id in (
        select lessons.id from public.lessons where lessons.chapter_id = p_chapter_id
      )
      or exists (
        select 1
        from public.session_lessons
        join public.lessons on lessons.id = session_lessons.lesson_id
        where session_lessons.session_id = rooms.id
          and lessons.chapter_id = p_chapter_id
      )
    );

  delete from public.lessons
  where lessons.course_section_id = p_course_section_id
    and lessons.chapter_id = p_chapter_id;

  delete from public.chapters
  where chapters.id = p_chapter_id
    and chapters.course_section_id = p_course_section_id;
  if not found then
    raise exception 'Course Section Chapter is not available.' using errcode = '42501';
  end if;

  return p_chapter_id;
end;
$$;

revoke all on function public.delete_course_section_chapter(uuid, uuid, uuid)
from public, anon, authenticated;
grant execute on function public.delete_course_section_chapter(uuid, uuid, uuid)
to authenticated;
