create table public.session_reflections (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null unique references public.participants(id) on delete cascade,
  speaking_count integer not null,
  review_body text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint session_reflections_speaking_count_valid check (speaking_count between 0 and 999),
  constraint session_reflections_review_body_valid check (
    review_body is null
    or (
      review_body = btrim(review_body)
      and char_length(review_body) between 1 and 1000
    )
  )
);

create trigger session_reflections_set_updated_at
before update on public.session_reflections
for each row execute function private.set_updated_at();

alter table public.session_reflections enable row level security;

revoke all on table public.session_reflections from public, anon, authenticated;

create function public.save_own_session_reflection(
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
  on conflict (participant_id)
  do update set
    speaking_count = excluded.speaking_count,
    review_body = excluded.review_body
  returning
    session_reflections.id,
    session_reflections.speaking_count,
    session_reflections.review_body,
    session_reflections.updated_at
  into reflection_id, speaking_count, review_body, updated_at;

  return next;
end;
$$;

create function public.get_own_session_reflection(p_room_id uuid)
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
  target_participant_id uuid;
begin
  if auth.uid() is null
    or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) is not true
  then
    raise exception 'Session reflection is not available.' using errcode = '42501';
  end if;

  select participants.id
  into target_participant_id
  from public.participants
  join public.rooms on rooms.id = participants.room_id
  where participants.room_id = p_room_id
    and participants.user_id = auth.uid()
    and rooms.status = 'ENDED';

  if not found then
    raise exception 'Session reflection is not available.' using errcode = '42501';
  end if;

  return query
  select
    session_reflections.id,
    session_reflections.speaking_count,
    session_reflections.review_body,
    session_reflections.updated_at
  from public.session_reflections
  where session_reflections.participant_id = target_participant_id;
end;
$$;

create function public.get_teacher_session_reflections(p_room_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_room public.rooms%rowtype;
  participant_count integer;
  reflection_data jsonb;
begin
  if auth.uid() is null or not private.is_permanent_user() then
    raise exception 'Session reflections are not available.' using errcode = '42501';
  end if;

  select rooms.*
  into target_room
  from public.rooms
  where rooms.id = p_room_id
    and rooms.teacher_user_id = auth.uid()
    and rooms.status = 'ENDED';

  if not found then
    raise exception 'Session reflections are not available.' using errcode = '42501';
  end if;

  select count(*)::integer
  into participant_count
  from public.participants
  where participants.room_id = target_room.id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', session_reflections.id,
        'mssv', participants.mssv,
        'speakingCount', session_reflections.speaking_count,
        'reviewBody', session_reflections.review_body,
        'submittedAt', session_reflections.updated_at
      )
      order by session_reflections.updated_at, session_reflections.id
    ),
    '[]'::jsonb
  )
  into reflection_data
  from public.session_reflections
  join public.participants on participants.id = session_reflections.participant_id
  where participants.room_id = target_room.id;

  return jsonb_build_object(
    'roomId', target_room.id,
    'roomTitle', target_room.title,
    'participantCount', participant_count,
    'submittedCount', jsonb_array_length(reflection_data),
    'reflections', reflection_data
  );
end;
$$;

revoke all on function public.save_own_session_reflection(uuid, integer, text) from public, anon, authenticated;
revoke all on function public.get_own_session_reflection(uuid) from public, anon, authenticated;
revoke all on function public.get_teacher_session_reflections(uuid) from public, anon, authenticated;

grant execute on function public.save_own_session_reflection(uuid, integer, text) to authenticated;
grant execute on function public.get_own_session_reflection(uuid) to authenticated;
grant execute on function public.get_teacher_session_reflections(uuid) to authenticated;
