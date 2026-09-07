-- Verify one Student at Course Section entry without exposing roster rows.
create function public.verify_course_section_student(
  p_course_section_id uuid,
  p_mssv text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mssv text := upper(btrim(coalesce(p_mssv, '')));
begin
  if auth.uid() is null
    or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) is not true
    or v_mssv !~ '^[A-Z0-9][A-Z0-9._-]{2,31}$' then
    raise exception 'Course Section access is not available.' using errcode = '42501';
  end if;

  perform 1
  from public.course_sections
  where course_sections.id = p_course_section_id;

  if not found then
    raise exception 'Course Section access is not available.' using errcode = '42501';
  end if;

  perform 1
  from public.course_section_students
  where course_section_students.course_section_id = p_course_section_id
    and course_section_students.normalized_mssv = v_mssv;

  if not found then
    raise exception 'Student is not in the Course Section.' using errcode = 'P0003';
  end if;

  return true;
end;
$$;

revoke all on function public.verify_course_section_student(uuid, text)
from public, anon, authenticated;
grant execute on function public.verify_course_section_student(uuid, text)
to authenticated;
