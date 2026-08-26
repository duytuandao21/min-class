create table public.chapters (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chapters_name_valid check (
    name = btrim(name)
    and char_length(name) between 1 and 120
  )
);

create unique index chapters_subject_name_unique_idx
on public.chapters (subject_id, lower(name));

create index chapters_subject_name_idx
on public.chapters (subject_id, lower(name), name);

create trigger chapters_set_updated_at
before update on public.chapters
for each row execute function private.set_updated_at();

alter table public.chapters enable row level security;

revoke all on table public.chapters from public, anon, authenticated;
grant select, insert, update on table public.chapters to authenticated;

create policy chapters_teacher_select
on public.chapters for select to authenticated
using (
  coalesce((auth.jwt()->>'is_anonymous')::boolean, true) is false
  and lower(coalesce(auth.jwt()->>'email', '')) = 'thaybao@minclass.local'
  and exists (
    select 1
    from public.subjects
    where subjects.id = chapters.subject_id
      and subjects.teacher_id = auth.uid()
  )
);

create policy chapters_teacher_insert
on public.chapters for insert to authenticated
with check (
  coalesce((auth.jwt()->>'is_anonymous')::boolean, true) is false
  and lower(coalesce(auth.jwt()->>'email', '')) = 'thaybao@minclass.local'
  and exists (
    select 1
    from public.subjects
    where subjects.id = chapters.subject_id
      and subjects.teacher_id = auth.uid()
  )
);

create policy chapters_teacher_update
on public.chapters for update to authenticated
using (
  coalesce((auth.jwt()->>'is_anonymous')::boolean, true) is false
  and lower(coalesce(auth.jwt()->>'email', '')) = 'thaybao@minclass.local'
  and exists (
    select 1
    from public.subjects
    where subjects.id = chapters.subject_id
      and subjects.teacher_id = auth.uid()
  )
)
with check (
  coalesce((auth.jwt()->>'is_anonymous')::boolean, true) is false
  and lower(coalesce(auth.jwt()->>'email', '')) = 'thaybao@minclass.local'
  and exists (
    select 1
    from public.subjects
    where subjects.id = chapters.subject_id
      and subjects.teacher_id = auth.uid()
  )
);

create function private.keep_chapter_subject_immutable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.subject_id <> old.subject_id then
    raise exception 'Chapter cannot move to another Subject.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger chapters_keep_subject_immutable
before update of subject_id on public.chapters
for each row execute function private.keep_chapter_subject_immutable();

alter table public.lessons
add column chapter_id uuid references public.chapters(id) on delete restrict;

insert into public.chapters (subject_id, name)
select distinct course_sections.subject_id, 'Chưa phân chương'
from public.lessons
join public.course_sections on course_sections.id = lessons.course_section_id
where lessons.course_section_id is not null;

update public.lessons
set chapter_id = chapters.id
from public.course_sections, public.chapters
where lessons.course_section_id = course_sections.id
  and chapters.subject_id = course_sections.subject_id
  and chapters.name = 'Chưa phân chương';

create index lessons_chapter_created_idx
on public.lessons (chapter_id, created_at desc)
where chapter_id is not null;

create function private.enforce_lesson_chapter_subject()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_course_section_id uuid;
  v_chapter_id uuid;
  v_course_subject_id uuid;
  v_chapter_subject_id uuid;
begin
  select
    lessons.course_section_id,
    lessons.chapter_id,
    course_sections.subject_id,
    chapters.subject_id
  into
    v_course_section_id,
    v_chapter_id,
    v_course_subject_id,
    v_chapter_subject_id
  from public.lessons
  left join public.course_sections on course_sections.id = lessons.course_section_id
  left join public.chapters on chapters.id = lessons.chapter_id
  where lessons.id = new.id;

  if not found then
    return null;
  end if;

  if v_course_section_id is null then
    if v_chapter_id is not null then
      raise exception 'Legacy Room Lesson cannot reference a Chapter.' using errcode = '23514';
    end if;
  elsif v_chapter_id is null or v_course_subject_id is distinct from v_chapter_subject_id then
    raise exception 'Lesson Chapter must belong to the Course Section Subject.' using errcode = '23514';
  end if;

  return null;
end;
$$;

create constraint trigger lessons_enforce_chapter_subject
after insert or update of course_section_id, chapter_id on public.lessons
deferrable initially deferred
for each row execute function private.enforce_lesson_chapter_subject();

create function public.create_course_section_lesson(
  p_course_section_id uuid,
  p_chapter_id uuid,
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
  v_lesson record;
begin
  if coalesce((auth.jwt()->>'is_anonymous')::boolean, true)
    or lower(coalesce(auth.jwt()->>'email', '')) <> 'thaybao@minclass.local'
  then
    raise exception 'Teacher account required.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.chapters
    join public.subjects on subjects.id = chapters.subject_id
    join public.course_sections on course_sections.subject_id = subjects.id
    where chapters.id = p_chapter_id
      and course_sections.id = p_course_section_id
      and subjects.teacher_id = auth.uid()
  ) then
    raise exception 'Chapter is not available for this Course Section.' using errcode = '42501';
  end if;

  select *
  into v_lesson
  from public.create_course_section_lesson(
    p_course_section_id,
    p_lesson_title,
    p_markdown_source,
    p_lesson
  );

  update public.lessons
  set chapter_id = p_chapter_id
  where lessons.id = v_lesson.lesson_id;

  return query
  select
    v_lesson.lesson_id,
    v_lesson.lesson_title,
    v_lesson.lesson_created_at;
end;
$$;

revoke all on function public.create_course_section_lesson(uuid, text, text, jsonb) from authenticated;
revoke all on function public.create_course_section_lesson(uuid, uuid, text, text, jsonb) from public, anon;
grant execute on function public.create_course_section_lesson(uuid, uuid, text, text, jsonb) to authenticated;
