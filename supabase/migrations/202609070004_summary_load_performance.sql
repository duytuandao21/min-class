-- Split the ended Session summary into a lightweight overview, streamed
-- attendance details, and Lesson analytics loaded only when requested.

create function public.get_teacher_room_summary_overview(p_room_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  target_room public.rooms%rowtype;
  roster_count integer;
  joined_count integer;
  total_comments integer;
  anonymous_comments integer;
  named_comments integer;
  most_engaged_section jsonb;
  lesson_context jsonb;
begin
  select * into target_room
  from public.rooms
  where id = p_room_id and teacher_user_id = auth.uid() and status = 'ENDED';
  if not found then
    raise exception 'Room summary is not available.' using errcode = '42501';
  end if;

  select count(*)::integer,
    count(*) filter (where joined_at is not null)::integer
  into roster_count, joined_count
  from public.session_attendance
  where session_id = p_room_id;

  select count(*)::integer,
    count(*) filter (where section_comments.is_anonymous)::integer,
    count(*) filter (where not section_comments.is_anonymous)::integer
  into total_comments, anonymous_comments, named_comments
  from public.section_comments
  join public.sections on sections.id = section_comments.section_id
  join public.session_lessons
    on session_lessons.lesson_id = sections.lesson_id
   and session_lessons.session_id = p_room_id
  join public.participants
    on participants.id = section_comments.participant_id
   and participants.room_id = p_room_id;

  with released_sections as (
    select sections.id, sections.position, sections.title
    from public.session_lessons
    join public.sections
      on sections.lesson_id = session_lessons.lesson_id
     and sections.position <= session_lessons.released_through
    where session_lessons.session_id = p_room_id
  ), feedback as (
    select section_reactions.section_id, count(*)::integer feedback_count
    from public.section_reactions
    join public.participants
      on participants.id = section_reactions.participant_id
     and participants.room_id = p_room_id
    join released_sections on released_sections.id = section_reactions.section_id
    group by section_reactions.section_id
    union all
    select section_comments.section_id, count(*)::integer feedback_count
    from public.section_comments
    join public.participants
      on participants.id = section_comments.participant_id
     and participants.room_id = p_room_id
    join released_sections on released_sections.id = section_comments.section_id
    group by section_comments.section_id
  ), totals as (
    select released_sections.id, released_sections.position, released_sections.title,
      coalesce(sum(feedback.feedback_count), 0)::integer total_feedback
    from released_sections
    left join feedback on feedback.section_id = released_sections.id
    group by released_sections.id, released_sections.position, released_sections.title
  )
  select jsonb_build_object(
    'sectionId', totals.id,
    'sectionPosition', totals.position,
    'sectionTitle', totals.title,
    'totalFeedback', totals.total_feedback
  ) into most_engaged_section
  from totals
  where totals.total_feedback > 0
  order by totals.total_feedback desc, totals.title
  limit 1;

  select jsonb_build_object(
    'lessonId', first_lesson.lesson_id,
    'courseSectionId', course_sections.id,
    'subjectId', course_sections.subject_id
  ) into lesson_context
  from public.course_sections
  cross join lateral (
    select session_lessons.lesson_id
    from public.session_lessons
    where session_lessons.session_id = p_room_id
    order by session_lessons.created_at, session_lessons.lesson_id
    limit 1
  ) first_lesson
  where course_sections.id = target_room.course_section_id;

  return jsonb_build_object(
    'room', jsonb_build_object(
      'id', target_room.id,
      'title', target_room.title,
      'startedAt', target_room.started_at,
      'endedAt', target_room.ended_at
    ),
    'attendance', jsonb_build_object(
      'rosterCount', roster_count,
      'joinedCount', joined_count,
      'absentCount', greatest(roster_count - joined_count, 0)
    ),
    'comments', jsonb_build_object(
      'total', total_comments,
      'anonymous', anonymous_comments,
      'named', named_comments
    ),
    'mostEngagedSection', most_engaged_section,
    'lessonContext', lesson_context
  );
end;
$$;

create function public.get_teacher_room_attendance_detail(p_room_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  participant_data jsonb;
  absent_data jsonb;
begin
  if not private.is_room_teacher(p_room_id)
    or not exists (select 1 from public.rooms where id = p_room_id and status = 'ENDED') then
    raise exception 'Room summary is not available.' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'mssv', participants.mssv,
    'joinedAt', participants.joined_at
  ) order by participants.joined_at, participants.mssv), '[]'::jsonb)
  into participant_data
  from public.participants
  where participants.room_id = p_room_id;

  select coalesce(jsonb_agg(session_attendance.mssv order by session_attendance.mssv), '[]'::jsonb)
  into absent_data
  from public.session_attendance
  where session_attendance.session_id = p_room_id
    and session_attendance.joined_at is null;

  return jsonb_build_object('participants', participant_data, 'absentMssvs', absent_data);
