-- A Room is now one Chapter teaching session. It can expose several Lessons
-- concurrently while retaining the existing session-scoped attendance and feedback.
alter table public.rooms
add column course_section_id uuid references public.course_sections(id) on delete restrict,
add column chapter_id uuid references public.chapters(id) on delete restrict;

create table public.session_lessons (
  session_id uuid not null references public.rooms(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  teaching_section integer not null,
  released_through integer not null,
  created_at timestamptz not null default now(),
  primary key (session_id, lesson_id),
  constraint session_lessons_section_positions check (
    teaching_section >= 0
    and released_through >= -1
    and released_through <= teaching_section
  )
);

create index session_lessons_lesson_session_idx
on public.session_lessons (lesson_id, session_id);

-- Backfill every existing single-Lesson Session without changing its identity.
insert into public.session_lessons (session_id, lesson_id, teaching_section, released_through, created_at)
select rooms.id, rooms.lesson_id, rooms.teaching_section, rooms.released_through, rooms.created_at
from public.rooms
where rooms.lesson_id is not null
on conflict (session_id, lesson_id) do nothing;

update public.rooms
set course_section_id = lessons.course_section_id,
    chapter_id = lessons.chapter_id
from public.lessons
where lessons.id = rooms.lesson_id
  and rooms.lesson_id is not null;

drop trigger if exists rooms_enforce_persistent_lesson_session on public.rooms;
drop function if exists private.enforce_persistent_lesson_session();
drop index if exists public.rooms_one_active_session_per_lesson_idx;

create unique index rooms_one_active_chapter_session_per_course_idx
on public.rooms (course_section_id)
where course_section_id is not null and status = 'ACTIVE';

alter table public.session_lessons enable row level security;
revoke all on table public.session_lessons from public, anon, authenticated;
grant select on table public.session_lessons to authenticated;

create policy session_lessons_select_member
on public.session_lessons for select to authenticated
using (
  private.is_room_teacher(session_id)
  or private.is_room_participant(session_id)
  or exists (
    select 1 from public.lesson_session_access_grants
    where lesson_session_access_grants.room_id = session_lessons.session_id
      and lesson_session_access_grants.user_id = auth.uid()
  )
);

create or replace function private.lesson_is_in_session(p_room_id uuid, p_lesson_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.session_lessons
    where session_lessons.session_id = p_room_id
      and session_lessons.lesson_id = p_lesson_id
  );
$$;

create or replace function private.can_interact_with_section(
  target_section_id uuid,
  target_participant_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.participants
    join public.rooms on rooms.id = participants.room_id
    join public.session_lessons on session_lessons.session_id = rooms.id
    join public.sections on sections.lesson_id = session_lessons.lesson_id
    where participants.id = target_participant_id
      and participants.user_id = auth.uid()
      and sections.id = target_section_id
      and rooms.status = 'ACTIVE'
      and sections.position <= session_lessons.released_through
  );
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
    join public.session_lessons on session_lessons.lesson_id = sections.lesson_id
    join public.rooms on rooms.id = session_lessons.session_id
    where sections.id = target_section_id
      and (
        rooms.teacher_user_id = auth.uid()
        or (
          sections.position <= session_lessons.released_through
          and (
            exists (
              select 1 from public.participants
              where participants.room_id = rooms.id
                and participants.user_id = auth.uid()
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

create or replace function private.validate_same_room()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  participant_room_id uuid;
begin
  select participants.room_id into participant_room_id
  from public.participants where participants.id = new.participant_id;

  if participant_room_id is null then
    raise exception 'Participant does not exist.' using errcode = '23514';
  end if;

  perform rooms.id
  from public.rooms
  join public.session_lessons on session_lessons.session_id = rooms.id
  join public.sections on sections.lesson_id = session_lessons.lesson_id
  where rooms.id = participant_room_id
    and sections.id = new.section_id
    and rooms.status = 'ACTIVE'
    and sections.position <= session_lessons.released_through
  for share of rooms;

  if not found then
    raise exception 'Section is not available for interaction.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.start_chapter_session(
  p_course_section_id uuid,
  p_chapter_id uuid
)
returns table (session_id uuid, session_status public.room_status, started_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room_id uuid;
  v_started_at timestamptz;
  v_first_lesson_id uuid;
  v_chapter_name text;
begin
  if not private.is_permanent_user() then
    raise exception 'Teacher account required.' using errcode = '42501';
  end if;

  select chapters.name into v_chapter_name
  from public.chapters
  join public.course_sections on course_sections.id = chapters.course_section_id
  join public.subjects on subjects.id = course_sections.subject_id
  where chapters.id = p_chapter_id
    and chapters.course_section_id = p_course_section_id
    and subjects.teacher_id = auth.uid();

  if v_chapter_name is null then
    raise exception 'Chapter is not available.' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_course_section_id::text, 0));

  if exists (
    select 1 from public.rooms
    where rooms.course_section_id = p_course_section_id and rooms.status = 'ACTIVE'
  ) then
    raise exception 'Course Section already has a LIVE Lesson Session.' using errcode = '23505';
  end if;

  select lessons.id into v_first_lesson_id
  from public.lessons
  where lessons.course_section_id = p_course_section_id
    and lessons.chapter_id = p_chapter_id
    and exists (select 1 from public.sections where sections.lesson_id = lessons.id)
  order by lessons.created_at, lessons.id
  limit 1;

  if v_first_lesson_id is null then
    raise exception 'Chapter must have at least one valid Lesson.' using errcode = 'P0001';
  end if;

  insert into public.rooms (
    teacher_user_id, title, status, teaching_section, released_through,
    started_at, lesson_id, course_section_id, chapter_id
  )
  values (
    auth.uid(), v_chapter_name, 'ACTIVE', 0, 0,
    now(), v_first_lesson_id, p_course_section_id, p_chapter_id
  )
  returning id, rooms.started_at into v_room_id, v_started_at;

  insert into public.session_lessons (session_id, lesson_id, teaching_section, released_through)
  select v_room_id, lessons.id, first_sections.position, first_sections.position
  from public.lessons
  cross join lateral (
    select min(sections.position)::integer as position
    from public.sections where sections.lesson_id = lessons.id
  ) as first_sections
  where lessons.course_section_id = p_course_section_id
    and lessons.chapter_id = p_chapter_id
    and first_sections.position is not null;

  insert into public.session_attendance (session_id, mssv)
  select v_room_id, course_section_students.normalized_mssv
  from public.course_section_students
  where course_section_students.course_section_id = p_course_section_id;

  return query select v_room_id, 'ACTIVE'::public.room_status, v_started_at;
end;
$$;

-- Compatibility entry point: starting any Lesson starts its whole Chapter.
create or replace function public.start_lesson_session(p_lesson_id uuid)
returns table (session_id uuid, session_status public.room_status, started_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_course_section_id uuid;
  v_chapter_id uuid;
  v_room_id uuid;
  v_first_position integer;
  v_started_at timestamptz;
begin
  select lessons.course_section_id, lessons.chapter_id
  into v_course_section_id, v_chapter_id
  from public.lessons
  join public.course_sections on course_sections.id = lessons.course_section_id
  join public.subjects on subjects.id = course_sections.subject_id
  where lessons.id = p_lesson_id and subjects.teacher_id = auth.uid();

  if v_course_section_id is null then
    raise exception 'Lesson is not available.' using errcode = '42501';
  end if;
  if v_chapter_id is not null then
    return query select * from public.start_chapter_session(v_course_section_id, v_chapter_id);
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_course_section_id::text, 0));
  if exists (select 1 from public.rooms where course_section_id = v_course_section_id and status = 'ACTIVE') then
    raise exception 'Course Section already has a LIVE Lesson Session.' using errcode = '23505';
  end if;
  select min(position) into v_first_position from public.sections where lesson_id = p_lesson_id;
  if v_first_position is null then raise exception 'Lesson must have at least one Section.' using errcode = 'P0001'; end if;
  insert into public.rooms (teacher_user_id, title, status, teaching_section, released_through,
    started_at, lesson_id, course_section_id)
  select auth.uid(), lessons.title, 'ACTIVE', v_first_position, v_first_position,
    now(), lessons.id, v_course_section_id from public.lessons where lessons.id = p_lesson_id
  returning id, rooms.started_at into v_room_id, v_started_at;
  insert into public.session_lessons (session_id, lesson_id, teaching_section, released_through)
  values (v_room_id, p_lesson_id, v_first_position, v_first_position);
  insert into public.session_attendance (session_id, mssv)
  select v_room_id, normalized_mssv from public.course_section_students
  where course_section_id = v_course_section_id;
  return query select v_room_id, 'ACTIVE'::public.room_status, v_started_at;
end;
$$;

create function public.join_live_chapter_session(p_session_id uuid, p_mssv text)
returns table (
  room_id uuid,
  room_title text,
  room_status public.room_status,
  participant_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_room public.rooms%rowtype;
  existing_participant public.participants%rowtype;
  created_participant_id uuid;
  v_normalized_mssv text := upper(btrim(coalesce(p_mssv, '')));
  v_joined_at timestamptz;
begin
  if auth.uid() is null
    or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) is not true
  then
    raise exception 'Lesson Session is not available.' using errcode = '42501';
  end if;

  select rooms.* into target_room
  from public.rooms
  where rooms.id = p_session_id and rooms.status = 'ACTIVE'
  for update;

  if not found then
    raise exception 'Lesson Session is not available.' using errcode = 'P0001';
  end if;

  if v_normalized_mssv !~ '^[A-Z0-9][A-Z0-9._-]{2,31}$'
    or not exists (
      select 1 from public.session_attendance
      where session_attendance.session_id = target_room.id
        and session_attendance.mssv = v_normalized_mssv
    )
  then
    raise exception 'Student is not in the Course Section.' using errcode = 'P0003';
  end if;

  select participants.* into existing_participant
  from public.participants
  where participants.room_id = target_room.id and participants.user_id = auth.uid();

  if found then
    if existing_participant.mssv is distinct from v_normalized_mssv then
      raise exception 'This user has already joined the Lesson Session.' using errcode = '23505';
    end if;
    created_participant_id := existing_participant.id;
    v_joined_at := existing_participant.joined_at;
  else
    v_joined_at := now();
    insert into public.participants (room_id, user_id, mssv, joined_at)
    values (target_room.id, auth.uid(), v_normalized_mssv, v_joined_at)
    returning id into created_participant_id;
  end if;

  update public.session_attendance
  set joined_at = coalesce(session_attendance.joined_at, v_joined_at)
  where session_attendance.session_id = target_room.id
    and session_attendance.mssv = v_normalized_mssv;

  return query select target_room.id, target_room.title, target_room.status, created_participant_id;
exception
  when unique_violation then
    raise exception 'This MSSV or user has already joined the Lesson Session.' using errcode = '23505';
end;
$$;

create or replace function public.join_live_lesson(p_lesson_id uuid, p_mssv text)
returns table (
  room_id uuid,
  room_title text,
  room_status public.room_status,
  participant_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session_id uuid;
begin
  select rooms.id into v_session_id
  from public.rooms
  join public.session_lessons on session_lessons.session_id = rooms.id
  where session_lessons.lesson_id = p_lesson_id and rooms.status = 'ACTIVE'
  order by rooms.started_at desc limit 1;

  if v_session_id is null then
    raise exception 'Lesson Session is not available.' using errcode = 'P0001';
  end if;
  return query select * from public.join_live_chapter_session(v_session_id, p_mssv);
end;
$$;

create function public.release_session_lesson_section(p_room_id uuid, p_lesson_id uuid)
returns table (teaching_section integer, released_through integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_progress public.session_lessons%rowtype;
  v_next_position integer;
begin
  if not private.is_room_teacher(p_room_id) or not exists (
    select 1 from public.rooms where id = p_room_id and status = 'ACTIVE'
  ) then
    raise exception 'Session cannot advance a section.' using errcode = '42501';
  end if;

  select * into v_progress from public.session_lessons
  where session_id = p_room_id and lesson_id = p_lesson_id
  for update;
  if not found then
    raise exception 'Lesson is not in this Session.' using errcode = '42501';
  end if;

  select min(sections.position) into v_next_position
  from public.sections
  where sections.lesson_id = p_lesson_id
    and sections.position > v_progress.teaching_section;
  if v_next_position is null then
    raise exception 'The final section has no next section.' using errcode = 'P0001';
  end if;

  update public.session_lessons
  set teaching_section = v_next_position, released_through = v_next_position
  where session_id = p_room_id and lesson_id = p_lesson_id;

  -- Preserve scalar compatibility for the legacy primary Lesson.
  update public.rooms
  set teaching_section = v_next_position, released_through = v_next_position
  where id = p_room_id and lesson_id = p_lesson_id;

  return query select v_next_position, v_next_position;
end;
$$;

create or replace function public.release_section(p_room_id uuid)
returns table (teaching_section integer, released_through integer)
language sql
security definer
set search_path = ''
as $$
  select * from public.release_session_lesson_section(
    p_room_id,
    (select rooms.lesson_id from public.rooms where rooms.id = p_room_id)
  );
$$;

create function public.get_student_session_lessons(p_room_id uuid)
returns table (lesson_id uuid, lesson_title text, chapter_name text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not (
    exists (select 1 from public.participants where room_id = p_room_id and user_id = auth.uid())
    or exists (
      select 1 from public.lesson_session_access_grants
      where room_id = p_room_id and user_id = auth.uid()
    )
  ) then
    raise exception 'Lesson Session is not available to this Student.' using errcode = '42501';
  end if;

  return query
  select lessons.id, lessons.title, coalesce(chapters.name, 'Lesson')
  from public.session_lessons
  join public.lessons on lessons.id = session_lessons.lesson_id
  left join public.chapters on chapters.id = lessons.chapter_id
  where session_lessons.session_id = p_room_id
  order by lessons.created_at, lessons.id;
end;
$$;

create function public.get_teacher_session_lessons(p_room_id uuid)
returns table (lesson_id uuid, lesson_title text, chapter_name text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_room_teacher(p_room_id) then
    raise exception 'Lesson Session is not available.' using errcode = '42501';
  end if;
  return query
  select lessons.id, lessons.title, coalesce(chapters.name, 'Lesson')
  from public.session_lessons
  join public.lessons on lessons.id = session_lessons.lesson_id
  left join public.chapters on chapters.id = lessons.chapter_id
  where session_lessons.session_id = p_room_id
  order by lessons.created_at, lessons.id;
end;
$$;

create function public.get_student_session_lesson_snapshot(p_room_id uuid, p_lesson_id uuid)
returns table (
  room_id uuid,
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
  if auth.uid() is null or not (
    exists (select 1 from public.participants where room_id = p_room_id and user_id = auth.uid())
    or exists (
      select 1 from public.lesson_session_access_grants
      join public.rooms on rooms.id = lesson_session_access_grants.room_id
      where lesson_session_access_grants.room_id = p_room_id
        and lesson_session_access_grants.user_id = auth.uid()
        and rooms.status = 'ENDED'
    )
  ) then
    raise exception 'Lesson Session is not available to this Student.' using errcode = '42501';
  end if;

  return query
  select rooms.id, lessons.title, rooms.status, session_lessons.released_through,
    sections.id, sections.position, sections.type, sections.title, sections.content_md
  from public.rooms
  join public.session_lessons on session_lessons.session_id = rooms.id
    and session_lessons.lesson_id = p_lesson_id
  join public.lessons on lessons.id = session_lessons.lesson_id
  left join public.sections on sections.lesson_id = lessons.id
    and sections.position <= session_lessons.released_through
  where rooms.id = p_room_id
  order by sections.position;
end;
$$;

create or replace function public.get_student_lesson_snapshot(p_room_id uuid)
returns table (
  room_id uuid, room_title text, room_status public.room_status,
  released_through integer, section_id uuid, section_position integer,
  section_type public.section_type, section_title text, section_content_md text
)
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.get_student_session_lesson_snapshot(
    p_room_id,
    (select rooms.lesson_id from public.rooms where rooms.id = p_room_id)
  );
$$;

create function public.get_public_live_sessions()
returns table (
  session_id uuid,
  subject_name text,
  section_code text,
  section_display_name text,
  chapter_name text,
  first_lesson_id uuid,
  lesson_count integer,
  started_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select rooms.id, subjects.name, course_sections.section_code,
    course_sections.display_name, chapters.name, rooms.lesson_id,
    count(session_lessons.lesson_id)::integer, rooms.started_at
  from public.rooms
  join public.course_sections on course_sections.id = rooms.course_section_id
  join public.subjects on subjects.id = course_sections.subject_id
  join public.chapters on chapters.id = rooms.chapter_id
  join public.session_lessons on session_lessons.session_id = rooms.id
  where rooms.status = 'ACTIVE'
  group by rooms.id, subjects.name, course_sections.section_code,
    course_sections.display_name, chapters.name, rooms.lesson_id, rooms.started_at
  order by rooms.started_at desc;
$$;

create or replace function private.public_lesson_status(p_lesson_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (
      select 1 from public.session_lessons
      join public.rooms on rooms.id = session_lessons.session_id
      where session_lessons.lesson_id = p_lesson_id and rooms.status = 'ACTIVE'
    ) then 'LIVE'
    when exists (
      select 1 from public.session_lessons
      join public.rooms on rooms.id = session_lessons.session_id
      where session_lessons.lesson_id = p_lesson_id and rooms.status = 'ENDED'
    ) then 'ENDED'
    else 'UPCOMING'
  end;
$$;

-- Roster updates also update the single active Chapter Session snapshot.
create or replace function public.replace_course_section_roster(
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
  if not private.is_permanent_user() or not exists (
    select 1 from public.course_sections
    join public.subjects on subjects.id = course_sections.subject_id
    where course_sections.id = p_course_section_id and subjects.teacher_id = auth.uid()
  ) then raise exception 'Course Section is not available.' using errcode = '42501'; end if;
  if v_count < 1 or v_count > 2000 then
    raise exception 'Roster must contain between 1 and 2000 MSSV values.' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(p_mssv) as roster(mssv)
    where roster.mssv is null or roster.mssv <> upper(btrim(roster.mssv))
      or roster.mssv !~ '^[A-Z0-9][A-Z0-9._-]{2,31}$'
  ) then raise exception 'Roster contains an invalid MSSV.' using errcode = '22023'; end if;
  if (select count(distinct roster.mssv) from unnest(p_mssv) as roster(mssv)) <> v_count then
    raise exception 'Roster contains duplicate MSSV values.' using errcode = '23505';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_course_section_id::text, 0));
  perform rooms.id from public.rooms
  where rooms.course_section_id = p_course_section_id and rooms.status = 'ACTIVE'
  order by rooms.id for update;

  delete from public.course_section_students where course_section_id = p_course_section_id;
  insert into public.course_section_students (course_section_id, mssv)
  select p_course_section_id, roster.mssv
  from unnest(p_mssv) with ordinality as roster(mssv, position)
  order by roster.position;

  delete from public.session_attendance
  using public.rooms
  where session_attendance.session_id = rooms.id
    and rooms.course_section_id = p_course_section_id
    and rooms.status = 'ACTIVE'
    and session_attendance.joined_at is null
    and not (session_attendance.mssv = any(p_mssv));

  insert into public.session_attendance (session_id, mssv)
  select rooms.id, roster.mssv
  from public.rooms cross join unnest(p_mssv) as roster(mssv)
  where rooms.course_section_id = p_course_section_id and rooms.status = 'ACTIVE'
  on conflict (session_id, mssv) do nothing;
  return v_count;
end;
$$;

-- Direct mutation RPCs resolve release against the Lesson within this Session.
create or replace function public.set_section_reaction(
  p_section_id uuid,
  p_reaction public.reaction_type
)
returns table (section_id uuid, reaction public.reaction_type, updated_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare target_participant_id uuid;
begin
  select participants.id into target_participant_id
  from public.participants
  join public.rooms on rooms.id = participants.room_id
  join public.session_lessons on session_lessons.session_id = rooms.id
  join public.sections on sections.lesson_id = session_lessons.lesson_id
  where sections.id = p_section_id and participants.user_id = auth.uid()
    and rooms.status = 'ACTIVE' and sections.position <= session_lessons.released_through
  for share of rooms;
  if target_participant_id is null then
    raise exception 'Section is not available for interaction.' using errcode = '42501';
  end if;
  insert into public.section_reactions (section_id, participant_id, reaction)
  values (p_section_id, target_participant_id, p_reaction)
  on conflict on constraint section_reactions_section_id_participant_id_key
  do update set reaction = excluded.reaction
  returning section_reactions.section_id, section_reactions.reaction, section_reactions.updated_at
  into section_id, reaction, updated_at;
  return next;
end;
$$;

create or replace function public.create_section_comment(
  p_section_id uuid, p_body text, p_is_anonymous boolean
)
returns table (comment_id uuid, section_id uuid, created_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare target_participant_id uuid; normalized_body text := btrim(p_body);
begin
  if p_body is null or char_length(normalized_body) not between 1 and 500 or p_is_anonymous is null then
    raise exception 'Comment must contain between 1 and 500 characters.' using errcode = '22023';
  end if;
  select participants.id into target_participant_id
  from public.participants
  join public.rooms on rooms.id = participants.room_id
  join public.session_lessons on session_lessons.session_id = rooms.id
  join public.sections on sections.lesson_id = session_lessons.lesson_id
  where sections.id = p_section_id and participants.user_id = auth.uid()
    and rooms.status = 'ACTIVE' and sections.position <= session_lessons.released_through
  for share of rooms;
  if target_participant_id is null then
    raise exception 'Section is not available for interaction.' using errcode = '42501';
  end if;
  insert into public.section_comments (section_id, participant_id, body, is_anonymous)
  values (p_section_id, target_participant_id, normalized_body, p_is_anonymous)
  returning section_comments.id, section_comments.section_id, section_comments.created_at
  into comment_id, section_id, created_at;
  return next;
end;
$$;

create or replace function public.get_session_student_quiz_snapshot(
  p_room_id uuid, p_section_id uuid
)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  target_quiz_id uuid; target_quiz_title text; target_participant_id uuid;
  question_data jsonb; attempt_data jsonb;
begin
  select quizzes.id, quizzes.title, participants.id
  into target_quiz_id, target_quiz_title, target_participant_id
  from public.rooms
  join public.participants on participants.room_id = rooms.id and participants.user_id = auth.uid()
  join public.session_lessons on session_lessons.session_id = rooms.id
  join public.sections on sections.lesson_id = session_lessons.lesson_id
  join public.quizzes on quizzes.section_id = sections.id
  where rooms.id = p_room_id and sections.id = p_section_id
    and sections.position <= session_lessons.released_through;
  if target_quiz_id is null then raise exception 'Quiz is not available.' using errcode = '42501'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', quiz_questions.id, 'position', quiz_questions.position,
    'type', quiz_questions.type, 'questionText', quiz_questions.question_text,
    'options', (select coalesce(jsonb_agg(jsonb_build_object(
      'id', quiz_options.id, 'position', quiz_options.position, 'content', quiz_options.content
    ) order by quiz_options.position), '[]'::jsonb)
      from public.quiz_options where quiz_options.question_id = quiz_questions.id)
  ) order by quiz_questions.position), '[]'::jsonb)
  into question_data from public.quiz_questions where quiz_questions.quiz_id = target_quiz_id;

  select jsonb_build_object(
    'attemptId', quiz_attempts.id, 'score', quiz_attempts.score,
    'totalQuestions', quiz_attempts.total_questions, 'submittedAt', quiz_attempts.submitted_at,
    'answers', (select coalesce(jsonb_agg(jsonb_build_object(
      'questionId', quiz_answers.question_id,
      'selectedOptionIds', quiz_answers.selected_option_ids,
      'correctOptionIds', quiz_answer_keys.correct_option_ids,
      'isCorrect', quiz_answers.is_correct
    ) order by quiz_questions.position), '[]'::jsonb)
      from public.quiz_answers
      join public.quiz_questions on quiz_questions.id = quiz_answers.question_id
      join public.quiz_answer_keys on quiz_answer_keys.question_id = quiz_answers.question_id
      where quiz_answers.attempt_id = quiz_attempts.id)
  ) into attempt_data
  from public.quiz_attempts
  where quiz_attempts.quiz_id = target_quiz_id
    and quiz_attempts.participant_id = target_participant_id;

  return jsonb_build_object('quizId', target_quiz_id, 'sectionId', p_section_id,
    'title', target_quiz_title, 'questions', question_data, 'attempt', attempt_data);
end;
$$;

create or replace function public.submit_session_quiz(
  p_room_id uuid, p_quiz_id uuid, p_answers jsonb
)
returns table (attempt_id uuid, score integer, total_questions integer)
language plpgsql security definer set search_path = ''
as $$
declare
  target_participant_id uuid; question_count integer; correct_count integer; created_attempt_id uuid;
begin
  if jsonb_typeof(p_answers) <> 'array' or jsonb_array_length(p_answers) = 0 then
    raise exception 'Answers must be a non-empty array.' using errcode = '22023';
  end if;
  select participants.id into target_participant_id
  from public.rooms
  join public.participants on participants.room_id = rooms.id and participants.user_id = auth.uid()
  join public.session_lessons on session_lessons.session_id = rooms.id
  join public.sections on sections.lesson_id = session_lessons.lesson_id
  join public.quizzes on quizzes.section_id = sections.id
  where rooms.id = p_room_id and rooms.status = 'ACTIVE' and quizzes.id = p_quiz_id
    and sections.position <= session_lessons.released_through
  for share of rooms;
  if target_participant_id is null then raise exception 'Quiz is not available.' using errcode = '42501'; end if;

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
    left join public.quiz_questions on quiz_questions.id = submitted.question_id
      and quiz_questions.quiz_id = p_quiz_id
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
  values (p_quiz_id, target_participant_id, correct_count, question_count)
  returning id into created_attempt_id;
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

create or replace function public.get_teacher_feedback_snapshot(p_room_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare reaction_data jsonb; comment_data jsonb;
begin
  if not private.is_room_teacher(p_room_id) then
    raise exception 'Room feedback is not available.' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'sectionId', counts.section_id, 'sectionPosition', counts.section_position,
    'sectionTitle', counts.section_title, 'understand', counts.understand,
    'unsure', counts.unsure, 'question', counts.question
  ) order by counts.lesson_created_at, counts.section_position), '[]'::jsonb)
  into reaction_data from (
    select sections.id section_id, sections.position section_position,
      sections.title section_title, lessons.created_at lesson_created_at,
      count(section_reactions.id) filter (where participants.id is not null and section_reactions.reaction='UNDERSTAND') understand,
      count(section_reactions.id) filter (where participants.id is not null and section_reactions.reaction='UNSURE') unsure,
      count(section_reactions.id) filter (where participants.id is not null and section_reactions.reaction='QUESTION') question
    from public.session_lessons
    join public.lessons on lessons.id = session_lessons.lesson_id
    join public.sections on sections.lesson_id = lessons.id
    left join public.section_reactions on section_reactions.section_id = sections.id
    left join public.participants on participants.id = section_reactions.participant_id
      and participants.room_id = p_room_id
    where session_lessons.session_id = p_room_id and sections.position <= session_lessons.released_through
    group by sections.id, sections.position, sections.title, lessons.title, lessons.created_at
  ) counts;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', comments.id, 'sectionId', comments.section_id,
    'sectionPosition', comments.section_position, 'sectionTitle', comments.section_title,
    'body', comments.body, 'authorLabel', comments.author_label,
    'isAnonymous', comments.is_anonymous, 'createdAt', comments.created_at
  ) order by comments.created_at desc), '[]'::jsonb)
  into comment_data from (
    select section_comments.id, sections.id section_id, sections.position section_position,
      sections.title section_title, section_comments.body,
      case when section_comments.is_anonymous then 'Anonymous' else participants.mssv end author_label,
      section_comments.is_anonymous, section_comments.created_at
    from public.session_lessons
    join public.lessons on lessons.id = session_lessons.lesson_id
    join public.sections on sections.lesson_id = lessons.id
    join public.section_comments on section_comments.section_id = sections.id
    join public.participants on participants.id = section_comments.participant_id
      and participants.room_id = p_room_id
    where session_lessons.session_id = p_room_id
    order by section_comments.created_at desc limit 30
  ) comments;
  return jsonb_build_object('reactions', reaction_data, 'comments', comment_data);
end;
$$;

create or replace function public.get_teacher_quiz_analytics(p_room_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare quiz_data jsonb;
begin
  if not private.is_room_teacher(p_room_id) then
    raise exception 'Quiz analytics are not available.' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'quizId', quiz_stats.quiz_id, 'sectionId', quiz_stats.section_id,
    'sectionPosition', quiz_stats.section_position, 'title', quiz_stats.title,
    'submittedCount', quiz_stats.submitted_count, 'participantCount', quiz_stats.participant_count,
    'completionRate', quiz_stats.completion_rate, 'averageScore', quiz_stats.average_score,
    'totalQuestions', quiz_stats.total_questions,
    'questions', (select coalesce(jsonb_agg(jsonb_build_object(
      'questionId', question_stats.question_id, 'position', question_stats.position,
      'type', question_stats.type, 'questionText', question_stats.question_text,
      'correctPercentage', question_stats.correct_percentage, 'options', question_stats.options
    ) order by question_stats.position), '[]'::jsonb) from (
      select quiz_questions.id question_id, quiz_questions.position, quiz_questions.type,
        quiz_questions.question_text,
        round(coalesce(100.0 * count(quiz_answers.id) filter (where participants.id is not null and quiz_answers.is_correct)
          / nullif(count(quiz_answers.id) filter (where participants.id is not null), 0), 0), 2) correct_percentage,
        (select coalesce(jsonb_agg(jsonb_build_object(
          'optionId', option_stats.option_id, 'position', option_stats.position,
          'content', option_stats.content, 'selectionCount', option_stats.selection_count
        ) order by option_stats.position), '[]'::jsonb) from (
          select quiz_options.id option_id, quiz_options.position, quiz_options.content,
            (select count(*) from public.quiz_answers selected_answers
              join public.quiz_attempts selected_attempts on selected_attempts.id = selected_answers.attempt_id
              join public.participants selected_participants on selected_participants.id = selected_attempts.participant_id
              where selected_answers.question_id = quiz_questions.id
                and selected_participants.room_id = p_room_id
                and quiz_options.id = any(selected_answers.selected_option_ids)) selection_count
          from public.quiz_options where quiz_options.question_id = quiz_questions.id
        ) option_stats) options
      from public.quiz_questions
      left join public.quiz_answers on quiz_answers.question_id = quiz_questions.id
      left join public.quiz_attempts on quiz_attempts.id = quiz_answers.attempt_id
      left join public.participants on participants.id = quiz_attempts.participant_id
        and participants.room_id = p_room_id
      where quiz_questions.quiz_id = quiz_stats.quiz_id
      group by quiz_questions.id, quiz_questions.position, quiz_questions.type, quiz_questions.question_text
    ) question_stats)
  ) order by quiz_stats.lesson_created_at, quiz_stats.section_position), '[]'::jsonb)
  into quiz_data from (
    select quizzes.id quiz_id, sections.id section_id, sections.position section_position,
      lessons.created_at lesson_created_at, quizzes.title title,
      count(quiz_attempts.id) filter (where participants.id is not null)::integer submitted_count,
      (select count(*)::integer from public.participants where room_id = p_room_id) participant_count,
      round(case when (select count(*) from public.participants where room_id = p_room_id) = 0 then 0
        else 100.0 * count(quiz_attempts.id) filter (where participants.id is not null)
          / (select count(*) from public.participants where room_id = p_room_id) end, 2) completion_rate,
      round(coalesce(avg(quiz_attempts.score) filter (where participants.id is not null), 0), 2) average_score,
      (select count(*)::integer from public.quiz_questions where quiz_id = quizzes.id) total_questions
    from public.session_lessons
    join public.lessons on lessons.id = session_lessons.lesson_id
    join public.sections on sections.lesson_id = lessons.id
    join public.quizzes on quizzes.section_id = sections.id
    left join public.quiz_attempts on quiz_attempts.quiz_id = quizzes.id
    left join public.participants on participants.id = quiz_attempts.participant_id
      and participants.room_id = p_room_id
    where session_lessons.session_id = p_room_id and sections.position <= session_lessons.released_through
    group by quizzes.id, sections.id, sections.position, lessons.title, lessons.created_at
  ) quiz_stats;
  return jsonb_build_object('quizzes', quiz_data);
