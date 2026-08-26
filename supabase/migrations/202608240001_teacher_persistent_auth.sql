create function private.is_permanent_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((auth.jwt()->>'is_anonymous')::boolean, true) is false;
$$;

create or replace function private.is_room_teacher(target_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_permanent_user()
    and exists (
      select 1
      from public.rooms
      where rooms.id = target_room_id
        and rooms.teacher_user_id = auth.uid()
    );
$$;

create policy rooms_permanent_teacher_guard
on public.rooms
as restrictive
for all
to authenticated
using (
  teacher_user_id is distinct from auth.uid()
  or (select private.is_permanent_user())
)
with check (
  teacher_user_id is distinct from auth.uid()
  or (select private.is_permanent_user())
);

alter function public.create_room_with_lesson(text, text, jsonb) set schema private;
alter function public.start_room(uuid) set schema private;
alter function public.release_section(uuid) set schema private;
alter function public.end_room(uuid) set schema private;
alter function public.get_teacher_room_summary(uuid) set schema private;
alter function public.get_teacher_class_voices(uuid) set schema private;
alter function public.delete_room(uuid) set schema private;

revoke all on function private.is_permanent_user() from public, anon, authenticated;
revoke all on function private.create_room_with_lesson(text, text, jsonb) from public, anon, authenticated;
revoke all on function private.start_room(uuid) from public, anon, authenticated;
revoke all on function private.release_section(uuid) from public, anon, authenticated;
revoke all on function private.end_room(uuid) from public, anon, authenticated;
revoke all on function private.get_teacher_room_summary(uuid) from public, anon, authenticated;
revoke all on function private.get_teacher_class_voices(uuid) from public, anon, authenticated;
revoke all on function private.delete_room(uuid) from public, anon, authenticated;

create function public.create_room_with_lesson(
  p_room_title text,
  p_markdown_source text,
  p_lesson jsonb
)
returns table (
  room_id uuid,
  room_code text,
  room_title text,
  room_status public.room_status
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '28000';
  end if;

  if not private.is_permanent_user() then
    raise exception 'Teacher account required.' using errcode = '42501';
  end if;

  return query
  select *
  from private.create_room_with_lesson(p_room_title, p_markdown_source, p_lesson);
end;
$$;

create function public.start_room(p_room_id uuid)
returns table (
  room_id uuid,
  room_code text,
  room_status public.room_status,
  started_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '28000';
  end if;

  if not private.is_permanent_user() then
    raise exception 'Teacher account required.' using errcode = '42501';
  end if;

  return query select * from private.start_room(p_room_id);
end;
$$;

create function public.release_section(p_room_id uuid)
returns table (
  teaching_section integer,
  released_through integer
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '28000';
  end if;

  if not private.is_permanent_user() then
    raise exception 'Teacher account required.' using errcode = '42501';
  end if;

  return query select * from private.release_section(p_room_id);
end;
$$;

create function public.end_room(p_room_id uuid)
returns table (
  room_status public.room_status,
  room_ended_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '28000';
  end if;

  if not private.is_permanent_user() then
    raise exception 'Teacher account required.' using errcode = '42501';
  end if;

  return query select * from private.end_room(p_room_id);
end;
$$;

create function public.get_teacher_room_summary(p_room_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '28000';
  end if;

  if not private.is_permanent_user() then
    raise exception 'Teacher account required.' using errcode = '42501';
  end if;

  return private.get_teacher_room_summary(p_room_id);
end;
$$;

create function public.get_teacher_class_voices(p_room_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '28000';
  end if;

  if not private.is_permanent_user() then
    raise exception 'Teacher account required.' using errcode = '42501';
  end if;

  return private.get_teacher_class_voices(p_room_id);
end;
$$;

create function public.delete_room(p_room_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '28000';
  end if;

  if not private.is_permanent_user() then
    raise exception 'Teacher account required.' using errcode = '42501';
  end if;

  return private.delete_room(p_room_id);
end;
$$;

revoke all on function public.create_room_with_lesson(text, text, jsonb) from public, anon;
revoke all on function public.start_room(uuid) from public, anon;
revoke all on function public.release_section(uuid) from public, anon;
revoke all on function public.end_room(uuid) from public, anon;
revoke all on function public.get_teacher_room_summary(uuid) from public, anon;
revoke all on function public.get_teacher_class_voices(uuid) from public, anon;
revoke all on function public.delete_room(uuid) from public, anon;

grant execute on function public.create_room_with_lesson(text, text, jsonb) to authenticated;
grant execute on function public.start_room(uuid) to authenticated;
grant execute on function public.release_section(uuid) to authenticated;
grant execute on function public.end_room(uuid) to authenticated;
grant execute on function public.get_teacher_room_summary(uuid) to authenticated;
grant execute on function public.get_teacher_class_voices(uuid) to authenticated;
grant execute on function public.delete_room(uuid) to authenticated;
