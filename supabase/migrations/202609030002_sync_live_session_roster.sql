create or replace function public.replace_course_section_roster(
  p_course_section_id uuid,
  p_mssv text[]
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer := coalesce(array_length(p_mssv, 1), 0);
begin
  if coalesce((auth.jwt()->>'is_anonymous')::boolean, true)
    or lower(coalesce(auth.jwt()->>'email', '')) <> 'thaybao@minclass.local'
  then
    raise exception 'Teacher account required.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.course_sections
    join public.subjects on subjects.id = course_sections.subject_id
    where course_sections.id = p_course_section_id
      and subjects.teacher_id = auth.uid()
  ) then
    raise exception 'Course Section is not available.' using errcode = '42501';
  end if;

  if v_count < 1 or v_count > 2000 then
    raise exception 'Roster must contain between 1 and 2000 MSSV values.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(p_mssv) as roster(mssv)
    where roster.mssv is null
      or roster.mssv <> upper(btrim(roster.mssv))
      or roster.mssv !~ '^[A-Z0-9][A-Z0-9._-]{2,31}$'
  ) then
    raise exception 'Roster contains an invalid MSSV.' using errcode = '22023';
  end if;

  if (select count(distinct roster.mssv) from unnest(p_mssv) as roster(mssv)) <> v_count then
    raise exception 'Roster contains duplicate MSSV values.' using errcode = '23505';
  end if;

  -- Serialize with Session Start, which uses the same Course Section lock.
  perform pg_advisory_xact_lock(hashtextextended(p_course_section_id::text, 0));

  -- Serialize with Student Join/End for every currently active Session.
  perform rooms.id
  from public.rooms
  join public.lessons on lessons.id = rooms.lesson_id
  where lessons.course_section_id = p_course_section_id
    and rooms.status = 'ACTIVE'
  order by rooms.id
  for update of rooms;

  delete from public.course_section_students
  where course_section_id = p_course_section_id;

  insert into public.course_section_students (course_section_id, mssv)
  select p_course_section_id, roster.mssv
  from unnest(p_mssv) with ordinality as roster(mssv, position)
  order by roster.position;

  -- A removed, not-yet-joined Student no longer belongs to a LIVE snapshot.
  -- Joined Students remain historical participants and keep their activity.
  delete from public.session_attendance
  using public.rooms, public.lessons
  where session_attendance.session_id = rooms.id
    and rooms.lesson_id = lessons.id
    and rooms.status = 'ACTIVE'
    and lessons.course_section_id = p_course_section_id
    and session_attendance.joined_at is null
    and not (session_attendance.mssv = any(p_mssv));

  -- New roster Students can join every currently LIVE Lesson immediately.
  insert into public.session_attendance (session_id, mssv)
  select rooms.id, roster.mssv
  from public.rooms
  join public.lessons on lessons.id = rooms.lesson_id
  cross join unnest(p_mssv) as roster(mssv)
  where rooms.status = 'ACTIVE'
    and lessons.course_section_id = p_course_section_id
  on conflict (session_id, mssv) do nothing;

  return v_count;
end;
$$;

revoke all on function public.replace_course_section_roster(uuid, text[]) from public, anon, authenticated;
grant execute on function public.replace_course_section_roster(uuid, text[]) to authenticated;
