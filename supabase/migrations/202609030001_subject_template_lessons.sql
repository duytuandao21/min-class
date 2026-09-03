alter table public.chapters
alter column subject_id drop not null;

alter table public.chapters
add column course_section_id uuid references public.course_sections(id) on delete restrict;

alter table public.chapters
add constraint chapters_exactly_one_parent
check (num_nonnulls(subject_id, course_section_id) = 1);

create unique index chapters_course_section_name_unique_idx
on public.chapters (course_section_id, lower(name))
where course_section_id is not null;

create index chapters_course_section_name_idx
on public.chapters (course_section_id, lower(name), name)
where course_section_id is not null;

-- Alter Lessons before the data update below queues the deferred
-- lessons_enforce_chapter_subject constraint trigger.
alter table public.lessons
add column subject_id uuid references public.subjects(id) on delete restrict;

alter table public.lessons
drop constraint lessons_exactly_one_parent;

alter table public.lessons
add constraint lessons_exactly_one_parent
check (num_nonnulls(room_id, course_section_id, subject_id) = 1);

-- Existing Course Lessons receive Course Section-specific Chapter copies.
insert into public.chapters (course_section_id, name, created_at, updated_at)
select distinct lessons.course_section_id, chapters.name, chapters.created_at, chapters.updated_at
from public.lessons
join public.chapters on chapters.id = lessons.chapter_id
where lessons.course_section_id is not null;

create index lessons_subject_chapter_created_idx
on public.lessons (subject_id, chapter_id, created_at)
where subject_id is not null;

create policy lessons_subject_teacher_all
on public.lessons for all to authenticated
using (
  private.is_permanent_user()
  and exists (
    select 1 from public.subjects
    where subjects.id = lessons.subject_id
      and subjects.teacher_id = auth.uid()
  )
)
with check (
  room_id is null
  and course_section_id is null
  and private.is_permanent_user()
  and exists (
    select 1 from public.subjects
    where subjects.id = lessons.subject_id
      and subjects.teacher_id = auth.uid()
  )
);

drop policy chapters_teacher_select on public.chapters;
drop policy chapters_teacher_insert on public.chapters;
drop policy chapters_teacher_update on public.chapters;

create policy chapters_teacher_select
on public.chapters for select to authenticated
using (
  private.is_permanent_user()
  and exists (
    select 1 from public.subjects
    left join public.course_sections on course_sections.subject_id = subjects.id
    where subjects.teacher_id = auth.uid()
      and (subjects.id = chapters.subject_id or course_sections.id = chapters.course_section_id)
  )
);

create policy chapters_teacher_insert
on public.chapters for insert to authenticated
with check (
  private.is_permanent_user()
  and exists (
    select 1 from public.subjects
    left join public.course_sections on course_sections.subject_id = subjects.id
    where subjects.teacher_id = auth.uid()
      and (subjects.id = chapters.subject_id or course_sections.id = chapters.course_section_id)
  )
);

create policy chapters_teacher_update
on public.chapters for update to authenticated
using (
  private.is_permanent_user()
  and exists (
    select 1 from public.subjects
    left join public.course_sections on course_sections.subject_id = subjects.id
    where subjects.teacher_id = auth.uid()
      and (subjects.id = chapters.subject_id or course_sections.id = chapters.course_section_id)
  )
)
with check (
  private.is_permanent_user()
  and exists (
    select 1 from public.subjects
    left join public.course_sections on course_sections.subject_id = subjects.id
    where subjects.teacher_id = auth.uid()
      and (subjects.id = chapters.subject_id or course_sections.id = chapters.course_section_id)
  )
);

create or replace function private.keep_chapter_subject_immutable()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.subject_id is distinct from old.subject_id
    or new.course_section_id is distinct from old.course_section_id
  then raise exception 'Chapter cannot move to another parent.' using errcode = '23514'; end if;
  return new;
end;
$$;

drop trigger chapters_keep_subject_immutable on public.chapters;
create trigger chapters_keep_subject_immutable
before update of subject_id, course_section_id on public.chapters
for each row execute function private.keep_chapter_subject_immutable();

create or replace function private.enforce_lesson_chapter_subject()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room_id uuid;
  v_subject_id uuid;
  v_course_section_id uuid;
  v_chapter_id uuid;
  v_chapter_subject_id uuid;
  v_chapter_course_section_id uuid;
