alter table public.subjects
drop constraint subjects_teacher_code_unique;

alter table public.subjects
add constraint subjects_teacher_code_unique unique (teacher_id, code);