end;
$$;

create function public.get_teacher_room_summary_lessons(p_room_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare lesson_data jsonb;
begin
  if not private.is_room_teacher(p_room_id)
    or not exists (select 1 from public.rooms where id = p_room_id and status = 'ENDED') then
    raise exception 'Room summary is not available.' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'lessonId', lesson_stats.lesson_id,
    'lessonTitle', lesson_stats.lesson_title,
    'sectionCount', lesson_stats.section_count,
    'quizCount', lesson_stats.quiz_count
  ) order by lesson_stats.created_at, lesson_stats.lesson_id), '[]'::jsonb)
  into lesson_data
  from (
    select lessons.id lesson_id, lessons.title lesson_title, lessons.created_at,
      count(distinct sections.id)::integer section_count,
      count(distinct quizzes.id)::integer quiz_count
    from public.session_lessons
    join public.lessons on lessons.id = session_lessons.lesson_id
    left join public.sections
      on sections.lesson_id = lessons.id
     and sections.position <= session_lessons.released_through
    left join public.quizzes on quizzes.section_id = sections.id
    where session_lessons.session_id = p_room_id
    group by lessons.id, lessons.title, lessons.created_at
  ) lesson_stats;
  return lesson_data;
end;
$$;

create function public.get_teacher_room_lesson_summary(p_room_id uuid, p_lesson_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  lesson_title text;
  reaction_data jsonb;
  quiz_data jsonb;
begin
  if not private.is_room_teacher(p_room_id)
    or not private.lesson_is_in_session(p_room_id, p_lesson_id)
    or not exists (select 1 from public.rooms where id = p_room_id and status = 'ENDED') then
    raise exception 'Lesson summary is not available.' using errcode = '42501';
  end if;

  select lessons.title into lesson_title from public.lessons where lessons.id = p_lesson_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'sectionId', reaction_stats.section_id,
    'sectionPosition', reaction_stats.section_position,
    'sectionTitle', reaction_stats.section_title,
    'understand', reaction_stats.understand,
    'unsure', reaction_stats.unsure,
    'question', reaction_stats.question
  ) order by reaction_stats.section_position), '[]'::jsonb)
  into reaction_data
  from (
    select sections.id section_id, sections.position section_position, sections.title section_title,
      count(section_reactions.id) filter (where participants.id is not null and section_reactions.reaction = 'UNDERSTAND')::integer understand,
      count(section_reactions.id) filter (where participants.id is not null and section_reactions.reaction = 'UNSURE')::integer unsure,
      count(section_reactions.id) filter (where participants.id is not null and section_reactions.reaction = 'QUESTION')::integer question
    from public.session_lessons
    join public.sections
      on sections.lesson_id = session_lessons.lesson_id
     and sections.position <= session_lessons.released_through
    left join public.section_reactions on section_reactions.section_id = sections.id
    left join public.participants
      on participants.id = section_reactions.participant_id
     and participants.room_id = p_room_id
    where session_lessons.session_id = p_room_id
      and session_lessons.lesson_id = p_lesson_id
    group by sections.id, sections.position, sections.title
  ) reaction_stats;

  quiz_data := private.build_teacher_quiz_analytics(p_room_id, p_lesson_id)->'quizzes';
  return jsonb_build_object(
    'lessonId', p_lesson_id,
    'lessonTitle', lesson_title,
    'reactions', reaction_data,
    'quizzes', coalesce(quiz_data, '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_teacher_room_summary_overview(uuid) from public, anon, authenticated;
revoke all on function public.get_teacher_room_attendance_detail(uuid) from public, anon, authenticated;
revoke all on function public.get_teacher_room_summary_lessons(uuid) from public, anon, authenticated;
revoke all on function public.get_teacher_room_lesson_summary(uuid, uuid) from public, anon, authenticated;
grant execute on function public.get_teacher_room_summary_overview(uuid) to authenticated;
grant execute on function public.get_teacher_room_attendance_detail(uuid) to authenticated;
grant execute on function public.get_teacher_room_summary_lessons(uuid) to authenticated;
grant execute on function public.get_teacher_room_lesson_summary(uuid, uuid) to authenticated;
