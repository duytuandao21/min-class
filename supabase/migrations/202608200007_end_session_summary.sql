create function private.enforce_room_status_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status
    and not (
      (old.status = 'DRAFT' and new.status = 'ACTIVE')
      or (old.status = 'ACTIVE' and new.status = 'ENDED')
    )
  then
    raise exception 'Room status transition is not allowed.' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger rooms_enforce_status_transition
before update of status on public.rooms
for each row execute function private.enforce_room_status_transition();

create function public.end_room(p_room_id uuid)
returns table (
  room_status public.room_status,
  room_ended_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_room public.rooms%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '28000';
  end if;

  select rooms.*
  into target_room
  from public.rooms
  where rooms.id = p_room_id
  for update;

  if not found
    or target_room.teacher_user_id is distinct from auth.uid()
    or target_room.status <> 'ACTIVE'
  then
    raise exception 'Room cannot be ended.' using errcode = '42501';
  end if;

  update public.rooms
  set status = 'ENDED', ended_at = now()
  where rooms.id = target_room.id;

  return query
  select rooms.status, rooms.ended_at
  from public.rooms
  where rooms.id = target_room.id;
end;
$$;

create function public.get_teacher_room_summary(p_room_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_room public.rooms%rowtype;
  participant_data jsonb;
  participant_count integer;
  quiz_data jsonb;
  reaction_data jsonb;
  total_comments integer;
  anonymous_comments integer;
  named_comments integer;
  most_engaged_section jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '28000';
  end if;

  select rooms.*
  into target_room
  from public.rooms
  where rooms.id = p_room_id
    and rooms.teacher_user_id = auth.uid()
    and rooms.status = 'ENDED';

  if not found then
    raise exception 'Room summary is not available.' using errcode = '42501';
  end if;

  select
    count(*)::integer,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'mssv', participants.mssv,
          'joinedAt', participants.joined_at
        )
        order by participants.joined_at, participants.mssv
      ),
      '[]'::jsonb
    )
  into participant_count, participant_data
  from public.participants
  where participants.room_id = p_room_id;

  quiz_data := public.get_teacher_quiz_analytics(p_room_id)->'quizzes';

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'sectionId', section_counts.section_id,
        'sectionPosition', section_counts.section_position,
        'sectionTitle', section_counts.section_title,
        'understand', section_counts.understand,
        'unsure', section_counts.unsure,
        'question', section_counts.question
      )
      order by section_counts.section_position
    ),
    '[]'::jsonb
  )
  into reaction_data
  from (
    select
      sections.id as section_id,
      sections.position as section_position,
      sections.title as section_title,
      count(section_reactions.id) filter (where section_reactions.reaction = 'UNDERSTAND')::integer as understand,
      count(section_reactions.id) filter (where section_reactions.reaction = 'UNSURE')::integer as unsure,
      count(section_reactions.id) filter (where section_reactions.reaction = 'QUESTION')::integer as question
    from public.sections
    join public.lessons on lessons.id = sections.lesson_id
    left join public.section_reactions on section_reactions.section_id = sections.id
    where lessons.room_id = p_room_id
      and sections.position <= target_room.released_through
    group by sections.id, sections.position, sections.title
  ) as section_counts;

  select
    count(*)::integer,
    count(*) filter (where section_comments.is_anonymous)::integer,
    count(*) filter (where not section_comments.is_anonymous)::integer
  into total_comments, anonymous_comments, named_comments
  from public.section_comments
  join public.sections on sections.id = section_comments.section_id
  join public.lessons on lessons.id = sections.lesson_id
  where lessons.room_id = p_room_id;

  select jsonb_build_object(
    'sectionId', engagement.section_id,
    'sectionPosition', engagement.section_position,
    'sectionTitle', engagement.section_title,
    'totalFeedback', engagement.total_feedback
  )
  into most_engaged_section
  from (
    select
      sections.id as section_id,
      sections.position as section_position,
      sections.title as section_title,
      (
        (select count(*) from public.section_reactions where section_reactions.section_id = sections.id)
        + (select count(*) from public.section_comments where section_comments.section_id = sections.id)
      )::integer as total_feedback
    from public.sections
    join public.lessons on lessons.id = sections.lesson_id
    where lessons.room_id = p_room_id
      and sections.position <= target_room.released_through
  ) as engagement
  where engagement.total_feedback > 0
  order by engagement.total_feedback desc, engagement.section_position
  limit 1;

  return jsonb_build_object(
    'room', jsonb_build_object(
      'id', target_room.id,
      'code', target_room.code,
      'title', target_room.title,
      'startedAt', target_room.started_at,
      'endedAt', target_room.ended_at
    ),
    'participantCount', participant_count,
    'participants', participant_data,
    'quizzes', quiz_data,
    'reactions', reaction_data,
    'comments', jsonb_build_object(
      'total', total_comments,
      'anonymous', anonymous_comments,
      'named', named_comments
    ),
    'mostEngagedSection', most_engaged_section
  );
end;
$$;

revoke all on function private.enforce_room_status_transition() from public, anon, authenticated;
revoke all on function public.end_room(uuid) from public, anon;
revoke all on function public.get_teacher_room_summary(uuid) from public, anon;

grant execute on function public.end_room(uuid) to authenticated;
grant execute on function public.get_teacher_room_summary(uuid) to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'participants'
  ) then
    alter publication supabase_realtime add table public.participants;
  end if;
end;
$$;
