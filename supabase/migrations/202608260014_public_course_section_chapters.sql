drop function public.get_public_course_section_lessons(uuid);

create function public.get_public_course_section_lessons(p_course_section_id uuid)
returns table (
  lesson_id uuid,
  chapter_id uuid,
  lesson_title text,
  lesson_status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    lessons.id,
    lessons.chapter_id,
    lessons.title,
    private.public_lesson_status(lessons.id)
  from public.lessons
  join public.chapters on chapters.id = lessons.chapter_id
  join public.course_sections on course_sections.id = lessons.course_section_id
  where lessons.course_section_id = p_course_section_id
    and chapters.subject_id = course_sections.subject_id
  order by lessons.created_at desc;
$$;

create function public.get_public_course_section_chapters(p_course_section_id uuid)
returns table (
  chapter_id uuid,
  chapter_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select chapters.id, chapters.name
  from public.chapters
  join public.course_sections on course_sections.subject_id = chapters.subject_id
  where course_sections.id = p_course_section_id
  order by lower(chapters.name), chapters.name;
$$;

revoke all on function public.get_public_course_section_lessons(uuid) from public, anon, authenticated;
revoke all on function public.get_public_course_section_chapters(uuid) from public, anon, authenticated;

grant execute on function public.get_public_course_section_lessons(uuid) to anon, authenticated;
grant execute on function public.get_public_course_section_chapters(uuid) to anon, authenticated;