end;
$$;

create or replace function public.access_ended_lesson_session(p_lesson_id uuid, p_mssv text)
returns table (session_id uuid, lesson_id uuid, lesson_status text)
language plpgsql security definer set search_path = ''
as $$
declare
  normalized_mssv text := upper(btrim(coalesce(p_mssv, '')));
  target_room_id uuid;
begin
  if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) is not true
    or normalized_mssv !~ '^[A-Z0-9][A-Z0-9._-]{2,31}$'
  then raise exception 'Lesson access denied.' using errcode = '42501'; end if;
  select rooms.id into target_room_id
  from public.rooms
  join public.session_lessons on session_lessons.session_id = rooms.id
  join public.session_attendance on session_attendance.session_id = rooms.id
  where session_lessons.lesson_id = p_lesson_id and rooms.status = 'ENDED'
    and session_attendance.mssv = normalized_mssv
    and not exists (
      select 1 from public.rooms live_rooms
      join public.session_lessons live_lessons on live_lessons.session_id = live_rooms.id
      where live_lessons.lesson_id = p_lesson_id and live_rooms.status = 'ACTIVE'
    )
  order by rooms.ended_at desc limit 1;
  if target_room_id is null then raise exception 'Lesson access denied.' using errcode = '42501'; end if;
  insert into public.lesson_session_access_grants (room_id, user_id, mssv)
  values (target_room_id, auth.uid(), normalized_mssv)
  on conflict (room_id, user_id) do update set mssv = excluded.mssv;
  return query select target_room_id, p_lesson_id, 'ENDED'::text;
