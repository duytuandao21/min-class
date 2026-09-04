-- Multiple anonymous browser sessions may represent the same roster Student.
-- Domain data remains attached to one canonical participant per Session/MSSV.

create or replace function private.current_session_participant_id(p_room_id uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select participants.id
  from public.participants
  where participants.room_id = p_room_id
    and (participants.user_id = auth.uid() or exists (
      select 1 from public.lesson_session_access_grants
      where lesson_session_access_grants.room_id = participants.room_id
        and lesson_session_access_grants.user_id = auth.uid()
        and lesson_session_access_grants.mssv = participants.mssv
    ))
  limit 1;
$$;

create or replace function private.is_room_participant(target_room_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.current_session_participant_id(target_room_id) is not null;
$$;

create or replace function private.is_own_participant(target_participant_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.participants
    where participants.id = target_participant_id
      and private.current_session_participant_id(participants.room_id) = participants.id
  );
$$;

create or replace function private.can_interact_with_section(target_section_id uuid, target_participant_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.participants
    join public.rooms on rooms.id = participants.room_id
    join public.session_lessons on session_lessons.session_id = rooms.id
    join public.sections on sections.lesson_id = session_lessons.lesson_id
    where participants.id = target_participant_id
      and private.is_own_participant(participants.id)
      and sections.id = target_section_id
      and rooms.status = 'ACTIVE'
      and sections.position <= session_lessons.released_through
  );
$$;

create or replace function private.can_read_section(target_section_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.sections
    join public.session_lessons on session_lessons.lesson_id = sections.lesson_id
    join public.rooms on rooms.id = session_lessons.session_id
    where sections.id = target_section_id
      and (rooms.teacher_user_id = auth.uid() or (
        sections.position <= session_lessons.released_through
        and (
          private.is_room_participant(rooms.id)
          or exists (
            select 1 from public.lesson_session_access_grants
            where lesson_session_access_grants.room_id = rooms.id
              and lesson_session_access_grants.user_id = auth.uid()
              and rooms.status = 'ENDED'
          )
        )
      ))
  );
$$;

create or replace function public.join_live_chapter_session(p_session_id uuid, p_mssv text)
returns table (room_id uuid, room_title text, room_status public.room_status, participant_id uuid)
language plpgsql security definer set search_path = '' as $$
declare
  target_room public.rooms%rowtype;
  existing_grant public.lesson_session_access_grants%rowtype;
  created_participant_id uuid;
  v_normalized_mssv text := upper(btrim(coalesce(p_mssv, '')));
  v_joined_at timestamptz := now();
begin
  if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) is not true then
    raise exception 'Lesson Session is not available.' using errcode = '42501';
  end if;
  select rooms.* into target_room from public.rooms
  where rooms.id = p_session_id and rooms.status = 'ACTIVE' for update;
  if not found then raise exception 'Lesson Session is not available.' using errcode = 'P0001'; end if;
  if v_normalized_mssv !~ '^[A-Z0-9][A-Z0-9._-]{2,31}$' or not exists (
    select 1 from public.session_attendance
    where session_id = target_room.id and mssv = v_normalized_mssv
  ) then raise exception 'Student is not in the Course Section.' using errcode = 'P0003'; end if;

  select grants.* into existing_grant from public.lesson_session_access_grants as grants
  where grants.room_id = target_room.id and grants.user_id = auth.uid();
  if found and existing_grant.mssv is distinct from v_normalized_mssv then
    raise exception 'This browser session already represents another Student.' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(target_room.id::text || ':' || v_normalized_mssv, 0));
  select participants.id, participants.joined_at into created_participant_id, v_joined_at
  from public.participants
  where participants.room_id = target_room.id and participants.mssv = v_normalized_mssv;
  if created_participant_id is null then
    v_joined_at := now();
    insert into public.participants (room_id, user_id, mssv, joined_at)
    values (target_room.id, auth.uid(), v_normalized_mssv, v_joined_at)
    returning id into created_participant_id;
  end if;
  insert into public.lesson_session_access_grants (room_id, user_id, mssv)
  values (target_room.id, auth.uid(), v_normalized_mssv)
  on conflict (room_id, user_id) do nothing;
  update public.session_attendance set joined_at = coalesce(joined_at, v_joined_at)
  where session_id = target_room.id and mssv = v_normalized_mssv;
  return query select target_room.id, target_room.title, target_room.status, created_participant_id;
end;
$$;

