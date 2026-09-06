-- Preview is a Course Section chapter setting, never a teaching Session.
alter table public.chapters add column preview_enabled boolean not null default false;
alter table public.chapters add constraint chapters_preview_course_only
  check (not preview_enabled or course_section_id is not null);

create function private.chapter_has_session(p_chapter_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.rooms r where r.chapter_id = p_chapter_id)
    or exists (
      select 1 from public.lessons l
      join public.session_lessons sl on sl.lesson_id = l.id
      where l.chapter_id = p_chapter_id
    );
$$;
revoke all on function private.chapter_has_session(uuid) from public, anon, authenticated;

create function public.set_chapter_preview(p_chapter_id uuid, p_enabled boolean)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_course_id uuid;
begin
  if not private.is_permanent_user() or p_enabled is null then
    raise exception 'Chapter preview is not available.' using errcode = '42501';
  end if;
  select c.course_section_id into v_course_id
  from public.chapters c
  join public.course_sections cs on cs.id = c.course_section_id
  join public.subjects s on s.id = cs.subject_id
  where c.id = p_chapter_id and s.teacher_id = auth.uid();
  if v_course_id is null then
    raise exception 'Chapter preview is not available.' using errcode = '42501';
  end if;
  -- Same lock as start_chapter_session: opening and starting cannot race.
  perform pg_advisory_xact_lock(hashtextextended(v_course_id::text, 0));
  if private.chapter_has_session(p_chapter_id) or (p_enabled and not exists (
    select 1 from public.lessons l join public.sections s on s.lesson_id = l.id
    where l.chapter_id = p_chapter_id and l.course_section_id = v_course_id
  )) then
    raise exception 'Chapter preview is not available.' using errcode = '42501';
  end if;
  update public.chapters set preview_enabled = p_enabled where id = p_chapter_id;
  if not found then
    raise exception 'Chapter preview is not available.' using errcode = '42501';
  end if;
  return p_enabled;
end;
$$;
revoke all on function public.set_chapter_preview(uuid, boolean) from public, anon, authenticated;
grant execute on function public.set_chapter_preview(uuid, boolean) to authenticated;

-- Keep the catalog metadata-only; do not broaden table SELECT policies.
drop function public.get_public_course_section_chapters(uuid);
create function public.get_public_course_section_chapters(p_course_section_id uuid)
returns table (chapter_id uuid, chapter_name text, preview_enabled boolean)
language sql stable security definer set search_path = ''
as $$
  select c.id, c.name, c.preview_enabled and not private.chapter_has_session(c.id)
  from public.chapters c where c.course_section_id = p_course_section_id
  order by lower(c.name), c.name;
$$;
revoke all on function public.get_public_course_section_chapters(uuid) from public, anon, authenticated;
grant execute on function public.get_public_course_section_chapters(uuid) to anon, authenticated;

-- MSSV is verified on every read. No grants, participants or attendance are created.
create function public.get_student_chapter_preview(p_chapter_id uuid, p_mssv text)
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
  select c.course_section_id into v_course_id from public.chapters c where c.id = p_chapter_id;
  if v_course_id is null then
    raise exception 'Chapter preview is not available.' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock_shared(hashtextextended(v_course_id::text, 0));
  perform 1 from public.chapters c
  where c.id = p_chapter_id and c.preview_enabled
    and not private.chapter_has_session(c.id)
  for share;
  if not found then
    raise exception 'Chapter preview is not available.' using errcode = '42501';
  end if;
  perform 1 from public.course_section_students roster
  where roster.course_section_id = v_course_id and roster.normalized_mssv = v_mssv
  for share;
  if not found then
    raise exception 'Chapter preview is not available.' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'chapterId', c.id, 'title', c.name,
    'lessons', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', l.id, 'title', l.title,
        'sections', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', s.id, 'title', s.title, 'position', s.position, 'type', s.type,
            -- Never return original Markdown: it contains private quiz keys.
            'contentMd', case when s.type = 'QUIZ' then '' else s.content_md end
          ) order by s.position) from public.sections s where s.lesson_id = l.id
        ), '[]'::jsonb)
      ) order by l.title, l.id)
      from public.lessons l where l.chapter_id = c.id and l.course_section_id = v_course_id
    ), '[]'::jsonb)
  ) into v_result from public.chapters c where c.id = p_chapter_id;
  return v_result;
end;
$$;
revoke all on function public.get_student_chapter_preview(uuid, text) from public, anon, authenticated;
grant execute on function public.get_student_chapter_preview(uuid, text) to authenticated;