begin
  select lessons.room_id, lessons.subject_id, lessons.course_section_id, lessons.chapter_id
  into v_room_id, v_subject_id, v_course_section_id, v_chapter_id
  from public.lessons where lessons.id = new.id;
  if not found then return null; end if;

  if v_room_id is not null then
    if v_chapter_id is not null then
      raise exception 'Legacy Room Lesson cannot reference a Chapter.' using errcode = '23514';
    end if;
    return null;
  end if;

  select chapters.subject_id, chapters.course_section_id
  into v_chapter_subject_id, v_chapter_course_section_id
  from public.chapters
  where chapters.id = v_chapter_id;

  if v_chapter_id is null
    or (v_subject_id is not null and
      (v_chapter_subject_id is distinct from v_subject_id or v_chapter_course_section_id is not null))
    or (v_course_section_id is not null and
      (v_chapter_course_section_id is distinct from v_course_section_id or v_chapter_subject_id is not null))
  then
    raise exception 'Lesson Chapter must belong to its Subject.' using errcode = '23514';
  end if;
  return null;
end;
$$;

drop trigger lessons_enforce_chapter_subject on public.lessons;
create constraint trigger lessons_enforce_chapter_subject
after insert or update of course_section_id, subject_id, chapter_id on public.lessons
deferrable initially deferred
for each row execute function private.enforce_lesson_chapter_subject();

update public.lessons
set chapter_id = course_chapters.id
from public.chapters as source_chapters, public.chapters as course_chapters
where lessons.course_section_id is not null
  and source_chapters.id = lessons.chapter_id
  and course_chapters.course_section_id = lessons.course_section_id
  and lower(course_chapters.name) = lower(source_chapters.name);

