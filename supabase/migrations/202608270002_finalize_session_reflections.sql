create or replace function public.save_own_session_reflection(
  p_room_id uuid,
  p_speaking_count integer,
  p_review_body text
)
returns table (
  reflection_id uuid,
  speaking_count integer,
  review_body text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_participant_id uuid;
  normalized_review_body text := nullif(btrim(coalesce(p_review_body, '')), '');
begin
  if auth.uid() is null
    or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) is not true
  then
    raise exception 'Session reflection is not available.' using errcode = '42501';
  end if;

  if p_speaking_count is null or p_speaking_count not between 0 and 999 then
    raise exception 'Speaking count must be between 0 and 999.' using errcode = '22023';
  end if;

  if normalized_review_body is not null and char_length(normalized_review_body) > 1000 then
    raise exception 'Review must contain at most 1000 characters.' using errcode = '22023';
  end if;

  select participants.id
  into target_participant_id
  from public.participants
  join public.rooms on rooms.id = participants.room_id
  where participants.room_id = p_room_id
    and participants.user_id = auth.uid()
    and rooms.status = 'ENDED'
  for share of rooms, participants;

  if not found then
    raise exception 'Session reflection is not available.' using errcode = '42501';
  end if;

  insert into public.session_reflections (participant_id, speaking_count, review_body)
  values (target_participant_id, p_speaking_count, normalized_review_body)
  returning
    session_reflections.id,
    session_reflections.speaking_count,
    session_reflections.review_body,
    session_reflections.updated_at
  into reflection_id, speaking_count, review_body, updated_at;

  return next;
exception
  when unique_violation then
    raise exception 'Session reflection has already been submitted.' using errcode = '23505';
end;
$$;

grant select on table public.session_reflections to authenticated;

create policy session_reflections_select_authorized
on public.session_reflections for select to authenticated
using (
  exists (
    select 1
    from public.participants
    join public.rooms on rooms.id = participants.room_id
    where participants.id = session_reflections.participant_id
      and (
        (
          participants.user_id = auth.uid()
          and coalesce((auth.jwt()->>'is_anonymous')::boolean, false) is true
        )
        or (
          rooms.teacher_user_id = auth.uid()
          and private.is_permanent_user()
        )
      )
  )
);

do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'session_reflections'
  ) then
    alter publication supabase_realtime add table public.session_reflections;
  end if;
end;
$$;

create function public.get_ended_session_reflection(p_room_id uuid)
returns table (
  reflection_id uuid,
  speaking_count integer,
  review_body text,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_room public.rooms%rowtype;
  review_mssv text;
begin
  if auth.uid() is null
    or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) is not true
  then
    raise exception 'Session reflection is not available.' using errcode = '42501';
  end if;

  select rooms.*
  into target_room
  from public.rooms
  join public.lesson_session_access_grants
    on lesson_session_access_grants.room_id = rooms.id
   and lesson_session_access_grants.user_id = auth.uid()
  where rooms.id = p_room_id
    and rooms.status = 'ENDED'
    and rooms.lesson_id is not null;

  if not found then
    raise exception 'Session reflection is not available.' using errcode = '42501';
  end if;

  select lesson_session_access_grants.mssv
  into review_mssv
  from public.lesson_session_access_grants
  where lesson_session_access_grants.room_id = target_room.id
    and lesson_session_access_grants.user_id = auth.uid();

  if exists (
    select 1
    from public.rooms as live_rooms
    where live_rooms.lesson_id = target_room.lesson_id
      and live_rooms.status = 'ACTIVE'
  ) then
    raise exception 'Session reflection is not available.' using errcode = '42501';
  end if;

  return query
  select
    session_reflections.id,
    session_reflections.speaking_count,
    session_reflections.review_body,
    session_reflections.updated_at
  from public.session_reflections
  join public.participants on participants.id = session_reflections.participant_id
  where participants.room_id = target_room.id
    and participants.mssv = review_mssv;
end;
$$;

revoke all on function public.get_ended_session_reflection(uuid) from public, anon, authenticated;
grant execute on function public.get_ended_session_reflection(uuid) to authenticated;
