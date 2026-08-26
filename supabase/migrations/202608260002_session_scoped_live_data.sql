create or replace function private.emit_room_feedback_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_kind text;
  target_room_id uuid;
begin
  target_kind := case tg_table_name
    when 'section_reactions' then 'REACTION'
    when 'section_comments' then 'COMMENT'
    else null
  end;

  select participants.room_id
  into target_room_id
  from public.participants
  where participants.id = new.participant_id;

  if target_kind is null or target_room_id is null then
    raise exception 'Unsupported feedback source.' using errcode = 'P0001';
  end if;

  insert into public.room_feedback_events (room_id, section_id, kind)
  values (target_room_id, new.section_id, target_kind);
  return new;
end;
$$;

create or replace function private.emit_quiz_feedback_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_section_id uuid;
  target_room_id uuid;
begin
  select quizzes.section_id
  into target_section_id
  from public.quizzes
  where quizzes.id = new.quiz_id;

  select participants.room_id
  into target_room_id
  from public.participants
  where participants.id = new.participant_id;

  if target_section_id is null or target_room_id is null then
    raise exception 'Quiz Session does not exist.' using errcode = '23503';
  end if;

  insert into public.room_feedback_events (room_id, section_id, kind)
  values (target_room_id, target_section_id, 'QUIZ');
  return new;
end;
$$;

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
    and sections.position <= rooms.released_through;

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
    and sections.position <= rooms.released_through;

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

