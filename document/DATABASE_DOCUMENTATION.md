# MINCLASS — Database Documentation

## 1. Tổng quan

MINCLASS dùng Supabase PostgreSQL. Schema nghiệp vụ nằm trong `public`; các helper không được client gọi trực tiếp nằm trong schema `private`. Supabase Auth quản lý người dùng trong `auth.users`.

Migrations trong `supabase/migrations/` là source of truth. Không sửa migration đã áp dụng; mọi thay đổi schema phải tạo migration mới.

Hiện có 20 bảng nghiệp vụ. Bảng `rooms` là tên kỹ thuật kế thừa từ MVP ban đầu và hiện đại diện cho **Lesson Session**.

## 2. ERD

```mermaid
erDiagram
    AUTH_USERS ||--o{ SUBJECTS : owns
    AUTH_USERS ||--o{ ROOMS : teaches
    AUTH_USERS ||--o{ PARTICIPANTS : anonymous_identity
    AUTH_USERS ||--o{ LESSON_SESSION_ACCESS_GRANTS : receives

    SUBJECTS ||--o{ CHAPTERS : contains
    SUBJECTS ||--o{ COURSE_SECTIONS : contains
    COURSE_SECTIONS ||--o{ COURSE_SECTION_STUDENTS : has_roster
    COURSE_SECTIONS ||--o{ LESSONS : stores
    CHAPTERS ||--o{ LESSONS : groups

    LESSONS ||--o{ SECTIONS : contains
    LESSONS ||--o{ ROOMS : taught_as_session
    ROOMS ||--o{ SESSION_ATTENDANCE : snapshots
    ROOMS ||--o{ PARTICIPANTS : has
    ROOMS ||--o{ LESSON_SESSION_ACCESS_GRANTS : grants_review
    ROOMS ||--o{ ROOM_FEEDBACK_EVENTS : emits

    SECTIONS ||--o| QUIZZES : may_have
    SECTIONS ||--o{ SECTION_REACTIONS : receives
    SECTIONS ||--o{ SECTION_COMMENTS : receives
    SECTIONS ||--o{ ROOM_FEEDBACK_EVENTS : identifies

    PARTICIPANTS ||--o{ SECTION_REACTIONS : creates
    PARTICIPANTS ||--o{ SECTION_COMMENTS : creates
    PARTICIPANTS ||--o{ QUIZ_ATTEMPTS : submits
    PARTICIPANTS ||--o| SESSION_REFLECTIONS : submits

    QUIZZES ||--o{ QUIZ_QUESTIONS : contains
    QUIZZES ||--o{ QUIZ_ATTEMPTS : receives
    QUIZ_QUESTIONS ||--o{ QUIZ_OPTIONS : contains
    QUIZ_QUESTIONS ||--|| QUIZ_ANSWER_KEYS : has_private_key
    QUIZ_ATTEMPTS ||--o{ QUIZ_ANSWERS : contains
    QUIZ_QUESTIONS ||--o{ QUIZ_ANSWERS : answered_by
```

Quan hệ legacy `lessons.room_id` vẫn tồn tại để tương thích dữ liệu Room cũ nhưng persistent Lesson dùng `lessons.course_section_id`; Session mới liên kết ngược qua `rooms.lesson_id`.

## 3. Enum

| Enum | Giá trị | Ý nghĩa |
|---|---|---|
| `room_status` | `DRAFT`, `ACTIVE`, `ENDED` | Lifecycle Room cũ/Lesson Session; persistent Session mới dùng `ACTIVE` và `ENDED` |
| `section_type` | `CONTENT`, `QUIZ`, `REFLECTION` | Loại Section |
| `reaction_type` | `UNDERSTAND`, `UNSURE`, `QUESTION` | Reaction của Student |
| `quiz_question_type` | `SINGLE_CHOICE`, `MULTIPLE_CHOICE`, `TRUE_FALSE` | Loại câu hỏi Quiz |

## 4. Các bảng quản lý khóa học

### `subjects`

Môn học thuộc Teacher.

| Field | Kiểu | Vai trò |
|---|---|---|
| `id` | `uuid` | Primary key |
| `teacher_id` | `uuid` | FK → `auth.users.id`, Teacher sở hữu |
| `name` | `text` | Tên môn học, 1–120 ký tự |
| `code` | `text nullable` | Mã môn học chuẩn hóa chữ hoa |
| `created_at` | `timestamptz` | Thời điểm tạo |

Constraint/index quan trọng:

