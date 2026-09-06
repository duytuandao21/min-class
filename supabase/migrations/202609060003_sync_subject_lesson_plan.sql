-- Keep the relationship between Subject templates and their independent
-- Course Section copies. A null source means the Course copy was customized.
alter table public.chapters
add column template_chapter_id uuid references public.chapters(id) on delete set null;

alter table public.chapters
add constraint chapters_template_source_course_only check (
  template_chapter_id is null or course_section_id is not null
);

create unique index chapters_course_template_unique_idx
on public.chapters(course_section_id, template_chapter_id)
where template_chapter_id is not null;

alter table public.lessons
add column template_lesson_id uuid references public.lessons(id) on delete set null;

alter table public.lessons
add constraint lessons_template_source_course_only check (
  template_lesson_id is null or course_section_id is not null
);

create unique index lessons_course_template_unique_idx
on public.lessons(course_section_id, template_lesson_id)
where template_lesson_id is not null;

create function private.enforce_template_source_ownership()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_table_name = 'chapters' then
    if new.template_chapter_id is not null and not exists (
      select 1 from public.course_sections course_section
      join public.chapters template_chapter
        on template_chapter.id = new.template_chapter_id
       and template_chapter.subject_id = course_section.subject_id
       and template_chapter.course_section_id is null
      where course_section.id = new.course_section_id
    ) then raise exception 'Template Chapter must belong to the same Subject.' using errcode = '23514'; end if;
    return new;
  end if;

  if new.template_lesson_id is not null and not exists (
    select 1 from public.course_sections course_section
    join public.lessons template_lesson
      on template_lesson.id = new.template_lesson_id
     and template_lesson.subject_id = course_section.subject_id
     and template_lesson.course_section_id is null
    where course_section.id = new.course_section_id
  ) then raise exception 'Template Lesson must belong to the same Subject.' using errcode = '23514'; end if;
  return new;
end;
$$;

create trigger chapters_enforce_template_source_ownership
before insert or update of course_section_id, template_chapter_id on public.chapters
for each row execute function private.enforce_template_source_ownership();

create trigger lessons_enforce_template_source_ownership
before insert or update of course_section_id, template_lesson_id on public.lessons
for each row execute function private.enforce_template_source_ownership();

revoke all on function private.enforce_template_source_ownership()
from public, anon, authenticated;

-- Link legacy copies only when their Chapter and complete Markdown still match.
update public.chapters course_chapter
set template_chapter_id = template_chapter.id
from public.course_sections course_section,
     public.chapters template_chapter
where course_chapter.course_section_id = course_section.id
  and template_chapter.subject_id = course_section.subject_id
  and lower(template_chapter.name) = lower(course_chapter.name)
  and course_chapter.template_chapter_id is null;

with template_ranked as (
  select lesson.id, lesson.subject_id, lesson.chapter_id, lesson.title,
    lesson.markdown_source,
    row_number() over (
      partition by lesson.subject_id, lesson.chapter_id, lesson.title, lesson.markdown_source
      order by lesson.created_at, lesson.id
    ) as match_number
  from public.lessons lesson
  where lesson.subject_id is not null
), course_ranked as (
  select lesson.id, lesson.course_section_id, chapter.template_chapter_id,
    lesson.title, lesson.markdown_source,
    row_number() over (
      partition by lesson.course_section_id, chapter.template_chapter_id,
        lesson.title, lesson.markdown_source
      order by lesson.created_at, lesson.id
    ) as match_number
  from public.lessons lesson
  join public.chapters chapter on chapter.id = lesson.chapter_id
  where lesson.course_section_id is not null
    and chapter.template_chapter_id is not null
)
update public.lessons course_lesson
set template_lesson_id = template_ranked.id
from course_ranked
join template_ranked
  on template_ranked.chapter_id = course_ranked.template_chapter_id
 and template_ranked.title = course_ranked.title
 and template_ranked.markdown_source = course_ranked.markdown_source
 and template_ranked.match_number = course_ranked.match_number
where course_lesson.id = course_ranked.id
  and course_lesson.template_lesson_id is null;

create function private.lesson_has_any_session(p_lesson_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.session_lessons where lesson_id = p_lesson_id
  ) or exists (
    select 1 from public.rooms where lesson_id = p_lesson_id
  );
$$;
revoke all on function private.lesson_has_any_session(uuid) from public, anon, authenticated;

