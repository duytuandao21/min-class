-- Return only the public catalog branch requested by the current route.
-- These functions intentionally expose metadata only: no roster, lesson body,
-- attendance, participant identity, or quiz answer key leaves the database.

create function public.get_public_subject_course_sections(p_subject_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'subject', jsonb_build_object(
      'subject_id', subjects.id,
      'subject_name', subjects.name,
      'subject_code', subjects.code
    ),
    'courseSections', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'course_section_id', course_sections.id,
        'section_code', course_sections.section_code,
        'display_name', course_sections.display_name
      ) order by course_sections.section_code, course_sections.created_at), '[]'::jsonb)
      from public.course_sections
      where course_sections.subject_id = subjects.id
    )
  )
  from public.subjects
  where subjects.id = p_subject_id;
$$;

create function public.get_public_course_section_catalog(
  p_subject_id uuid,
  p_course_section_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'courseSection', jsonb_build_object(
      'course_section_id', course_sections.id,
      'section_code', course_sections.section_code,
      'display_name', course_sections.display_name
    ),
    'chapters', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'chapter_id', chapters.id,
        'chapter_name', chapters.name,
        'preview_enabled', chapters.preview_enabled and not private.chapter_has_session(chapters.id)
      ) order by lower(chapters.name), chapters.name), '[]'::jsonb)
      from public.chapters
      where chapters.course_section_id = course_sections.id
    ),
    'lessons', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'lesson_id', lesson_status.lesson_id,
        'chapter_id', lesson_status.chapter_id,
        'lesson_title', lesson_status.lesson_title,
        'lesson_status', lesson_status.lesson_status
      ) order by lesson_status.created_at, lesson_status.lesson_id), '[]'::jsonb)
      from (
        select lessons.id lesson_id, lessons.chapter_id, lessons.title lesson_title,
          lessons.created_at,
          case
            when coalesce(bool_or(rooms.status = 'ACTIVE'), false) then 'LIVE'
            when coalesce(bool_or(rooms.status = 'ENDED'), false) then 'ENDED'
            else 'UPCOMING'
          end lesson_status
        from public.lessons
        left join public.session_lessons on session_lessons.lesson_id = lessons.id
        left join public.rooms on rooms.id = session_lessons.session_id
          and rooms.status in ('ACTIVE', 'ENDED')
        where lessons.course_section_id = course_sections.id
        group by lessons.id, lessons.chapter_id, lessons.title, lessons.created_at
      ) lesson_status
    )
  )
  from public.course_sections
  where course_sections.id = p_course_section_id
    and course_sections.subject_id = p_subject_id;
$$;

create function public.get_public_chapter_catalog(
  p_subject_id uuid,
  p_course_section_id uuid,
  p_chapter_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'courseSection', jsonb_build_object(
      'course_section_id', course_sections.id,
      'section_code', course_sections.section_code,
      'display_name', course_sections.display_name
    ),
    'chapter', jsonb_build_object(
      'chapter_id', chapters.id,
      'chapter_name', chapters.name,
      'preview_enabled', chapters.preview_enabled and not private.chapter_has_session(chapters.id)
    ),
    'lessons', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'lesson_id', lesson_status.lesson_id,
        'chapter_id', chapters.id,
        'lesson_title', lesson_status.lesson_title,
        'lesson_status', lesson_status.lesson_status
      ) order by lesson_status.created_at, lesson_status.lesson_id), '[]'::jsonb)
      from (
        select lessons.id lesson_id, lessons.title lesson_title, lessons.created_at,
          case
            when coalesce(bool_or(rooms.status = 'ACTIVE'), false) then 'LIVE'
            when coalesce(bool_or(rooms.status = 'ENDED'), false) then 'ENDED'
            else 'UPCOMING'
          end lesson_status
        from public.lessons
        left join public.session_lessons on session_lessons.lesson_id = lessons.id
        left join public.rooms on rooms.id = session_lessons.session_id
          and rooms.status in ('ACTIVE', 'ENDED')
        where lessons.course_section_id = course_sections.id
          and lessons.chapter_id = chapters.id
        group by lessons.id, lessons.title, lessons.created_at
      ) lesson_status
    )
  )
  from public.course_sections
  join public.chapters on chapters.course_section_id = course_sections.id
  where course_sections.id = p_course_section_id
    and course_sections.subject_id = p_subject_id
    and chapters.id = p_chapter_id;
