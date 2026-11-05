-- Presentation can move backwards while previously released content stays open.
alter table public.rooms drop constraint rooms_section_positions;
alter table public.rooms add constraint rooms_section_positions
  check (teaching_section >= 0 and released_through >= -1);
alter table public.session_lessons drop constraint session_lessons_section_positions;
alter table public.session_lessons add constraint session_lessons_section_positions
  check (teaching_section >= 0 and released_through >= -1);
alter table public.session_lessons
  add column presentation_revision bigint not null default 0
    check (presentation_revision >= 0);

-- Covers every progress writer, including Done entire Chapter. An explicit
-- re-presentation also increments the revision when the pointer is unchanged.
create function private.bump_session_presentation_revision()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.released_through < old.released_through then
    raise exception 'Released content cannot be withdrawn.' using errcode = '23514';
  end if;
  if new.teaching_section is distinct from old.teaching_section
    or new.released_through is distinct from old.released_through
    or new.presentation_revision is distinct from old.presentation_revision then
    new.presentation_revision := old.presentation_revision + 1;
  end if;
  return new;
end;
$$;
create trigger session_lessons_presentation_revision
before update on public.session_lessons
for each row execute function private.bump_session_presentation_revision();
revoke all on function private.bump_session_presentation_revision() from public, anon, authenticated;

create function public.present_session_lesson_section(
  p_room_id uuid, p_lesson_id uuid, p_section_position integer
)
returns table (teaching_section integer, released_through integer)
language plpgsql security definer set search_path = '' as $$
declare
  v_progress public.session_lessons%rowtype;
begin
  if not private.is_room_teacher(p_room_id) then
    raise exception 'Only the Session Teacher can present a section.' using errcode = '42501';
  end if;
  -- Lock room first, matching End and Done entire Chapter.
  perform 1 from public.rooms where id = p_room_id and status = 'ACTIVE' for update;
  if not found then
    raise exception 'Only a LIVE Session can present a section.' using errcode = '42501';
  end if;
  select * into v_progress from public.session_lessons
  where session_id = p_room_id and lesson_id = p_lesson_id for update;
  if not found then
    raise exception 'Lesson is not in this Session.' using errcode = '42501';
  end if;
  if p_section_position is null or p_section_position > v_progress.released_through
    or not exists (select 1 from public.sections
      where lesson_id = p_lesson_id and position = p_section_position) then
    raise exception 'Only an existing released section can be presented.' using errcode = '22023';
  end if;
  update public.session_lessons
  set teaching_section = p_section_position,
      presentation_revision = session_lessons.presentation_revision + 1
  where session_id = p_room_id and lesson_id = p_lesson_id;
  update public.rooms set teaching_section = p_section_position
  where id = p_room_id and lesson_id = p_lesson_id;
  return query select p_section_position, v_progress.released_through;
end;
$$;
revoke all on function public.present_session_lesson_section(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.present_session_lesson_section(uuid, uuid, integer) to authenticated;

-- Preserve the release contract and never shrink previously released access.
create or replace function public.release_session_lesson_section(p_room_id uuid, p_lesson_id uuid)
returns table (teaching_section integer, released_through integer)
language plpgsql security definer set search_path = '' as $$
declare
  v_progress public.session_lessons%rowtype;
  v_next_position integer;
  v_released_through integer;
begin
  if not private.is_room_teacher(p_room_id) then
    raise exception 'Session cannot advance a section.' using errcode = '42501';
  end if;
  perform 1 from public.rooms where id = p_room_id and status = 'ACTIVE' for update;
  if not found then
    raise exception 'Session cannot advance a section.' using errcode = '42501';
  end if;
  select * into v_progress from public.session_lessons
  where session_id = p_room_id and lesson_id = p_lesson_id for update;
  if not found then
    raise exception 'Lesson is not in this Session.' using errcode = '42501';
  end if;
  select min(sections.position) into v_next_position from public.sections
  where sections.lesson_id = p_lesson_id and sections.position > v_progress.teaching_section;
  if v_next_position is null then
    raise exception 'The final section has no next section.' using errcode = 'P0001';
  end if;
  v_released_through := greatest(v_progress.released_through, v_next_position);
  update public.session_lessons
  set teaching_section = v_next_position, released_through = v_released_through
  where session_id = p_room_id and lesson_id = p_lesson_id;
  update public.rooms
  set teaching_section = v_next_position, released_through = v_released_through
  where id = p_room_id and lesson_id = p_lesson_id;
  return query select v_next_position, v_released_through;
end;
$$;

-- New contract leaves existing snapshot callers and dependencies intact.
create function public.get_student_session_lesson_flow_snapshot(p_room_id uuid, p_lesson_id uuid)
returns table (
  room_id uuid, room_title text, room_status public.room_status, released_through integer,
  section_id uuid, section_position integer, section_type public.section_type,
  section_title text, section_content_md text, teaching_section integer, presentation_revision bigint
)
language sql stable security definer set search_path = '' as $$
  select snapshot.*, progress.teaching_section, progress.presentation_revision
  from public.get_student_session_lesson_snapshot(p_room_id, p_lesson_id) as snapshot
  join public.session_lessons as progress
    on progress.session_id = snapshot.room_id and progress.lesson_id = p_lesson_id
  order by snapshot.section_position;
$$;
revoke all on function public.get_student_session_lesson_flow_snapshot(uuid, uuid) from public, anon, authenticated;
grant execute on function public.get_student_session_lesson_flow_snapshot(uuid, uuid) to authenticated;