create function private.replace_lesson_from_payload(
  p_lesson_id uuid,
  p_chapter_id uuid,
  p_lesson_title text,
  p_markdown_source text,
  p_lesson jsonb
)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.sections where lesson_id = p_lesson_id;
  update public.lessons
  set chapter_id = p_chapter_id,
      title = p_lesson_title,
      description = nullif(p_lesson->>'description', ''),
      markdown_source = p_markdown_source
  where id = p_lesson_id;
  perform private.populate_lesson_content(p_lesson_id, p_lesson);
end;
$$;
revoke all on function private.replace_lesson_from_payload(uuid, uuid, text, text, jsonb)
from public, anon, authenticated;

-- Clone into the linked Chapter directly, even if that Course Section kept a
-- custom Chapter name after opting out of a previous rename.
create function private.clone_lesson_to_course_chapter(
  p_source_lesson_id uuid, p_course_section_id uuid, p_target_chapter_id uuid
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_target_lesson_id uuid;
  v_source_section record;
  v_source_question record;
  v_source_option record;
  v_target_section_id uuid;
  v_target_quiz_id uuid;
  v_target_question_id uuid;
  v_target_option_id uuid;
  v_correct_ids uuid[];
begin
  if not exists (
    select 1 from public.chapters
    where id = p_target_chapter_id and course_section_id = p_course_section_id
  ) then raise exception 'Target Chapter is not available.' using errcode = '23514'; end if;

  insert into public.lessons
    (room_id, subject_id, course_section_id, chapter_id, title, description, markdown_source, metadata)
  select null, null, p_course_section_id, p_target_chapter_id,
    title, description, markdown_source, metadata
  from public.lessons where id = p_source_lesson_id
  returning id into v_target_lesson_id;

  for v_source_section in
    select * from public.sections where lesson_id = p_source_lesson_id order by position
  loop
    insert into public.sections (lesson_id, position, type, title, content_md)
    values (v_target_lesson_id, v_source_section.position, v_source_section.type,
      v_source_section.title, v_source_section.content_md)
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
        values (v_target_quiz_id, v_source_question.position,
          v_source_question.type, v_source_question.question_text)
        returning id into v_target_question_id;
        v_correct_ids := '{}'::uuid[];
        for v_source_option in
          select * from public.quiz_options where question_id = v_source_question.id order by position
        loop
          insert into public.quiz_options (question_id, position, content)
          values (v_target_question_id, v_source_option.position, v_source_option.content)
          returning id into v_target_option_id;
          if exists (
            select 1 from public.quiz_answer_keys
            where question_id = v_source_question.id
              and v_source_option.id = any(correct_option_ids)
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
revoke all on function private.clone_lesson_to_course_chapter(uuid, uuid, uuid)
from public, anon, authenticated;

create function public.create_subject_chapter_synced(
  p_subject_id uuid,
  p_name text,
  p_apply_to_existing boolean default true
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_chapter_id uuid;
  v_applied integer := 0;
  v_total integer := 0;
begin
  if not private.is_permanent_user() or not exists (
    select 1 from public.subjects
    where id = p_subject_id and teacher_id = auth.uid()
  ) then raise exception 'Subject is not available.' using errcode = '42501'; end if;
  if p_name is null or p_name <> btrim(p_name) or char_length(p_name) not between 1 and 120
  then raise exception 'Invalid Chapter.' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_subject_id::text, 0));
  insert into public.chapters(subject_id, name)
  values (p_subject_id, p_name) returning id into v_chapter_id;
  if coalesce(p_apply_to_existing, true) then
    insert into public.chapters(course_section_id, name, template_chapter_id)
    select id, p_name, v_chapter_id
    from public.course_sections course_section
    where subject_id = p_subject_id
      and not exists (
        select 1 from public.chapters existing
        where existing.course_section_id = course_section.id
          and lower(existing.name) = lower(p_name)
      );
    get diagnostics v_applied = row_count;
    select count(*) into v_total from public.course_sections where subject_id = p_subject_id;
  end if;
  return jsonb_build_object('chapterId', v_chapter_id, 'appliedCount', v_applied,
    'skippedCount', greatest(v_total - v_applied, 0));
end;
$$;

create function public.update_subject_chapter_synced(
  p_subject_id uuid,
  p_chapter_id uuid,
  p_name text,
  p_apply_to_existing boolean default true
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_applied integer := 0; v_total integer := 0;
begin
  if not private.is_permanent_user() or not exists (
    select 1 from public.chapters chapter
    join public.subjects subject on subject.id = chapter.subject_id
    where chapter.id = p_chapter_id and subject.id = p_subject_id
      and subject.teacher_id = auth.uid()
  ) then raise exception 'Chapter is not available.' using errcode = '42501'; end if;
  if p_name is null or p_name <> btrim(p_name) or char_length(p_name) not between 1 and 120
  then raise exception 'Invalid Chapter.' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_subject_id::text, 0));
  update public.chapters set name = p_name where id = p_chapter_id;
  if coalesce(p_apply_to_existing, true) then
    update public.chapters set name = p_name
    where template_chapter_id = p_chapter_id
      and not exists (
        select 1 from public.chapters existing
        where existing.course_section_id = chapters.course_section_id
          and existing.id <> chapters.id
          and lower(existing.name) = lower(p_name)
      );
    get diagnostics v_applied = row_count;
    select count(*) into v_total from public.chapters where template_chapter_id = p_chapter_id;
  end if;
  return jsonb_build_object('chapterId', p_chapter_id, 'appliedCount', v_applied,
    'skippedCount', greatest(v_total - v_applied, 0));