- Unique `(teacher_id, code)`; PostgreSQL cho phép nhiều Subject không có code.
- `subjects_teacher_created_idx (teacher_id, created_at desc)`.
- Teacher chỉ CRUD row có `teacher_id = auth.uid()` và đúng permanent Teacher account.

### `chapters`

Chapter trong Lesson Plan của Subject.

| Field | Kiểu | Vai trò |
|---|---|---|
| `id` | `uuid` | Primary key |
| `subject_id` | `uuid` | FK → `subjects.id` |
| `name` | `text` | Tên Chapter, 1–120 ký tự |
| `created_at` | `timestamptz` | Thời điểm tạo |
| `updated_at` | `timestamptz` | Tự cập nhật bằng trigger |

Constraint/index quan trọng:

- Unique case-insensitive `(subject_id, lower(name))`.
- Index `(subject_id, lower(name), name)` phục vụ sắp xếp.
- Trigger không cho chuyển Chapter sang Subject khác.

### `course_sections`

Lớp học phần thuộc Subject.

| Field | Kiểu | Vai trò |
|---|---|---|
| `id` | `uuid` | Primary key |
| `subject_id` | `uuid` | FK → `subjects.id`, `ON DELETE RESTRICT` ở schema hiện tại |
| `section_code` | `text` | Mã lớp học phần chuẩn hóa chữ hoa |
| `display_name` | `text nullable` | Tên hiển thị, tối đa 120 ký tự |
| `created_at` | `timestamptz` | Thời điểm tạo |

Constraint/index quan trọng:

- Unique `(subject_id, section_code)`.
- `course_sections_subject_created_idx (subject_id, created_at)`.
- Xóa Subject dùng RPC `delete_subject` để xóa cây dữ liệu theo đúng thứ tự thay vì dựa hoàn toàn vào cascade.

### `course_section_students`

Roster hiện tại của Course Section.

| Field | Kiểu | Vai trò |
|---|---|---|
| `id` | `uuid` | Primary key |
| `course_section_id` | `uuid` | FK → `course_sections.id`, cascade |
| `mssv` | `text` | MSSV đã chuẩn hóa |
| `normalized_mssv` | `text generated` | `upper(btrim(mssv))` |
| `created_at` | `timestamptz` | Thời điểm thêm |

Constraint/index quan trọng:

- MSSV phải khớp `^[A-Z0-9][A-Z0-9._-]{2,31}$`.
- Unique `(course_section_id, normalized_mssv)`.
- Index `(course_section_id, created_at)`.
- Student không có quyền tải toàn bộ bảng roster.

## 5. Lesson và Section

### `lessons`

Persistent Lesson hoặc Lesson của legacy Room.

| Field | Kiểu | Vai trò |
|---|---|---|
| `id` | `uuid` | Primary key |
| `room_id` | `uuid nullable` | Legacy FK → `rooms.id`, unique |
| `course_section_id` | `uuid nullable` | Persistent FK → `course_sections.id`, `ON DELETE RESTRICT` |
| `chapter_id` | `uuid nullable` | FK → `chapters.id`, `ON DELETE RESTRICT` |
| `title` | `text` | Tên Lesson, 1–200 ký tự |
| `description` | `text nullable` | Mô tả, tối đa 1.000 ký tự |
| `markdown_source` | `text` | File Markdown nguyên bản |
| `metadata` | `jsonb` | Metadata bổ sung dạng object |
| `created_at` | `timestamptz` | Thời điểm tạo |
| `updated_at` | `timestamptz` | Tự cập nhật bằng trigger |

Constraint/index quan trọng:

- `num_nonnulls(room_id, course_section_id) = 1`: Lesson chỉ có một loại parent.
- Persistent Lesson phải có Chapter thuộc cùng Subject với Course Section; constraint trigger kiểm tra khi transaction kết thúc.
- Partial indexes theo `course_section_id` và `chapter_id` phục vụ danh sách Lesson.

### `sections`

Các phần tuần tự của Lesson.

| Field | Kiểu | Vai trò |
|---|---|---|
| `id` | `uuid` | Primary key |
| `lesson_id` | `uuid` | FK → `lessons.id`, cascade |
| `position` | `integer` | Vị trí bắt đầu từ 0 |
| `type` | `section_type` | `CONTENT`, `QUIZ` hoặc `REFLECTION` |
| `title` | `text` | Tiêu đề, 1–200 ký tự |
| `content_md` | `text` | Markdown của Section; Quiz dùng chuỗi rỗng |
| `created_at` | `timestamptz` | Thời điểm tạo |

Constraint/index quan trọng:

- Unique `(lesson_id, position)`.
- `position >= 0`.
- Index `sections_lesson_id_idx`.

