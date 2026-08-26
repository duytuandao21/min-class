create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  code text,
  created_at timestamptz not null default now(),
  constraint subjects_name_valid check (char_length(btrim(name)) between 1 and 120 and name = btrim(name)),
  constraint subjects_code_valid check (
    code is null
    or (code = upper(btrim(code)) and code ~ '^[A-Z0-9][A-Z0-9._-]{1,31}$')
  ),
  constraint subjects_teacher_code_unique unique nulls not distinct (teacher_id, code)
);

create table public.course_sections (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  section_code text not null,
  display_name text,
  created_at timestamptz not null default now(),
  constraint course_sections_code_valid check (
    section_code = upper(btrim(section_code))
    and section_code ~ '^[A-Z0-9][A-Z0-9._-]{2,31}$'
  ),
  constraint course_sections_display_name_valid check (
    display_name is null
    or (char_length(btrim(display_name)) between 1 and 120 and display_name = btrim(display_name))
  ),
  constraint course_sections_subject_code_unique unique (subject_id, section_code)
);

create index subjects_teacher_created_idx on public.subjects (teacher_id, created_at desc);
create index course_sections_subject_created_idx on public.course_sections (subject_id, created_at);

alter table public.subjects enable row level security;
alter table public.course_sections enable row level security;

revoke all on table public.subjects from public, anon, authenticated;
revoke all on table public.course_sections from public, anon, authenticated;
grant select, insert, update, delete on table public.subjects to authenticated;
grant select, insert, update, delete on table public.course_sections to authenticated;

create policy subjects_teacher_select
on public.subjects for select to authenticated
using (
  auth.uid() = teacher_id
  and coalesce((auth.jwt()->>'is_anonymous')::boolean, true) is false
  and lower(coalesce(auth.jwt()->>'email', '')) = 'thaybao@minclass.local'
);

create policy subjects_teacher_insert
on public.subjects for insert to authenticated
with check (
  auth.uid() = teacher_id
  and coalesce((auth.jwt()->>'is_anonymous')::boolean, true) is false
  and lower(coalesce(auth.jwt()->>'email', '')) = 'thaybao@minclass.local'
);

create policy subjects_teacher_update
on public.subjects for update to authenticated
using (
  auth.uid() = teacher_id
  and coalesce((auth.jwt()->>'is_anonymous')::boolean, true) is false
  and lower(coalesce(auth.jwt()->>'email', '')) = 'thaybao@minclass.local'
)
with check (
  auth.uid() = teacher_id
  and coalesce((auth.jwt()->>'is_anonymous')::boolean, true) is false
  and lower(coalesce(auth.jwt()->>'email', '')) = 'thaybao@minclass.local'
);

create policy subjects_teacher_delete
on public.subjects for delete to authenticated
using (
  auth.uid() = teacher_id
  and coalesce((auth.jwt()->>'is_anonymous')::boolean, true) is false
  and lower(coalesce(auth.jwt()->>'email', '')) = 'thaybao@minclass.local'
);

create policy course_sections_teacher_select
on public.course_sections for select to authenticated
using (
  coalesce((auth.jwt()->>'is_anonymous')::boolean, true) is false
  and lower(coalesce(auth.jwt()->>'email', '')) = 'thaybao@minclass.local'
  and exists (
    select 1 from public.subjects
    where subjects.id = course_sections.subject_id
      and subjects.teacher_id = auth.uid()
  )
);

create policy course_sections_teacher_insert
on public.course_sections for insert to authenticated
with check (
  coalesce((auth.jwt()->>'is_anonymous')::boolean, true) is false
  and lower(coalesce(auth.jwt()->>'email', '')) = 'thaybao@minclass.local'
  and exists (
    select 1 from public.subjects
    where subjects.id = course_sections.subject_id
      and subjects.teacher_id = auth.uid()
  )
);

create policy course_sections_teacher_update
on public.course_sections for update to authenticated
using (
  coalesce((auth.jwt()->>'is_anonymous')::boolean, true) is false
  and lower(coalesce(auth.jwt()->>'email', '')) = 'thaybao@minclass.local'
  and exists (
    select 1 from public.subjects
    where subjects.id = course_sections.subject_id
      and subjects.teacher_id = auth.uid()
  )
)
with check (
  coalesce((auth.jwt()->>'is_anonymous')::boolean, true) is false
  and lower(coalesce(auth.jwt()->>'email', '')) = 'thaybao@minclass.local'
  and exists (
    select 1 from public.subjects
    where subjects.id = course_sections.subject_id
      and subjects.teacher_id = auth.uid()
  )
);

create policy course_sections_teacher_delete
on public.course_sections for delete to authenticated
using (
  coalesce((auth.jwt()->>'is_anonymous')::boolean, true) is false
  and lower(coalesce(auth.jwt()->>'email', '')) = 'thaybao@minclass.local'
  and exists (
    select 1 from public.subjects
    where subjects.id = course_sections.subject_id
      and subjects.teacher_id = auth.uid()
  )
);
