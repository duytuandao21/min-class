create function private.generate_room_code(code_length integer default 6)
returns text
language sql
volatile
set search_path = ''
as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', floor(random() * 32)::integer + 1, 1), '')
  from generate_series(1, code_length);
$$;

create function public.create_room_with_lesson(
  p_room_title text,
  p_markdown_source text,
  p_lesson jsonb
)
returns table (
  room_id uuid,
  room_code text,
  room_title text,
  room_status public.room_status
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_room_id uuid;
  v_room_code text;
  v_lesson_id uuid;
  v_section_id uuid;
  v_quiz_id uuid;
  v_question_id uuid;
  v_option_id uuid;
  v_section record;
  v_question record;
  v_option record;
  v_section_json jsonb;
  v_question_json jsonb;
  v_option_json jsonb;
  v_section_type text;
  v_question_type text;
  v_correct_option_ids uuid[];
  v_seen_section_ids text[] := '{}'::text[];
  v_seen_question_ids text[];
  v_seen_option_ids text[];
  v_source_id text;
  v_attempt integer;
  v_constraint_name text;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  if p_room_title is null
    or p_room_title <> btrim(p_room_title)
    or char_length(p_room_title) not between 1 and 120
  then
    raise exception using errcode = '22023', message = 'Invalid room title';
  end if;
  if p_markdown_source is null
    or char_length(p_markdown_source) = 0
    or octet_length(p_markdown_source) > 1048576
  then
    raise exception using errcode = '22023', message = 'Invalid Markdown source';
  end if;
  if p_lesson is null or jsonb_typeof(p_lesson) is distinct from 'object' then
    raise exception using errcode = '22023', message = 'Invalid lesson payload';
  end if;
  if coalesce(p_lesson->>'title', '') <> btrim(coalesce(p_lesson->>'title', ''))
    or char_length(coalesce(p_lesson->>'title', '')) not between 1 and 200
    or (
      p_lesson->>'description' is not null
      and char_length(p_lesson->>'description') > 1000
    )
    or jsonb_typeof(p_lesson->'sections') is distinct from 'array'
    or jsonb_array_length(p_lesson->'sections') = 0
  then
    raise exception using errcode = '22023', message = 'Invalid lesson metadata';
  end if;

  for v_attempt in 1..10 loop
    v_room_code := private.generate_room_code(6);
    begin
      insert into public.rooms (code, teacher_user_id, title, status)
      values (v_room_code, v_user_id, p_room_title, 'DRAFT')
      returning id into v_room_id;
      exit;
    exception when unique_violation then
      get stacked diagnostics v_constraint_name = constraint_name;
      if v_constraint_name <> 'rooms_code_key' then
        raise;
      end if;
    end;
  end loop;
  if v_room_id is null then
    raise exception using errcode = '23505', message = 'Could not allocate a room code';
  end if;

  insert into public.lessons (room_id, title, description, markdown_source)
  values (
    v_room_id,
    p_lesson->>'title',
    nullif(p_lesson->>'description', ''),
    p_markdown_source
  )
  returning id into v_lesson_id;

  for v_section in
    select item.value, item.ordinality
    from jsonb_array_elements(p_lesson->'sections') with ordinality as item(value, ordinality)
    order by item.ordinality
  loop
    v_section_json := v_section.value;
    if jsonb_typeof(v_section_json) is distinct from 'object' then
      raise exception using errcode = '22023', message = 'Invalid section';
    end if;
    v_source_id := v_section_json->>'id';
    v_section_type := v_section_json->>'type';
    if v_source_id is null
      or v_source_id !~ '^[a-z0-9][a-z0-9_-]{0,63}$'
      or v_source_id = any(v_seen_section_ids)
      or coalesce(v_section_json->>'title', '') <> btrim(coalesce(v_section_json->>'title', ''))
      or char_length(coalesce(v_section_json->>'title', '')) not between 1 and 200
      or v_section_type not in ('CONTENT', 'REFLECTION', 'QUIZ')
      or jsonb_typeof(v_section_json->'position') is distinct from 'number'
      or (v_section_json->>'position')::integer <> v_section.ordinality - 1
    then
      raise exception using errcode = '22023', message = 'Invalid or duplicate section';
    end if;
    v_seen_section_ids := array_append(v_seen_section_ids, v_source_id);

    if v_section_type in ('CONTENT', 'REFLECTION') then
      if jsonb_typeof(v_section_json->'contentMd') is distinct from 'string'
        or coalesce(v_section_json->>'contentMd', '') = ''
      then
        raise exception using errcode = '22023', message = 'Content section cannot be empty';
      end if;
    elsif coalesce(v_section_json->>'contentMd', '') <> ''
      or jsonb_typeof(v_section_json->'quiz') is distinct from 'object'
      or jsonb_typeof(v_section_json->'quiz'->'questions') is distinct from 'array'
      or jsonb_array_length(v_section_json->'quiz'->'questions') = 0
    then
      raise exception using errcode = '22023', message = 'Invalid quiz section';
    end if;

    insert into public.sections (lesson_id, position, type, title, content_md)
    values (
      v_lesson_id,
      v_section.ordinality - 1,
      v_section_type::public.section_type,
      v_section_json->>'title',
      v_section_json->>'contentMd'
    )
    returning id into v_section_id;

    if v_section_type = 'QUIZ' then
      insert into public.quizzes (section_id, title)
      values (v_section_id, v_section_json->>'title')
      returning id into v_quiz_id;
      v_seen_question_ids := '{}'::text[];

      for v_question in
        select item.value, item.ordinality
        from jsonb_array_elements(v_section_json->'quiz'->'questions') with ordinality as item(value, ordinality)
        order by item.ordinality
      loop
        v_question_json := v_question.value;
        v_source_id := v_question_json->>'id';
        v_question_type := v_question_json->>'type';
        if jsonb_typeof(v_question_json) is distinct from 'object'
          or v_source_id is null
          or v_source_id !~ '^[a-z0-9][a-z0-9_-]{0,63}$'
          or v_source_id = any(v_seen_question_ids)
          or v_question_type not in ('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE')
          or coalesce(v_question_json->>'questionText', '') <> btrim(coalesce(v_question_json->>'questionText', ''))
          or char_length(coalesce(v_question_json->>'questionText', '')) not between 1 and 1000
          or jsonb_typeof(v_question_json->'position') is distinct from 'number'
          or (v_question_json->>'position')::integer <> v_question.ordinality - 1
          or jsonb_typeof(v_question_json->'options') is distinct from 'array'
          or jsonb_array_length(v_question_json->'options') < 2
        then
          raise exception using errcode = '22023', message = 'Invalid or duplicate quiz question';
        end if;
        v_seen_question_ids := array_append(v_seen_question_ids, v_source_id);

        insert into public.quiz_questions (quiz_id, position, type, question_text)
        values (
          v_quiz_id,
          v_question.ordinality - 1,
          v_question_type::public.quiz_question_type,
          v_question_json->>'questionText'
        )
        returning id into v_question_id;

        v_correct_option_ids := '{}'::uuid[];
        v_seen_option_ids := '{}'::text[];
        for v_option in
          select item.value, item.ordinality
          from jsonb_array_elements(v_question_json->'options') with ordinality as item(value, ordinality)
          order by item.ordinality
        loop
          v_option_json := v_option.value;
          v_source_id := v_option_json->>'id';
          if jsonb_typeof(v_option_json) is distinct from 'object'
            or v_source_id is null
            or v_source_id !~ '^[a-z0-9][a-z0-9_-]{0,63}$'
            or v_source_id = any(v_seen_option_ids)
            or coalesce(v_option_json->>'content', '') <> btrim(coalesce(v_option_json->>'content', ''))
            or char_length(coalesce(v_option_json->>'content', '')) not between 1 and 500
            or jsonb_typeof(v_option_json->'position') is distinct from 'number'
            or (v_option_json->>'position')::integer <> v_option.ordinality - 1
            or jsonb_typeof(v_option_json->'isCorrect') is distinct from 'boolean'
          then
            raise exception using errcode = '22023', message = 'Invalid or duplicate quiz option';
          end if;
          v_seen_option_ids := array_append(v_seen_option_ids, v_source_id);

          insert into public.quiz_options (question_id, position, content)
          values (v_question_id, v_option.ordinality - 1, v_option_json->>'content')
          returning id into v_option_id;
          if (v_option_json->>'isCorrect')::boolean then
            v_correct_option_ids := array_append(v_correct_option_ids, v_option_id);
          end if;
        end loop;

        if (v_question_type = 'SINGLE_CHOICE' and cardinality(v_correct_option_ids) <> 1)
          or (v_question_type = 'MULTIPLE_CHOICE' and cardinality(v_correct_option_ids) < 1)
          or (
            v_question_type = 'TRUE_FALSE'
            and (jsonb_array_length(v_question_json->'options') <> 2 or cardinality(v_correct_option_ids) <> 1)
          )
        then
          raise exception using errcode = '22023', message = 'Invalid quiz answer key';
        end if;
        insert into public.quiz_answer_keys (question_id, correct_option_ids)
        values (v_question_id, v_correct_option_ids);
      end loop;
    end if;
  end loop;

  return query
  select v_room_id, v_room_code, p_room_title, 'DRAFT'::public.room_status;
end;
$$;

revoke all on function private.generate_room_code(integer) from public, anon, authenticated;
revoke all on function public.create_room_with_lesson(text, text, jsonb) from public, anon;
grant execute on function public.create_room_with_lesson(text, text, jsonb) to authenticated;