create function private.populate_lesson_content(p_lesson_id uuid, p_lesson jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_section record;
  v_question record;
  v_option record;
  v_section_json jsonb;
  v_question_json jsonb;
  v_option_json jsonb;
  v_section_id uuid;
  v_quiz_id uuid;
  v_question_id uuid;
  v_option_id uuid;
  v_section_type text;
  v_question_type text;
  v_correct_option_ids uuid[];
begin
  if p_lesson is null
    or jsonb_typeof(p_lesson) is distinct from 'object'
    or jsonb_typeof(p_lesson->'sections') is distinct from 'array'
    or jsonb_array_length(p_lesson->'sections') = 0
  then
    raise exception 'Invalid Lesson payload.' using errcode = '22023';
  end if;

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
    then raise exception 'Invalid Lesson section.' using errcode = '22023'; end if;

    if v_section_type in ('CONTENT', 'REFLECTION') then
      if jsonb_typeof(v_section_json->'contentMd') is distinct from 'string'
        or coalesce(v_section_json->>'contentMd', '') = ''
      then raise exception 'Content section cannot be empty.' using errcode = '22023'; end if;
    elsif coalesce(v_section_json->>'contentMd', '') <> ''
      or jsonb_typeof(v_section_json->'quiz') is distinct from 'object'
      or jsonb_typeof(v_section_json->'quiz'->'questions') is distinct from 'array'
      or jsonb_array_length(v_section_json->'quiz'->'questions') = 0
    then raise exception 'Invalid Quiz section.' using errcode = '22023'; end if;

    insert into public.sections (lesson_id, position, type, title, content_md)
    values (p_lesson_id, v_section.ordinality - 1, v_section_type::public.section_type,
      v_section_json->>'title', v_section_json->>'contentMd')
    returning id into v_section_id;

    if v_section_type = 'QUIZ' then
      insert into public.quizzes (section_id, title)
      values (v_section_id, v_section_json->>'title') returning id into v_quiz_id;

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
        then raise exception 'Invalid Quiz question.' using errcode = '22023'; end if;

        insert into public.quiz_questions (quiz_id, position, type, question_text)
        values (v_quiz_id, v_question.ordinality - 1, v_question_type::public.quiz_question_type,
          v_question_json->>'questionText') returning id into v_question_id;

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
          then raise exception 'Invalid Quiz option.' using errcode = '22023'; end if;
          insert into public.quiz_options (question_id, position, content)
          values (v_question_id, v_option.ordinality - 1, v_option_json->>'content') returning id into v_option_id;
          if (v_option_json->>'isCorrect')::boolean then
            v_correct_option_ids := array_append(v_correct_option_ids, v_option_id);
          end if;
        end loop;

        if (v_question_type = 'SINGLE_CHOICE' and cardinality(v_correct_option_ids) <> 1)
          or (v_question_type = 'MULTIPLE_CHOICE' and cardinality(v_correct_option_ids) < 1)
          or (v_question_type = 'TRUE_FALSE' and
            (jsonb_array_length(v_question_json->'options') <> 2 or cardinality(v_correct_option_ids) <> 1))
        then raise exception 'Invalid Quiz answer key.' using errcode = '22023'; end if;
        insert into public.quiz_answer_keys (question_id, correct_option_ids)
        values (v_question_id, v_correct_option_ids);
      end loop;
    end if;
  end loop;
end;
$$;

revoke all on function private.populate_lesson_content(uuid, jsonb) from public, anon, authenticated;

create function private.clone_lesson(p_source_lesson_id uuid, p_subject_id uuid, p_course_section_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target_lesson_id uuid;
  v_target_chapter_id uuid;
  v_source_section record;
  v_source_question record;
  v_source_option record;
  v_target_section_id uuid;
  v_target_quiz_id uuid;
  v_target_question_id uuid;
  v_target_option_id uuid;
  v_correct_ids uuid[];
begin
  if p_subject_id is not null then
    select target_chapters.id into v_target_chapter_id
    from public.lessons source_lessons
    join public.chapters source_chapters on source_chapters.id = source_lessons.chapter_id
    join public.chapters target_chapters on target_chapters.subject_id = p_subject_id
      and lower(target_chapters.name) = lower(source_chapters.name)
    where source_lessons.id = p_source_lesson_id;
  else
    select target_chapters.id into v_target_chapter_id
    from public.lessons source_lessons
    join public.chapters source_chapters on source_chapters.id = source_lessons.chapter_id
    join public.chapters target_chapters on target_chapters.course_section_id = p_course_section_id
      and lower(target_chapters.name) = lower(source_chapters.name)
    where source_lessons.id = p_source_lesson_id;
  end if;
  if v_target_chapter_id is null then raise exception 'Target Chapter is not available.' using errcode = '23514'; end if;

  insert into public.lessons (room_id, subject_id, course_section_id, chapter_id, title, description, markdown_source, metadata)
  select null, p_subject_id, p_course_section_id, v_target_chapter_id, title, description, markdown_source, metadata
  from public.lessons where id = p_source_lesson_id
  returning id into v_target_lesson_id;

  for v_source_section in select * from public.sections where lesson_id = p_source_lesson_id order by position loop
    insert into public.sections (lesson_id, position, type, title, content_md)
    values (v_target_lesson_id, v_source_section.position, v_source_section.type, v_source_section.title, v_source_section.content_md)
    returning id into v_target_section_id;
    if v_source_section.type = 'QUIZ' then
      insert into public.quizzes (section_id, title)
      select v_target_section_id, title from public.quizzes where section_id = v_source_section.id
      returning id into v_target_quiz_id;
      for v_source_question in
        select quiz_questions.* from public.quiz_questions
        join public.quizzes on quizzes.id = quiz_questions.quiz_id
        where quizzes.section_id = v_source_section.id order by quiz_questions.position
      loop
        insert into public.quiz_questions (quiz_id, position, type, question_text)
        values (v_target_quiz_id, v_source_question.position, v_source_question.type, v_source_question.question_text)
        returning id into v_target_question_id;
        v_correct_ids := '{}'::uuid[];
        for v_source_option in select * from public.quiz_options where question_id = v_source_question.id order by position loop
          insert into public.quiz_options (question_id, position, content)
          values (v_target_question_id, v_source_option.position, v_source_option.content)
          returning id into v_target_option_id;
          if exists (
            select 1 from public.quiz_answer_keys
            where question_id = v_source_question.id and v_source_option.id = any(correct_option_ids)
          ) then v_correct_ids := array_append(v_correct_ids, v_target_option_id); end if;
        end loop;
        insert into public.quiz_answer_keys (question_id, correct_option_ids)
        values (v_target_question_id, v_correct_ids);
      end loop;
    end if;
  end loop;
  return v_target_lesson_id;
end;
$$;

revoke all on function private.clone_lesson(uuid, uuid, uuid) from public, anon, authenticated;

create function public.create_subject_template_lesson(
  p_subject_id uuid, p_chapter_id uuid, p_lesson_title text, p_markdown_source text, p_lesson jsonb
)
returns table (lesson_id uuid, lesson_title text, lesson_created_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare v_lesson_id uuid; v_created_at timestamptz;
begin
  if not private.is_permanent_user() then raise exception 'Teacher account required.' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_subject_id::text, 0));
  if not exists (
    select 1 from public.chapters join public.subjects on subjects.id = chapters.subject_id
    where chapters.id = p_chapter_id and subjects.id = p_subject_id and subjects.teacher_id = auth.uid()
  ) then raise exception 'Chapter is not available.' using errcode = '42501'; end if;
  if p_lesson_title is null or p_lesson_title <> btrim(p_lesson_title) or char_length(p_lesson_title) not between 1 and 200
  then raise exception 'Invalid Lesson title.' using errcode = '22023'; end if;
  if p_markdown_source is null or octet_length(p_markdown_source) not between 1 and 1048576
  then raise exception 'Invalid Markdown source.' using errcode = '22023'; end if;
  insert into public.lessons (room_id, course_section_id, subject_id, chapter_id, title, description, markdown_source)
  values (null, null, p_subject_id, p_chapter_id, p_lesson_title, nullif(p_lesson->>'description', ''), p_markdown_source)
  returning id, created_at into v_lesson_id, v_created_at;
  perform private.populate_lesson_content(v_lesson_id, p_lesson);
  return query select v_lesson_id, p_lesson_title, v_created_at;
end;
$$;

create function public.create_course_section_from_template(
  p_subject_id uuid, p_section_code text, p_display_name text
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare v_course_section_id uuid; v_template record;
begin
  if not private.is_permanent_user() then raise exception 'Teacher account required.' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_subject_id::text, 0));
  if not exists (select 1 from public.subjects where id = p_subject_id and teacher_id = auth.uid())
  then raise exception 'Subject is not available.' using errcode = '42501'; end if;
  if not exists (select 1 from public.lessons where subject_id = p_subject_id)
  then raise exception 'Create at least one template Lesson first.' using errcode = '23514'; end if;
  insert into public.course_sections (subject_id, section_code, display_name)
  values (p_subject_id, p_section_code, nullif(p_display_name, '')) returning id into v_course_section_id;
  insert into public.chapters (subject_id, course_section_id, name, created_at, updated_at)
  select null, v_course_section_id, name, created_at, updated_at
  from public.chapters where subject_id = p_subject_id
  order by lower(name), name;
  for v_template in select id from public.lessons where subject_id = p_subject_id order by created_at, id loop
    perform private.clone_lesson(v_template.id, null, v_course_section_id);
  end loop;
  return v_course_section_id;