end;
$$;

create function public.get_student_ended_lesson_review(p_room_id uuid, p_lesson_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  target_room public.rooms%rowtype; review_mssv text; target_participant_id uuid;
  lesson_title text; section_data jsonb;
begin
  if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) is not true
  then raise exception 'Lesson review is not available.' using errcode = '42501'; end if;
  select rooms.* into target_room
  from public.rooms
  join public.lesson_session_access_grants on lesson_session_access_grants.room_id = rooms.id
    and lesson_session_access_grants.user_id = auth.uid()
  join public.session_lessons on session_lessons.session_id = rooms.id
    and session_lessons.lesson_id = p_lesson_id
  where rooms.id = p_room_id and rooms.status = 'ENDED';
  if not found then raise exception 'Lesson review is not available.' using errcode = '42501'; end if;
  select mssv into review_mssv from public.lesson_session_access_grants
  where room_id = target_room.id and user_id = auth.uid();
  select title into lesson_title from public.lessons where id = p_lesson_id;
  select id into target_participant_id from public.participants
  where room_id = target_room.id and mssv = review_mssv;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', sections.id, 'position', sections.position, 'type', sections.type,
    'title', sections.title, 'contentMd', sections.content_md,
    'quiz', case when quizzes.id is null then null else jsonb_build_object(
      'quizId', quizzes.id, 'title', quizzes.title,
      'attempt', (select jsonb_build_object('score', quiz_attempts.score,
        'totalQuestions', quiz_attempts.total_questions, 'submittedAt', quiz_attempts.submitted_at)
        from public.quiz_attempts where quiz_attempts.quiz_id = quizzes.id
          and quiz_attempts.participant_id = target_participant_id),
      'questions', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', quiz_questions.id, 'position', quiz_questions.position,
        'type', quiz_questions.type, 'questionText', quiz_questions.question_text,
        'isCorrect', (select quiz_answers.is_correct from public.quiz_attempts
          join public.quiz_answers on quiz_answers.attempt_id = quiz_attempts.id
          where quiz_attempts.quiz_id = quizzes.id
            and quiz_attempts.participant_id = target_participant_id
            and quiz_answers.question_id = quiz_questions.id),
        'options', (select coalesce(jsonb_agg(jsonb_build_object(
          'id', quiz_options.id, 'position', quiz_options.position,
          'content', quiz_options.content,
          'isCorrect', quiz_options.id = any(quiz_answer_keys.correct_option_ids),
          'isSelected', exists (select 1 from public.quiz_attempts
            join public.quiz_answers on quiz_answers.attempt_id = quiz_attempts.id
            where quiz_attempts.quiz_id = quizzes.id
              and quiz_attempts.participant_id = target_participant_id
              and quiz_answers.question_id = quiz_questions.id
              and quiz_options.id = any(quiz_answers.selected_option_ids))
        ) order by quiz_options.position), '[]'::jsonb)
          from public.quiz_options join public.quiz_answer_keys
            on quiz_answer_keys.question_id = quiz_options.question_id
          where quiz_options.question_id = quiz_questions.id)
      ) order by quiz_questions.position), '[]'::jsonb)
        from public.quiz_questions where quiz_questions.quiz_id = quizzes.id)
    ) end
  ) order by sections.position), '[]'::jsonb)
  into section_data
  from public.sections left join public.quizzes on quizzes.section_id = sections.id
  where sections.lesson_id = p_lesson_id;

  return jsonb_build_object('sessionId', target_room.id, 'lessonId', p_lesson_id,
    'title', lesson_title, 'endedAt', target_room.ended_at, 'mssv', review_mssv,
    'sections', section_data);
