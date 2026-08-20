create or replace function public.get_teacher_class_voices(p_room_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_room public.rooms%rowtype;
  participant_count integer;
  section_data jsonb;
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
    raise exception 'Class Voices are not available.' using errcode = '42501';
  end if;

  select count(*)::integer
  into participant_count
  from public.participants
  where participants.room_id = target_room.id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'sectionId', sections.id,
        'sectionPosition', sections.position,
        'sectionTitle', sections.title,
        'reactions', jsonb_build_object(
          'understand', (
            select count(*)::integer
            from public.section_reactions
            where section_reactions.section_id = sections.id
              and section_reactions.reaction = 'UNDERSTAND'
          ),
          'unsure', (
            select count(*)::integer
            from public.section_reactions
            where section_reactions.section_id = sections.id
              and section_reactions.reaction = 'UNSURE'
          ),
          'question', (
            select count(*)::integer
            from public.section_reactions
            where section_reactions.section_id = sections.id
              and section_reactions.reaction = 'QUESTION'
          )
        ),
        'comments', (
          select coalesce(
            jsonb_agg(
              jsonb_build_object(
                'id', section_comments.id,
                'body', section_comments.body,
                'authorLabel', case
                  when section_comments.is_anonymous then 'Anonymous'
                  else participants.mssv
                end,
                'isAnonymous', section_comments.is_anonymous,
                'createdAt', section_comments.created_at
              )
              order by section_comments.created_at, section_comments.id
            ),
            '[]'::jsonb
          )
          from public.section_comments
          join public.participants on participants.id = section_comments.participant_id
          where section_comments.section_id = sections.id
        )
      )
      order by sections.position
    ),
    '[]'::jsonb
  )
  into section_data
  from public.sections
  join public.lessons on lessons.id = sections.lesson_id
  where lessons.room_id = target_room.id
    and sections.position <= target_room.released_through;

  return jsonb_build_object(
    'roomId', target_room.id,
    'roomCode', target_room.code,
    'roomTitle', target_room.title,
    'participantCount', participant_count,
    'sections', section_data
  );
end;
$$;

revoke all on function public.get_teacher_class_voices(uuid) from public, anon;
grant execute on function public.get_teacher_class_voices(uuid) to authenticated;