end;
$$;

create function public.update_owned_lesson(
  p_lesson_id uuid, p_chapter_id uuid, p_lesson_title text, p_markdown_source text, p_lesson jsonb
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare v_subject_id uuid; v_course_section_id uuid;
begin
  if not private.is_permanent_user() then raise exception 'Teacher account required.' using errcode = '42501'; end if;
  select coalesce(lessons.subject_id, course_sections.subject_id), lessons.course_section_id
  into v_subject_id, v_course_section_id
  from public.lessons left join public.course_sections on course_sections.id = lessons.course_section_id
  join public.subjects on subjects.id = coalesce(lessons.subject_id, course_sections.subject_id)
  where lessons.id = p_lesson_id and subjects.teacher_id = auth.uid();
  if not found then raise exception 'Lesson is not available.' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_subject_id::text, 0));
  perform lessons.id from public.lessons where lessons.id = p_lesson_id for update;
  if not found then raise exception 'Lesson is not available.' using errcode = '42501'; end if;
  if not exists (
    select 1 from public.chapters
    where id = p_chapter_id
      and ((v_course_section_id is null and subject_id = v_subject_id)
        or (v_course_section_id is not null and course_section_id = v_course_section_id))
  )
  then raise exception 'Chapter is not available.' using errcode = '42501'; end if;
  if v_course_section_id is not null and exists (select 1 from public.rooms where lesson_id = p_lesson_id)
  then raise exception 'A Lesson with Session history cannot be edited.' using errcode = '23514'; end if;
  if p_lesson_title is null or p_lesson_title <> btrim(p_lesson_title) or char_length(p_lesson_title) not between 1 and 200
    or p_markdown_source is null or octet_length(p_markdown_source) not between 1 and 1048576
  then raise exception 'Invalid Lesson.' using errcode = '22023'; end if;
  delete from public.sections where lesson_id = p_lesson_id;
  update public.lessons set chapter_id = p_chapter_id, title = p_lesson_title,
    description = nullif(p_lesson->>'description', ''), markdown_source = p_markdown_source
  where id = p_lesson_id;
  perform private.populate_lesson_content(p_lesson_id, p_lesson);
  return p_lesson_id;
