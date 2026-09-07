create function public.create_subject_template_lessons_batch(
  p_subject_id uuid,
  p_chapter_id uuid,
  p_lessons jsonb,
  p_apply_to_existing boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_created jsonb;
  v_result jsonb := '[]'::jsonb;
begin
  if not private.is_permanent_user() or not exists (
    select 1
    from public.chapters chapter
    join public.subjects subject on subject.id = chapter.subject_id
    where chapter.id = p_chapter_id
      and subject.id = p_subject_id
      and subject.teacher_id = auth.uid()
  ) then raise exception 'Chapter is not available.' using errcode = '42501'; end if;

  if p_lessons is null or jsonb_typeof(p_lessons) is distinct from 'array'
  then raise exception 'Lesson batch must be an array.' using errcode = '22023'; end if;
  if jsonb_array_length(p_lessons) not between 1 and 20
  then raise exception 'Lesson batch must contain between 1 and 20 items.' using errcode = '22023'; end if;

  if exists (
    select 1
    from jsonb_array_elements(p_lessons) item
    where jsonb_typeof(item) is distinct from 'object'
      or jsonb_typeof(item->'lessonTitle') is distinct from 'string'
      or jsonb_typeof(item->'markdownSource') is distinct from 'string'
      or jsonb_typeof(item->'lesson') is distinct from 'object'
  ) then raise exception 'Lesson batch contains an invalid item.' using errcode = '22023'; end if;

  if exists (
    select 1
    from jsonb_array_elements(p_lessons) item
    group by lower(item->>'lessonTitle')
    having count(*) > 1
  ) then raise exception 'Lesson titles must be unique within a batch.' using errcode = '23505'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_subject_id::text, 0));
  for v_item in select value from jsonb_array_elements(p_lessons)
  loop
    v_created := public.create_subject_template_lesson_synced(
      p_subject_id,
      p_chapter_id,
      v_item->>'lessonTitle',
      v_item->>'markdownSource',
      v_item->'lesson',
      coalesce(p_apply_to_existing, true)
    );
    v_result := v_result || jsonb_build_array(v_created);
  end loop;
  return v_result;
end;
$$;

revoke all on function public.create_subject_template_lessons_batch(uuid, uuid, jsonb, boolean)
from public, anon, authenticated;
grant execute on function public.create_subject_template_lessons_batch(uuid, uuid, jsonb, boolean)
to authenticated;