end;
$$;

create function public.delete_subject_chapter_synced(
  p_subject_id uuid,
  p_chapter_id uuid,
  p_apply_to_existing boolean default true
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_applied integer := 0; v_detached integer := 0;
begin
  if not private.is_permanent_user() or not exists (
    select 1 from public.chapters chapter
    join public.subjects subject on subject.id = chapter.subject_id
    where chapter.id = p_chapter_id and subject.id = p_subject_id
      and subject.teacher_id = auth.uid()
  ) then raise exception 'Chapter is not available.' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_subject_id::text, 0));
  if exists (select 1 from public.lessons where chapter_id = p_chapter_id)
  then raise exception 'Delete Lessons in this Chapter first.' using errcode = '23514'; end if;
  if coalesce(p_apply_to_existing, true) then
    delete from public.chapters chapter
    where chapter.template_chapter_id = p_chapter_id
      and not exists (select 1 from public.lessons where chapter_id = chapter.id);
    get diagnostics v_applied = row_count;
    update public.chapters set template_chapter_id = null
    where template_chapter_id = p_chapter_id;
    get diagnostics v_detached = row_count;
  end if;
  delete from public.chapters where id = p_chapter_id and subject_id = p_subject_id;
  return jsonb_build_object('chapterId', p_chapter_id,
    'appliedCount', v_applied, 'skippedCount', v_detached);
end;
$$;

create function public.create_subject_template_lesson_synced(
  p_subject_id uuid,
  p_chapter_id uuid,
  p_lesson_title text,
  p_markdown_source text,
  p_lesson jsonb,
  p_apply_to_existing boolean default true
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_template_id uuid;
  v_target record;
  v_target_chapter_id uuid;
  v_copy_id uuid;
  v_applied integer := 0;
  v_skipped integer := 0;
begin
  select lesson_id into v_template_id
  from public.create_subject_template_lesson(
    p_subject_id, p_chapter_id, p_lesson_title, p_markdown_source, p_lesson
  );
  if coalesce(p_apply_to_existing, true) then
    for v_target in
      select course_section.id as course_section_id, chapter.id as chapter_id
      from public.course_sections course_section
      left join public.chapters chapter
        on chapter.course_section_id = course_section.id
       and chapter.template_chapter_id = p_chapter_id
      where course_section.subject_id = p_subject_id
      order by course_section.id
    loop
      v_target_chapter_id := v_target.chapter_id;
      if v_target_chapter_id is null then
        insert into public.chapters(course_section_id, name, template_chapter_id)
        select v_target.course_section_id, template_chapter.name, p_chapter_id
        from public.chapters template_chapter
        where template_chapter.id = p_chapter_id
          and not exists (
            select 1 from public.chapters existing
            where existing.course_section_id = v_target.course_section_id
              and lower(existing.name) = lower(template_chapter.name)
          )
        returning id into v_target_chapter_id;
      end if;
      if v_target_chapter_id is null then
        v_skipped := v_skipped + 1;
      else
        v_copy_id := private.clone_lesson_to_course_chapter(
          v_template_id, v_target.course_section_id, v_target_chapter_id
        );
        update public.lessons set template_lesson_id = v_template_id
        where id = v_copy_id;
        v_applied := v_applied + 1;
      end if;
    end loop;
  end if;
  return jsonb_build_object('lessonId', v_template_id,
    'appliedCount', v_applied, 'skippedCount', v_skipped);
end;
$$;

create function public.update_course_section_chapter_independent(
  p_subject_id uuid,
  p_course_section_id uuid,
  p_chapter_id uuid,
  p_name text
)
returns uuid language plpgsql security definer set search_path = ''
as $$
begin
  if not private.is_permanent_user() or not exists (
    select 1 from public.chapters chapter
    join public.course_sections course_section on course_section.id = chapter.course_section_id
    join public.subjects subject on subject.id = course_section.subject_id
    where chapter.id = p_chapter_id
      and course_section.id = p_course_section_id
      and subject.id = p_subject_id
      and subject.teacher_id = auth.uid()
  ) then raise exception 'Chapter is not available.' using errcode = '42501'; end if;
  if p_name is null or p_name <> btrim(p_name) or char_length(p_name) not between 1 and 120
  then raise exception 'Invalid Chapter.' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_subject_id::text, 0));
  update public.chapters
  set name = p_name, template_chapter_id = null
  where id = p_chapter_id and course_section_id = p_course_section_id;
  update public.lessons set template_lesson_id = null
  where course_section_id = p_course_section_id and chapter_id = p_chapter_id;
  return p_chapter_id;
