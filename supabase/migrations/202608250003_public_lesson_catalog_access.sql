alter table public.rooms
add column lesson_id uuid references public.lessons(id) on delete set null;

create index rooms_lesson_status_idx
on public.rooms (lesson_id, status, ended_at desc)
where lesson_id is not null;

create function private.public_lesson_status(p_lesson_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (
      select 1
      from public.rooms
      where rooms.lesson_id = p_lesson_id
        and rooms.status = 'ACTIVE'
    ) then 'LIVE'
    when exists (
      select 1
      from public.rooms
      where rooms.lesson_id = p_lesson_id
        and rooms.status = 'ENDED'
    ) then 'ENDED'
    else 'UPCOMING'
  end;
$$;

revoke all on function private.public_lesson_status(uuid) from public, anon, authenticated;

create function public.get_public_subjects()
returns table (
  subject_id uuid,
  subject_name text,
  subject_code text
)
language sql
stable
security definer
set search_path = ''
as $$
  select subjects.id, subjects.name, subjects.code
  from public.subjects
  order by subjects.name, subjects.created_at;
$$;

create function public.get_public_course_sections(p_subject_id uuid)
returns table (
  course_section_id uuid,
  section_code text,
  display_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select course_sections.id, course_sections.section_code, course_sections.display_name
  from public.course_sections
  where course_sections.subject_id = p_subject_id
  order by course_sections.section_code, course_sections.created_at;
$$;

create function public.get_public_course_section_lessons(p_course_section_id uuid)
returns table (
  lesson_id uuid,
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
    lessons.title,
    private.public_lesson_status(lessons.id)
  from public.lessons
  where lessons.course_section_id = p_course_section_id
  order by lessons.created_at desc;
$$;

create function public.get_public_lesson_gate_context(p_lesson_id uuid)
returns table (
  lesson_id uuid,
  lesson_title text,
  lesson_status text,
  subject_id uuid,
  subject_name text,
  course_section_id uuid,
  section_code text,
  section_display_name text
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
    course_sections.display_name
  from public.lessons
  join public.course_sections on course_sections.id = lessons.course_section_id
  join public.subjects on subjects.id = course_sections.subject_id
  where lessons.id = p_lesson_id;
$$;

create function public.access_public_lesson(
  p_lesson_id uuid,
  p_mssv text,
  p_session_code text default null
)
returns table (
  lesson_id uuid,
  lesson_status text,
  session_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_course_section_id uuid;
  v_normalized_mssv text := upper(btrim(coalesce(p_mssv, '')));
  v_lesson_status text;
  v_session_id uuid;
begin
  if auth.uid() is null
    or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) is not true
    or v_normalized_mssv !~ '^[A-Z0-9][A-Z0-9._-]{2,31}$'
  then
    raise exception using errcode = '42501', message = 'Lesson access denied.';
  end if;

  select lessons.course_section_id
  into v_course_section_id
  from public.lessons
  where lessons.id = p_lesson_id
    and lessons.course_section_id is not null;

  if v_course_section_id is null
    or not exists (
      select 1
      from public.course_section_students
      where course_section_students.course_section_id = v_course_section_id
        and course_section_students.normalized_mssv = v_normalized_mssv
    )
  then
    raise exception using errcode = '42501', message = 'Lesson access denied.';
  end if;

  v_lesson_status := private.public_lesson_status(p_lesson_id);

  if v_lesson_status = 'LIVE' then
    if p_session_code is null then
      raise exception using errcode = '42501', message = 'Lesson access denied.';
    end if;

    select rooms.id
    into v_session_id
    from public.rooms
    where rooms.lesson_id = p_lesson_id
      and rooms.status = 'ACTIVE'
      and rooms.code = upper(btrim(p_session_code))
    order by rooms.started_at desc
    limit 1;
  elsif v_lesson_status = 'ENDED' then
    select rooms.id
    into v_session_id
    from public.rooms
    where rooms.lesson_id = p_lesson_id
      and rooms.status = 'ENDED'
    order by rooms.ended_at desc
    limit 1;
  else
    raise exception using errcode = '42501', message = 'Lesson access denied.';
  end if;

  if v_session_id is null then
    raise exception using errcode = '42501', message = 'Lesson access denied.';
  end if;

  return query select p_lesson_id, v_lesson_status, v_session_id;
end;
$$;

revoke all on function public.get_public_subjects() from public, anon, authenticated;
revoke all on function public.get_public_course_sections(uuid) from public, anon, authenticated;
revoke all on function public.get_public_course_section_lessons(uuid) from public, anon, authenticated;
revoke all on function public.get_public_lesson_gate_context(uuid) from public, anon, authenticated;
revoke all on function public.access_public_lesson(uuid, text, text) from public, anon, authenticated;

grant execute on function public.get_public_subjects() to anon, authenticated;
grant execute on function public.get_public_course_sections(uuid) to anon, authenticated;
grant execute on function public.get_public_course_section_lessons(uuid) to anon, authenticated;
grant execute on function public.get_public_lesson_gate_context(uuid) to anon, authenticated;
grant execute on function public.access_public_lesson(uuid, text, text) to authenticated;
