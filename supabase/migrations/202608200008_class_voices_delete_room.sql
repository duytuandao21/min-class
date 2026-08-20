create function public.get_teacher_class_voices(p_room_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_room public.rooms%rowtype;
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

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'sectionId', sections.id,
        'sectionPosition', sections.position,
        'sectionTitle', sections.title,
        'comments', (
          select jsonb_agg(
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
    and sections.position <= target_room.released_through
    and exists (
      select 1
      from public.section_comments
      where section_comments.section_id = sections.id
    );

  return jsonb_build_object(
    'roomId', target_room.id,
    'roomCode', target_room.code,
    'roomTitle', target_room.title,
    'sections', section_data
  );
end;
$$;

create function public.delete_room(p_room_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_room_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '28000';
  end if;

  select rooms.id
  into target_room_id
  from public.rooms
  where rooms.id = p_room_id
    and rooms.teacher_user_id = auth.uid()
  for update;

  if target_room_id is null then
    raise exception 'Room cannot be deleted.' using errcode = '42501';
  end if;

  delete from public.rooms
  where rooms.id = target_room_id;

  return target_room_id;
end;
$$;

revoke all on function public.get_teacher_class_voices(uuid) from public, anon;
revoke all on function public.delete_room(uuid) from public, anon;

grant execute on function public.get_teacher_class_voices(uuid) to authenticated;
grant execute on function public.delete_room(uuid) to authenticated;
