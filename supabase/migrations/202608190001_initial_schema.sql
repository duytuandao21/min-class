create schema if not exists private;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create type public.room_status as enum ('DRAFT', 'ACTIVE', 'ENDED');
create type public.section_type as enum ('CONTENT', 'QUIZ', 'REFLECTION');
create type public.reaction_type as enum ('UNDERSTAND', 'UNSURE', 'QUESTION');
create type public.quiz_question_type as enum (
  'SINGLE_CHOICE',
  'MULTIPLE_CHOICE',
  'TRUE_FALSE'
);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  teacher_user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  status public.room_status not null default 'DRAFT',
  teaching_section integer not null default 0,
  released_through integer not null default -1,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  ended_at timestamptz,
  constraint rooms_code_format check (code ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$'),
  constraint rooms_title_length check (
    title = btrim(title)
    and char_length(title) between 1 and 120
  ),
  constraint rooms_section_positions check (
    teaching_section >= 0
    and released_through >= -1
    and released_through <= teaching_section
  ),
  constraint rooms_lifecycle check (
    (status = 'DRAFT' and started_at is null and ended_at is null)
    or (status = 'ACTIVE' and started_at is not null and ended_at is null)
    or (status = 'ENDED' and started_at is not null and ended_at is not null)
  )
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null unique references public.rooms (id) on delete cascade,
  title text not null,
  description text,
  markdown_source text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lessons_title_length check (
    title = btrim(title)
    and char_length(title) between 1 and 200
  ),
  constraint lessons_description_length check (
    description is null or char_length(description) <= 1000
  ),
  constraint lessons_markdown_not_empty check (char_length(markdown_source) > 0),
  constraint lessons_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create table public.sections (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  position integer not null,
  type public.section_type not null,
  title text not null,
  content_md text not null default '',
  created_at timestamptz not null default now(),
  constraint sections_position_nonnegative check (position >= 0),
  constraint sections_title_length check (
    title = btrim(title)
    and char_length(title) between 1 and 200
  ),
  unique (lesson_id, position)
);

create table public.participants (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  mssv text not null,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint participants_mssv_format check (mssv ~ '^[A-Z0-9][A-Z0-9._-]{2,31}$'),
  unique (room_id, mssv),
  unique (room_id, user_id)
);

create table public.section_reactions (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.sections (id) on delete cascade,
  participant_id uuid not null references public.participants (id) on delete cascade,
  reaction public.reaction_type not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (section_id, participant_id)
);

create table public.section_comments (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.sections (id) on delete cascade,
  participant_id uuid not null references public.participants (id) on delete cascade,
  body text not null,
  is_anonymous boolean not null default true,
  created_at timestamptz not null default now(),
  constraint section_comments_body_length check (
    body = btrim(body)
    and char_length(body) between 1 and 500
  )
);

create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null unique references public.sections (id) on delete cascade,
  title text not null,
  created_at timestamptz not null default now(),
  constraint quizzes_title_length check (
    title = btrim(title)
    and char_length(title) between 1 and 200
  )
);

create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  position integer not null,
  type public.quiz_question_type not null,
  question_text text not null,
  constraint quiz_questions_position_nonnegative check (position >= 0),
  constraint quiz_questions_text_length check (
    question_text = btrim(question_text)
    and char_length(question_text) between 1 and 1000
  ),
  unique (quiz_id, position)
);

create table public.quiz_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.quiz_questions (id) on delete cascade,
  position integer not null,
  content text not null,
  constraint quiz_options_position_nonnegative check (position >= 0),
  constraint quiz_options_content_length check (
    content = btrim(content)
    and char_length(content) between 1 and 500
  ),
  unique (question_id, position)
);

create table public.quiz_answer_keys (
  question_id uuid primary key references public.quiz_questions (id) on delete cascade,
  correct_option_ids uuid[] not null,
  constraint quiz_answer_keys_not_empty check (cardinality(correct_option_ids) > 0)
);

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  participant_id uuid not null references public.participants (id) on delete cascade,
  score integer not null,
  total_questions integer not null,
  submitted_at timestamptz not null default now(),
  constraint quiz_attempts_score_range check (
    total_questions > 0
    and score between 0 and total_questions
  ),
  unique (quiz_id, participant_id)
);

