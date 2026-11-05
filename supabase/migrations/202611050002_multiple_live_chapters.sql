-- Each Chapter is an independent Session, even within the same Course Section.
drop index public.rooms_one_active_chapter_session_per_course_idx;
create unique index rooms_one_active_session_per_chapter_idx
on public.rooms (course_section_id, chapter_id)
where course_section_id is not null and chapter_id is not null and status = 'ACTIVE';

-- Preserve duplicate protection for historical Lessons without a Chapter.
create unique index rooms_one_active_legacy_lesson_session_idx
on public.rooms (lesson_id)
where chapter_id is null and lesson_id is not null and status = 'ACTIVE';

create or replace function public.start_chapter_session(p_course_section_id uuid, p_chapter_id uuid)
returns table (session_id uuid, session_status public.room_status, started_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  v_room_id uuid;
  v_started_at timestamptz;
  v_first_lesson_id uuid;
  v_chapter_name text;
begin
  if not private.is_permanent_user() then
    raise exception 'Teacher account required.' using errcode = '42501';
  end if;
  select chapters.name into v_chapter_name
  from public.chapters
  join public.course_sections on course_sections.id = chapters.course_section_id
  join public.subjects on subjects.id = course_sections.subject_id
  where chapters.id = p_chapter_id and chapters.course_section_id = p_course_section_id
    and subjects.teacher_id = auth.uid();
  if v_chapter_name is null then
    raise exception 'Chapter is not available.' using errcode = '42501';
  end if;

  -- Keep the same lock as roster replacement. Starting different Chapters is
  -- serialized briefly; their resulting Sessions are free to run concurrently.
  perform pg_advisory_xact_lock(hashtextextended(p_course_section_id::text, 0));
  if exists (select 1 from public.rooms
    where rooms.course_section_id = p_course_section_id
      and rooms.chapter_id = p_chapter_id and rooms.status = 'ACTIVE') then
    raise exception 'Chapter already has a LIVE Session.' using errcode = '23505';
  end if;
  select lessons.id into v_first_lesson_id from public.lessons
  where lessons.course_section_id = p_course_section_id and lessons.chapter_id = p_chapter_id
    and exists (select 1 from public.sections where sections.lesson_id = lessons.id)
  order by lessons.created_at, lessons.id limit 1;
  if v_first_lesson_id is null then
    raise exception 'Chapter must have at least one valid Lesson.' using errcode = 'P0001';
  end if;
  insert into public.rooms (teacher_user_id, title, status, teaching_section, released_through,
    started_at, lesson_id, course_section_id, chapter_id)
  values (auth.uid(), v_chapter_name, 'ACTIVE', 0, 0, now(),
    v_first_lesson_id, p_course_section_id, p_chapter_id)
  returning id, rooms.started_at into v_room_id, v_started_at;
  insert into public.session_lessons (session_id, lesson_id, teaching_section, released_through)
  select v_room_id, lessons.id, first_sections.position, first_sections.position
  from public.lessons cross join lateral (
    select min(sections.position)::integer as position
    from public.sections where sections.lesson_id = lessons.id
  ) as first_sections
  where lessons.course_section_id = p_course_section_id and lessons.chapter_id = p_chapter_id
    and first_sections.position is not null;
  insert into public.session_attendance (session_id, mssv)
  select v_room_id, normalized_mssv from public.course_section_students
  where course_section_id = p_course_section_id;
  return query select v_room_id, 'ACTIVE'::public.room_status, v_started_at;
end;
$$;

-- Legacy entry point delegates to the same Chapter-scoped duplicate guard.
create or replace function public.start_lesson_session(p_lesson_id uuid)
returns table (session_id uuid, session_status public.room_status, started_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  v_course_section_id uuid;
  v_chapter_id uuid;
  v_room_id uuid;
  v_first_position integer;
  v_started_at timestamptz;
begin
  if not private.is_permanent_user() then
    raise exception 'Teacher account required.' using errcode = '42501';
  end if;
  select lessons.course_section_id, lessons.chapter_id into v_course_section_id, v_chapter_id
  from public.lessons
  join public.course_sections on course_sections.id = lessons.course_section_id
  join public.subjects on subjects.id = course_sections.subject_id
  where lessons.id = p_lesson_id and subjects.teacher_id = auth.uid();
  if v_course_section_id is null then
    raise exception 'Lesson is not available.' using errcode = '42501';
  end if;
  if v_chapter_id is not null then
    return query select * from public.start_chapter_session(v_course_section_id, v_chapter_id);
    return;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_course_section_id::text, 0));
  if exists (select 1 from public.rooms where lesson_id = p_lesson_id and status = 'ACTIVE') then
    raise exception 'Lesson already has a LIVE Session.' using errcode = '23505';
  end if;
  select min(position) into v_first_position from public.sections where lesson_id = p_lesson_id;
  if v_first_position is null then
    raise exception 'Lesson must have at least one Section.' using errcode = 'P0001';
  end if;
  insert into public.rooms (teacher_user_id, title, status, teaching_section, released_through,
    started_at, lesson_id, course_section_id)
  select auth.uid(), lessons.title, 'ACTIVE', v_first_position, v_first_position,
    now(), lessons.id, v_course_section_id from public.lessons where lessons.id = p_lesson_id
  returning id, rooms.started_at into v_room_id, v_started_at;
  insert into public.session_lessons (session_id, lesson_id, teaching_section, released_through)
  values (v_room_id, p_lesson_id, v_first_position, v_first_position);
  insert into public.session_attendance (session_id, mssv)
  select v_room_id, normalized_mssv from public.course_section_students
  where course_section_id = v_course_section_id;
  return query select v_room_id, 'ACTIVE'::public.room_status, v_started_at;
end;
$$;

revoke all on function public.start_chapter_session(uuid, uuid) from public, anon, authenticated;
revoke all on function public.start_lesson_session(uuid) from public, anon, authenticated;
grant execute on function public.start_chapter_session(uuid, uuid) to authenticated;
grant execute on function public.start_lesson_session(uuid) to authenticated;
