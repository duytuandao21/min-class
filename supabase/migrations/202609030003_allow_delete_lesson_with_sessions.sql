create or replace function public.delete_owned_lesson(p_lesson_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_subject_id uuid;
  v_course_section_id uuid;
begin
  if not private.is_permanent_user() then
    raise exception 'Teacher account required.' using errcode = '42501';
  end if;

  select coalesce(lessons.subject_id, course_sections.subject_id), lessons.course_section_id
  into v_subject_id, v_course_section_id
  from public.lessons
  left join public.course_sections on course_sections.id = lessons.course_section_id
  join public.subjects on subjects.id = coalesce(lessons.subject_id, course_sections.subject_id)
  where lessons.id = p_lesson_id
    and subjects.teacher_id = auth.uid();

  if not found then
    raise exception 'Lesson is not available.' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_subject_id::text, 0));
  perform lessons.id from public.lessons where lessons.id = p_lesson_id for update;
  if not found then
    raise exception 'Lesson is not available.' using errcode = '42501';
  end if;

  -- rooms.lesson_id is RESTRICT. Removing Sessions first also cascades their
  -- participants, attendance, reactions, comments, attempts and reflections.
  if v_course_section_id is not null then
    delete from public.rooms where rooms.lesson_id = p_lesson_id;
  end if;

  delete from public.lessons where lessons.id = p_lesson_id;
  return p_lesson_id;
end;
$$;

revoke all on function public.delete_owned_lesson(uuid) from public, anon, authenticated;
grant execute on function public.delete_owned_lesson(uuid) to authenticated;