## 6. Lesson Session và attendance

### `rooms`

Lesson Session runtime. Tên bảng được giữ để tái sử dụng live Room core.

| Field | Kiểu | Vai trò |
|---|---|---|
| `id` | `uuid` | Primary key/Session ID |
| `code` | `text nullable` | Legacy Room Code; Session mới không sử dụng |
| `teacher_user_id` | `uuid` | FK → `auth.users.id` |
| `lesson_id` | `uuid nullable` | FK → persistent `lessons.id`, `ON DELETE RESTRICT` |
| `title` | `text` | Snapshot tên Session/Lesson |
| `status` | `room_status` | Lifecycle |
| `teaching_section` | `integer` | Position đang trình bày |
| `released_through` | `integer` | Position cuối Student được đọc |
| `created_at` | `timestamptz` | Thời điểm tạo |
| `started_at` | `timestamptz nullable` | Thời điểm Start |
| `ended_at` | `timestamptz nullable` | Thời điểm End |

Constraint/index/trigger quan trọng:

- Lifecycle timestamp phải phù hợp status.
- `released_through <= teaching_section`.
- Partial unique index chỉ cho một `ACTIVE` Session trên mỗi Lesson.
- Trigger và advisory lock bổ sung quy tắc chỉ một Lesson LIVE trong cùng Course Section.
- `rooms_lesson_status_idx (lesson_id, status, ended_at desc)`.
- `rooms_teacher_user_id_idx`.
- `code` nullable sau khi Room Code bị loại khỏi persistent flow.

### `session_attendance`

Roster snapshot bất biến theo Session.

| Field | Kiểu | Vai trò |
|---|---|---|
| `session_id` | `uuid` | PK/FK → `rooms.id`, cascade |
| `mssv` | `text` | PK, MSSV snapshot |
| `joined_at` | `timestamptz nullable` | `NULL` nếu chưa tham gia |

Constraint/index quan trọng:

- Composite primary key `(session_id, mssv)`.
- MSSV được validate và chuẩn hóa.
- Index `(session_id, joined_at)` phục vụ joined/absent count.
- Chỉ Teacher sở hữu Session có quyền đọc trực tiếp.

### `participants`

Student thực tế đã join Session.

| Field | Kiểu | Vai trò |
|---|---|---|
| `id` | `uuid` | Primary key |
| `room_id` | `uuid` | FK → `rooms.id`, cascade |
| `user_id` | `uuid` | FK → anonymous `auth.users.id`, cascade |
| `mssv` | `text` | MSSV đã join |
| `joined_at` | `timestamptz` | Thời điểm join |
| `last_seen_at` | `timestamptz` | Lần ghi nhận gần nhất |

Constraint/index quan trọng:

- Unique `(room_id, mssv)`.
- Unique `(room_id, user_id)`.
- Index `participants_user_id_idx`.
- Join RPC chỉ insert Participant nếu MSSV có trong attendance snapshot.

### `lesson_session_access_grants`

Quyền tạm theo anonymous user để xem một Ended Session sau khi xác minh MSSV.

| Field | Kiểu | Vai trò |
|---|---|---|
| `id` | `uuid` | Primary key |
| `room_id` | `uuid` | FK → `rooms.id`, cascade |
| `user_id` | `uuid` | FK → `auth.users.id`, cascade |
| `mssv` | `text` | MSSV đã xác minh |
| `created_at` | `timestamptz` | Thời điểm cấp quyền |

Constraint/index quan trọng:

- Unique `(room_id, user_id)`.
- Index `(user_id, room_id)`.
- Student chỉ đọc grant của chính `auth.uid()`.
- RPC có thể cập nhật MSSV của grant sau khi xác minh lại attendance snapshot.

## 7. Reaction, comment và Realtime event

### `section_reactions`

| Field | Kiểu | Vai trò |
|---|---|---|
| `id` | `uuid` | Primary key |
| `section_id` | `uuid` | FK → `sections.id`, cascade |
| `participant_id` | `uuid` | FK → `participants.id`, cascade |
| `reaction` | `reaction_type` | Reaction hiện tại |
| `created_at`, `updated_at` | `timestamptz` | Audit timestamps |

- Unique `(section_id, participant_id)` bảo đảm một reaction/Student/Section.
- Trigger kiểm tra Section và Participant thuộc cùng Session/Lesson.
- Index theo `section_id` và `participant_id`.

### `section_comments`

