create or replace function public.access_ended_lesson_session(
  p_lesson_id uuid,
  p_mssv text
)
returns table (
  session_id uuid,
  lesson_id uuid,
  lesson_status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_mssv text := upper(btrim(coalesce(p_mssv, '')));
  target_room_id uuid;
  existing_grant public.lesson_session_access_grants%rowtype;
begin
  if auth.uid() is null
    or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) is not true
    or normalized_mssv !~ '^[A-Z0-9][A-Z0-9._-]{2,31}$'
  then
    raise exception 'Lesson access denied.' using errcode = '42501';
  end if;

  select rooms.id
  into target_room_id
  from public.rooms
  join public.session_attendance
    on session_attendance.session_id = rooms.id
  where rooms.lesson_id = p_lesson_id
    and rooms.status = 'ENDED'
    and session_attendance.mssv = normalized_mssv
    and not exists (
      select 1
      from public.rooms as live_rooms
      where live_rooms.lesson_id = p_lesson_id
        and live_rooms.status = 'ACTIVE'
    )
  order by rooms.ended_at desc
  limit 1;

  if target_room_id is null then
    raise exception 'Lesson access denied.' using errcode = '42501';
  end if;

  select lesson_session_access_grants.*
  into existing_grant
  from public.lesson_session_access_grants
  where lesson_session_access_grants.room_id = target_room_id
    and lesson_session_access_grants.user_id = auth.uid();

  if found then
    if existing_grant.mssv is distinct from normalized_mssv then
      raise exception 'Lesson access denied.' using errcode = '42501';
    end if;
  else
    insert into public.lesson_session_access_grants (room_id, user_id, mssv)
    values (target_room_id, auth.uid(), normalized_mssv);
  end if;

  return query select target_room_id, p_lesson_id, 'ENDED'::text;
exception
  when unique_violation then
    raise exception 'Lesson access denied.' using errcode = '42501';
end;
$$;

create or replace function public.get_student_ended_lesson_review(p_room_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_room public.rooms%rowtype;
  review_mssv text;
  target_participant_id uuid;
  section_data jsonb;
begin
  if auth.uid() is null
    or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) is not true
  then
    raise exception 'Lesson review is not available.' using errcode = '42501';
  end if;

  select rooms.*
  into target_room
  from public.rooms
  join public.lesson_session_access_grants
    on lesson_session_access_grants.room_id = rooms.id
   and lesson_session_access_grants.user_id = auth.uid()
  where rooms.id = p_room_id
    and rooms.status = 'ENDED'
    and rooms.lesson_id is not null;

  if not found then
    raise exception 'Lesson review is not available.' using errcode = '42501';
  end if;

  select lesson_session_access_grants.mssv
  into review_mssv
  from public.lesson_session_access_grants
  where lesson_session_access_grants.room_id = target_room.id
    and lesson_session_access_grants.user_id = auth.uid();

  if exists (
    select 1
    from public.rooms as live_rooms
    where live_rooms.lesson_id = target_room.lesson_id
      and live_rooms.status = 'ACTIVE'
  ) then
    raise exception 'Lesson review is not available.' using errcode = '42501';
  end if;

  select participants.id
  into target_participant_id
  from public.participants
  where participants.room_id = target_room.id
    and participants.mssv = review_mssv;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', sections.id,
        'position', sections.position,
        'type', sections.type,
        'title', sections.title,
        'contentMd', sections.content_md,
        'quiz', case when quizzes.id is null then null else jsonb_build_object(
          'quizId', quizzes.id,
          'title', quizzes.title,
          'attempt', (
            select jsonb_build_object(
              'score', quiz_attempts.score,
              'totalQuestions', quiz_attempts.total_questions,
              'submittedAt', quiz_attempts.submitted_at
            )
            from public.quiz_attempts
            where quiz_attempts.quiz_id = quizzes.id
              and quiz_attempts.participant_id = target_participant_id
          ),
          'questions', (
            select coalesce(
              jsonb_agg(
                jsonb_build_object(
                  'id', quiz_questions.id,
                  'position', quiz_questions.position,
                  'type', quiz_questions.type,
                  'questionText', quiz_questions.question_text,
                  'isCorrect', (
                    select quiz_answers.is_correct
                    from public.quiz_attempts
                    join public.quiz_answers on quiz_answers.attempt_id = quiz_attempts.id
                    where quiz_attempts.quiz_id = quizzes.id
                      and quiz_attempts.participant_id = target_participant_id
                      and quiz_answers.question_id = quiz_questions.id
                  ),
                  'options', (
                    select coalesce(
                      jsonb_agg(
                        jsonb_build_object(
                          'id', quiz_options.id,
                          'position', quiz_options.position,
                          'content', quiz_options.content,
                          'isCorrect', quiz_options.id = any(quiz_answer_keys.correct_option_ids),
                          'isSelected', exists (
                            select 1
                            from public.quiz_attempts
                            join public.quiz_answers on quiz_answers.attempt_id = quiz_attempts.id
                            where quiz_attempts.quiz_id = quizzes.id
                              and quiz_attempts.participant_id = target_participant_id
                              and quiz_answers.question_id = quiz_questions.id
                              and quiz_options.id = any(quiz_answers.selected_option_ids)
                          )
                        )
                        order by quiz_options.position
                      ),
                      '[]'::jsonb
                    )
                    from public.quiz_options
                    join public.quiz_answer_keys
                      on quiz_answer_keys.question_id = quiz_options.question_id
                    where quiz_options.question_id = quiz_questions.id
                  )
                )
                order by quiz_questions.position
              ),
              '[]'::jsonb
            )
            from public.quiz_questions
            where quiz_questions.quiz_id = quizzes.id
          )
        ) end
      )
      order by sections.position
    ),
    '[]'::jsonb
  )
  into section_data
  from public.sections
  left join public.quizzes on quizzes.section_id = sections.id
  where sections.lesson_id = target_room.lesson_id;

  return jsonb_build_object(
    'sessionId', target_room.id,
    'lessonId', target_room.lesson_id,
    'title', target_room.title,
    'endedAt', target_room.ended_at,
    'mssv', review_mssv,
    'sections', section_data
  );
end;
$$;

revoke all on function public.access_ended_lesson_session(uuid, text) from public, anon, authenticated;
revoke all on function public.get_student_ended_lesson_review(uuid) from public, anon, authenticated;
grant execute on function public.access_ended_lesson_session(uuid, text) to authenticated;
grant execute on function public.get_student_ended_lesson_review(uuid) to authenticated;
