-- Keep the public Lesson access gate lightweight while exposing its Chapter name.
-- Only catalog metadata is returned; lesson content and roster remain private.
drop function public.get_public_lesson_gate_context(uuid);

create function public.get_public_lesson_gate_context(p_lesson_id uuid)
returns table (
  lesson_id uuid,
  lesson_title text,
  lesson_status text,
  subject_id uuid,
  subject_name text,
  course_section_id uuid,
  section_code text,
  section_display_name text,
  chapter_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    lessons.id,
    lessons.title,
    private.public_lesson_status(lessons.id),
    subjects.id,
    subjects.name,
    course_sections.id,
    course_sections.section_code,
    course_sections.display_name,
    chapters.name
  from public.lessons
  join public.course_sections on course_sections.id = lessons.course_section_id
  join public.subjects on subjects.id = course_sections.subject_id
  left join public.chapters on chapters.id = lessons.chapter_id
  where lessons.id = p_lesson_id;
$$;

revoke all on function public.get_public_lesson_gate_context(uuid) from public, anon, authenticated;
grant execute on function public.get_public_lesson_gate_context(uuid) to anon, authenticated;
