create table public.lesson_session_access_grants (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  mssv text not null,
  created_at timestamptz not null default now(),
  constraint lesson_session_access_grants_mssv_valid check (
    mssv = upper(btrim(mssv))
    and mssv ~ '^[A-Z0-9][A-Z0-9._-]{2,31}$'
  ),
  unique (room_id, user_id),
  unique (room_id, mssv)
);

create index lesson_session_access_grants_user_room_idx
on public.lesson_session_access_grants (user_id, room_id);

alter table public.lesson_session_access_grants enable row level security;
revoke all on table public.lesson_session_access_grants from public, anon, authenticated;
grant select on table public.lesson_session_access_grants to authenticated;

create policy lesson_session_access_grants_select_own
on public.lesson_session_access_grants for select to authenticated
using (user_id = auth.uid());

drop policy rooms_select_member on public.rooms;
create policy rooms_select_member
on public.rooms for select to authenticated
using (
  teacher_user_id = auth.uid()
  or private.is_room_participant(id)
  or exists (
    select 1
    from public.lesson_session_access_grants
    where lesson_session_access_grants.room_id = rooms.id
      and lesson_session_access_grants.user_id = auth.uid()
  )
);

create function public.access_ended_lesson_session(
  p_lesson_id uuid,
  p_mssv text
)
returns table (
  session_id uuid,
  lesson_id uuid,
  lesson_status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_mssv text := upper(btrim(coalesce(p_mssv, '')));
  target_room_id uuid;
  existing_grant public.lesson_session_access_grants%rowtype;
begin
  if auth.uid() is null
    or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) is not true
    or normalized_mssv !~ '^[A-Z0-9][A-Z0-9._-]{2,31}$'
  then
    raise exception 'Lesson access denied.' using errcode = '42501';
  end if;

  select rooms.id
  into target_room_id
  from public.rooms
  join public.lessons on lessons.id = rooms.lesson_id
  join public.course_section_students
    on course_section_students.course_section_id = lessons.course_section_id
  where rooms.lesson_id = p_lesson_id
    and rooms.status = 'ENDED'
    and course_section_students.normalized_mssv = normalized_mssv
  order by rooms.ended_at desc
  limit 1;

  if target_room_id is null then
    raise exception 'Lesson access denied.' using errcode = '42501';
  end if;

  select lesson_session_access_grants.*
  into existing_grant
  from public.lesson_session_access_grants
  where lesson_session_access_grants.room_id = target_room_id
    and lesson_session_access_grants.user_id = auth.uid();

  if found then
    if existing_grant.mssv is distinct from normalized_mssv then
      raise exception 'Lesson access denied.' using errcode = '42501';
    end if;
  else
    insert into public.lesson_session_access_grants (room_id, user_id, mssv)
    values (target_room_id, auth.uid(), normalized_mssv);
  end if;

  return query select target_room_id, p_lesson_id, 'ENDED'::text;
exception
  when unique_violation then
    raise exception 'Lesson access denied.' using errcode = '42501';
end;
$$;

create or replace function private.can_read_section(target_section_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.sections
    join public.rooms on private.lesson_id_for_room(rooms.id) = sections.lesson_id
    where sections.id = target_section_id
      and (
        rooms.teacher_user_id = auth.uid()
        or (
          sections.position <= rooms.released_through
          and (
            exists (
              select 1 from public.participants
              where participants.room_id = rooms.id and participants.user_id = auth.uid()
            )
            or exists (
              select 1 from public.lesson_session_access_grants
              where lesson_session_access_grants.room_id = rooms.id
                and lesson_session_access_grants.user_id = auth.uid()
                and rooms.status = 'ENDED'
            )
          )
        )
      )
  );
$$;

create or replace function public.get_student_lesson_snapshot(p_room_id uuid)
returns table (
  room_id uuid,
  room_code text,
  room_title text,
  room_status public.room_status,
  released_through integer,
  section_id uuid,
  section_position integer,
  section_type public.section_type,
  section_title text,
  section_content_md text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '28000';
  end if;

  if not exists (
    select 1 from public.participants
    where participants.room_id = p_room_id and participants.user_id = auth.uid()
  ) and not exists (
    select 1 from public.lesson_session_access_grants
    join public.rooms on rooms.id = lesson_session_access_grants.room_id
    where lesson_session_access_grants.room_id = p_room_id
      and lesson_session_access_grants.user_id = auth.uid()
      and rooms.status = 'ENDED'
  ) then
    raise exception 'Room is not available to this Student.' using errcode = '42501';
  end if;

  return query
  select
    rooms.id,
    rooms.code,
    rooms.title,
    rooms.status,
    rooms.released_through,
    sections.id,
    sections.position,
    sections.type,
    sections.title,
    sections.content_md
  from public.rooms
  left join public.sections
    on sections.lesson_id = private.lesson_id_for_room(rooms.id)
   and sections.position <= rooms.released_through
  where rooms.id = p_room_id
  order by sections.position;
end;
$$;

revoke all on function public.access_ended_lesson_session(uuid, text) from public, anon, authenticated;
grant execute on function public.access_ended_lesson_session(uuid, text) to authenticated;