end;
$$;

create function public.delete_owned_lesson(p_lesson_id uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare v_subject_id uuid; v_course_section_id uuid;
begin
  if not private.is_permanent_user() then raise exception 'Teacher account required.' using errcode = '42501'; end if;
  select coalesce(lessons.subject_id, course_sections.subject_id), lessons.course_section_id
  into v_subject_id, v_course_section_id
  from public.lessons left join public.course_sections on course_sections.id = lessons.course_section_id
  join public.subjects on subjects.id = coalesce(lessons.subject_id, course_sections.subject_id)
  where lessons.id = p_lesson_id and subjects.teacher_id = auth.uid();
  if not found then raise exception 'Lesson is not available.' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_subject_id::text, 0));
  perform lessons.id from public.lessons where lessons.id = p_lesson_id for update;
  if not found then raise exception 'Lesson is not available.' using errcode = '42501'; end if;
  if v_course_section_id is not null and exists (select 1 from public.rooms where lesson_id = p_lesson_id)
  then raise exception 'A Lesson with Session history cannot be deleted.' using errcode = '23514'; end if;
  delete from public.lessons where id = p_lesson_id;
  return p_lesson_id;
end;
$$;

create function public.delete_subject_chapter(p_subject_id uuid, p_chapter_id uuid)
returns uuid language plpgsql security definer set search_path = ''
as $$
begin
  if not private.is_permanent_user() or not exists (
    select 1 from public.subjects where id = p_subject_id and teacher_id = auth.uid()
  ) then raise exception 'Subject is not available.' using errcode = '42501'; end if;
  if exists (select 1 from public.lessons where chapter_id = p_chapter_id)
  then raise exception 'Delete Lessons in this Chapter first.' using errcode = '23514'; end if;
  delete from public.chapters where id = p_chapter_id and subject_id = p_subject_id;
  if not found then raise exception 'Chapter is not available.' using errcode = '42501'; end if;
  return p_chapter_id;
end;
$$;

-- Preserve existing installations by deriving a template from one existing Course Section.
do $$
declare v_subject record; v_lesson record;
begin
  for v_subject in
    select subjects.id,
      (select course_sections.id from public.course_sections
       where course_sections.subject_id = subjects.id
         and exists (select 1 from public.lessons where lessons.course_section_id = course_sections.id)
       order by course_sections.created_at, course_sections.id limit 1) as source_course_section_id
    from public.subjects
    where not exists (select 1 from public.lessons where lessons.subject_id = subjects.id)
  loop
    if v_subject.source_course_section_id is not null then
      for v_lesson in select id from public.lessons
        where course_section_id = v_subject.source_course_section_id order by created_at, id
      loop perform private.clone_lesson(v_lesson.id, v_subject.id, null); end loop;
    end if;
  end loop;
end;
$$;

create or replace function public.delete_subject(p_subject_id uuid)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare target_subject public.subjects%rowtype;
begin
  if auth.uid() is null or not private.is_permanent_user() then
    raise exception 'Teacher account required.' using errcode = '42501';
  end if;
  select * into target_subject from public.subjects
  where id = p_subject_id and teacher_id = auth.uid() for update;
  if not found then raise exception 'Subject is not available.' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_subject_id::text, 0));
  delete from public.rooms where lesson_id in (
    select lessons.id from public.lessons join public.course_sections on course_sections.id = lessons.course_section_id
    where course_sections.subject_id = p_subject_id
  );
  delete from public.lessons where subject_id = p_subject_id or course_section_id in (
    select id from public.course_sections where subject_id = p_subject_id
  );
  delete from public.chapters where course_section_id in (
    select id from public.course_sections where subject_id = p_subject_id
  );
  delete from public.course_sections where subject_id = p_subject_id;
  delete from public.subjects where id = p_subject_id;
  return p_subject_id;
end;
$$;

