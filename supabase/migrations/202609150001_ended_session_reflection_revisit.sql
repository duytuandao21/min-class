-- A Student who re-verifies the same attended MSSV in another anonymous
-- browser session must be able to read the one-time reflection state.
-- When an existing browser switches MSSV, the current verified grant takes
-- precedence over its older participant.user_id association.
create function private.current_ended_reflection_participant_id(p_room_id uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select participants.id
  from public.participants
  where participants.room_id = p_room_id
    and participants.mssv = coalesce(
      (select grants.mssv from public.lesson_session_access_grants as grants
       where grants.room_id = p_room_id and grants.user_id = auth.uid()),
      (select own_participant.mssv from public.participants as own_participant
       where own_participant.room_id = p_room_id and own_participant.user_id = auth.uid()
       limit 1)
    )
  limit 1;
$$;

revoke all on function private.current_ended_reflection_participant_id(uuid) from public, anon, authenticated;

create or replace function public.get_own_session_reflection(p_room_id uuid)
returns table (
  reflection_id uuid,
  speaking_count integer,
  review_body text,
  updated_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
declare target_participant_id uuid;
begin
  if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) is not true then
    raise exception 'Session reflection is not available.' using errcode = '42501';
  end if;

  select private.current_ended_reflection_participant_id(rooms.id)
  into target_participant_id
  from public.rooms
  where rooms.id = p_room_id and rooms.status = 'ENDED';

  if target_participant_id is null then
    raise exception 'Session reflection is not available.' using errcode = '42501';
  end if;

  return query
  select session_reflections.id, session_reflections.speaking_count,
    session_reflections.review_body, session_reflections.updated_at
  from public.session_reflections
  where session_reflections.participant_id = target_participant_id;
end;
$$;

revoke all on function public.get_own_session_reflection(uuid) from public, anon, authenticated;
grant execute on function public.get_own_session_reflection(uuid) to authenticated;

create or replace function public.save_own_session_reflection(p_room_id uuid, p_speaking_count integer, p_review_body text)
returns table (reflection_id uuid, speaking_count integer, review_body text, updated_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare target_participant_id uuid; normalized_review_body text := nullif(btrim(coalesce(p_review_body, '')), '');
begin
  if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) is not true then
    raise exception 'Session reflection is not available.' using errcode = '42501';
  end if;
  if p_speaking_count is null or p_speaking_count not between 0 and 999 then
    raise exception 'Speaking count must be between 0 and 999.' using errcode = '22023';
  end if;
  if normalized_review_body is not null and char_length(normalized_review_body) > 1000 then
    raise exception 'Review must contain at most 1000 characters.' using errcode = '22023';
  end if;
  select private.current_ended_reflection_participant_id(rooms.id) into target_participant_id
  from public.rooms where rooms.id = p_room_id and rooms.status = 'ENDED' for share of rooms;
  if target_participant_id is null then raise exception 'Session reflection is not available.' using errcode = '42501'; end if;
  insert into public.session_reflections (participant_id, speaking_count, review_body)
  values (target_participant_id, p_speaking_count, normalized_review_body)
  returning session_reflections.id, session_reflections.speaking_count,
    session_reflections.review_body, session_reflections.updated_at
  into reflection_id, speaking_count, review_body, updated_at;
  return next;
exception when unique_violation then
  raise exception 'Session reflection has already been submitted.' using errcode = '23505';
end;
$$;

revoke all on function public.save_own_session_reflection(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.save_own_session_reflection(uuid, integer, text) to authenticated;
