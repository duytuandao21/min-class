create table public.course_section_students (
  id uuid primary key default gen_random_uuid(),
  course_section_id uuid not null references public.course_sections(id) on delete cascade,
  mssv text not null,
  normalized_mssv text generated always as (upper(btrim(mssv))) stored,
  created_at timestamptz not null default now(),
  constraint course_section_students_mssv_valid check (
    mssv = upper(btrim(mssv))
    and mssv ~ '^[A-Z0-9][A-Z0-9._-]{2,31}$'
  ),
  constraint course_section_students_mssv_unique unique (course_section_id, normalized_mssv)
);

create index course_section_students_section_created_idx
on public.course_section_students (course_section_id, created_at);

alter table public.course_section_students enable row level security;

revoke all on table public.course_section_students from public, anon, authenticated;
grant select, insert, update, delete on table public.course_section_students to authenticated;

create policy course_section_students_teacher_select
on public.course_section_students for select to authenticated
using (
  coalesce((auth.jwt()->>'is_anonymous')::boolean, true) is false
  and lower(coalesce(auth.jwt()->>'email', '')) = 'thaybao@minclass.local'
  and exists (
    select 1
    from public.course_sections
    join public.subjects on subjects.id = course_sections.subject_id
    where course_sections.id = course_section_students.course_section_id
      and subjects.teacher_id = auth.uid()
  )
);

create policy course_section_students_teacher_insert
on public.course_section_students for insert to authenticated
with check (
  coalesce((auth.jwt()->>'is_anonymous')::boolean, true) is false
  and lower(coalesce(auth.jwt()->>'email', '')) = 'thaybao@minclass.local'
  and exists (
    select 1
    from public.course_sections
    join public.subjects on subjects.id = course_sections.subject_id
    where course_sections.id = course_section_students.course_section_id
      and subjects.teacher_id = auth.uid()
  )
);

create policy course_section_students_teacher_update
on public.course_section_students for update to authenticated
using (
  coalesce((auth.jwt()->>'is_anonymous')::boolean, true) is false
  and lower(coalesce(auth.jwt()->>'email', '')) = 'thaybao@minclass.local'
  and exists (
    select 1
    from public.course_sections
    join public.subjects on subjects.id = course_sections.subject_id
    where course_sections.id = course_section_students.course_section_id
      and subjects.teacher_id = auth.uid()
  )
)
with check (
  coalesce((auth.jwt()->>'is_anonymous')::boolean, true) is false
  and lower(coalesce(auth.jwt()->>'email', '')) = 'thaybao@minclass.local'
  and exists (
    select 1
    from public.course_sections
    join public.subjects on subjects.id = course_sections.subject_id
    where course_sections.id = course_section_students.course_section_id
      and subjects.teacher_id = auth.uid()
  )
);

create policy course_section_students_teacher_delete
on public.course_section_students for delete to authenticated
using (
  coalesce((auth.jwt()->>'is_anonymous')::boolean, true) is false
  and lower(coalesce(auth.jwt()->>'email', '')) = 'thaybao@minclass.local'
  and exists (
    select 1
    from public.course_sections
    join public.subjects on subjects.id = course_sections.subject_id
    where course_sections.id = course_section_students.course_section_id
      and subjects.teacher_id = auth.uid()
  )
);

create function public.replace_course_section_roster(
  p_course_section_id uuid,
  p_mssv text[]
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer := coalesce(array_length(p_mssv, 1), 0);
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

  if v_count < 1 or v_count > 2000 then
    raise exception using errcode = '22023', message = 'Roster must contain between 1 and 2000 MSSV values.';
  end if;

  if exists (
    select 1
    from unnest(p_mssv) as roster(mssv)
    where roster.mssv is null
      or roster.mssv <> upper(btrim(roster.mssv))
      or roster.mssv !~ '^[A-Z0-9][A-Z0-9._-]{2,31}$'
  ) then
    raise exception using errcode = '22023', message = 'Roster contains an invalid MSSV.';
  end if;

  if (select count(distinct roster.mssv) from unnest(p_mssv) as roster(mssv)) <> v_count then
    raise exception using errcode = '23505', message = 'Roster contains duplicate MSSV values.';
  end if;

  delete from public.course_section_students
  where course_section_id = p_course_section_id;

  insert into public.course_section_students (course_section_id, mssv)
  select p_course_section_id, roster.mssv
  from unnest(p_mssv) with ordinality as roster(mssv, position)
  order by roster.position;

  return v_count;
end;
$$;

revoke all on function public.replace_course_section_roster(uuid, text[]) from public, anon;
grant execute on function public.replace_course_section_roster(uuid, text[]) to authenticated;
