create or replace function public.join_live_chapter_session(p_session_id uuid, p_mssv text)
returns table (room_id uuid, room_title text, room_status public.room_status, participant_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_room public.rooms%rowtype;
  existing_grant public.lesson_session_access_grants%rowtype;
  created_participant_id uuid;
  v_normalized_mssv text := upper(btrim(coalesce(p_mssv, '')));
  v_joined_at timestamptz := now();
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
      select 1
      from public.session_attendance
      where session_attendance.session_id = target_room.id
        and session_attendance.mssv = v_normalized_mssv
    )
  then
    raise exception 'Student is not in the Course Section.' using errcode = 'P0003';
  end if;

  select grants.* into existing_grant
  from public.lesson_session_access_grants as grants
  where grants.room_id = target_room.id
    and grants.user_id = auth.uid();

  if found and existing_grant.mssv is distinct from v_normalized_mssv then
    raise exception 'This browser session already represents another Student.' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(target_room.id::text || ':' || v_normalized_mssv, 0)
  );

  select participants.id, participants.joined_at
  into created_participant_id, v_joined_at
  from public.participants
  where participants.room_id = target_room.id
    and participants.mssv = v_normalized_mssv;

  if created_participant_id is null then
    v_joined_at := now();
    insert into public.participants (room_id, user_id, mssv, joined_at)
    values (target_room.id, auth.uid(), v_normalized_mssv, v_joined_at)
    returning participants.id into created_participant_id;
  end if;

  insert into public.lesson_session_access_grants (room_id, user_id, mssv)
  values (target_room.id, auth.uid(), v_normalized_mssv)
  on conflict on constraint lesson_session_access_grants_room_id_user_id_key
  do nothing;

  update public.session_attendance
  set joined_at = coalesce(session_attendance.joined_at, v_joined_at)
  where session_attendance.session_id = target_room.id
    and session_attendance.mssv = v_normalized_mssv;

  return query
  select target_room.id, target_room.title, target_room.status, created_participant_id;
end;
$$;

revoke all on function public.join_live_chapter_session(uuid, text)
from public, anon, authenticated;
grant execute on function public.join_live_chapter_session(uuid, text)
to authenticated;
