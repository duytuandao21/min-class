begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(7);

insert into auth.users (id, instance_id, aud, role, encrypted_password, email, created_at, updated_at, is_anonymous)
values
  ('d1000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', 'thaybao@minclass.local', now(), now(), false),
  ('d1000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', 'other@example.com', now(), now(), false),
  ('d1000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', null, now(), now(), true);

insert into public.subjects (id, teacher_id, name)
values
  ('d1100000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 'Owned Subject'),
  ('d1100000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000002', 'Other Subject');

select is((select public from storage.buckets where id = 'lesson-images'), true, 'Lesson image bucket is public for rendering');
select is((select file_size_limit from storage.buckets where id = 'lesson-images'), 5242880::bigint, 'Bucket limits images to 5 MB');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d1000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false,"email":"thaybao@minclass.local"}', true);

select lives_ok(
  $$insert into storage.objects (bucket_id, name) values ('lesson-images', 'd1000000-0000-4000-8000-000000000001/d1100000-0000-4000-8000-000000000001/owned.png')$$,
  'Teacher uploads an image under their own Subject path'
);
select is((select count(*) from storage.objects where name like 'd1000000-0000-4000-8000-000000000001/%'), 1::bigint, 'Teacher can read owned image metadata');
select throws_matching(
  $$insert into storage.objects (bucket_id, name) values ('lesson-images', 'd1000000-0000-4000-8000-000000000001/d1100000-0000-4000-8000-000000000002/cross-room.png')$$,
  'row-level security',
  'Teacher cannot upload into another owner Subject path'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d1000000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":false,"email":"other@example.com"}', true);
select throws_matching(
  $$insert into storage.objects (bucket_id, name) values ('lesson-images', 'd1000000-0000-4000-8000-000000000002/d1100000-0000-4000-8000-000000000002/not-teacher.png')$$,
  'row-level security',
  'A different permanent account cannot upload Lesson images'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d1000000-0000-4000-8000-000000000003","role":"authenticated","is_anonymous":true}', true);
select is((select count(*) from storage.objects where bucket_id = 'lesson-images'), 0::bigint, 'Anonymous Student cannot list Lesson images');
select throws_matching(
  $$insert into storage.objects (bucket_id, name) values ('lesson-images', 'd1000000-0000-4000-8000-000000000003/d1100000-0000-4000-8000-000000000001/anonymous.png')$$,
  'row-level security',
  'Anonymous Student cannot upload Lesson images'
);

select * from finish();
rollback;
