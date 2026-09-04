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
  select *
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
  where participants.room_id = p_room_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'lessonId', lessons.id,
    'lessonTitle', lessons.title,
    'sectionId', sections.id,
    'sectionPosition', sections.position,
    'sectionTitle', sections.title,
    'reactions', jsonb_build_object(
      'understand', (
        select count(*)::integer
        from public.section_reactions
        join public.participants on participants.id = section_reactions.participant_id
        where section_reactions.section_id = sections.id
          and participants.room_id = p_room_id
          and section_reactions.reaction = 'UNDERSTAND'
      ),
      'unsure', (
        select count(*)::integer
        from public.section_reactions
        join public.participants on participants.id = section_reactions.participant_id
        where section_reactions.section_id = sections.id
          and participants.room_id = p_room_id
          and section_reactions.reaction = 'UNSURE'
      ),
      'question', (
        select count(*)::integer
        from public.section_reactions
        join public.participants on participants.id = section_reactions.participant_id
        where section_reactions.section_id = sections.id
          and participants.room_id = p_room_id
          and section_reactions.reaction = 'QUESTION'
      )
    ),
    'comments', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', section_comments.id,
        'body', section_comments.body,
        'authorLabel', case
          when section_comments.is_anonymous then 'Anonymous'
          else participants.mssv
        end,
        'isAnonymous', section_comments.is_anonymous,
        'createdAt', section_comments.created_at
      ) order by section_comments.created_at, section_comments.id), '[]'::jsonb)
      from public.section_comments
      join public.participants on participants.id = section_comments.participant_id
      where section_comments.section_id = sections.id
        and participants.room_id = p_room_id
    )
  ) order by lessons.created_at, lessons.id, sections.position), '[]'::jsonb)
  into section_data
  from public.session_lessons
  join public.lessons on lessons.id = session_lessons.lesson_id
  join public.sections on sections.lesson_id = lessons.id
  where session_lessons.session_id = p_room_id
    and sections.position <= session_lessons.released_through;

  return jsonb_build_object(
    'roomId', target_room.id,
    'roomTitle', target_room.title,
    'participantCount', participant_count,
    'sections', section_data
  );
end;
$$;

revoke all on function public.get_teacher_class_voices(uuid)
from public, anon, authenticated;
grant execute on function public.get_teacher_class_voices(uuid)
to authenticated;
