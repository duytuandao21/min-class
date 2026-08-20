create table public.room_feedback_events (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.rooms (id) on delete cascade,
  section_id uuid not null references public.sections (id) on delete cascade,
  kind text not null,
  created_at timestamptz not null default now(),
  constraint room_feedback_events_kind check (kind in ('REACTION', 'COMMENT'))
);

create index room_feedback_events_room_id_id_idx
on public.room_feedback_events (room_id, id desc);

alter table public.room_feedback_events enable row level security;

create policy room_feedback_events_select_teacher
on public.room_feedback_events for select to authenticated
using (private.is_room_teacher(room_id));

revoke all on public.room_feedback_events from anon, authenticated;
grant select on public.room_feedback_events to authenticated;

alter publication supabase_realtime add table public.room_feedback_events;

drop policy section_comments_select_authorized on public.section_comments;

create policy section_comments_select_authorized
on public.section_comments for select to authenticated
using (
  private.is_own_participant(participant_id)
  or (
    not is_anonymous
    and private.is_room_teacher(private.room_id_for_section(section_id))
  )
);

create function private.emit_room_feedback_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_kind text;
begin
  target_kind := case tg_table_name
    when 'section_reactions' then 'REACTION'
    when 'section_comments' then 'COMMENT'
    else null
  end;

  if target_kind is null then
    raise exception 'Unsupported feedback source.' using errcode = 'P0001';
  end if;

  insert into public.room_feedback_events (room_id, section_id, kind)
  values (private.room_id_for_section(new.section_id), new.section_id, target_kind);

  return new;
end;
$$;

create trigger section_reactions_emit_feedback
after insert or update of reaction on public.section_reactions
for each row execute function private.emit_room_feedback_event();

create trigger section_comments_emit_feedback
after insert on public.section_comments
for each row execute function private.emit_room_feedback_event();

create function public.set_section_reaction(
  p_section_id uuid,
  p_reaction public.reaction_type
)
returns table (
  section_id uuid,
  reaction public.reaction_type,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_participant_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '28000';
  end if;

  select participants.id
  into target_participant_id
  from public.sections
  join public.lessons on lessons.id = sections.lesson_id
  join public.rooms on rooms.id = lessons.room_id
  join public.participants
    on participants.room_id = rooms.id
   and participants.user_id = auth.uid()
  where sections.id = p_section_id
    and rooms.status = 'ACTIVE'
    and sections.position <= rooms.released_through;

  if target_participant_id is null then
    raise exception 'Section is not available for interaction.' using errcode = '42501';
  end if;

  insert into public.section_reactions (section_id, participant_id, reaction)
  values (p_section_id, target_participant_id, p_reaction)
  on conflict on constraint section_reactions_section_id_participant_id_key
  do update set reaction = excluded.reaction
  returning
    section_reactions.section_id,
    section_reactions.reaction,
    section_reactions.updated_at
  into section_id, reaction, updated_at;

  return next;
end;
$$;

create function public.create_section_comment(
  p_section_id uuid,
  p_body text,
  p_is_anonymous boolean
)
returns table (
  comment_id uuid,
  section_id uuid,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_participant_id uuid;
  normalized_body text := btrim(p_body);
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '28000';
  end if;

  if p_body is null
    or normalized_body is null
    or char_length(normalized_body) not between 1 and 500
    or p_is_anonymous is null
  then
    raise exception 'Comment must contain between 1 and 500 characters.' using errcode = '22023';
  end if;

  select participants.id
  into target_participant_id
  from public.sections
  join public.lessons on lessons.id = sections.lesson_id
  join public.rooms on rooms.id = lessons.room_id
  join public.participants
    on participants.room_id = rooms.id
   and participants.user_id = auth.uid()
  where sections.id = p_section_id
    and rooms.status = 'ACTIVE'
    and sections.position <= rooms.released_through;

  if target_participant_id is null then
    raise exception 'Section is not available for interaction.' using errcode = '42501';
  end if;

  insert into public.section_comments (section_id, participant_id, body, is_anonymous)
  values (p_section_id, target_participant_id, normalized_body, p_is_anonymous)
  returning
    section_comments.id,
    section_comments.section_id,
    section_comments.created_at
  into comment_id, section_id, created_at;

  return next;
end;
$$;

create function public.get_teacher_feedback_snapshot(p_room_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  reaction_data jsonb;
  comment_data jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '28000';
  end if;

  if not private.is_room_teacher(p_room_id) then
    raise exception 'Room feedback is not available.' using errcode = '42501';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'sectionId', counts.section_id,
        'sectionPosition', counts.section_position,
        'sectionTitle', counts.section_title,
        'understand', counts.understand,
        'unsure', counts.unsure,
        'question', counts.question
      )
      order by counts.section_position
    ),
    '[]'::jsonb
  )
  into reaction_data
  from (
    select
      sections.id as section_id,
      sections.position as section_position,
      sections.title as section_title,
      count(section_reactions.id) filter (where section_reactions.reaction = 'UNDERSTAND') as understand,
      count(section_reactions.id) filter (where section_reactions.reaction = 'UNSURE') as unsure,
      count(section_reactions.id) filter (where section_reactions.reaction = 'QUESTION') as question
    from public.sections
    join public.lessons on lessons.id = sections.lesson_id
    join public.rooms on rooms.id = lessons.room_id
    left join public.section_reactions on section_reactions.section_id = sections.id
    where rooms.id = p_room_id
      and sections.position <= rooms.released_through
    group by sections.id, sections.position, sections.title
  ) as counts;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', comments.id,
        'sectionId', comments.section_id,
        'sectionPosition', comments.section_position,
        'sectionTitle', comments.section_title,
        'body', comments.body,
        'authorLabel', comments.author_label,
        'isAnonymous', comments.is_anonymous,
        'createdAt', comments.created_at
      )
      order by comments.created_at desc
    ),
    '[]'::jsonb
  )
  into comment_data
  from (
    select
      section_comments.id,
      sections.id as section_id,
      sections.position as section_position,
      sections.title as section_title,
      section_comments.body,
      case
        when section_comments.is_anonymous then 'Anonymous'
        else participants.mssv
      end as author_label,
      section_comments.is_anonymous,
      section_comments.created_at
    from public.section_comments
    join public.sections on sections.id = section_comments.section_id
    join public.lessons on lessons.id = sections.lesson_id
    join public.rooms on rooms.id = lessons.room_id
    join public.participants on participants.id = section_comments.participant_id
    where rooms.id = p_room_id
    order by section_comments.created_at desc
    limit 30
  ) as comments;

  return jsonb_build_object(
    'reactions', reaction_data,
    'comments', comment_data
  );
end;
$$;

revoke all on function private.emit_room_feedback_event() from public, anon, authenticated;
revoke all on function public.set_section_reaction(uuid, public.reaction_type) from public, anon;
revoke all on function public.create_section_comment(uuid, text, boolean) from public, anon;
revoke all on function public.get_teacher_feedback_snapshot(uuid) from public, anon;

grant execute on function public.set_section_reaction(uuid, public.reaction_type) to authenticated;
grant execute on function public.create_section_comment(uuid, text, boolean) to authenticated;
grant execute on function public.get_teacher_feedback_snapshot(uuid) to authenticated;