end;
$$;

create or replace function private.get_teacher_room_summary(p_room_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  target_room public.rooms%rowtype; participant_data jsonb; participant_count integer;
  quiz_data jsonb; reaction_data jsonb; total_comments integer;
  anonymous_comments integer; named_comments integer; most_engaged_section jsonb;
begin
  select * into target_room from public.rooms
  where id = p_room_id and teacher_user_id = auth.uid() and status = 'ENDED';
  if not found then raise exception 'Room summary is not available.' using errcode = '42501'; end if;
  select count(*)::integer, coalesce(jsonb_agg(jsonb_build_object(
    'mssv', mssv, 'joinedAt', joined_at) order by joined_at, mssv), '[]'::jsonb)
  into participant_count, participant_data from public.participants where room_id = p_room_id;
  quiz_data := public.get_teacher_quiz_analytics(p_room_id)->'quizzes';

  select coalesce(jsonb_agg(jsonb_build_object(
    'sectionId', c.section_id, 'sectionPosition', c.section_position,
    'sectionTitle', c.section_title, 'understand', c.understand,
    'unsure', c.unsure, 'question', c.question
  ) order by c.lesson_created_at, c.section_position), '[]'::jsonb)
  into reaction_data from (
    select sections.id section_id, sections.position section_position,
      sections.title section_title, lessons.created_at lesson_created_at,
      count(section_reactions.id) filter (where participants.id is not null and reaction='UNDERSTAND')::integer understand,
      count(section_reactions.id) filter (where participants.id is not null and reaction='UNSURE')::integer unsure,
      count(section_reactions.id) filter (where participants.id is not null and reaction='QUESTION')::integer question
    from public.session_lessons
    join public.lessons on lessons.id = session_lessons.lesson_id
    join public.sections on sections.lesson_id = lessons.id
    left join public.section_reactions on section_reactions.section_id = sections.id
    left join public.participants on participants.id = section_reactions.participant_id and participants.room_id = p_room_id
    where session_lessons.session_id = p_room_id and sections.position <= session_lessons.released_through
    group by sections.id, sections.position, sections.title, lessons.title, lessons.created_at
  ) c;

  select count(*)::integer,
    count(*) filter (where section_comments.is_anonymous)::integer,
    count(*) filter (where not section_comments.is_anonymous)::integer
  into total_comments, anonymous_comments, named_comments
  from public.section_comments
  join public.sections on sections.id = section_comments.section_id
  join public.session_lessons on session_lessons.lesson_id = sections.lesson_id and session_lessons.session_id = p_room_id
  join public.participants on participants.id = section_comments.participant_id and participants.room_id = p_room_id;

  select jsonb_build_object('sectionId', e.section_id, 'sectionPosition', e.section_position,
    'sectionTitle', e.section_title, 'totalFeedback', e.total_feedback)
  into most_engaged_section from (
    select sections.id section_id, sections.position section_position,
      sections.title section_title,
      (select count(*) from public.section_reactions join public.participants
        on participants.id = section_reactions.participant_id
        where section_reactions.section_id = sections.id and participants.room_id = p_room_id)
      + (select count(*) from public.section_comments join public.participants
        on participants.id = section_comments.participant_id
        where section_comments.section_id = sections.id and participants.room_id = p_room_id) total_feedback
    from public.session_lessons
    join public.lessons on lessons.id = session_lessons.lesson_id
    join public.sections on sections.lesson_id = lessons.id
    where session_lessons.session_id = p_room_id and sections.position <= session_lessons.released_through
  ) e where e.total_feedback > 0 order by e.total_feedback desc, e.section_title limit 1;

  return jsonb_build_object(
    'room', jsonb_build_object('id', target_room.id, 'code', target_room.code,
      'title', target_room.title, 'startedAt', target_room.started_at, 'endedAt', target_room.ended_at),
    'participantCount', participant_count, 'participants', participant_data,
    'quizzes', quiz_data, 'reactions', reaction_data,
    'comments', jsonb_build_object('total', total_comments, 'anonymous', anonymous_comments, 'named', named_comments),
    'mostEngagedSection', most_engaged_section);
end;
$$;

create or replace function public.get_teacher_class_voices(p_room_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare target_room public.rooms%rowtype; participant_count integer; section_data jsonb;
begin
  select * into target_room from public.rooms
  where id = p_room_id and teacher_user_id = auth.uid() and status = 'ENDED';
  if not found then raise exception 'Class Voices are not available.' using errcode = '42501'; end if;
  select count(*)::integer into participant_count from public.participants where room_id = p_room_id;
  select coalesce(jsonb_agg(jsonb_build_object(
    'sectionId', sections.id, 'sectionPosition', sections.position,
    'sectionTitle', sections.title,
    'reactions', jsonb_build_object(
      'understand', (select count(*)::integer from public.section_reactions join public.participants
        on participants.id = section_reactions.participant_id
        where section_reactions.section_id = sections.id and participants.room_id = p_room_id and reaction='UNDERSTAND'),
      'unsure', (select count(*)::integer from public.section_reactions join public.participants
        on participants.id = section_reactions.participant_id
        where section_reactions.section_id = sections.id and participants.room_id = p_room_id and reaction='UNSURE'),
      'question', (select count(*)::integer from public.section_reactions join public.participants
        on participants.id = section_reactions.participant_id
        where section_reactions.section_id = sections.id and participants.room_id = p_room_id and reaction='QUESTION')),
    'comments', (select coalesce(jsonb_agg(jsonb_build_object(
      'id', section_comments.id, 'body', section_comments.body,
      'authorLabel', case when section_comments.is_anonymous then 'Anonymous' else participants.mssv end,
      'isAnonymous', section_comments.is_anonymous, 'createdAt', section_comments.created_at
    ) order by section_comments.created_at, section_comments.id), '[]'::jsonb)
      from public.section_comments join public.participants on participants.id = section_comments.participant_id
      where section_comments.section_id = sections.id and participants.room_id = p_room_id)
  ) order by lessons.created_at, sections.position), '[]'::jsonb)
  into section_data
  from public.session_lessons
  join public.lessons on lessons.id = session_lessons.lesson_id
  join public.sections on sections.lesson_id = lessons.id
  where session_lessons.session_id = p_room_id and sections.position <= session_lessons.released_through;
  return jsonb_build_object('roomId', target_room.id, 'roomTitle', target_room.title,
    'participantCount', participant_count, 'sections', section_data);
end;
$$;

create or replace function public.delete_owned_lesson(p_lesson_id uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_subject_id uuid; v_course_section_id uuid; v_room record; v_replacement record;
begin
  if not private.is_permanent_user() then
    raise exception 'Teacher account required.' using errcode = '42501';
  end if;
  select coalesce(lessons.subject_id, course_sections.subject_id), lessons.course_section_id
  into v_subject_id, v_course_section_id
  from public.lessons left join public.course_sections on course_sections.id = lessons.course_section_id
  join public.subjects on subjects.id = coalesce(lessons.subject_id, course_sections.subject_id)
  where lessons.id = p_lesson_id and subjects.teacher_id = auth.uid();
  if not found then raise exception 'Lesson is not available.' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_subject_id::text, 0));
  perform lessons.id from public.lessons where id = p_lesson_id for update;

  for v_room in select rooms.id from public.rooms where rooms.lesson_id = p_lesson_id for update loop
    select session_lessons.lesson_id, session_lessons.teaching_section, session_lessons.released_through
    into v_replacement
    from public.session_lessons
    where session_lessons.session_id = v_room.id and session_lessons.lesson_id <> p_lesson_id
    order by session_lessons.created_at, session_lessons.lesson_id limit 1;
    if v_replacement.lesson_id is null then
      delete from public.rooms where id = v_room.id;
    else
      update public.rooms set lesson_id = v_replacement.lesson_id,
        teaching_section = v_replacement.teaching_section,
        released_through = v_replacement.released_through
      where id = v_room.id;
    end if;
  end loop;
  delete from public.lessons where id = p_lesson_id;
  return p_lesson_id;
end;
$$;

create or replace function public.get_teacher_course_section_export(
  p_subject_id uuid, p_course_section_id uuid
)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare v_course_section public.course_sections%rowtype; v_total_lessons integer; v_students jsonb;
begin
  if not private.is_permanent_user() then raise exception 'Teacher account required.' using errcode = '42501'; end if;
  select course_sections.* into v_course_section
  from public.course_sections join public.subjects on subjects.id = course_sections.subject_id
  where course_sections.id = p_course_section_id and course_sections.subject_id = p_subject_id
    and subjects.teacher_id = auth.uid();
  if not found then return null; end if;
  select count(*)::integer into v_total_lessons from public.lessons
  where course_section_id = v_course_section.id;
  with attendance_totals as (
    select session_attendance.mssv,
      count(distinct session_lessons.lesson_id)::integer attended_lesson_count
    from public.session_attendance
    join public.rooms on rooms.id = session_attendance.session_id
    join public.session_lessons on session_lessons.session_id = rooms.id
    join public.lessons on lessons.id = session_lessons.lesson_id
    where session_attendance.joined_at is not null
      and lessons.course_section_id = v_course_section.id
    group by session_attendance.mssv
  ), speaking_totals as (
    select participants.mssv, sum(session_reflections.speaking_count)::bigint speaking_count
    from public.session_reflections
    join public.participants on participants.id = session_reflections.participant_id
    join public.rooms on rooms.id = participants.room_id
    where rooms.course_section_id = v_course_section.id
    group by participants.mssv
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'mssv', course_section_students.normalized_mssv,
    'speakingCount', coalesce(speaking_totals.speaking_count, 0),
    'attendedLessonCount', coalesce(attendance_totals.attended_lesson_count, 0)
  ) order by course_section_students.normalized_mssv), '[]'::jsonb)
  into v_students from public.course_section_students
  left join attendance_totals on attendance_totals.mssv = course_section_students.normalized_mssv
  left join speaking_totals on speaking_totals.mssv = course_section_students.normalized_mssv
  where course_section_students.course_section_id = v_course_section.id;
  return jsonb_build_object('subjectId', p_subject_id, 'courseSectionId', v_course_section.id,
    'courseSectionCode', v_course_section.section_code, 'courseSectionName', v_course_section.display_name,
    'totalLessons', v_total_lessons, 'students', v_students);