create table public.quiz_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.quiz_attempts (id) on delete cascade,
  question_id uuid not null references public.quiz_questions (id) on delete cascade,
  selected_option_ids uuid[] not null,
  is_correct boolean not null,
  constraint quiz_answers_selection_not_empty check (cardinality(selected_option_ids) > 0),
  unique (attempt_id, question_id)
);

create index rooms_teacher_user_id_idx on public.rooms (teacher_user_id);
create index sections_lesson_id_idx on public.sections (lesson_id);
create index participants_user_id_idx on public.participants (user_id);
create index section_reactions_section_id_idx on public.section_reactions (section_id);
create index section_reactions_participant_id_idx on public.section_reactions (participant_id);
create index section_comments_section_created_at_idx
  on public.section_comments (section_id, created_at desc);
create index section_comments_participant_id_idx on public.section_comments (participant_id);
create index quizzes_section_id_idx on public.quizzes (section_id);
create index quiz_questions_quiz_id_idx on public.quiz_questions (quiz_id);
create index quiz_options_question_id_idx on public.quiz_options (question_id);
create index quiz_attempts_participant_id_idx on public.quiz_attempts (participant_id);
create index quiz_answers_question_id_idx on public.quiz_answers (question_id);

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger lessons_set_updated_at
before update on public.lessons
for each row execute function private.set_updated_at();

create trigger section_reactions_set_updated_at
before update on public.section_reactions
for each row execute function private.set_updated_at();

