create function private.is_teacher_account()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((auth.jwt()->>'is_anonymous')::boolean, true) is false
    and lower(coalesce(auth.jwt()->>'email', '')) = 'thaybao@minclass.local';
$$;

create or replace function private.is_permanent_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_teacher_account();
$$;

revoke all on function private.is_teacher_account() from public, anon, authenticated;
revoke all on function private.is_permanent_user() from public, anon, authenticated;
