alter table public.course_sections
drop constraint course_sections_subject_id_fkey,
add constraint course_sections_subject_id_fkey
  foreign key (subject_id) references public.subjects(id) on delete restrict;

alter table public.lessons
drop constraint lessons_course_section_id_fkey,
add constraint lessons_course_section_id_fkey
  foreign key (course_section_id) references public.course_sections(id) on delete restrict;

alter table public.rooms
drop constraint rooms_lesson_id_fkey,
add constraint rooms_lesson_id_fkey
  foreign key (lesson_id) references public.lessons(id) on delete restrict;

create or replace function public.set_section_reaction(
  p_section_id uuid,
  p_reaction public.reaction_type
)
returns table (
  section_id uuid,
  reaction public.reaction_type,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_participant_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '28000';
  end if;

  select participants.id
  into target_participant_id
  from public.participants
  join public.rooms on rooms.id = participants.room_id
  join public.sections on sections.lesson_id = private.lesson_id_for_room(rooms.id)
  where sections.id = p_section_id
    and participants.user_id = auth.uid()
    and rooms.status = 'ACTIVE'
    and sections.position <= rooms.released_through
  for share of rooms;

  if target_participant_id is null then
    raise exception 'Section is not available for interaction.' using errcode = '42501';
  end if;

  insert into public.section_reactions (section_id, participant_id, reaction)
  values (p_section_id, target_participant_id, p_reaction)
  on conflict on constraint section_reactions_section_id_participant_id_key
  do update set reaction = excluded.reaction
  returning section_reactions.section_id, section_reactions.reaction, section_reactions.updated_at
  into section_id, reaction, updated_at;
  return next;
end;
$$;

create or replace function public.create_section_comment(
  p_section_id uuid,
  p_body text,
  p_is_anonymous boolean
)
returns table (
  comment_id uuid,
  section_id uuid,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_participant_id uuid;
  normalized_body text := btrim(p_body);
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '28000';
  end if;

  if p_body is null or char_length(normalized_body) not between 1 and 500 or p_is_anonymous is null then
    raise exception 'Comment must contain between 1 and 500 characters.' using errcode = '22023';
  end if;

  select participants.id
  into target_participant_id
  from public.participants
  join public.rooms on rooms.id = participants.room_id
  join public.sections on sections.lesson_id = private.lesson_id_for_room(rooms.id)
  where sections.id = p_section_id
    and participants.user_id = auth.uid()
    and rooms.status = 'ACTIVE'
    and sections.position <= rooms.released_through
  for share of rooms;

  if target_participant_id is null then
    raise exception 'Section is not available for interaction.' using errcode = '42501';
  end if;

  insert into public.section_comments (section_id, participant_id, body, is_anonymous)
  values (p_section_id, target_participant_id, normalized_body, p_is_anonymous)
  returning section_comments.id, section_comments.section_id, section_comments.created_at
  into comment_id, section_id, created_at;
  return next;
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
    and participants.user_id = auth.uid()
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