create function public.get_session_student_quiz_snapshot(
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

create function public.submit_session_quiz(
  p_room_id uuid,
  p_quiz_id uuid,
  p_answers jsonb
)
returns table (
  attempt_id uuid,
  score integer,
  total_questions integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_participant_id uuid;
  question_count integer;
  correct_count integer;
  created_attempt_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '28000';
  end if;

  if jsonb_typeof(p_answers) <> 'array' or jsonb_array_length(p_answers) = 0 then
    raise exception 'Answers must be a non-empty array.' using errcode = '22023';
  end if;

  select participants.id
  into target_participant_id
  from public.rooms
  join public.participants
    on participants.room_id = rooms.id and participants.user_id = auth.uid()
  join public.sections on sections.lesson_id = private.lesson_id_for_room(rooms.id)
  join public.quizzes on quizzes.section_id = sections.id
  where rooms.id = p_room_id
    and rooms.status = 'ACTIVE'
    and quizzes.id = p_quiz_id
    and sections.position <= rooms.released_through
  for share of rooms;

  if target_participant_id is null then
    raise exception 'Quiz is not available.' using errcode = '42501';
  end if;

  select count(*) into question_count
  from public.quiz_questions
  where quiz_questions.quiz_id = p_quiz_id;

  if question_count = 0 or jsonb_array_length(p_answers) <> question_count then
    raise exception 'Every Quiz question must be answered exactly once.' using errcode = '22023';
  end if;

  if exists (
    with submitted as (
      select
        (answer->>'question_id')::uuid as question_id,
        array(select jsonb_array_elements_text(answer->'selected_option_ids')::uuid) as selected_option_ids
      from jsonb_array_elements(p_answers) as answer
    )
    select 1
    from submitted
    left join public.quiz_questions
      on quiz_questions.id = submitted.question_id and quiz_questions.quiz_id = p_quiz_id
    where quiz_questions.id is null
      or cardinality(submitted.selected_option_ids) = 0
      or cardinality(submitted.selected_option_ids) <> (
        select count(distinct selected_option_id)
        from unnest(submitted.selected_option_ids) as selected_option_id
      )
      or (quiz_questions.type in ('SINGLE_CHOICE', 'TRUE_FALSE') and cardinality(submitted.selected_option_ids) <> 1)
      or exists (
        select 1
        from unnest(submitted.selected_option_ids) as selected_option_id
        where not exists (
          select 1 from public.quiz_options
          where quiz_options.id = selected_option_id
            and quiz_options.question_id = submitted.question_id
        )
      )
  ) or (
    select count(distinct (answer->>'question_id')::uuid)
    from jsonb_array_elements(p_answers) as answer
  ) <> question_count then
    raise exception 'Quiz answers are invalid.' using errcode = '22023';
  end if;

  with submitted as (
    select
      (answer->>'question_id')::uuid as question_id,
      array(select jsonb_array_elements_text(answer->'selected_option_ids')::uuid) as selected_option_ids
    from jsonb_array_elements(p_answers) as answer
  )
  select count(*) filter (
    where cardinality(submitted.selected_option_ids) = cardinality(quiz_answer_keys.correct_option_ids)
      and submitted.selected_option_ids @> quiz_answer_keys.correct_option_ids
      and submitted.selected_option_ids <@ quiz_answer_keys.correct_option_ids
  )
  into correct_count
  from submitted
  join public.quiz_answer_keys using (question_id);

  if (
    select count(*)
    from public.quiz_answer_keys
    join public.quiz_questions on quiz_questions.id = quiz_answer_keys.question_id
    where quiz_questions.quiz_id = p_quiz_id
  ) <> question_count then
    raise exception 'Quiz answer keys are incomplete.' using errcode = 'P0001';
  end if;

  insert into public.quiz_attempts (quiz_id, participant_id, score, total_questions)
  values (p_quiz_id, target_participant_id, correct_count, question_count)
  returning id into created_attempt_id;

  with submitted as (
    select
      (answer->>'question_id')::uuid as question_id,
      array(select jsonb_array_elements_text(answer->'selected_option_ids')::uuid) as selected_option_ids
    from jsonb_array_elements(p_answers) as answer
  )
  insert into public.quiz_answers (attempt_id, question_id, selected_option_ids, is_correct)
  select
    created_attempt_id,
    submitted.question_id,
    submitted.selected_option_ids,
    cardinality(submitted.selected_option_ids) = cardinality(quiz_answer_keys.correct_option_ids)
      and submitted.selected_option_ids @> quiz_answer_keys.correct_option_ids
      and submitted.selected_option_ids <@ quiz_answer_keys.correct_option_ids
  from submitted
  join public.quiz_answer_keys using (question_id);

  return query select created_attempt_id, correct_count, question_count;
exception
  when unique_violation then
    raise exception 'Quiz has already been submitted.' using errcode = '23505';
end;
$$;

create or replace function public.get_teacher_feedback_snapshot(p_room_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  reaction_data jsonb;
  comment_data jsonb;
begin
  if not private.is_room_teacher(p_room_id) then
    raise exception 'Room feedback is not available.' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'sectionId', counts.section_id,
    'sectionPosition', counts.section_position,
    'sectionTitle', counts.section_title,
    'understand', counts.understand,
    'unsure', counts.unsure,
    'question', counts.question
  ) order by counts.section_position), '[]'::jsonb)
  into reaction_data
  from (
    select
      sections.id as section_id,
      sections.position as section_position,
      sections.title as section_title,
      count(section_reactions.id) filter (where participants.id is not null and section_reactions.reaction = 'UNDERSTAND') as understand,
      count(section_reactions.id) filter (where participants.id is not null and section_reactions.reaction = 'UNSURE') as unsure,
      count(section_reactions.id) filter (where participants.id is not null and section_reactions.reaction = 'QUESTION') as question
    from public.rooms
    join public.sections on sections.lesson_id = private.lesson_id_for_room(rooms.id)
    left join public.section_reactions on section_reactions.section_id = sections.id
    left join public.participants on participants.id = section_reactions.participant_id
      and participants.room_id = rooms.id
    where rooms.id = p_room_id and sections.position <= rooms.released_through
    group by sections.id, sections.position, sections.title
  ) as counts;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', comments.id,
    'sectionId', comments.section_id,
    'sectionPosition', comments.section_position,
    'sectionTitle', comments.section_title,
    'body', comments.body,
    'authorLabel', comments.author_label,
    'isAnonymous', comments.is_anonymous,
    'createdAt', comments.created_at
  ) order by comments.created_at desc), '[]'::jsonb)
  into comment_data
  from (
    select
      section_comments.id,
      sections.id as section_id,
      sections.position as section_position,
      sections.title as section_title,
      section_comments.body,
      case when section_comments.is_anonymous then 'Anonymous' else participants.mssv end as author_label,
      section_comments.is_anonymous,
      section_comments.created_at
    from public.rooms
    join public.sections on sections.lesson_id = private.lesson_id_for_room(rooms.id)
    join public.section_comments on section_comments.section_id = sections.id
    join public.participants on participants.id = section_comments.participant_id
      and participants.room_id = rooms.id
    where rooms.id = p_room_id
    order by section_comments.created_at desc
    limit 30
  ) as comments;

  return jsonb_build_object('reactions', reaction_data, 'comments', comment_data);