$$;

revoke all on function public.get_public_subject_course_sections(uuid) from public, anon, authenticated;
revoke all on function public.get_public_course_section_catalog(uuid, uuid) from public, anon, authenticated;
revoke all on function public.get_public_chapter_catalog(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.get_public_subject_course_sections(uuid) to anon, authenticated;
grant execute on function public.get_public_course_section_catalog(uuid, uuid) to anon, authenticated;
grant execute on function public.get_public_chapter_catalog(uuid, uuid, uuid) to anon, authenticated;

-- Build quiz analytics in set-based passes. The public response contract is
-- unchanged, while correlated per-option and per-question counts are removed.
create function private.build_teacher_quiz_analytics(
  p_room_id uuid,
  p_lesson_id uuid default null
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with room_participant_count as (
    select count(*)::integer participant_count
    from public.participants
    where participants.room_id = p_room_id
  ), room_quizzes as (
    select quizzes.id quiz_id, sections.id section_id,
      sections.position section_position, quizzes.title,
      lessons.id lesson_id, lessons.created_at lesson_created_at
    from public.session_lessons
    join public.lessons on lessons.id = session_lessons.lesson_id
    join public.sections on sections.lesson_id = lessons.id
      and sections.position <= session_lessons.released_through
    join public.quizzes on quizzes.section_id = sections.id
    where session_lessons.session_id = p_room_id
      and (p_lesson_id is null or lessons.id = p_lesson_id)
  ), attempt_stats as (
    select room_quizzes.quiz_id,
      count(quiz_attempts.id) filter (where participants.id is not null)::integer submitted_count,
      room_participant_count.participant_count,
      round(case when room_participant_count.participant_count = 0 then 0
        else 100.0 * count(quiz_attempts.id) filter (where participants.id is not null)
          / room_participant_count.participant_count end, 2) completion_rate,
      round(coalesce(avg(quiz_attempts.score) filter (where participants.id is not null), 0), 2) average_score
    from room_quizzes
    cross join room_participant_count
    left join public.quiz_attempts on quiz_attempts.quiz_id = room_quizzes.quiz_id
    left join public.participants on participants.id = quiz_attempts.participant_id
      and participants.room_id = p_room_id
    group by room_quizzes.quiz_id, room_participant_count.participant_count
  ), question_stats as (
    select room_quizzes.quiz_id, quiz_questions.id question_id,
      quiz_questions.position, quiz_questions.type, quiz_questions.question_text,
      round(coalesce(
        100.0 * count(quiz_answers.id) filter (
          where participants.id is not null and quiz_answers.is_correct
        ) / nullif(count(quiz_answers.id) filter (where participants.id is not null), 0),
        0
      ), 2) correct_percentage
    from room_quizzes
    join public.quiz_questions on quiz_questions.quiz_id = room_quizzes.quiz_id
    left join public.quiz_answers on quiz_answers.question_id = quiz_questions.id
    left join public.quiz_attempts on quiz_attempts.id = quiz_answers.attempt_id
    left join public.participants on participants.id = quiz_attempts.participant_id
      and participants.room_id = p_room_id
    group by room_quizzes.quiz_id, quiz_questions.id, quiz_questions.position,
      quiz_questions.type, quiz_questions.question_text
  ), option_stats as (
    select quiz_questions.quiz_id, quiz_options.question_id,
      quiz_options.id option_id, quiz_options.position, quiz_options.content,
      count(quiz_answers.id) filter (where participants.id is not null)::integer selection_count
    from room_quizzes
    join public.quiz_questions on quiz_questions.quiz_id = room_quizzes.quiz_id
    join public.quiz_options on quiz_options.question_id = quiz_questions.id
    left join public.quiz_answers on quiz_answers.question_id = quiz_questions.id
      and quiz_options.id = any(quiz_answers.selected_option_ids)
    left join public.quiz_attempts on quiz_attempts.id = quiz_answers.attempt_id
    left join public.participants on participants.id = quiz_attempts.participant_id
      and participants.room_id = p_room_id
    group by quiz_questions.quiz_id, quiz_options.question_id, quiz_options.id,
      quiz_options.position, quiz_options.content
  ), option_json as (
    select option_stats.quiz_id, option_stats.question_id,
      jsonb_agg(jsonb_build_object(
        'optionId', option_stats.option_id,
        'position', option_stats.position,
        'content', option_stats.content,
        'selectionCount', option_stats.selection_count
      ) order by option_stats.position) options
    from option_stats
    group by option_stats.quiz_id, option_stats.question_id
  ), question_json as (
    select question_stats.quiz_id,
      count(*)::integer total_questions,
      jsonb_agg(jsonb_build_object(
        'questionId', question_stats.question_id,
        'position', question_stats.position,
        'type', question_stats.type,
        'questionText', question_stats.question_text,
        'correctPercentage', question_stats.correct_percentage,
        'options', coalesce(option_json.options, '[]'::jsonb)
      ) order by question_stats.position) questions
    from question_stats
    left join option_json on option_json.quiz_id = question_stats.quiz_id
      and option_json.question_id = question_stats.question_id
    group by question_stats.quiz_id
  ), quiz_json as (
    select room_quizzes.lesson_created_at, room_quizzes.section_position,
      jsonb_build_object(
        'quizId', room_quizzes.quiz_id,
        'sectionId', room_quizzes.section_id,
        'sectionPosition', room_quizzes.section_position,
        'title', room_quizzes.title,
        'submittedCount', attempt_stats.submitted_count,
        'participantCount', attempt_stats.participant_count,
        'completionRate', attempt_stats.completion_rate,
        'averageScore', attempt_stats.average_score,
        'totalQuestions', question_json.total_questions,
        'questions', question_json.questions
      ) quiz
    from room_quizzes
    join attempt_stats on attempt_stats.quiz_id = room_quizzes.quiz_id
    join question_json on question_json.quiz_id = room_quizzes.quiz_id
  )
  select jsonb_build_object(
    'quizzes', coalesce(jsonb_agg(quiz_json.quiz order by
      quiz_json.lesson_created_at, quiz_json.section_position), '[]'::jsonb)
  )
  from quiz_json;
$$;

revoke all on function private.build_teacher_quiz_analytics(uuid, uuid) from public, anon, authenticated;

create or replace function public.get_teacher_quiz_analytics(p_room_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_room_teacher(p_room_id) then
    raise exception 'Quiz analytics are not available.' using errcode = '42501';
  end if;
  return private.build_teacher_quiz_analytics(p_room_id, null);
end;
$$;

create function public.get_teacher_lesson_quiz_analytics(p_room_id uuid, p_lesson_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_room_teacher(p_room_id) or not private.lesson_is_in_session(p_room_id, p_lesson_id) then
    raise exception 'Quiz analytics are not available.' using errcode = '42501';
  end if;
  return private.build_teacher_quiz_analytics(p_room_id, p_lesson_id);
end;
$$;

revoke all on function public.get_teacher_quiz_analytics(uuid) from public, anon, authenticated;
revoke all on function public.get_teacher_lesson_quiz_analytics(uuid, uuid) from public, anon, authenticated;
grant execute on function public.get_teacher_quiz_analytics(uuid) to authenticated;
grant execute on function public.get_teacher_lesson_quiz_analytics(uuid, uuid) to authenticated;

-- Query shapes observed in Course Section history and quiz aggregation.
create index rooms_course_section_chapter_started_idx
on public.rooms (course_section_id, chapter_id, started_at desc)
where course_section_id is not null and status in ('ACTIVE', 'ENDED');

create index quiz_answers_question_attempt_cover_idx
on public.quiz_answers (question_id, attempt_id)
include (is_correct, selected_option_ids);
