create or replace function public.get_teacher_course_section_export(
  p_subject_id uuid,
  p_course_section_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_course_section public.course_sections%rowtype;
  v_total_sessions integer;
  v_students jsonb;
begin
  if not private.is_permanent_user() then
    raise exception 'Teacher account required.' using errcode = '42501';
  end if;

  select course_sections.*
  into v_course_section
  from public.course_sections
  join public.subjects on subjects.id = course_sections.subject_id
  where course_sections.id = p_course_section_id
    and course_sections.subject_id = p_subject_id
    and subjects.teacher_id = auth.uid();

  if not found then
    return null;
  end if;

  select count(distinct rooms.id)::integer
  into v_total_sessions
  from public.rooms
  left join public.lessons on lessons.id = rooms.lesson_id
  where coalesce(rooms.course_section_id, lessons.course_section_id) = v_course_section.id
    and rooms.status in ('ACTIVE', 'ENDED');

  with course_sessions as (
    select distinct rooms.id
    from public.rooms
    left join public.lessons on lessons.id = rooms.lesson_id
    where coalesce(rooms.course_section_id, lessons.course_section_id) = v_course_section.id
      and rooms.status in ('ACTIVE', 'ENDED')
  ),
  attendance_totals as (
    select
      session_attendance.mssv,
      count(distinct session_attendance.session_id)::integer as attended_session_count
    from public.session_attendance
    join course_sessions on course_sessions.id = session_attendance.session_id
    where session_attendance.joined_at is not null
    group by session_attendance.mssv
  ),
  speaking_totals as (
    select
      participants.mssv,
      sum(session_reflections.speaking_count)::bigint as speaking_count
    from public.session_reflections
    join public.participants on participants.id = session_reflections.participant_id
    join course_sessions on course_sessions.id = participants.room_id
    group by participants.mssv
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'mssv', course_section_students.normalized_mssv,
        'speakingCount', coalesce(speaking_totals.speaking_count, 0),
        'attendedSessionCount', coalesce(attendance_totals.attended_session_count, 0)
      )
      order by course_section_students.normalized_mssv
    ),
    '[]'::jsonb
  )
  into v_students
  from public.course_section_students
  left join attendance_totals
    on attendance_totals.mssv = course_section_students.normalized_mssv
  left join speaking_totals
    on speaking_totals.mssv = course_section_students.normalized_mssv
  where course_section_students.course_section_id = v_course_section.id;

  return jsonb_build_object(
    'subjectId', p_subject_id,
    'courseSectionId', v_course_section.id,
    'courseSectionCode', v_course_section.section_code,
    'courseSectionName', v_course_section.display_name,
    'totalSessions', v_total_sessions,
    'students', v_students
  );
end;
$$;

revoke all on function public.get_teacher_course_section_export(uuid, uuid)
from public, anon, authenticated;
grant execute on function public.get_teacher_course_section_export(uuid, uuid)
to authenticated;
