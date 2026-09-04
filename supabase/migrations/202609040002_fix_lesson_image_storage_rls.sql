create or replace function private.can_manage_lesson_image(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.is_permanent_user()
    and cardinality(storage.foldername(p_object_name)) = 2
    and (storage.foldername(p_object_name))[1] = auth.uid()::text
    and exists (
      select 1
      from public.subjects
      where subjects.id::text = (storage.foldername(p_object_name))[2]
        and subjects.teacher_id = auth.uid()
    );
$$;

revoke all on function private.can_manage_lesson_image(text) from public, anon, authenticated;
grant execute on function private.can_manage_lesson_image(text) to authenticated;

drop policy if exists "Teacher reads owned Lesson images" on storage.objects;
drop policy if exists "Teacher uploads owned Lesson images" on storage.objects;
drop policy if exists "Teacher updates owned Lesson images" on storage.objects;
drop policy if exists "Teacher deletes owned Lesson images" on storage.objects;

create policy "Teacher reads owned Lesson images"
on storage.objects for select
to authenticated
using (
  bucket_id = 'lesson-images'
  and (select private.can_manage_lesson_image(name))
);

create policy "Teacher uploads owned Lesson images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'lesson-images'
  and (select private.can_manage_lesson_image(name))
);

create policy "Teacher updates owned Lesson images"
on storage.objects for update
to authenticated
using (
  bucket_id = 'lesson-images'
  and (select private.can_manage_lesson_image(name))
)
with check (
  bucket_id = 'lesson-images'
  and (select private.can_manage_lesson_image(name))
);

create policy "Teacher deletes owned Lesson images"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'lesson-images'
  and (select private.can_manage_lesson_image(name))
);