end;
$$;

create function public.update_subject_template_lesson_synced(
  p_subject_id uuid,
  p_lesson_id uuid,
  p_chapter_id uuid,
  p_lesson_title text,
  p_markdown_source text,
  p_lesson jsonb,
  p_apply_to_existing boolean default true
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_target record;
  v_target_chapter_id uuid;
  v_applied integer := 0;
  v_skipped integer := 0;
begin
  if not private.is_permanent_user() or not exists (
    select 1 from public.lessons
    join public.subjects on subjects.id = lessons.subject_id
    where lessons.id = p_lesson_id and subjects.id = p_subject_id
      and subjects.teacher_id = auth.uid()
  ) then raise exception 'Lesson is not available.' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_subject_id::text, 0));
  perform public.update_owned_lesson(
    p_lesson_id, p_chapter_id, p_lesson_title, p_markdown_source, p_lesson
  );
  if coalesce(p_apply_to_existing, true) then
    for v_target in
      select id, course_section_id
      from public.lessons
      where template_lesson_id = p_lesson_id
      order by course_section_id, id
      for update
    loop
      if private.lesson_has_any_session(v_target.id) then
        v_skipped := v_skipped + 1;
      else
        select id into v_target_chapter_id
        from public.chapters
        where course_section_id = v_target.course_section_id
          and template_chapter_id = p_chapter_id;
        if v_target_chapter_id is null then
          insert into public.chapters(course_section_id, name, template_chapter_id)
          select v_target.course_section_id, template_chapter.name, p_chapter_id
          from public.chapters template_chapter
          where template_chapter.id = p_chapter_id
            and not exists (
              select 1 from public.chapters existing
              where existing.course_section_id = v_target.course_section_id
                and lower(existing.name) = lower(template_chapter.name)
            )
          returning id into v_target_chapter_id;
        end if;
        if v_target_chapter_id is null then
          v_skipped := v_skipped + 1;
        else
          perform private.replace_lesson_from_payload(
            v_target.id, v_target_chapter_id, p_lesson_title, p_markdown_source, p_lesson
          );
          v_applied := v_applied + 1;
        end if;
      end if;
    end loop;
  end if;
  return jsonb_build_object('lessonId', p_lesson_id,
    'appliedCount', v_applied, 'skippedCount', v_skipped);
end;
$$;

create function public.delete_subject_template_lesson_synced(
  p_subject_id uuid,
  p_lesson_id uuid,
  p_apply_to_existing boolean default true
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_target record; v_applied integer := 0; v_skipped integer := 0;
begin
  if not private.is_permanent_user() or not exists (
    select 1 from public.lessons
    join public.subjects on subjects.id = lessons.subject_id
    where lessons.id = p_lesson_id and subjects.id = p_subject_id
      and subjects.teacher_id = auth.uid()
  ) then raise exception 'Lesson is not available.' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_subject_id::text, 0));
  if coalesce(p_apply_to_existing, true) then
    for v_target in
      select id from public.lessons
      where template_lesson_id = p_lesson_id
      order by id for update
    loop
      if private.lesson_has_any_session(v_target.id) then
        update public.lessons set template_lesson_id = null where id = v_target.id;
        v_skipped := v_skipped + 1;
      else
        delete from public.lessons where id = v_target.id;
        v_applied := v_applied + 1;
      end if;
    end loop;
  end if;
  perform public.delete_owned_lesson(p_lesson_id);
  return jsonb_build_object('lessonId', p_lesson_id,
    'appliedCount', v_applied, 'skippedCount', v_skipped);
