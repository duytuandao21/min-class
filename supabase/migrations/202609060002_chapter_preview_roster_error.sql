-- Match the existing LIVE access feedback without exposing roster rows.
create or replace function public.get_student_chapter_preview(p_chapter_id uuid, p_mssv text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_course_id uuid;
  v_mssv text := upper(btrim(coalesce(p_mssv, '')));
  v_result jsonb;
begin
  if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) is not true
    or v_mssv !~ '^[A-Z0-9][A-Z0-9._-]{2,31}$' then
    raise exception 'Chapter preview is not available.' using errcode = '42501';
  end if;

  select c.course_section_id into v_course_id
  from public.chapters c
  where c.id = p_chapter_id;

  if v_course_id is null then
    raise exception 'Chapter preview is not available.' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock_shared(hashtextextended(v_course_id::text, 0));

  perform 1
  from public.chapters c
  where c.id = p_chapter_id
    and c.preview_enabled
    and not private.chapter_has_session(c.id)
  for share;

  if not found then
    raise exception 'Chapter preview is not available.' using errcode = '42501';
  end if;

  perform 1
  from public.course_section_students roster
  where roster.course_section_id = v_course_id
    and roster.normalized_mssv = v_mssv
  for share;

  if not found then
    raise exception 'Student is not in the Course Section.' using errcode = 'P0003';
  end if;

  select jsonb_build_object(
    'chapterId', c.id,
    'title', c.name,
    'lessons', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', l.id,
        'title', l.title,
        'sections', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', s.id,
            'title', s.title,
            'position', s.position,
            'type', s.type,
            'contentMd', case when s.type = 'QUIZ' then '' else s.content_md end
          ) order by s.position)
          from public.sections s
          where s.lesson_id = l.id
        ), '[]'::jsonb)
      ) order by l.title, l.id)
      from public.lessons l
      where l.chapter_id = c.id
        and l.course_section_id = v_course_id
    ), '[]'::jsonb)
  ) into v_result
  from public.chapters c
  where c.id = p_chapter_id;

  return v_result;
end;
$$;

revoke all on function public.get_student_chapter_preview(uuid, text)
from public, anon, authenticated;
grant execute on function public.get_student_chapter_preview(uuid, text)
to authenticated;
