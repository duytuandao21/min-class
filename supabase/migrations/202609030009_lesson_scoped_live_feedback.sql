create function public.get_teacher_lesson_feedback_snapshot(
  p_room_id uuid,
  p_lesson_id uuid
)
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
  if not private.is_room_teacher(p_room_id)
    or not exists (
      select 1
      from public.session_lessons
      where session_lessons.session_id = p_room_id
        and session_lessons.lesson_id = p_lesson_id
    )
  then
    raise exception 'Lesson feedback is not available.' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'sectionId', counts.section_id,
    'sectionPosition', counts.section_position,
    'sectionTitle', counts.section_title,
    'understand', counts.understand,
    'unsure', counts.unsure,
    'question', counts.question
  ) order by counts.section_position), '[]'::jsonb)
  into reaction_data
  from (
    select
      sections.id as section_id,
      sections.position as section_position,
      sections.title as section_title,
      count(section_reactions.id) filter (
        where participants.id is not null
          and section_reactions.reaction = 'UNDERSTAND'
      ) as understand,
      count(section_reactions.id) filter (
        where participants.id is not null
          and section_reactions.reaction = 'UNSURE'
      ) as unsure,
      count(section_reactions.id) filter (
        where participants.id is not null
          and section_reactions.reaction = 'QUESTION'
      ) as question
    from public.session_lessons
    join public.sections on sections.lesson_id = session_lessons.lesson_id
    left join public.section_reactions on section_reactions.section_id = sections.id
    left join public.participants on participants.id = section_reactions.participant_id
      and participants.room_id = p_room_id
    where session_lessons.session_id = p_room_id
      and session_lessons.lesson_id = p_lesson_id
      and sections.position <= session_lessons.released_through
    group by sections.id, sections.position, sections.title
  ) as counts;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', comments.id,
    'sectionId', comments.section_id,
    'sectionPosition', comments.section_position,
    'sectionTitle', comments.section_title,
    'body', comments.body,
    'authorLabel', comments.author_label,
    'isAnonymous', comments.is_anonymous,
    'createdAt', comments.created_at
  ) order by comments.created_at desc), '[]'::jsonb)
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
    from public.session_lessons
    join public.sections on sections.lesson_id = session_lessons.lesson_id
    join public.section_comments on section_comments.section_id = sections.id
    join public.participants on participants.id = section_comments.participant_id
      and participants.room_id = p_room_id
    where session_lessons.session_id = p_room_id
      and session_lessons.lesson_id = p_lesson_id
    order by section_comments.created_at desc
    limit 30
  ) as comments;

  return jsonb_build_object('reactions', reaction_data, 'comments', comment_data);
end;
$$;

revoke all on function public.get_teacher_lesson_feedback_snapshot(uuid, uuid)
from public, anon, authenticated;
grant execute on function public.get_teacher_lesson_feedback_snapshot(uuid, uuid)
to authenticated;