end;
$$;

-- New Course Sections retain source links for subsequent Lesson Plan syncs.
create or replace function public.create_course_section_from_template(
  p_subject_id uuid, p_section_code text, p_display_name text
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_course_section_id uuid; v_template record; v_copy_id uuid;
begin
  if not private.is_permanent_user() then raise exception 'Teacher account required.' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_subject_id::text, 0));
  if not exists (select 1 from public.subjects where id = p_subject_id and teacher_id = auth.uid())
  then raise exception 'Subject is not available.' using errcode = '42501'; end if;
  if not exists (select 1 from public.lessons where subject_id = p_subject_id)
  then raise exception 'Create at least one template Lesson first.' using errcode = '23514'; end if;
  insert into public.course_sections(subject_id, section_code, display_name)
  values (p_subject_id, p_section_code, nullif(p_display_name, ''))
  returning id into v_course_section_id;
  insert into public.chapters(subject_id, course_section_id, name, created_at,
    updated_at, template_chapter_id)
  select null, v_course_section_id, name, created_at, updated_at, id
  from public.chapters where subject_id = p_subject_id
  order by lower(name), name;
  for v_template in
    select id from public.lessons where subject_id = p_subject_id order by created_at, id
  loop
    v_copy_id := private.clone_lesson(v_template.id, null, v_course_section_id);
    update public.lessons set template_lesson_id = v_template.id where id = v_copy_id;
  end loop;
  return v_course_section_id;
end;
$$;

-- Editing a Course Lesson makes that copy independent from later template edits.
create or replace function public.update_owned_lesson(
  p_lesson_id uuid, p_chapter_id uuid, p_lesson_title text,
  p_markdown_source text, p_lesson jsonb
)
returns uuid language plpgsql security definer set search_path = ''
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
  perform lessons.id from public.lessons where id = p_lesson_id for update;
  if not exists (
    select 1 from public.chapters where id = p_chapter_id
      and ((v_course_section_id is null and subject_id = v_subject_id)
        or (v_course_section_id is not null and course_section_id = v_course_section_id))
  ) then raise exception 'Chapter is not available.' using errcode = '42501'; end if;
  if v_course_section_id is not null and private.lesson_has_any_session(p_lesson_id)
  then raise exception 'A Lesson with Session history cannot be edited.' using errcode = '23514'; end if;
  if p_lesson_title is null or p_lesson_title <> btrim(p_lesson_title)
    or char_length(p_lesson_title) not between 1 and 200
    or p_markdown_source is null or octet_length(p_markdown_source) not between 1 and 1048576
  then raise exception 'Invalid Lesson.' using errcode = '22023'; end if;
  perform private.replace_lesson_from_payload(
    p_lesson_id, p_chapter_id, p_lesson_title, p_markdown_source, p_lesson
  );
  if v_course_section_id is not null then
    update public.lessons set template_lesson_id = null where id = p_lesson_id;
  end if;
  return p_lesson_id;
end;
$$;

revoke all on function public.create_subject_chapter_synced(uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.update_subject_chapter_synced(uuid, uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.delete_subject_chapter_synced(uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function public.create_subject_template_lesson_synced(uuid, uuid, text, text, jsonb, boolean) from public, anon, authenticated;
revoke all on function public.update_subject_template_lesson_synced(uuid, uuid, uuid, text, text, jsonb, boolean) from public, anon, authenticated;
revoke all on function public.delete_subject_template_lesson_synced(uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function public.update_course_section_chapter_independent(uuid, uuid, uuid, text) from public, anon, authenticated;

grant execute on function public.create_subject_chapter_synced(uuid, text, boolean) to authenticated;
grant execute on function public.update_subject_chapter_synced(uuid, uuid, text, boolean) to authenticated;
grant execute on function public.delete_subject_chapter_synced(uuid, uuid, boolean) to authenticated;
grant execute on function public.create_subject_template_lesson_synced(uuid, uuid, text, text, jsonb, boolean) to authenticated;
grant execute on function public.update_subject_template_lesson_synced(uuid, uuid, uuid, text, text, jsonb, boolean) to authenticated;
grant execute on function public.delete_subject_template_lesson_synced(uuid, uuid, boolean) to authenticated;
grant execute on function public.update_course_section_chapter_independent(uuid, uuid, uuid, text) to authenticated;
