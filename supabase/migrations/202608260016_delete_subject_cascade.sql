create function public.delete_subject(p_subject_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_subject public.subjects%rowtype;
begin
  if auth.uid() is null or not private.is_permanent_user() then
    raise exception 'Teacher account required.' using errcode = '42501';
  end if;

  select subjects.*
  into target_subject
  from public.subjects
  where subjects.id = p_subject_id
    and subjects.teacher_id = auth.uid()
  for update;

  if not found then
    raise exception 'Subject is not available.' using errcode = '42501';
  end if;

  perform course_sections.id
  from public.course_sections
  where course_sections.subject_id = target_subject.id
  order by course_sections.id
  for update;

  perform lessons.id
  from public.lessons
  join public.course_sections on course_sections.id = lessons.course_section_id
  where course_sections.subject_id = target_subject.id
  order by lessons.id
  for update of lessons;

  delete from public.rooms
  where rooms.lesson_id in (
    select lessons.id
    from public.lessons
    join public.course_sections on course_sections.id = lessons.course_section_id
    where course_sections.subject_id = target_subject.id
  );

  delete from public.lessons
  where lessons.course_section_id in (
    select course_sections.id
    from public.course_sections
    where course_sections.subject_id = target_subject.id
  );

  delete from public.course_sections
  where course_sections.subject_id = target_subject.id;

  delete from public.subjects
  where subjects.id = target_subject.id;

  return target_subject.id;
end;
$$;

revoke all on function public.delete_subject(uuid) from public, anon, authenticated;
grant execute on function public.delete_subject(uuid) to authenticated;