end;
$$;

revoke all on function private.lesson_is_in_session(uuid, uuid) from public, anon, authenticated;
revoke all on function public.start_chapter_session(uuid, uuid) from public, anon, authenticated;
revoke all on function public.start_lesson_session(uuid) from public, anon, authenticated;
revoke all on function public.join_live_chapter_session(uuid, text) from public, anon, authenticated;
revoke all on function public.join_live_lesson(uuid, text) from public, anon, authenticated;
revoke all on function public.release_session_lesson_section(uuid, uuid) from public, anon, authenticated;
revoke all on function public.release_section(uuid) from public, anon, authenticated;
revoke all on function public.get_student_session_lessons(uuid) from public, anon, authenticated;
revoke all on function public.get_teacher_session_lessons(uuid) from public, anon, authenticated;
revoke all on function public.get_student_session_lesson_snapshot(uuid, uuid) from public, anon, authenticated;
revoke all on function public.get_student_lesson_snapshot(uuid) from public, anon, authenticated;
revoke all on function public.get_public_live_sessions() from public, anon, authenticated;
revoke all on function public.get_student_ended_lesson_review(uuid, uuid) from public, anon, authenticated;
revoke all on function public.replace_course_section_roster(uuid, text[]) from public, anon, authenticated;

grant execute on function public.start_chapter_session(uuid, uuid) to authenticated;
grant execute on function public.start_lesson_session(uuid) to authenticated;
grant execute on function public.join_live_chapter_session(uuid, text) to authenticated;
grant execute on function public.join_live_lesson(uuid, text) to authenticated;
grant execute on function public.release_session_lesson_section(uuid, uuid) to authenticated;
grant execute on function public.release_section(uuid) to authenticated;
grant execute on function public.get_student_session_lessons(uuid) to authenticated;
grant execute on function public.get_teacher_session_lessons(uuid) to authenticated;
grant execute on function public.get_student_session_lesson_snapshot(uuid, uuid) to authenticated;
grant execute on function public.get_student_lesson_snapshot(uuid) to authenticated;
grant execute on function public.get_public_live_sessions() to anon, authenticated;
grant execute on function public.get_student_ended_lesson_review(uuid, uuid) to authenticated;
grant execute on function public.replace_course_section_roster(uuid, text[]) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.session_lessons;
exception
  when duplicate_object then null;
end;
$$;