| Field | Kiểu | Vai trò |
|---|---|---|
| `id` | `uuid` | Primary key |
| `section_id` | `uuid` | FK → `sections.id`, cascade |
| `participant_id` | `uuid` | FK → `participants.id`, cascade |
| `body` | `text` | Nội dung 1–500 ký tự |
| `is_anonymous` | `boolean` | Quyết định masking MSSV |
| `created_at` | `timestamptz` | Thời điểm gửi |

- Index `(section_id, created_at desc)` phục vụ comment mới nhất.
- Index theo `participant_id`.
- RPC chỉ cho comment Section đã released trong Session `ACTIVE`.
- Teacher snapshot tính `authorLabel` ở database: `Anonymous` hoặc MSSV.

### `room_feedback_events`

Event stream nhẹ để báo Dashboard fetch lại dữ liệu.

| Field | Kiểu | Vai trò |
|---|---|---|
| `id` | `bigint identity` | Primary key tăng dần |
| `room_id` | `uuid` | FK → `rooms.id`, cascade |
| `section_id` | `uuid` | FK → `sections.id`, cascade |
| `kind` | `text` | `REACTION`, `COMMENT` hoặc `QUIZ` |
| `created_at` | `timestamptz` | Thời điểm phát event |

- Index `(room_id, id desc)`.
- Trigger từ reaction/comment/quiz attempt tự insert event.
- Chỉ Teacher của Session đọc event; bảng nằm trong Supabase Realtime publication.

## 8. Quiz

### `quizzes`

Một Quiz trên một Section.

- `id` UUID primary key.
- `section_id` FK unique → `sections.id`, cascade.
- `title` 1–200 ký tự.
- `created_at`.
- Index theo `section_id`.

### `quiz_questions`

- `id` UUID primary key.
- `quiz_id` FK → `quizzes.id`, cascade.
- `position` integer không âm.
- `type` là `quiz_question_type`.
- `question_text` dài 1–1.000 ký tự.
- Unique `(quiz_id, position)` và index theo `quiz_id`.

### `quiz_options`

- `id` UUID primary key.
- `question_id` FK → `quiz_questions.id`, cascade.
- `position` integer không âm.
- `content` dài 1–500 ký tự.
- Unique `(question_id, position)` và index theo `question_id`.

### `quiz_answer_keys`

- `question_id` vừa là primary key vừa là FK → `quiz_questions.id`, cascade.
- `correct_option_ids` là mảng UUID không rỗng.
- Trigger kiểm tra option thuộc đúng question và số đáp án đúng phù hợp question type.
- Student không có direct read access; RPC chấm điểm và Ended Review kiểm soát việc expose.

### `quiz_attempts`

- `id` UUID primary key.
- `quiz_id` FK → `quizzes.id`, cascade.
- `participant_id` FK → `participants.id`, cascade.
- `score`, `total_questions`.
- `submitted_at`.
- Unique `(quiz_id, participant_id)` ngăn double submit.
- Check `0 <= score <= total_questions` và `total_questions > 0`.
- Index theo `participant_id`.

### `quiz_answers`

- `id` UUID primary key.
- `attempt_id` FK → `quiz_attempts.id`, cascade.
- `question_id` FK → `quiz_questions.id`, cascade.
- `selected_option_ids` UUID array không rỗng.
- `is_correct` do server/database tính.
- Unique `(attempt_id, question_id)`.
- Index theo `question_id`.

## 9. Session Reflection

### `session_reflections`

Tổng kết cá nhân gửi sau Session.

| Field | Kiểu | Vai trò |
|---|---|---|
| `id` | `uuid` | Primary key |
| `participant_id` | `uuid` | Unique FK → `participants.id`, cascade |
| `speaking_count` | `integer` | Số lần phát biểu, 0–999 |
| `review_body` | `text nullable` | Review đã trim, tối đa 1.000 ký tự |
| `created_at`, `updated_at` | `timestamptz` | Audit timestamps |

Quy tắc:

- Unique `participant_id` bảo đảm một reflection/Student/Session.
- RPC cuối cùng dùng insert-only và trả duplicate error, không cho sửa sau submit.
- Chỉ Participant sở hữu hoặc Teacher của Session được đọc.
- Bảng nằm trong Realtime publication để Teacher nhận review mới.

## 10. RLS và quyền truy cập

Tất cả bảng nghiệp vụ nhạy cảm bật RLS. Mô hình quyền chính:

