alter table public.room_feedback_events
drop constraint room_feedback_events_kind;

alter table public.room_feedback_events
add constraint room_feedback_events_kind
check (kind in ('REACTION', 'COMMENT', 'QUIZ'));

create function private.emit_quiz_feedback_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_section_id uuid;
begin
  select quizzes.section_id
  into target_section_id
  from public.quizzes
  where quizzes.id = new.quiz_id;

  if target_section_id is null then
    raise exception 'Quiz section does not exist.' using errcode = '23503';
  end if;

  insert into public.room_feedback_events (room_id, section_id, kind)
  values (
    private.room_id_for_section(target_section_id),
    target_section_id,
    'QUIZ'
  );

  return new;
end;
$$;

create trigger quiz_attempts_emit_feedback
after insert on public.quiz_attempts
for each row execute function private.emit_quiz_feedback_event();

create function public.get_student_quiz_snapshot(p_section_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_quiz_id uuid;
  target_quiz_title text;
  target_participant_id uuid;
  question_data jsonb;
  attempt_data jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '28000';
  end if;

  select quizzes.id, quizzes.title, participants.id
  into target_quiz_id, target_quiz_title, target_participant_id
  from public.sections
  join public.lessons on lessons.id = sections.lesson_id
  join public.rooms on rooms.id = lessons.room_id
  join public.quizzes on quizzes.section_id = sections.id
  join public.participants
    on participants.room_id = rooms.id
   and participants.user_id = auth.uid()
  where sections.id = p_section_id
    and sections.position <= rooms.released_through;

  if target_quiz_id is null then
    raise exception 'Quiz is not available.' using errcode = '42501';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', quiz_questions.id,
        'position', quiz_questions.position,
        'type', quiz_questions.type,
        'questionText', quiz_questions.question_text,
        'options', (
          select coalesce(
            jsonb_agg(
              jsonb_build_object(
                'id', quiz_options.id,
                'position', quiz_options.position,
                'content', quiz_options.content
              )
              order by quiz_options.position
            ),
            '[]'::jsonb
          )
          from public.quiz_options
          where quiz_options.question_id = quiz_questions.id
        )
      )
      order by quiz_questions.position
    ),
    '[]'::jsonb
  )
  into question_data
  from public.quiz_questions
  where quiz_questions.quiz_id = target_quiz_id;

  select jsonb_build_object(
    'attemptId', quiz_attempts.id,
    'score', quiz_attempts.score,
    'totalQuestions', quiz_attempts.total_questions,
    'submittedAt', quiz_attempts.submitted_at
  )
  into attempt_data
  from public.quiz_attempts
  where quiz_attempts.quiz_id = target_quiz_id
    and quiz_attempts.participant_id = target_participant_id;

  return jsonb_build_object(
    'quizId', target_quiz_id,
    'sectionId', p_section_id,
    'title', target_quiz_title,
    'questions', question_data,
    'attempt', attempt_data
  );
end;
$$;

create function public.get_teacher_quiz_analytics(p_room_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  quiz_data jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '28000';
  end if;

  if not private.is_room_teacher(p_room_id) then
    raise exception 'Quiz analytics are not available.' using errcode = '42501';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'quizId', quiz_stats.quiz_id,
        'sectionId', quiz_stats.section_id,
        'sectionPosition', quiz_stats.section_position,
        'title', quiz_stats.title,
        'submittedCount', quiz_stats.submitted_count,
        'participantCount', quiz_stats.participant_count,
        'completionRate', quiz_stats.completion_rate,
        'averageScore', quiz_stats.average_score,
        'totalQuestions', quiz_stats.total_questions,
        'questions', (
          select coalesce(
            jsonb_agg(
              jsonb_build_object(
                'questionId', question_stats.question_id,
                'position', question_stats.position,
                'type', question_stats.type,
                'questionText', question_stats.question_text,
                'correctPercentage', question_stats.correct_percentage,
                'options', question_stats.options
              )
              order by question_stats.position
            ),
            '[]'::jsonb
          )
          from (
            select
              quiz_questions.id as question_id,
              quiz_questions.position,
              quiz_questions.type,
              quiz_questions.question_text,
              round(
                coalesce(
                  100.0 * count(quiz_answers.id) filter (where quiz_answers.is_correct)
                  / nullif(count(quiz_answers.id), 0),
                  0
                ),
                2
              ) as correct_percentage,
              (
                select coalesce(
                  jsonb_agg(
                    jsonb_build_object(
                      'optionId', option_stats.option_id,
                      'position', option_stats.position,
                      'content', option_stats.content,
                      'selectionCount', option_stats.selection_count
                    )
                    order by option_stats.position
                  ),
                  '[]'::jsonb
                )
                from (
                  select
                    quiz_options.id as option_id,
                    quiz_options.position,
                    quiz_options.content,
                    (
                      select count(*)
                      from public.quiz_answers as selected_answers
                      where selected_answers.question_id = quiz_questions.id
                        and quiz_options.id = any(selected_answers.selected_option_ids)
                    ) as selection_count
                  from public.quiz_options
                  where quiz_options.question_id = quiz_questions.id
                ) as option_stats
              ) as options
            from public.quiz_questions
            left join public.quiz_answers on quiz_answers.question_id = quiz_questions.id
            where quiz_questions.quiz_id = quiz_stats.quiz_id
            group by quiz_questions.id, quiz_questions.position, quiz_questions.type, quiz_questions.question_text
          ) as question_stats
        )
      )
      order by quiz_stats.section_position
    ),
    '[]'::jsonb
  )
  into quiz_data
  from (
    select
      quizzes.id as quiz_id,
      sections.id as section_id,
      sections.position as section_position,
      quizzes.title,
      count(quiz_attempts.id)::integer as submitted_count,
      (select count(*)::integer from public.participants where participants.room_id = rooms.id) as participant_count,
      round(
        case
          when (select count(*) from public.participants where participants.room_id = rooms.id) = 0 then 0
          else 100.0 * count(quiz_attempts.id)
            / (select count(*) from public.participants where participants.room_id = rooms.id)
        end,
        2
      ) as completion_rate,
      round(coalesce(avg(quiz_attempts.score), 0), 2) as average_score,
      (select count(*)::integer from public.quiz_questions where quiz_questions.quiz_id = quizzes.id) as total_questions
    from public.rooms
    join public.lessons on lessons.room_id = rooms.id
    join public.sections on sections.lesson_id = lessons.id
    join public.quizzes on quizzes.section_id = sections.id
    left join public.quiz_attempts on quiz_attempts.quiz_id = quizzes.id
    where rooms.id = p_room_id
      and sections.position <= rooms.released_through
    group by quizzes.id, sections.id, sections.position, quizzes.title, rooms.id
  ) as quiz_stats;

  return jsonb_build_object('quizzes', quiz_data);
end;
$$;

revoke all on function private.emit_quiz_feedback_event() from public, anon, authenticated;
revoke all on function public.get_student_quiz_snapshot(uuid) from public, anon;
revoke all on function public.get_teacher_quiz_analytics(uuid) from public, anon;

grant execute on function public.get_student_quiz_snapshot(uuid) to authenticated;
grant execute on function public.get_teacher_quiz_analytics(uuid) to authenticated;