end;
$$;

revoke all on function public.get_session_student_quiz_snapshot(uuid, uuid) from public, anon, authenticated;
revoke all on function public.submit_session_quiz(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.get_session_student_quiz_snapshot(uuid, uuid) to authenticated;
grant execute on function public.submit_session_quiz(uuid, uuid, jsonb) to authenticated;

create or replace function public.get_teacher_quiz_analytics(p_room_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  quiz_data jsonb;
begin
  if not private.is_room_teacher(p_room_id) then
    raise exception 'Quiz analytics are not available.' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
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
      select coalesce(jsonb_agg(jsonb_build_object(
        'questionId', question_stats.question_id,
        'position', question_stats.position,
        'type', question_stats.type,
        'questionText', question_stats.question_text,
        'correctPercentage', question_stats.correct_percentage,
        'options', question_stats.options
      ) order by question_stats.position), '[]'::jsonb)
      from (
        select
          quiz_questions.id as question_id,
          quiz_questions.position,
          quiz_questions.type,
          quiz_questions.question_text,
          round(coalesce(
            100.0 * count(quiz_answers.id) filter (where quiz_answers.is_correct)
              / nullif(count(quiz_answers.id), 0), 0
          ), 2) as correct_percentage,
          (
            select coalesce(jsonb_agg(jsonb_build_object(
              'optionId', option_stats.option_id,
              'position', option_stats.position,
              'content', option_stats.content,
              'selectionCount', option_stats.selection_count
            ) order by option_stats.position), '[]'::jsonb)
            from (
              select
                quiz_options.id as option_id,
                quiz_options.position,
                quiz_options.content,
                (
                  select count(*)
                  from public.quiz_answers as selected_answers
                  join public.quiz_attempts as selected_attempts
                    on selected_attempts.id = selected_answers.attempt_id
                  join public.participants as selected_participants
                    on selected_participants.id = selected_attempts.participant_id
                  where selected_answers.question_id = quiz_questions.id
                    and selected_participants.room_id = p_room_id
                    and quiz_options.id = any(selected_answers.selected_option_ids)
                ) as selection_count
              from public.quiz_options
              where quiz_options.question_id = quiz_questions.id
            ) as option_stats
          ) as options
        from public.quiz_questions
        left join public.quiz_answers on quiz_answers.question_id = quiz_questions.id
        left join public.quiz_attempts on quiz_attempts.id = quiz_answers.attempt_id
        left join public.participants on participants.id = quiz_attempts.participant_id
          and participants.room_id = p_room_id
        where quiz_questions.quiz_id = quiz_stats.quiz_id
        group by quiz_questions.id, quiz_questions.position, quiz_questions.type, quiz_questions.question_text
      ) as question_stats
    )
  ) order by quiz_stats.section_position), '[]'::jsonb)
  into quiz_data
  from (
    select
      quizzes.id as quiz_id,
      sections.id as section_id,
      sections.position as section_position,
      quizzes.title,
      count(quiz_attempts.id) filter (where participants.id is not null)::integer as submitted_count,
      (select count(*)::integer from public.participants where participants.room_id = rooms.id) as participant_count,
      round(case
        when (select count(*) from public.participants where participants.room_id = rooms.id) = 0 then 0
        else 100.0 * count(quiz_attempts.id) filter (where participants.id is not null)
          / (select count(*) from public.participants where participants.room_id = rooms.id)
      end, 2) as completion_rate,
      round(coalesce(avg(quiz_attempts.score) filter (where participants.id is not null), 0), 2) as average_score,
      (select count(*)::integer from public.quiz_questions where quiz_questions.quiz_id = quizzes.id) as total_questions
    from public.rooms
    join public.sections on sections.lesson_id = private.lesson_id_for_room(rooms.id)
    join public.quizzes on quizzes.section_id = sections.id
    left join public.quiz_attempts on quiz_attempts.quiz_id = quizzes.id
    left join public.participants on participants.id = quiz_attempts.participant_id
      and participants.room_id = rooms.id
    where rooms.id = p_room_id and sections.position <= rooms.released_through
    group by quizzes.id, sections.id, sections.position, quizzes.title, rooms.id
  ) as quiz_stats;

  return jsonb_build_object('quizzes', quiz_data);
