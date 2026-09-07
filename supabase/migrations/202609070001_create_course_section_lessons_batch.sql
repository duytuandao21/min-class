create function public.create_course_section_lessons_batch(
  p_course_section_id uuid,
  p_chapter_id uuid,
  p_lessons jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_created record;
  v_result jsonb := '[]'::jsonb;
begin
  if not private.is_permanent_user() or not exists (
    select 1
    from public.chapters chapter
    join public.course_sections course_section on course_section.id = chapter.course_section_id
    join public.subjects subject on subject.id = course_section.subject_id
    where chapter.id = p_chapter_id
      and course_section.id = p_course_section_id
      and subject.teacher_id = auth.uid()
  ) then raise exception 'Chapter is not available.' using errcode = '42501'; end if;

  if p_lessons is null or jsonb_typeof(p_lessons) is distinct from 'array'
  then raise exception 'Lesson batch must be an array.' using errcode = '22023'; end if;
  if jsonb_array_length(p_lessons) not between 1 and 20
  then raise exception 'Lesson batch must contain between 1 and 20 items.' using errcode = '22023'; end if;

  if exists (
    select 1
    from jsonb_array_elements(p_lessons) item
    where jsonb_typeof(item) is distinct from 'object'
      or jsonb_typeof(item->'lessonTitle') is distinct from 'string'
      or jsonb_typeof(item->'markdownSource') is distinct from 'string'
      or jsonb_typeof(item->'lesson') is distinct from 'object'
  ) then raise exception 'Lesson batch contains an invalid item.' using errcode = '22023'; end if;

  if exists (
    select 1
    from jsonb_array_elements(p_lessons) item
    group by lower(item->>'lessonTitle')
    having count(*) > 1
  ) then raise exception 'Lesson titles must be unique within a batch.' using errcode = '23505'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_course_section_id::text, 0));
  for v_item in select value from jsonb_array_elements(p_lessons)
  loop
    select * into v_created
    from public.create_course_section_lesson(
      p_course_section_id,
      p_chapter_id,
      v_item->>'lessonTitle',
      v_item->>'markdownSource',
      v_item->'lesson'
    );
    v_result := v_result || jsonb_build_array(jsonb_build_object(
      'lessonId', v_created.lesson_id,
      'lessonTitle', v_created.lesson_title,
      'lessonCreatedAt', v_created.lesson_created_at
    ));
  end loop;
  return v_result;
end;
$$;

revoke all on function public.create_course_section_lessons_batch(uuid, uuid, jsonb)
from public, anon, authenticated;
grant execute on function public.create_course_section_lessons_batch(uuid, uuid, jsonb)
to authenticated;
