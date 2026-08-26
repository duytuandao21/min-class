alter table public.lessons
alter column room_id drop not null;

alter table public.lessons
add column course_section_id uuid references public.course_sections(id) on delete cascade;

alter table public.lessons
add constraint lessons_exactly_one_parent check (num_nonnulls(room_id, course_section_id) = 1);

create index lessons_course_section_created_idx
on public.lessons (course_section_id, created_at desc)
where course_section_id is not null;

create policy lessons_course_section_teacher_all
on public.lessons for all to authenticated
using (
  coalesce((auth.jwt()->>'is_anonymous')::boolean, true) is false
  and lower(coalesce(auth.jwt()->>'email', '')) = 'thaybao@minclass.local'
  and exists (
    select 1
    from public.course_sections
    join public.subjects on subjects.id = course_sections.subject_id
    where course_sections.id = lessons.course_section_id
      and subjects.teacher_id = auth.uid()
  )
)
with check (
  room_id is null
  and coalesce((auth.jwt()->>'is_anonymous')::boolean, true) is false
  and lower(coalesce(auth.jwt()->>'email', '')) = 'thaybao@minclass.local'
  and exists (
    select 1
    from public.course_sections
    join public.subjects on subjects.id = course_sections.subject_id
    where course_sections.id = lessons.course_section_id
      and subjects.teacher_id = auth.uid()
  )
);

create function public.create_course_section_lesson(
  p_course_section_id uuid,
  p_lesson_title text,
  p_markdown_source text,
  p_lesson jsonb
)
returns table (
  lesson_id uuid,
  lesson_title text,
  lesson_created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lesson_id uuid;
  v_created_at timestamptz;
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
begin
  if coalesce((auth.jwt()->>'is_anonymous')::boolean, true)
    or lower(coalesce(auth.jwt()->>'email', '')) <> 'thaybao@minclass.local'
  then
    raise exception using errcode = '42501', message = 'Teacher account required.';
  end if;

  if not exists (
    select 1
    from public.course_sections
    join public.subjects on subjects.id = course_sections.subject_id
    where course_sections.id = p_course_section_id
      and subjects.teacher_id = auth.uid()
  ) then
    raise exception using errcode = '42501', message = 'Course Section is not available.';
  end if;

  if p_lesson_title is null
    or p_lesson_title <> btrim(p_lesson_title)
    or char_length(p_lesson_title) not between 1 and 200
  then
    raise exception using errcode = '22023', message = 'Invalid Lesson title.';
  end if;

  if p_markdown_source is null
    or char_length(p_markdown_source) = 0
    or octet_length(p_markdown_source) > 1048576
  then
    raise exception using errcode = '22023', message = 'Invalid Markdown source.';
  end if;

  if p_lesson is null
    or jsonb_typeof(p_lesson) is distinct from 'object'
    or jsonb_typeof(p_lesson->'sections') is distinct from 'array'
    or jsonb_array_length(p_lesson->'sections') = 0
  then
    raise exception using errcode = '22023', message = 'Invalid Lesson payload.';
  end if;

  insert into public.lessons (
    room_id,
    course_section_id,
    title,
    description,
    markdown_source
  )
  values (
    null,
    p_course_section_id,
    p_lesson_title,
    nullif(p_lesson->>'description', ''),
    p_markdown_source
  )
  returning id, created_at into v_lesson_id, v_created_at;

  for v_section in
    select item.value, item.ordinality
    from jsonb_array_elements(p_lesson->'sections') with ordinality as item(value, ordinality)
    order by item.ordinality
  loop
    v_section_json := v_section.value;
    v_section_type := v_section_json->>'type';
    if jsonb_typeof(v_section_json) is distinct from 'object'
      or v_section_type not in ('CONTENT', 'REFLECTION', 'QUIZ')
      or coalesce(v_section_json->>'title', '') <> btrim(coalesce(v_section_json->>'title', ''))
      or char_length(coalesce(v_section_json->>'title', '')) not between 1 and 200
      or jsonb_typeof(v_section_json->'position') is distinct from 'number'
      or (v_section_json->>'position')::integer <> v_section.ordinality - 1
    then
      raise exception using errcode = '22023', message = 'Invalid Lesson section.';
    end if;

    if v_section_type in ('CONTENT', 'REFLECTION') then
      if jsonb_typeof(v_section_json->'contentMd') is distinct from 'string'
        or coalesce(v_section_json->>'contentMd', '') = ''
      then
        raise exception using errcode = '22023', message = 'Content section cannot be empty.';
      end if;
    elsif coalesce(v_section_json->>'contentMd', '') <> ''
      or jsonb_typeof(v_section_json->'quiz') is distinct from 'object'
      or jsonb_typeof(v_section_json->'quiz'->'questions') is distinct from 'array'
      or jsonb_array_length(v_section_json->'quiz'->'questions') = 0
    then
      raise exception using errcode = '22023', message = 'Invalid Quiz section.';
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

      for v_question in
        select item.value, item.ordinality
        from jsonb_array_elements(v_section_json->'quiz'->'questions') with ordinality as item(value, ordinality)
        order by item.ordinality
      loop
        v_question_json := v_question.value;
        v_question_type := v_question_json->>'type';
        if jsonb_typeof(v_question_json) is distinct from 'object'
          or v_question_type not in ('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE')
          or coalesce(v_question_json->>'questionText', '') <> btrim(coalesce(v_question_json->>'questionText', ''))
          or char_length(coalesce(v_question_json->>'questionText', '')) not between 1 and 1000
          or jsonb_typeof(v_question_json->'position') is distinct from 'number'
          or (v_question_json->>'position')::integer <> v_question.ordinality - 1
          or jsonb_typeof(v_question_json->'options') is distinct from 'array'
          or jsonb_array_length(v_question_json->'options') < 2
        then
          raise exception using errcode = '22023', message = 'Invalid Quiz question.';
        end if;

        insert into public.quiz_questions (quiz_id, position, type, question_text)
        values (
          v_quiz_id,
          v_question.ordinality - 1,
          v_question_type::public.quiz_question_type,
          v_question_json->>'questionText'
        )
        returning id into v_question_id;

        v_correct_option_ids := '{}'::uuid[];
        for v_option in
          select item.value, item.ordinality
          from jsonb_array_elements(v_question_json->'options') with ordinality as item(value, ordinality)
          order by item.ordinality
        loop
          v_option_json := v_option.value;
          if jsonb_typeof(v_option_json) is distinct from 'object'
            or coalesce(v_option_json->>'content', '') <> btrim(coalesce(v_option_json->>'content', ''))
            or char_length(coalesce(v_option_json->>'content', '')) not between 1 and 500
            or jsonb_typeof(v_option_json->'position') is distinct from 'number'
            or (v_option_json->>'position')::integer <> v_option.ordinality - 1
            or jsonb_typeof(v_option_json->'isCorrect') is distinct from 'boolean'
          then
            raise exception using errcode = '22023', message = 'Invalid Quiz option.';
          end if;

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
          raise exception using errcode = '22023', message = 'Invalid Quiz answer key.';
        end if;

        insert into public.quiz_answer_keys (question_id, correct_option_ids)
        values (v_question_id, v_correct_option_ids);
      end loop;
    end if;
  end loop;

  return query select v_lesson_id, p_lesson_title, v_created_at;
end;
$$;

revoke all on function public.create_course_section_lesson(uuid, text, text, jsonb) from public, anon;
grant execute on function public.create_course_section_lesson(uuid, text, text, jsonb) to authenticated;