end;
$$;

create or replace function private.get_teacher_room_summary(p_room_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_room public.rooms%rowtype;
  participant_data jsonb;
  participant_count integer;
  quiz_data jsonb;
  reaction_data jsonb;
  total_comments integer;
  anonymous_comments integer;
  named_comments integer;
  most_engaged_section jsonb;
begin
  select rooms.* into target_room
  from public.rooms
  where rooms.id = p_room_id
    and rooms.teacher_user_id = auth.uid()
    and rooms.status = 'ENDED';

  if not found then
    raise exception 'Room summary is not available.' using errcode = '42501';
  end if;

  select count(*)::integer, coalesce(jsonb_agg(jsonb_build_object(
    'mssv', participants.mssv,
    'joinedAt', participants.joined_at
  ) order by participants.joined_at, participants.mssv), '[]'::jsonb)
  into participant_count, participant_data
  from public.participants
  where participants.room_id = p_room_id;

  quiz_data := public.get_teacher_quiz_analytics(p_room_id)->'quizzes';

  select coalesce(jsonb_agg(jsonb_build_object(
    'sectionId', section_counts.section_id,
    'sectionPosition', section_counts.section_position,
    'sectionTitle', section_counts.section_title,
    'understand', section_counts.understand,
    'unsure', section_counts.unsure,
    'question', section_counts.question
  ) order by section_counts.section_position), '[]'::jsonb)
  into reaction_data
  from (
    select
      sections.id as section_id,
      sections.position as section_position,
      sections.title as section_title,
      count(section_reactions.id) filter (where participants.id is not null and section_reactions.reaction = 'UNDERSTAND')::integer as understand,
      count(section_reactions.id) filter (where participants.id is not null and section_reactions.reaction = 'UNSURE')::integer as unsure,
      count(section_reactions.id) filter (where participants.id is not null and section_reactions.reaction = 'QUESTION')::integer as question
    from public.sections
    left join public.section_reactions on section_reactions.section_id = sections.id
    left join public.participants on participants.id = section_reactions.participant_id
      and participants.room_id = p_room_id
    where sections.lesson_id = private.lesson_id_for_room(p_room_id)
      and sections.position <= target_room.released_through
    group by sections.id, sections.position, sections.title
  ) as section_counts;

  select
    count(*)::integer,
    count(*) filter (where section_comments.is_anonymous)::integer,
    count(*) filter (where not section_comments.is_anonymous)::integer
  into total_comments, anonymous_comments, named_comments
  from public.section_comments
  join public.sections on sections.id = section_comments.section_id
  join public.participants on participants.id = section_comments.participant_id
  where sections.lesson_id = private.lesson_id_for_room(p_room_id)
    and participants.room_id = p_room_id;

  select jsonb_build_object(
    'sectionId', engagement.section_id,
    'sectionPosition', engagement.section_position,
    'sectionTitle', engagement.section_title,
    'totalFeedback', engagement.total_feedback
  )
  into most_engaged_section
  from (
    select
      sections.id as section_id,
      sections.position as section_position,
      sections.title as section_title,
      (
        select count(*)
        from public.section_reactions
        join public.participants on participants.id = section_reactions.participant_id
        where section_reactions.section_id = sections.id and participants.room_id = p_room_id
      ) + (
        select count(*)
        from public.section_comments
        join public.participants on participants.id = section_comments.participant_id
        where section_comments.section_id = sections.id and participants.room_id = p_room_id
      ) as total_feedback
    from public.sections
    where sections.lesson_id = private.lesson_id_for_room(p_room_id)
      and sections.position <= target_room.released_through
  ) as engagement
  where engagement.total_feedback > 0
  order by engagement.total_feedback desc, engagement.section_position
  limit 1;

  return jsonb_build_object(
    'room', jsonb_build_object(
      'id', target_room.id,
      'code', target_room.code,
      'title', target_room.title,
      'startedAt', target_room.started_at,
      'endedAt', target_room.ended_at
    ),
    'participantCount', participant_count,
    'participants', participant_data,
    'quizzes', quiz_data,
    'reactions', reaction_data,
    'comments', jsonb_build_object(
      'total', total_comments,
      'anonymous', anonymous_comments,
      'named', named_comments
    ),
    'mostEngagedSection', most_engaged_section
  );
end;
$$;

create or replace function private.get_teacher_class_voices(p_room_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_room public.rooms%rowtype;
  participant_count integer;
  section_data jsonb;
begin
  select rooms.* into target_room
  from public.rooms
  where rooms.id = p_room_id
    and rooms.teacher_user_id = auth.uid()
    and rooms.status = 'ENDED';

  if not found then
    raise exception 'Class Voices are not available.' using errcode = '42501';
  end if;

  select count(*)::integer into participant_count
  from public.participants where participants.room_id = target_room.id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'sectionId', sections.id,
    'sectionPosition', sections.position,
    'sectionTitle', sections.title,
    'reactions', jsonb_build_object(
      'understand', (
        select count(*)::integer
        from public.section_reactions
        join public.participants on participants.id = section_reactions.participant_id
        where section_reactions.section_id = sections.id
          and participants.room_id = target_room.id
          and section_reactions.reaction = 'UNDERSTAND'
      ),
      'unsure', (
        select count(*)::integer
        from public.section_reactions
        join public.participants on participants.id = section_reactions.participant_id
        where section_reactions.section_id = sections.id
          and participants.room_id = target_room.id
          and section_reactions.reaction = 'UNSURE'
      ),
      'question', (
        select count(*)::integer
        from public.section_reactions
        join public.participants on participants.id = section_reactions.participant_id
        where section_reactions.section_id = sections.id
          and participants.room_id = target_room.id
          and section_reactions.reaction = 'QUESTION'
      )
    ),
    'comments', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', section_comments.id,
        'body', section_comments.body,
        'authorLabel', case when section_comments.is_anonymous then 'Anonymous' else participants.mssv end,
        'isAnonymous', section_comments.is_anonymous,
        'createdAt', section_comments.created_at
      ) order by section_comments.created_at, section_comments.id), '[]'::jsonb)
      from public.section_comments
      join public.participants on participants.id = section_comments.participant_id
      where section_comments.section_id = sections.id
        and participants.room_id = target_room.id
    )
  ) order by sections.position), '[]'::jsonb)
  into section_data
  from public.sections
  where sections.lesson_id = private.lesson_id_for_room(target_room.id)
    and sections.position <= target_room.released_through;

  return jsonb_build_object(
    'roomId', target_room.id,
    'roomCode', target_room.code,
    'roomTitle', target_room.title,
    'participantCount', participant_count,
    'sections', section_data
  );
end;
$$;
