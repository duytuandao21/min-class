alter table public.lesson_session_access_grants
drop constraint if exists lesson_session_access_grants_room_id_mssv_key;

create or replace function public.access_ended_lesson_session(
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
  join public.session_attendance
    on session_attendance.session_id = rooms.id
  where rooms.lesson_id = p_lesson_id
    and rooms.status = 'ENDED'
    and session_attendance.mssv = normalized_mssv
    and not exists (
      select 1
      from public.rooms as live_rooms
      where live_rooms.lesson_id = p_lesson_id
        and live_rooms.status = 'ACTIVE'
    )
  order by rooms.ended_at desc
  limit 1;

  if target_room_id is null then
    raise exception 'Lesson access denied.' using errcode = '42501';
  end if;

  insert into public.lesson_session_access_grants (room_id, user_id, mssv)
  values (target_room_id, auth.uid(), normalized_mssv)
  on conflict (room_id, user_id)
  do update set mssv = excluded.mssv;

  return query select target_room_id, p_lesson_id, 'ENDED'::text;
end;
$$;

revoke all on function public.access_ended_lesson_session(uuid, text) from public, anon, authenticated;
grant execute on function public.access_ended_lesson_session(uuid, text) to authenticated;