create or replace function public.get_student_session_lessons(p_room_id uuid)
returns table (lesson_id uuid, lesson_title text, chapter_name text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not (
    private.is_room_participant(p_room_id)
    or exists (select 1 from public.lesson_session_access_grants
      where room_id = p_room_id and user_id = auth.uid())
  ) then
    raise exception 'Lesson Session is not available to this Student.' using errcode = '42501';
  end if;
  return query select lessons.id, lessons.title, coalesce(chapters.name, 'Lesson')
  from public.session_lessons
  join public.lessons on lessons.id = session_lessons.lesson_id
  left join public.chapters on chapters.id = lessons.chapter_id
  where session_lessons.session_id = p_room_id order by lessons.created_at, lessons.id;
end;
$$;

create or replace function public.get_student_session_lesson_snapshot(p_room_id uuid, p_lesson_id uuid)
returns table (room_id uuid, room_title text, room_status public.room_status, released_through integer,
  section_id uuid, section_position integer, section_type public.section_type,
  section_title text, section_content_md text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not (
    private.is_room_participant(p_room_id)
    or exists (select 1 from public.lesson_session_access_grants
      join public.rooms on rooms.id = lesson_session_access_grants.room_id
      where lesson_session_access_grants.room_id = p_room_id
        and lesson_session_access_grants.user_id = auth.uid()
        and rooms.status = 'ENDED')
  ) then
    raise exception 'Lesson Session is not available to this Student.' using errcode = '42501';
  end if;
  return query select rooms.id, lessons.title, rooms.status, session_lessons.released_through,
    sections.id, sections.position, sections.type, sections.title, sections.content_md
  from public.rooms
  join public.session_lessons on session_lessons.session_id = rooms.id and session_lessons.lesson_id = p_lesson_id
  join public.lessons on lessons.id = session_lessons.lesson_id
  left join public.sections on sections.lesson_id = lessons.id and sections.position <= session_lessons.released_through
  where rooms.id = p_room_id order by sections.position;
end;
$$;

create or replace function public.set_section_reaction(p_section_id uuid, p_reaction public.reaction_type)
returns table (section_id uuid, reaction public.reaction_type, updated_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare target_participant_id uuid;
begin
  select private.current_session_participant_id(rooms.id) into target_participant_id
  from public.rooms join public.session_lessons on session_lessons.session_id = rooms.id
  join public.sections on sections.lesson_id = session_lessons.lesson_id
  where sections.id = p_section_id and rooms.status = 'ACTIVE'
    and sections.position <= session_lessons.released_through for share of rooms;
  if target_participant_id is null then raise exception 'Section is not available for interaction.' using errcode = '42501'; end if;
  insert into public.section_reactions (section_id, participant_id, reaction)
  values (p_section_id, target_participant_id, p_reaction)
  on conflict on constraint section_reactions_section_id_participant_id_key do update set reaction = excluded.reaction
  returning section_reactions.section_id, section_reactions.reaction, section_reactions.updated_at
  into section_id, reaction, updated_at;
  return next;
end;
$$;

create or replace function public.create_section_comment(p_section_id uuid, p_body text, p_is_anonymous boolean)
returns table (comment_id uuid, section_id uuid, created_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare target_participant_id uuid; normalized_body text := btrim(p_body);
begin
  if p_body is null or char_length(normalized_body) not between 1 and 500 or p_is_anonymous is null then
    raise exception 'Comment must contain between 1 and 500 characters.' using errcode = '22023';
  end if;
  select private.current_session_participant_id(rooms.id) into target_participant_id
  from public.rooms join public.session_lessons on session_lessons.session_id = rooms.id
  join public.sections on sections.lesson_id = session_lessons.lesson_id
  where sections.id = p_section_id and rooms.status = 'ACTIVE'
    and sections.position <= session_lessons.released_through for share of rooms;
  if target_participant_id is null then raise exception 'Section is not available for interaction.' using errcode = '42501'; end if;
  insert into public.section_comments (section_id, participant_id, body, is_anonymous)
  values (p_section_id, target_participant_id, normalized_body, p_is_anonymous)
  returning section_comments.id, section_comments.section_id, section_comments.created_at
  into comment_id, section_id, created_at;
  return next;
end;
$$;

-- Resolve quiz ownership through the canonical participant, so every browser
-- sees the same attempt and the existing unique constraint still prevents resubmission.
create or replace function public.get_session_student_quiz_snapshot(p_room_id uuid, p_section_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare target_quiz_id uuid; target_quiz_title text; target_participant_id uuid; question_data jsonb; attempt_data jsonb;
begin
  target_participant_id := private.current_session_participant_id(p_room_id);
  select quizzes.id, quizzes.title into target_quiz_id, target_quiz_title
  from public.rooms join public.session_lessons on session_lessons.session_id = rooms.id
  join public.sections on sections.lesson_id = session_lessons.lesson_id
  join public.quizzes on quizzes.section_id = sections.id
  where rooms.id = p_room_id and sections.id = p_section_id and target_participant_id is not null
    and sections.position <= session_lessons.released_through;
  if target_quiz_id is null then raise exception 'Quiz is not available.' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', quiz_questions.id, 'position', quiz_questions.position,
    'type', quiz_questions.type, 'questionText', quiz_questions.question_text,
    'options', (select coalesce(jsonb_agg(jsonb_build_object('id', quiz_options.id,
      'position', quiz_options.position, 'content', quiz_options.content) order by quiz_options.position), '[]'::jsonb)
      from public.quiz_options where quiz_options.question_id = quiz_questions.id))
    order by quiz_questions.position), '[]'::jsonb)
  into question_data from public.quiz_questions where quiz_questions.quiz_id = target_quiz_id;
  select jsonb_build_object('attemptId', quiz_attempts.id, 'score', quiz_attempts.score,
    'totalQuestions', quiz_attempts.total_questions, 'submittedAt', quiz_attempts.submitted_at,
    'answers', (select coalesce(jsonb_agg(jsonb_build_object('questionId', quiz_answers.question_id,
      'selectedOptionIds', quiz_answers.selected_option_ids, 'correctOptionIds', quiz_answer_keys.correct_option_ids,
      'isCorrect', quiz_answers.is_correct) order by quiz_questions.position), '[]'::jsonb)
      from public.quiz_answers join public.quiz_questions on quiz_questions.id = quiz_answers.question_id
      join public.quiz_answer_keys on quiz_answer_keys.question_id = quiz_answers.question_id
      where quiz_answers.attempt_id = quiz_attempts.id)) into attempt_data
  from public.quiz_attempts where quiz_attempts.quiz_id = target_quiz_id
    and quiz_attempts.participant_id = target_participant_id;
  return jsonb_build_object('quizId', target_quiz_id, 'sectionId', p_section_id,
    'title', target_quiz_title, 'questions', question_data, 'attempt', attempt_data);
end;
$$;

create or replace function public.submit_session_quiz(p_room_id uuid, p_quiz_id uuid, p_answers jsonb)
returns table (attempt_id uuid, score integer, total_questions integer)
language plpgsql security definer set search_path = '' as $$
declare target_participant_id uuid; question_count integer; correct_count integer; created_attempt_id uuid;
begin
  if jsonb_typeof(p_answers) <> 'array' or jsonb_array_length(p_answers) = 0 then
    raise exception 'Answers must be a non-empty array.' using errcode = '22023';
  end if;
  target_participant_id := private.current_session_participant_id(p_room_id);
  if target_participant_id is null or not exists (
    select 1 from public.rooms
    join public.session_lessons on session_lessons.session_id = rooms.id
    join public.sections on sections.lesson_id = session_lessons.lesson_id
    join public.quizzes on quizzes.section_id = sections.id
    where rooms.id = p_room_id and rooms.status = 'ACTIVE' and quizzes.id = p_quiz_id
      and sections.position <= session_lessons.released_through
  ) then raise exception 'Quiz is not available.' using errcode = '42501'; end if;
  select count(*) into question_count from public.quiz_questions where quiz_id = p_quiz_id;
  if question_count = 0 or jsonb_array_length(p_answers) <> question_count then
    raise exception 'Every Quiz question must be answered exactly once.' using errcode = '22023';
  end if;
  if exists (
    with submitted as (
      select (answer->>'question_id')::uuid question_id,
        array(select jsonb_array_elements_text(answer->'selected_option_ids')::uuid) selected_option_ids
      from jsonb_array_elements(p_answers) answer
    )
    select 1 from submitted
    left join public.quiz_questions on quiz_questions.id = submitted.question_id and quiz_questions.quiz_id = p_quiz_id
    where quiz_questions.id is null or cardinality(submitted.selected_option_ids) = 0
      or cardinality(submitted.selected_option_ids) <> (
        select count(distinct selected_option_id) from unnest(submitted.selected_option_ids) selected_option_id)
      or (quiz_questions.type in ('SINGLE_CHOICE','TRUE_FALSE') and cardinality(submitted.selected_option_ids) <> 1)
      or exists (select 1 from unnest(submitted.selected_option_ids) selected_option_id
        where not exists (select 1 from public.quiz_options
          where quiz_options.id = selected_option_id and quiz_options.question_id = submitted.question_id))
  ) or (select count(distinct (answer->>'question_id')::uuid) from jsonb_array_elements(p_answers) answer) <> question_count
  then raise exception 'Quiz answers are invalid.' using errcode = '22023'; end if;
  with submitted as (
    select (answer->>'question_id')::uuid question_id,
      array(select jsonb_array_elements_text(answer->'selected_option_ids')::uuid) selected_option_ids
    from jsonb_array_elements(p_answers) answer
  )
  select count(*) filter (where cardinality(submitted.selected_option_ids) = cardinality(quiz_answer_keys.correct_option_ids)
    and submitted.selected_option_ids @> quiz_answer_keys.correct_option_ids
    and submitted.selected_option_ids <@ quiz_answer_keys.correct_option_ids)
  into correct_count from submitted join public.quiz_answer_keys using (question_id);
  if (select count(*) from public.quiz_answer_keys join public.quiz_questions
    on quiz_questions.id = quiz_answer_keys.question_id where quiz_questions.quiz_id = p_quiz_id) <> question_count
  then raise exception 'Quiz answer keys are incomplete.' using errcode = 'P0001'; end if;
  insert into public.quiz_attempts (quiz_id, participant_id, score, total_questions)
  values (p_quiz_id, target_participant_id, correct_count, question_count) returning id into created_attempt_id;
  with submitted as (
    select (answer->>'question_id')::uuid question_id,
      array(select jsonb_array_elements_text(answer->'selected_option_ids')::uuid) selected_option_ids
    from jsonb_array_elements(p_answers) answer
  )
  insert into public.quiz_answers (attempt_id, question_id, selected_option_ids, is_correct)
  select created_attempt_id, submitted.question_id, submitted.selected_option_ids,
    cardinality(submitted.selected_option_ids) = cardinality(quiz_answer_keys.correct_option_ids)
      and submitted.selected_option_ids @> quiz_answer_keys.correct_option_ids
      and submitted.selected_option_ids <@ quiz_answer_keys.correct_option_ids
  from submitted join public.quiz_answer_keys using (question_id);
  return query select created_attempt_id, correct_count, question_count;
exception when unique_violation then
  raise exception 'Quiz has already been submitted.' using errcode = '23505';
end;
$$;

create or replace function public.save_own_session_reflection(p_room_id uuid, p_speaking_count integer, p_review_body text)
returns table (reflection_id uuid, speaking_count integer, review_body text, updated_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare target_participant_id uuid; normalized_review_body text := nullif(btrim(coalesce(p_review_body, '')), '');
begin
  if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) is not true then
    raise exception 'Session reflection is not available.' using errcode = '42501';
  end if;
  if p_speaking_count is null or p_speaking_count not between 0 and 999 then
    raise exception 'Speaking count must be between 0 and 999.' using errcode = '22023';
  end if;
  if normalized_review_body is not null and char_length(normalized_review_body) > 1000 then
    raise exception 'Review must contain at most 1000 characters.' using errcode = '22023';
  end if;
  select private.current_session_participant_id(rooms.id) into target_participant_id
  from public.rooms where rooms.id = p_room_id and rooms.status = 'ENDED' for share of rooms;
  if target_participant_id is null then raise exception 'Session reflection is not available.' using errcode = '42501'; end if;
  insert into public.session_reflections (participant_id, speaking_count, review_body)
  values (target_participant_id, p_speaking_count, normalized_review_body)
  returning session_reflections.id, session_reflections.speaking_count,
    session_reflections.review_body, session_reflections.updated_at
  into reflection_id, speaking_count, review_body, updated_at;
  return next;
exception when unique_violation then
  raise exception 'Session reflection has already been submitted.' using errcode = '23505';
end;
$$;

drop policy if exists session_reflections_select_authorized on public.session_reflections;
create policy session_reflections_select_authorized on public.session_reflections for select to authenticated using (
  private.is_own_participant(participant_id) or exists (
    select 1 from public.participants join public.rooms on rooms.id = participants.room_id
    where participants.id = session_reflections.participant_id
      and rooms.teacher_user_id = auth.uid() and private.is_permanent_user()
  )
);

drop policy if exists participants_select_authorized on public.participants;
create policy participants_select_authorized on public.participants for select to authenticated using (
  private.is_own_participant(id) or private.is_room_teacher(room_id)
);

revoke all on function private.current_session_participant_id(uuid) from public, anon, authenticated;
grant execute on function private.current_session_participant_id(uuid) to authenticated;
revoke all on function public.join_live_chapter_session(uuid, text) from public, anon, authenticated;
grant execute on function public.join_live_chapter_session(uuid, text) to authenticated;