| Nhóm dữ liệu | Teacher | Student |
|---|---|---|
| Subject/Chapter/Course Section | Chỉ dữ liệu thuộc mình | Không đọc trực tiếp; catalog qua RPC giới hạn field |
| Roster | Owner CRUD | Không được download/read toàn bộ |
| Lesson/Section | Owner quản lý | Chỉ snapshot được RPC cho phép |
| Session | Owner quản lý | Participant hoặc access grant phù hợp |
| Attendance | Owner đọc | Không đọc trực tiếp |
| Reaction | Owner xem aggregate | Chỉ reaction của chính mình khi LIVE |
| Comment | Owner xem qua masked snapshot | Tạo comment của chính mình khi LIVE |
| Answer key | Owner qua flow quản trị | Không direct read; chỉ post-submit/ENDED RPC |
| Quiz attempt/answer | Owner xem analytics | Chỉ dữ liệu của chính Participant |
| Session reflection | Owner xem | Chỉ reflection của chính mình |

Security-definer RPC luôn phải tự kiểm tra `auth.uid()`, claim anonymous/permanent, ownership, Session status và quan hệ dữ liệu. `SET search_path = ''` giảm nguy cơ object shadowing.

## 11. RPC quan trọng

| RPC | Mục đích |
|---|---|
| `replace_course_section_roster` | Replace roster atomically sau validation |
| `create_course_section_lesson` | Tạo Lesson, Section, Quiz và answer key |
| `start_lesson_session` | Tạo ACTIVE Session và attendance snapshot |
| `join_live_lesson` | Join Session bằng Lesson ID + MSSV |
| `release_section` | Chuyển Section tuần tự |
| `set_section_reaction` | Create/update reaction của Participant |
| `create_section_comment` | Tạo comment và enforce identity/status |
| `get_session_student_quiz_snapshot` | Trả Quiz an toàn cho Student |
| `submit_session_quiz` | Chấm và lưu Quiz trên server |
| `end_room` | Chuyển Session sang ENDED |
| `access_ended_lesson_session` | Xác minh MSSV và cấp review access grant |
| `get_student_ended_lesson_review` | Trả Lesson/answer key sau ENDED |
| `save_own_session_reflection` | Gửi reflection một lần |
| `get_teacher_room_summary` | Aggregate Summary |
| `get_teacher_class_voices` | Masked Class Voices data |
| `get_teacher_session_reflections` | Session Reviews cho Teacher |
| `get_teacher_course_section_export` | Aggregate dữ liệu Excel |
| `delete_room` | Xóa Session và dữ liệu con |
| `delete_subject` | Xóa cây Subject theo thứ tự an toàn |

Các RPC Room Code cũ vẫn có thể tồn tại trong lịch sử migration nhưng đã bị revoke ở migration hiện hành và không thuộc public application flow.

## 12. Index quan trọng

| Index/constraint | Tác dụng |
|---|---|
| `rooms_one_active_session_per_lesson_idx` | Ngăn hai ACTIVE Session trên cùng Lesson |
| `rooms_lesson_status_idx` | Tìm LIVE/latest ENDED Session theo Lesson |
| `subjects_teacher_created_idx` | Danh sách Subject theo Teacher |
| `course_sections_subject_created_idx` | Danh sách Course Section theo Subject |
| `chapters_subject_name_unique_idx` | Tên Chapter không trùng, không phân biệt hoa thường |
| `course_section_students_mssv_unique` | MSSV không trùng trong Course Section |
| `session_attendance` primary key | Một MSSV một dòng snapshot trong Session |
| `participants` unique keys | Ngăn duplicate MSSV và anonymous user trong Session |
| `sections (lesson_id, position)` | Thứ tự Section duy nhất |
| `section_reactions (section_id, participant_id)` | Một reaction/Student/Section |
| `quiz_attempts (quiz_id, participant_id)` | Một attempt/Student/Quiz |
| `room_feedback_events_room_id_id_idx` | Realtime event mới nhất theo Session |

## 13. Cascade và xóa dữ liệu

- Xóa Session (`rooms`) cascade attendance, participant, access grant và feedback event.
- Participant cascade reaction, comment, Quiz attempt/answer và session reflection.
- Section/Lesson cascade nội dung Quiz theo cây FK tương ứng.
- Một số parent FK đã chuyển sang `ON DELETE RESTRICT` để ngăn xóa ngoài ý muốn.
- `delete_subject` và `delete_room` thực hiện kiểm tra owner và xóa theo thứ tự có kiểm soát.
- Xóa Session không xóa persistent Lesson.

## 14. Realtime publication

Các bảng/event source hiện được đưa vào Supabase Realtime publication:

- `rooms` — Section flow và End Session.
- `participants` — Student join.
- `session_attendance` — joined count.
- `room_feedback_events` — reaction, comment và Quiz signal.
- `session_reflections` — review cuối buổi.

Realtime không thay thế query database. Client phải refetch snapshot sau event hoặc reconnect.