create function private.room_id_for_section(target_section_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select lessons.room_id
  from public.sections
  join public.lessons on lessons.id = sections.lesson_id
  where sections.id = target_section_id;
$$;

create function private.room_id_for_quiz(target_quiz_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select private.room_id_for_section(quizzes.section_id)
  from public.quizzes
  where quizzes.id = target_quiz_id;
$$;

create function private.room_id_for_question(target_question_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select private.room_id_for_quiz(quiz_questions.quiz_id)
  from public.quiz_questions
  where quiz_questions.id = target_question_id;
$$;

create function private.is_room_teacher(target_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.rooms
    where rooms.id = target_room_id
      and rooms.teacher_user_id = auth.uid()
  );
$$;

create function private.is_room_participant(target_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.participants
    where participants.room_id = target_room_id
      and participants.user_id = auth.uid()
  );
$$;

create function private.is_own_participant(target_participant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.participants
    where participants.id = target_participant_id
      and participants.user_id = auth.uid()
  );
$$;

create function private.can_interact_with_section(
  target_section_id uuid,
  target_participant_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.sections
    join public.lessons on lessons.id = sections.lesson_id
    join public.rooms on rooms.id = lessons.room_id
    join public.participants
      on participants.room_id = rooms.id
     and participants.id = target_participant_id
    where sections.id = target_section_id
      and participants.user_id = auth.uid()
      and rooms.status = 'ACTIVE'
      and sections.position <= rooms.released_through
  );
$$;

create function private.can_read_section(target_section_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.sections
    join public.lessons on lessons.id = sections.lesson_id
    join public.rooms on rooms.id = lessons.room_id
    where sections.id = target_section_id
      and (
        rooms.teacher_user_id = auth.uid()
        or (
          sections.position <= rooms.released_through
          and exists (
            select 1
            from public.participants
            where participants.room_id = rooms.id
              and participants.user_id = auth.uid()
          )
        )
      )
  );
$$;

create function private.can_read_quiz(target_quiz_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.quizzes
    where quizzes.id = target_quiz_id
      and private.can_read_section(quizzes.section_id)
  );
$$;

create function private.can_read_question(target_question_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.quiz_questions
    where quiz_questions.id = target_question_id
      and private.can_read_quiz(quiz_questions.quiz_id)
  );
$$;

create function private.validate_same_room()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  participant_room_id uuid;
begin
  select participants.room_id
  into participant_room_id
  from public.participants
  where participants.id = new.participant_id;

  if participant_room_id is null then
    raise exception 'Participant does not exist.' using errcode = '23514';
  end if;

  perform rooms.id
  from public.sections
  join public.lessons on lessons.id = sections.lesson_id
  join public.rooms on rooms.id = lessons.room_id
  where sections.id = new.section_id
    and rooms.id = participant_room_id
    and rooms.status = 'ACTIVE'
    and sections.position <= rooms.released_through
  for share of rooms;

  if not found then
    raise exception 'Section is not available for interaction.' using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger section_reactions_validate_same_room
before insert or update on public.section_reactions
for each row execute function private.validate_same_room();

create trigger section_comments_validate_same_room
before insert or update on public.section_comments
for each row execute function private.validate_same_room();

create function private.validate_quiz_section()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.sections
    where sections.id = new.section_id
      and sections.type = 'QUIZ'
  ) then
    raise exception 'A quiz must belong to a QUIZ section.' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger quizzes_validate_section
before insert or update on public.quizzes
for each row execute function private.validate_quiz_section();

create function private.validate_quiz_answer_key()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  question_type public.quiz_question_type;
begin
  select quiz_questions.type
  into question_type
  from public.quiz_questions
  where quiz_questions.id = new.question_id;

  if question_type is null then
    raise exception 'Quiz question does not exist.' using errcode = '23503';
  end if;

  if cardinality(new.correct_option_ids) <> (
    select count(distinct option_id)
    from unnest(new.correct_option_ids) as option_id
  ) then
    raise exception 'Correct options must be unique.' using errcode = '23514';
  end if;

  if exists (
    select 1
    from unnest(new.correct_option_ids) as option_id
    where not exists (
      select 1
      from public.quiz_options
      where quiz_options.id = option_id
        and quiz_options.question_id = new.question_id
    )
  ) then
    raise exception 'Correct options must belong to the question.' using errcode = '23514';
  end if;

  if question_type in ('SINGLE_CHOICE', 'TRUE_FALSE')
     and cardinality(new.correct_option_ids) <> 1 then
    raise exception 'This question type requires exactly one correct option.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger quiz_answer_keys_validate
before insert or update on public.quiz_answer_keys
for each row execute function private.validate_quiz_answer_key();

create function public.join_room(p_room_code text, p_mssv text)
returns table (
  room_id uuid,
  room_code text,
  room_title text,
  room_status public.room_status,
  participant_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_room public.rooms%rowtype;
  normalized_code text := upper(btrim(p_room_code));
  normalized_mssv text := upper(btrim(p_mssv));
  created_participant_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '28000';
  end if;

  if normalized_code !~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$'
     or normalized_mssv !~ '^[A-Z0-9][A-Z0-9._-]{2,31}$' then
    raise exception 'Invalid room code or MSSV.' using errcode = '22023';
  end if;

  select rooms.*
  into target_room
  from public.rooms
  where rooms.code = normalized_code
    and rooms.status = 'ACTIVE'
  for update;

  if not found then
    raise exception 'Room is not available.' using errcode = 'P0001';
  end if;

  insert into public.participants (room_id, user_id, mssv)
  values (target_room.id, auth.uid(), normalized_mssv)
  returning id into created_participant_id;

  return query
  select
    target_room.id,
    target_room.code,
    target_room.title,
    target_room.status,
    created_participant_id;
exception
  when unique_violation then
    raise exception 'This MSSV or user has already joined the room.' using errcode = '23505';
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
declare
  target_room public.rooms%rowtype;
  next_position integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '28000';
  end if;

  select rooms.*
  into target_room
  from public.rooms
  where rooms.id = p_room_id
  for update;

  if not found
     or target_room.teacher_user_id is distinct from auth.uid()
     or target_room.status <> 'ACTIVE' then
    raise exception 'Room cannot release a section.' using errcode = '42501';
  end if;

  if target_room.released_through >= target_room.teaching_section then
    raise exception 'The current section is already released.' using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.sections
    join public.lessons on lessons.id = sections.lesson_id
    where lessons.room_id = target_room.id
      and sections.position = target_room.teaching_section
  ) then
    raise exception 'The current section does not exist.' using errcode = 'P0001';
  end if;

  select min(sections.position)
  into next_position
  from public.sections
  join public.lessons on lessons.id = sections.lesson_id
  where lessons.room_id = target_room.id
    and sections.position > target_room.teaching_section;

  update public.rooms
  set
    released_through = target_room.teaching_section,
    teaching_section = coalesce(next_position, target_room.teaching_section)
  where rooms.id = target_room.id;

  return query
  select rooms.teaching_section, rooms.released_through
  from public.rooms
  where rooms.id = target_room.id;
end;
$$;

create function public.submit_quiz(p_quiz_id uuid, p_answers jsonb)
returns table (
  attempt_id uuid,
  score integer,
  total_questions integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_participant_id uuid;
  target_room_id uuid;
  question_count integer;
  correct_count integer;
  created_attempt_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '28000';
  end if;

  if jsonb_typeof(p_answers) <> 'array' or jsonb_array_length(p_answers) = 0 then
    raise exception 'Answers must be a non-empty array.' using errcode = '22023';
  end if;

  lock table
    public.quiz_questions,
    public.quiz_options,
    public.quiz_answer_keys
  in share mode;

  select rooms.id
  into target_room_id
  from public.quizzes
  join public.sections on sections.id = quizzes.section_id
  join public.lessons on lessons.id = sections.lesson_id
  join public.rooms on rooms.id = lessons.room_id
  where quizzes.id = p_quiz_id
    and rooms.status = 'ACTIVE'
    and sections.position <= rooms.released_through
  for share of quizzes, sections, lessons, rooms;

  if target_room_id is null then
    raise exception 'Quiz is not available.' using errcode = '42501';
  end if;

  select participants.id
  into target_participant_id
  from public.participants
  where participants.room_id = target_room_id
    and participants.user_id = auth.uid();

  if target_participant_id is null then
    raise exception 'Participant not found.' using errcode = '42501';
  end if;

  select count(*)
  into question_count
  from public.quiz_questions
  where quiz_questions.quiz_id = p_quiz_id;

  if question_count = 0 or jsonb_array_length(p_answers) <> question_count then
    raise exception 'Every quiz question must be answered exactly once.' using errcode = '22023';
  end if;

  if exists (
    with submitted as (
      select
        (answer ->> 'question_id')::uuid as question_id,
        array(
          select jsonb_array_elements_text(answer -> 'selected_option_ids')::uuid
        ) as selected_option_ids
      from jsonb_array_elements(p_answers) as answer
    )
    select 1
    from submitted
    left join public.quiz_questions
      on quiz_questions.id = submitted.question_id
     and quiz_questions.quiz_id = p_quiz_id
    where quiz_questions.id is null
       or cardinality(submitted.selected_option_ids) = 0
       or cardinality(submitted.selected_option_ids) <> (
         select count(distinct selected_option_id)
         from unnest(submitted.selected_option_ids) as selected_option_id
       )
       or (
         quiz_questions.type in ('SINGLE_CHOICE', 'TRUE_FALSE')
         and cardinality(submitted.selected_option_ids) <> 1
       )
       or exists (
         select 1
         from unnest(submitted.selected_option_ids) as selected_option_id
         where not exists (
           select 1
           from public.quiz_options
           where quiz_options.id = selected_option_id
             and quiz_options.question_id = submitted.question_id
         )
       )
  ) then
    raise exception 'Quiz answers are invalid.' using errcode = '22023';
  end if;

  if (
    select count(distinct (answer ->> 'question_id')::uuid)
    from jsonb_array_elements(p_answers) as answer
  ) <> question_count then
    raise exception 'Every quiz question must be answered exactly once.' using errcode = '22023';
  end if;

  with submitted as (
    select
      (answer ->> 'question_id')::uuid as question_id,
      array(
        select jsonb_array_elements_text(answer -> 'selected_option_ids')::uuid
      ) as selected_option_ids
    from jsonb_array_elements(p_answers) as answer
  )
  select count(*) filter (
    where cardinality(submitted.selected_option_ids) = cardinality(quiz_answer_keys.correct_option_ids)
      and submitted.selected_option_ids @> quiz_answer_keys.correct_option_ids
      and submitted.selected_option_ids <@ quiz_answer_keys.correct_option_ids
  )
  into correct_count
  from submitted
  join public.quiz_answer_keys using (question_id);

  if (
    select count(*)
    from public.quiz_answer_keys
    join public.quiz_questions
      on quiz_questions.id = quiz_answer_keys.question_id
    where quiz_questions.quiz_id = p_quiz_id
  ) <> question_count then
    raise exception 'Quiz answer keys are incomplete.' using errcode = 'P0001';
  end if;

  insert into public.quiz_attempts (quiz_id, participant_id, score, total_questions)
  values (p_quiz_id, target_participant_id, correct_count, question_count)
  returning id into created_attempt_id;

  with submitted as (
    select
      (answer ->> 'question_id')::uuid as question_id,
      array(
        select jsonb_array_elements_text(answer -> 'selected_option_ids')::uuid
      ) as selected_option_ids
    from jsonb_array_elements(p_answers) as answer
  )
  insert into public.quiz_answers (
    attempt_id,
    question_id,
    selected_option_ids,
    is_correct
  )
  select
    created_attempt_id,
    submitted.question_id,
    submitted.selected_option_ids,
    cardinality(submitted.selected_option_ids) = cardinality(quiz_answer_keys.correct_option_ids)
      and submitted.selected_option_ids @> quiz_answer_keys.correct_option_ids
      and submitted.selected_option_ids <@ quiz_answer_keys.correct_option_ids
  from submitted
  join public.quiz_answer_keys using (question_id);

  return query select created_attempt_id, correct_count, question_count;
exception
  when unique_violation then
    raise exception 'Quiz has already been submitted.' using errcode = '23505';
end;
$$;

alter table public.rooms enable row level security;
alter table public.lessons enable row level security;
alter table public.sections enable row level security;
alter table public.participants enable row level security;
alter table public.section_reactions enable row level security;
alter table public.section_comments enable row level security;
alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_options enable row level security;
alter table public.quiz_answer_keys enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.quiz_answers enable row level security;

create policy rooms_select_member
on public.rooms for select to authenticated
using (
  teacher_user_id = auth.uid()
  or private.is_room_participant(id)
);

create policy rooms_insert_owner
on public.rooms for insert to authenticated
with check (teacher_user_id = auth.uid());

create policy rooms_update_owner
on public.rooms for update to authenticated
using (teacher_user_id = auth.uid())
with check (teacher_user_id = auth.uid());

create policy rooms_delete_owner
on public.rooms for delete to authenticated
using (teacher_user_id = auth.uid());

create policy lessons_teacher_all
on public.lessons for all to authenticated
using (private.is_room_teacher(room_id))
with check (private.is_room_teacher(room_id));

create policy sections_select_authorized
on public.sections for select to authenticated
using (private.can_read_section(id));

create policy sections_insert_teacher
on public.sections for insert to authenticated
with check (
  exists (
    select 1 from public.lessons
    where lessons.id = lesson_id
      and private.is_room_teacher(lessons.room_id)
  )
);

create policy sections_update_teacher
on public.sections for update to authenticated
using (private.is_room_teacher(private.room_id_for_section(id)))
with check (
  exists (
    select 1 from public.lessons
    where lessons.id = lesson_id
      and private.is_room_teacher(lessons.room_id)
  )
);

create policy sections_delete_teacher
on public.sections for delete to authenticated
using (private.is_room_teacher(private.room_id_for_section(id)));

create policy participants_select_authorized
on public.participants for select to authenticated
using (
  user_id = auth.uid()
  or private.is_room_teacher(room_id)
);

create policy section_reactions_select_authorized
on public.section_reactions for select to authenticated
using (
  private.is_own_participant(participant_id)
  or private.is_room_teacher(private.room_id_for_section(section_id))
);

create policy section_reactions_insert_own
on public.section_reactions for insert to authenticated
with check (private.can_interact_with_section(section_id, participant_id));

create policy section_reactions_update_own
on public.section_reactions for update to authenticated
using (private.can_interact_with_section(section_id, participant_id))
with check (private.can_interact_with_section(section_id, participant_id));

create policy section_comments_select_authorized
on public.section_comments for select to authenticated
using (
  private.is_own_participant(participant_id)
  or private.is_room_teacher(private.room_id_for_section(section_id))
);

create policy section_comments_insert_own
on public.section_comments for insert to authenticated
with check (private.can_interact_with_section(section_id, participant_id));

create policy quizzes_select_authorized
on public.quizzes for select to authenticated
using (private.can_read_quiz(id));

create policy quizzes_insert_teacher
on public.quizzes for insert to authenticated
with check (private.is_room_teacher(private.room_id_for_section(section_id)));

create policy quizzes_update_teacher
on public.quizzes for update to authenticated
using (private.is_room_teacher(private.room_id_for_quiz(id)))
with check (private.is_room_teacher(private.room_id_for_section(section_id)));

create policy quizzes_delete_teacher
on public.quizzes for delete to authenticated
using (private.is_room_teacher(private.room_id_for_quiz(id)));

create policy quiz_questions_select_authorized
on public.quiz_questions for select to authenticated
using (private.can_read_question(id));

create policy quiz_questions_insert_teacher
on public.quiz_questions for insert to authenticated
with check (private.is_room_teacher(private.room_id_for_quiz(quiz_id)));

create policy quiz_questions_update_teacher
on public.quiz_questions for update to authenticated
using (private.is_room_teacher(private.room_id_for_question(id)))
with check (private.is_room_teacher(private.room_id_for_quiz(quiz_id)));

create policy quiz_questions_delete_teacher
on public.quiz_questions for delete to authenticated
using (private.is_room_teacher(private.room_id_for_question(id)));

create policy quiz_options_select_authorized
on public.quiz_options for select to authenticated
using (private.can_read_question(question_id));

create policy quiz_options_insert_teacher
on public.quiz_options for insert to authenticated
with check (private.is_room_teacher(private.room_id_for_question(question_id)));

create policy quiz_options_update_teacher
on public.quiz_options for update to authenticated
using (private.is_room_teacher(private.room_id_for_question(question_id)))
with check (private.is_room_teacher(private.room_id_for_question(question_id)));

create policy quiz_options_delete_teacher
on public.quiz_options for delete to authenticated
using (private.is_room_teacher(private.room_id_for_question(question_id)));

create policy quiz_answer_keys_teacher_all
on public.quiz_answer_keys for all to authenticated
using (private.is_room_teacher(private.room_id_for_question(question_id)))
with check (private.is_room_teacher(private.room_id_for_question(question_id)));

create policy quiz_attempts_select_authorized
on public.quiz_attempts for select to authenticated
using (
  private.is_own_participant(participant_id)
  or private.is_room_teacher(private.room_id_for_quiz(quiz_id))
);

create policy quiz_answers_select_authorized
on public.quiz_answers for select to authenticated
using (
  exists (
    select 1
    from public.quiz_attempts
    where quiz_attempts.id = quiz_answers.attempt_id
      and (
        private.is_own_participant(quiz_attempts.participant_id)
        or private.is_room_teacher(private.room_id_for_quiz(quiz_attempts.quiz_id))
      )
  )
);

revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;

grant select, insert, delete on public.rooms to authenticated;
grant update (title, status, started_at, ended_at) on public.rooms to authenticated;
grant select, insert, update, delete on public.lessons to authenticated;
grant select, insert, update, delete on public.sections to authenticated;
grant select on public.participants to authenticated;
grant select, insert on public.section_reactions to authenticated;
grant update (reaction) on public.section_reactions to authenticated;
grant select, insert on public.section_comments to authenticated;
grant select, insert, update, delete on public.quizzes to authenticated;
grant select, insert, update, delete on public.quiz_questions to authenticated;
grant select, insert, update, delete on public.quiz_options to authenticated;
grant select, insert, update, delete on public.quiz_answer_keys to authenticated;
grant select on public.quiz_attempts to authenticated;
grant select on public.quiz_answers to authenticated;

grant execute on function private.room_id_for_section(uuid) to authenticated;
grant execute on function private.room_id_for_quiz(uuid) to authenticated;
grant execute on function private.room_id_for_question(uuid) to authenticated;
grant execute on function private.is_room_teacher(uuid) to authenticated;
grant execute on function private.is_room_participant(uuid) to authenticated;
grant execute on function private.is_own_participant(uuid) to authenticated;
grant execute on function private.can_interact_with_section(uuid, uuid) to authenticated;
grant execute on function private.can_read_section(uuid) to authenticated;
grant execute on function private.can_read_quiz(uuid) to authenticated;
grant execute on function private.can_read_question(uuid) to authenticated;

grant execute on function public.join_room(text, text) to authenticated;
grant execute on function public.release_section(uuid) to authenticated;
grant execute on function public.submit_quiz(uuid, jsonb) to authenticated;
