insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'lesson-images',
  'lesson-images',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Teacher reads owned Lesson images"
on storage.objects for select
to authenticated
using (
  bucket_id = 'lesson-images'
  and private.is_permanent_user()
  and array_length(storage.foldername(name), 1) = 2
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1 from public.subjects
    where subjects.id::text = (storage.foldername(name))[2]
      and subjects.teacher_id = auth.uid()
  )
);

create policy "Teacher uploads owned Lesson images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'lesson-images'
  and private.is_permanent_user()
  and array_length(storage.foldername(name), 1) = 2
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1 from public.subjects
    where subjects.id::text = (storage.foldername(name))[2]
      and subjects.teacher_id = auth.uid()
  )
);

create policy "Teacher updates owned Lesson images"
on storage.objects for update
to authenticated
using (
  bucket_id = 'lesson-images'
  and private.is_permanent_user()
  and array_length(storage.foldername(name), 1) = 2
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1 from public.subjects
    where subjects.id::text = (storage.foldername(name))[2]
      and subjects.teacher_id = auth.uid()
  )
)
with check (
  bucket_id = 'lesson-images'
  and private.is_permanent_user()
  and array_length(storage.foldername(name), 1) = 2
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1 from public.subjects
    where subjects.id::text = (storage.foldername(name))[2]
      and subjects.teacher_id = auth.uid()
  )
);

create policy "Teacher deletes owned Lesson images"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'lesson-images'
  and private.is_permanent_user()
  and array_length(storage.foldername(name), 1) = 2
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1 from public.subjects
    where subjects.id::text = (storage.foldername(name))[2]
      and subjects.teacher_id = auth.uid()
  )
);
