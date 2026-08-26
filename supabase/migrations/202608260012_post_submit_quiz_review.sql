create or replace function public.get_session_student_quiz_snapshot(
  p_room_id uuid,
  p_section_id uuid
)
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
  from public.rooms
  join public.participants
    on participants.room_id = rooms.id and participants.user_id = auth.uid()
  join public.sections on sections.lesson_id = private.lesson_id_for_room(rooms.id)
  join public.quizzes on quizzes.section_id = sections.id
  where rooms.id = p_room_id
    and sections.id = p_section_id
    and sections.position <= rooms.released_through;

  if target_quiz_id is null then
    raise exception 'Quiz is not available.' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', quiz_questions.id,
      'position', quiz_questions.position,
      'type', quiz_questions.type,
      'questionText', quiz_questions.question_text,
      'options', (
        select coalesce(jsonb_agg(
          jsonb_build_object(
            'id', quiz_options.id,
            'position', quiz_options.position,
            'content', quiz_options.content
          ) order by quiz_options.position
        ), '[]'::jsonb)
        from public.quiz_options
        where quiz_options.question_id = quiz_questions.id
      )
    ) order by quiz_questions.position
  ), '[]'::jsonb)
  into question_data
  from public.quiz_questions
  where quiz_questions.quiz_id = target_quiz_id;

  select jsonb_build_object(
    'attemptId', quiz_attempts.id,
    'score', quiz_attempts.score,
    'totalQuestions', quiz_attempts.total_questions,
    'submittedAt', quiz_attempts.submitted_at,
    'answers', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'questionId', quiz_answers.question_id,
          'selectedOptionIds', quiz_answers.selected_option_ids,
          'correctOptionIds', quiz_answer_keys.correct_option_ids,
          'isCorrect', quiz_answers.is_correct
        ) order by quiz_questions.position
      ), '[]'::jsonb)
      from public.quiz_answers
      join public.quiz_questions on quiz_questions.id = quiz_answers.question_id
      join public.quiz_answer_keys on quiz_answer_keys.question_id = quiz_answers.question_id
      where quiz_answers.attempt_id = quiz_attempts.id
    )
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

revoke all on function public.get_session_student_quiz_snapshot(uuid, uuid) from public, anon, authenticated;
grant execute on function public.get_session_student_quiz_snapshot(uuid, uuid) to authenticated;