revoke all on function public.create_subject_template_lesson(uuid, uuid, text, text, jsonb) from public, anon;
revoke all on function public.create_course_section_from_template(uuid, text, text) from public, anon;
revoke all on function public.update_owned_lesson(uuid, uuid, text, text, jsonb) from public, anon;
revoke all on function public.delete_owned_lesson(uuid) from public, anon;
revoke all on function public.delete_subject_chapter(uuid, uuid) from public, anon;
grant execute on function public.create_subject_template_lesson(uuid, uuid, text, text, jsonb) to authenticated;
grant execute on function public.create_course_section_from_template(uuid, text, text) to authenticated;
grant execute on function public.update_owned_lesson(uuid, uuid, text, text, jsonb) to authenticated;
grant execute on function public.delete_owned_lesson(uuid) to authenticated;
grant execute on function public.delete_subject_chapter(uuid, uuid) to authenticated;

create or replace function public.create_course_section_lesson(
  p_course_section_id uuid, p_chapter_id uuid, p_lesson_title text, p_markdown_source text, p_lesson jsonb
)
returns table (lesson_id uuid, lesson_title text, lesson_created_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare v_lesson record; v_course_chapter_id uuid; v_subject_id uuid;
begin
  if not private.is_permanent_user() then raise exception 'Teacher account required.' using errcode = '42501'; end if;
  select course_sections.subject_id into v_subject_id from public.course_sections
  join public.subjects on subjects.id = course_sections.subject_id
  where course_sections.id = p_course_section_id and subjects.teacher_id = auth.uid();
  if v_subject_id is null then raise exception 'Chapter is not available for this Course Section.' using errcode = '42501'; end if;
  select id into v_course_chapter_id from public.chapters
  where id = p_chapter_id and course_section_id = p_course_section_id;
  if v_course_chapter_id is null then
    insert into public.chapters (subject_id, course_section_id, name)
    select null, p_course_section_id, name from public.chapters
    where id = p_chapter_id and subject_id = v_subject_id
    on conflict (course_section_id, lower(name)) where course_section_id is not null
    do update set name = excluded.name
    returning id into v_course_chapter_id;
  end if;
  if v_course_chapter_id is null then raise exception 'Chapter is not available for this Course Section.' using errcode = '42501'; end if;
  select * into v_lesson from public.create_course_section_lesson(p_course_section_id, p_lesson_title, p_markdown_source, p_lesson);
  update public.lessons set chapter_id = v_course_chapter_id where id = v_lesson.lesson_id;
  return query select v_lesson.lesson_id, v_lesson.lesson_title, v_lesson.lesson_created_at;
end;
$$;

create function public.delete_course_section(p_subject_id uuid, p_course_section_id uuid)
returns uuid language plpgsql security definer set search_path = ''
as $$
begin
  if not private.is_permanent_user() or not exists (
    select 1 from public.course_sections join public.subjects on subjects.id = course_sections.subject_id
    where course_sections.id = p_course_section_id and subjects.id = p_subject_id and subjects.teacher_id = auth.uid()
  ) then raise exception 'Course Section is not available.' using errcode = '42501'; end if;
  delete from public.rooms where lesson_id in (select id from public.lessons where course_section_id = p_course_section_id);
  delete from public.lessons where course_section_id = p_course_section_id;
  delete from public.chapters where course_section_id = p_course_section_id;
  delete from public.course_sections where id = p_course_section_id;
  return p_course_section_id;
end;
$$;

create or replace function public.get_public_course_section_lessons(p_course_section_id uuid)
returns table (lesson_id uuid, chapter_id uuid, lesson_title text, lesson_status text)
language sql stable security definer set search_path = ''
as $$
  select lessons.id, lessons.chapter_id, lessons.title, private.public_lesson_status(lessons.id)
  from public.lessons
  join public.chapters on chapters.id = lessons.chapter_id
  where lessons.course_section_id = p_course_section_id
    and chapters.course_section_id = p_course_section_id
  order by lessons.created_at desc;
$$;

create or replace function public.get_public_course_section_chapters(p_course_section_id uuid)
returns table (chapter_id uuid, chapter_name text)
language sql stable security definer set search_path = ''
as $$
  select chapters.id, chapters.name from public.chapters
  where chapters.course_section_id = p_course_section_id
  order by lower(chapters.name), chapters.name;
$$;

revoke all on function public.delete_course_section(uuid, uuid) from public, anon;
grant execute on function public.delete_course_section(uuid, uuid) to authenticated;
