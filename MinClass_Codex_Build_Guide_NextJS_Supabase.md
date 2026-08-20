# MinClass MVP — Kế hoạch build hoàn chỉnh với Codex

> Roadmap triển khai ClassFlow bằng **Next.js + Supabase**, chia thành từng phase nhỏ để giao việc tuần tự cho Codex, dễ kiểm soát scope, review và test.

## 1. Mục tiêu sản phẩm

MinClass không phải LMS. Sản phẩm tập trung vào ba giá trị:

1. Sinh viên follow được flow bài giảng.
2. Sinh viên phản hồi ngay sau từng điểm kiến thức.
3. Giảng viên thấy tình hình lớp trong và sau buổi học.

Flow cốt lõi:

```text
Giảng viên
    │
    ├── Tạo phòng
    ├── Upload lesson.md
    ├── Preview
    ├── Start Room
    └── Nhận mã lớp
             │
             ▼
Sinh viên nhập mã lớp + MSSV
             │
             ▼
       Waiting Screen
             │
             ▼
GV đang dạy Section 1
             │
             │ Done
             ▼
SV được mở Section 1
             │
      ┌──────┼───────────┐
      ▼      ▼           ▼
   Content  Reaction   Comment
      │
      └──── Quiz nếu section là quiz
             │
             ▼
GV thấy phản hồi realtime
             │
             ▼
GV dạy Section tiếp theo
             │
            ...
             │
             ▼
        End Session
             │
             ▼
       Session Summary
```

---

## 2. Scope MVP chính thức

### 2.1. Giảng viên

- Tạo phòng học.
- Upload file Markdown.
- Preview lesson.
- Start buổi học.
- Nhận mã lớp.
- Xem danh sách MSSV đã tham gia.
- Dạy từng section.
- Bấm `Done` để release section cho sinh viên.
- Xem reaction theo từng section.
- Xem comment mới gần như realtime.
- Xem số sinh viên đã làm quiz.
- Xem thống kê quiz cơ bản.
- Kết thúc buổi học.
- Xem báo cáo tổng kết.
- Xem danh sách comment bằng giao diện truyền cảm hứng.
- Xóa buổi học và dữ liệu liên quan.

### 2.2. Sinh viên

- Nhập mã lớp.
- Nhập MSSV.
- Tham gia phòng.
- Chờ section được giảng viên release.
- Xem từng micro-learning section.
- Xem text, ảnh, code block.
- Làm quiz.
- Thả reaction.
- Để lại comment.
- Chọn comment ẩn danh hoặc hiển thị MSSV.
- Xem lại section đã release.
- Không xem được section chưa release.

### 2.3. Không làm trong MVP

- Account email/password.
- Profile.
- Subject/Class management dài hạn.
- Video.
- Slide.
- Assignment.
- File submission.
- AI.
- Chat room.
- Code runner.
- SQL runner.
- Gamification.
- Ranking/Badge.
- Gradebook.
- Notification.
- GPS/Face recognition/QR attendance.

Nếu Codex đề xuất các feature này thì đưa vào backlog, **không code trong MVP**.

---

## 3. Kiến trúc đề xuất

```text
Frontend + Backend        Next.js App Router + TypeScript
UI                        Tailwind CSS
Database                  Supabase Postgres
Realtime                  Supabase Realtime
Identity nền              Supabase Anonymous Auth
Security                  Supabase RLS
Markdown                  unified / remark ecosystem
Validation                Zod
Testing                   Vitest + Playwright
Deployment                Vercel + Supabase
```

Không cần NestJS trong MVP.

### 3.1. Không có màn hình account nhưng vẫn có identity kỹ thuật

Người dùng không nhìn thấy đăng ký/đăng nhập.

```text
Browser
   │
   ▼
Supabase Anonymous Auth
   │
   ▼
anonymous user id
```

UID này dùng để:

- Xác định owner của Room.
- Xác định browser của Student.
- Áp dụng RLS.
- Giới hạn quyền đọc/ghi.
- Hỗ trợ Realtime.

Teacher UX:

```text
[ Tạo phòng học ]
```

Student UX:

```text
Mã lớp: ______
MSSV:   ______
[ Tham gia ]
```

---

## 4. Domain Model

MVP chỉ cần:

```text
Room
Lesson
Section
Participant
Reaction
Comment
Quiz
QuizAttempt
```

Quan hệ:

```text
Room
 │
 ├── Lesson
 │    └── Sections
 │          └── Quiz (optional)
 │
 ├── Participants
 ├── Reactions
 ├── Comments
 └── Quiz Attempts
```

---

## 5. Database Design

### 5.1. rooms

```text
id                    uuid
code                  varchar(6)
teacher_user_id       uuid
title                 text
status                DRAFT | ACTIVE | ENDED
teaching_section      integer
released_through      integer
created_at            timestamptz
started_at            timestamptz
ended_at              timestamptz
```

Ý nghĩa:

```text
teaching_section = section Teacher đang dạy
released_through = section lớn nhất Student đã được xem
```

Ví dụ:

```text
teaching_section = 4
released_through = 3
```

Teacher đang giảng section thứ 5, Student đã được xem section 1–4.

### 5.2. lessons

```text
id
room_id
title
description
markdown_source
metadata jsonb
created_at
updated_at
```

MVP:

```text
1 Room = 1 Lesson
```

### 5.3. sections

```text
id
lesson_id
position
type
title
content_md
created_at
```

Type:

```text
CONTENT
QUIZ
REFLECTION
```

### 5.4. participants

```text
id
room_id
user_id
mssv
joined_at
last_seen_at
```

Unique:

```text
(room_id, mssv)
(room_id, user_id)
```

### 5.5. section_reactions

```text
id
room_id
section_id
participant_id
reaction
created_at
updated_at
```

Reaction:

```text
UNDERSTAND  → 👍 Hiểu
UNSURE      → 🤔 Chưa chắc
QUESTION    → ❓ Có câu hỏi
```

Rule:

```text
1 Student + 1 Section = tối đa 1 reaction active
```

Student được đổi reaction.

### 5.6. section_comments

```text
id
room_id
section_id
participant_id
body
is_anonymous
created_at
```

Rule:

- Một Student có thể comment nhiều lần.
- Không cho comment rỗng.
- Giới hạn chiều dài, ví dụ 500 ký tự.
- Nếu anonymous, Teacher UI không hiện MSSV.
- Backend vẫn giữ participant_id.

---

## 6. Quiz Data Model

### quizzes

```text
id
section_id
title
created_at
```

### quiz_questions

```text
id
quiz_id
position
type
question_text
```

Type MVP:

```text
SINGLE_CHOICE
MULTIPLE_CHOICE
TRUE_FALSE
```

### quiz_options

```text
id
question_id
position
content
```

Không để `is_correct` trong dữ liệu Student có quyền đọc.

### quiz_answer_keys

```text
question_id
correct_option_ids jsonb
```

Table này không cho Student SELECT.

### quiz_attempts

```text
id
room_id
quiz_id
participant_id
score
total_questions
submitted_at
```

Unique MVP:

```text
(room_id, quiz_id, participant_id)
```

### quiz_answers

```text
id
attempt_id
question_id
selected_option_ids jsonb
is_correct
```

---

## 7. Session Lifecycle

```text
DRAFT
  │ Start
  ▼
ACTIVE
  │ End Session
  ▼
ENDED
  │ Delete
  ▼
DELETED
```

Không cần status DELETED trong DB. Khi xóa Room, dùng foreign key `ON DELETE CASCADE` để xóa dữ liệu con.

Room ENDED vẫn được giữ để Teacher xem báo cáo cho tới khi Teacher bấm xóa.

---

## 8. Lesson Flow bắt buộc

Ví dụ lesson:

```text
Section 1
Section 2
Section 3
Quiz 1
Section 4
Reflection
```

Khi Start:

```text
teaching_section = 0
released_through = -1
```

Student thấy Waiting Screen.

Teacher đang dạy Section 1. Student chưa thấy content.

Teacher bấm `Done`:

```text
released_through = 0
teaching_section = 1
```

Student lập tức được xem Section 1 và thực hiện reaction/comment/quiz nếu có.

Rule:

```text
Student chỉ được truy cập section.position <= released_through
```

Không chỉ disable nút ở frontend; phải enforce bằng server/RLS phù hợp.

---

## 9. Markdown Specification MVP

Ví dụ:

````markdown
---
title: TCP Three-Way Handshake
description: Buổi học về quá trình thiết lập kết nối TCP
---

:::section
id: tcp-overview
title: TCP là gì?
type: content

TCP là giao thức hướng kết nối ở tầng Transport.

- Reliable
- Connection-oriented
- Ordered delivery

```text
Application
    ↓
Transport - TCP
    ↓
Network - IP
```

:::

:::section
id: syn
title: Bước 1 — SYN
type: content

Client bắt đầu kết nối bằng cách gửi **SYN**.

:::

:::quiz
id: handshake-check
title: Quick Check

question:
  type: single
  text: Server phản hồi gì sau khi nhận SYN?

options:
  - text: ACK
    correct: false
  - text: SYN-ACK
    correct: true
  - text: FIN
    correct: false

:::
````

Parser MVP hỗ trợ:

- Frontmatter.
- Heading.
- Paragraph.
- Bold/Italic.
- List.
- Link.
- Image URL.
- Inline code.
- Fenced code block.
- Section.
- Quiz.

Không hỗ trợ:

- Raw HTML tùy ý.
- iframe.
- script.
- video.
- slide.
- assignment.

---

## 10. Cấu trúc repository

```text
classflow/
│
├── src/
│   ├── app/
│   │   ├── page.tsx
│   │   ├── teacher/
│   │   │   ├── create/page.tsx
│   │   │   └── room/[roomId]/
│   │   │       ├── page.tsx
│   │   │       ├── summary/page.tsx
│   │   │       └── comments/page.tsx
│   │   ├── join/page.tsx
│   │   └── room/[roomId]/page.tsx
│   │
│   ├── components/
│   │   ├── lesson/
│   │   ├── teacher/
│   │   ├── student/
│   │   └── summary/
│   │
│   ├── features/
│   │   ├── rooms/
│   │   ├── lessons/
│   │   ├── participants/
│   │   ├── reactions/
│   │   ├── comments/
│   │   └── quizzes/
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts
│   │   │   └── server.ts
│   │   ├── markdown/
│   │   │   ├── parser.ts
│   │   │   ├── schema.ts
│   │   │   └── validator.ts
│   │   └── validation/
│   │
│   └── types/
│
├── supabase/
│   ├── migrations/
│   ├── seed.sql
│   └── tests/
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── docs/
│   ├── requirements.md
│   ├── architecture.md
│   ├── database.md
│   ├── markdown-spec.md
│   ├── security.md
│   └── test-plan.md
│
├── AGENTS.md
├── .env.example
├── package.json
└── README.md
```

---

## 11. Quy tắc làm việc với Codex

Mỗi phase:

```text
1. Đọc AGENTS.md
2. Đọc docs liên quan
3. Inspect code hiện tại
4. Lập kế hoạch thay đổi
5. Triển khai đúng phase
6. Chạy migration nếu có
7. Chạy unit/integration tests
8. Chạy lint
9. Chạy typecheck
10. Chạy build
11. Review diff
12. Manual test
13. Commit
14. Sang phase tiếp theo
```

Không cho Codex:

- Refactor toàn bộ dự án khi chưa yêu cầu.
- Đổi stack.
- Thêm feature ngoài scope.
- Thêm dependency không cần thiết.
- Sửa schema ngoài phạm vi phase.
- Tự chuyển sang phase sau.


# PHASE 0 — Chuẩn hóa tài liệu

## Mục tiêu

Tạo source of truth để Codex không tự suy diễn product.

## Tạo các file

```text
AGENTS.md
docs/requirements.md
docs/architecture.md
docs/database.md
docs/markdown-spec.md
docs/security.md
docs/test-plan.md
```

## requirements.md

Ghi rõ Teacher Flow:

```text
Create Room
→ Upload Markdown
→ Preview
→ Start
→ Teach Section
→ Done
→ Receive Feedback
→ Next Section
→ End
→ Summary
→ Delete Room
```

Student Flow:

```text
Enter Code
→ Enter MSSV
→ Join
→ Wait
→ Receive Released Section
→ Read
→ Reaction / Comment / Quiz
→ Wait for Next
```

Business Rules:

- Không account truyền thống.
- MSSV unique trong từng Room.
- Teacher sở hữu Room.
- Student không sửa Lesson.
- Student không xem Section tương lai.
- Student không xem đáp án Quiz trước submit.
- Anonymous Comment không hiện MSSV với Teacher.
- Room ENDED vẫn xem được Summary.
- Delete Room xóa toàn bộ dữ liệu.

## architecture.md

```text
Next.js
    │
    ├── UI
    ├── Route Handlers / Server Actions
    └── Supabase Clients
             │
             ▼
         Supabase
      ┌──────┼───────┐
      ▼      ▼       ▼
   Postgres Auth   Realtime
```

## database.md

Vẽ ERD, khóa tên field/table, cascade delete, unique constraints, RLS rules.

## markdown-spec.md

Khóa syntax Markdown trước khi code parser.

## AGENTS.md

Phải có:

- Product purpose.
- Scope MVP.
- Out-of-scope.
- Kiến trúc bắt buộc.
- Coding rules.
- Security rules.
- Testing rules.
- Không tự thêm feature.
- Definition of Done.

## Definition of Done Phase 0

- Domain được đặt tên thống nhất.
- Không còn Class persistent.
- Phân biệt rõ Room/Lesson/Section.
- Chốt reaction type.
- Chốt quiz type.
- Chốt Markdown syntax.
- Chốt hành vi `Done → Release`.

---

# PHASE 1 — Khởi tạo Next.js + Supabase

## Mục tiêu

Project chạy được nhưng chưa có business feature.

## Công việc

### Next.js

- App Router.
- TypeScript strict.
- Tailwind CSS.
- ESLint.
- Prettier.
- Import aliases.
- Root error boundary.
- Global loading UI.
- `.env.example`.

### Supabase

Thiết lập:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY
```

Quy tắc:

- Service Role chỉ server-side.
- Không import service-role client vào Client Component.
- Không commit secrets.

Tạo:

```text
src/lib/supabase/client.ts
src/lib/supabase/server.ts
```

### Anonymous Auth bootstrap

Khi user vào app:

```text
Check current session
   │
   ├── exists → continue
   │
   └── missing → anonymous sign-in
```

Không tạo màn login.

## Definition of Done

```text
dev       ✓
lint      ✓
typecheck ✓
build     ✓
```

Browser có anonymous session hợp lệ.

---

# PHASE 2 — Database Schema + RLS

## Mục tiêu

Tạo schema + security trước UI business.

## Migration

Tạo các bảng:

```text
rooms
lessons
sections
participants
section_reactions
section_comments
quizzes
quiz_questions
quiz_options
quiz_answer_keys
quiz_attempts
quiz_answers
```

## Foreign keys

Thiết kế cascade delete từ Room xuống toàn bộ dữ liệu con.

## Index

Tạo ít nhất:

```text
rooms(code)
rooms(teacher_user_id)
participants(room_id, mssv)
sections(lesson_id, position)
section_reactions(section_id)
section_comments(section_id)
quiz_attempts(quiz_id, participant_id)
```

## RLS

Enable RLS trên toàn bộ table public.

### Teacher được phép

- SELECT/UPDATE/DELETE Room do mình tạo.
- Đọc Lesson/Section thuộc Room của mình.
- Đọc Participants.
- Đọc Reactions/Comments.
- Đọc Quiz Attempts/Answers phục vụ thống kê.

### Student được phép

- Đọc Room đã join.
- Đọc released Sections.
- Insert/update reaction của chính mình.
- Insert comment của chính mình.
- Submit Quiz của chính mình.

### Student không được

- Update Room.
- Release Section.
- Đọc quiz answer keys.
- Xem Section chưa release.
- Sửa reaction/comment của người khác.

## RPC join_room

Tạo function atomic:

```text
join_room(room_code, mssv)
```

Logic:

```text
find ACTIVE room
→ validate MSSV
→ duplicate check
→ insert participant
→ return safe Room info
```

Không để Client query toàn bộ Rooms để dò code.

## Quiz Security

Answer key phải private.

Chấm qua server/RPC, không tính score từ client.

## Test bắt buộc

- Teacher A không đọc Room Teacher B.
- Student không update Room.
- Student không query answer key.
- Student không query future Section.
- Duplicate MSSV bị chặn.
- Cascade delete hoạt động.

---

# PHASE 3 — Teacher tạo Room

## Mục tiêu

Teacher tạo một buổi học mới.

## Route

```text
/teacher/create
```

## UI

```text
Tạo buổi học mới

Tên buổi học
[ TCP Three-Way Handshake ]

[ Upload lesson.md ]

[ Tiếp tục ]
```

## Logic

Create Room:

```text
status = DRAFT
teacher_user_id = current anonymous user id
```

Generate room code 6 ký tự/số dễ đọc.

Tránh ký tự dễ nhầm như:

```text
0/O
1/I
```

Teacher ownership phải enforce server/RLS.

## Definition of Done

```text
Open App
→ Create Room
→ Room DRAFT được tạo
→ Teacher nhận Room Code
```

---

# PHASE 4 — Markdown Parser + Import + Preview

## Mục tiêu

```text
Upload .md
→ Parse
→ Validate
→ Preview
→ Save
```

## File rules

- `.md`.
- MIME text hợp lệ.
- Giới hạn file, ví dụ 1 MB.

## Parser output

```ts
type ParsedLesson = {
  title: string
  description?: string
  sections: ParsedSection[]
}
```

Section union:

```text
ContentSection
QuizSection
ReflectionSection
```

## Validation

- Ít nhất một Section.
- Position hợp lệ.
- ID không trùng.
- Quiz có Question.
- Single choice chỉ một correct option.
- Multiple choice có ít nhất một correct option.
- True/False hợp lệ.
- Unsupported directive báo lỗi rõ ràng.

## Preview

Teacher preview giống Student UI nhưng xem toàn bộ Section.

## Save

Lưu Lesson/Sections/Quiz trong transaction. Nếu lỗi, rollback toàn bộ.

## Tests fixtures

```text
valid-basic.md
valid-code.md
valid-quiz.md
invalid-section.md
invalid-single-choice.md
duplicate-id.md
```

## Definition of Done

Upload → Preview → Save hoạt động ổn định.

---

# PHASE 5 — Student Join bằng mã lớp + MSSV

## Route

```text
/join
```

## UI

```text
Tham gia buổi học

Mã lớp
[ ______ ]

MSSV
[ ______ ]

[ Tham gia ]
```

## Validation MSSV

- Trim.
- Normalize uppercase nếu cần.
- Min/max length.
- Chỉ ký tự cho phép.
- Không hardcode quá chặt nếu nhiều khóa có format khác nhau.

## Flow

```text
Anonymous Auth
    ↓
Code + MSSV
    ↓
join_room()
    ↓
Participant created
    ↓
/student room page
```

## Duplicate rule

Một MSSV chỉ join một lần trong Room.

Một anonymous browser cũng không claim nhiều MSSV cùng Room.

## Attendance MVP

```text
Join Room = Attendance
```

Teacher thấy:

```text
Đã tham gia: 42
```

Vì không có roster trước buổi học, không tính `Absent`.

## Definition of Done

- Code đúng → join.
- Code sai → fail.
- DRAFT/ENDED → fail.
- Duplicate MSSV → fail.
- Teacher thấy participant mới.

---

# PHASE 6 — Start Room + Waiting Screen

## Teacher Start

```text
status = ACTIVE
started_at = now()
teaching_section = 0
released_through = -1
```

## Student Waiting

```text
Buổi học đang diễn ra

Thầy/cô đang trình bày nội dung đầu tiên.
Nội dung sẽ xuất hiện khi section hoàn thành.
```

Hiển thị:

- Lesson title.
- Connection state.
- MSSV hiện tại.

## Definition of Done

Room DRAFT → ACTIVE đúng lifecycle.

---

# PHASE 7 — Teacher Section Controller

## Mục tiêu

Implement core behavior:

> Teacher dạy xong Section → bấm Done → Student được xem Section đó.

## Teacher UI

```text
SECTION 2 / 8

SYN-ACK

[nội dung]

Feedback Section trước
👍 31    🤔 8    ❓ 3

Recent comments
...

[ Done Section ]
```

## Transaction Done

Với Section `i`:

```text
released_through = max(released_through, i)

if i < last:
    teaching_section = i + 1
```

## Rules

- Release tuyến tính.
- Không skip Section.
- Không Undo Release trong MVP.
- Mutation chỉ Teacher owner được gọi.

## Definition of Done

```text
Teacher Done
→ DB update
→ Realtime
→ Student UI update
```

---

# PHASE 8 — Student Micro-learning Viewer

## Mục tiêu

Một màn hình tập trung một điểm kiến thức.

## Screen

```text
Section 3 / 8

SYN-ACK

Server trả về SYN-ACK sau khi nhận SYN.

Server ------- SYN-ACK -------> Client

────────────────────

👍     🤔     ❓

[ Để lại comment ]

────────────────────

[ Section trước ] [ Section sau ]
```

## Navigation

Student chỉ xem:

```text
position <= released_through
```

Ở section mới nhất:

```text
Đang chờ section tiếp theo...
```

## Renderer

Tách component:

```text
MarkdownRenderer
SectionRenderer
```

- Sanitize output.
- Code block chỉ highlight, không execute.
- Image MVP dùng URL công khai hợp lệ.

## Definition of Done

- Micro-learning đúng một Section/screen.
- Previous hoạt động.
- Next chỉ released Section.
- Mobile responsive.

---

# PHASE 9 — Reaction Realtime

## Reaction MVP

```text
👍 Hiểu
🤔 Chưa chắc
❓ Có câu hỏi
```

Một Student một reaction mỗi Section, được đổi lựa chọn.

## Student UX

- Click một lần.
- Optimistic UI.
- Không cần Submit.

## Teacher Realtime

```text
Section 3

👍 31
🤔 8
❓ 3
```

Khi DB đổi → Realtime subscription → count update.

Không cần aggregate table trong MVP.

## Definition of Done

Hai browser:

```text
Student click 🤔
→ Teacher count tăng gần như ngay
```

---

# PHASE 10 — Comment Realtime

## Form

```text
Bạn muốn hỏi hoặc góp ý gì?

[.............................]

○ Hiện MSSV
● Ẩn danh

[ Gửi ]
```

Chốt default anonymous/named với giảng viên trước khi polish UI.

## Rules

- 1–500 ký tự.
- Trim.
- Không blank.
- Chống double submit.
- Rate limit hợp lý.
- Render safe text.

## Teacher Live Feed

```text
Anonymous
"Em chưa hiểu tại sao cần SYN-ACK."

23110234
"Nếu SYN bị mất thì sao?"
```

Newest first.

Nếu anonymous, UI tuyệt đối không render MSSV.

## Definition of Done

```text
Student comment
→ insert
→ realtime
→ Teacher thấy mà không reload
```

---

# PHASE 11 — Quiz MVP

## Availability

Quiz là một Section. Chỉ được làm sau khi Teacher Done/Release Quiz Section.

## Student Quiz

Hỗ trợ:

```text
Single Choice
Multiple Choice
True / False
```

Flow:

```text
Question 1/N
→ answer
→ Next
→ Submit
```

## Submit

Client chỉ gửi:

```text
question_id
selected_option_ids
```

Server/RPC chấm.

## Student Result

MVP:

```text
Score
Correct count / Total
Percentage
```

Có thể hiện đúng/sai sau submit.

## Teacher Stats

```text
Joined             42
Submitted          36
Completion         86%
Average            78%

Q1                 92% correct
Q2                 47% correct
Q3                 81% correct
```

Có thể thêm answer distribution.

## Definition of Done

- Một attempt/Student/Quiz.
- Không expose answer key.
- Score đúng.
- Teacher statistics đúng.


# PHASE 12 — Teacher Live Dashboard

## Mục tiêu

Tập trung tín hiệu lớp trong một màn hình.

## Layout gợi ý

```text
┌─────────────────────────────────────────────────┐
│ TCP Three-Way Handshake             LIVE        │
│ Room: 7A29KQ            Students: 42            │
├──────────────────────────┬──────────────────────┤
│ Current Section          │ Live Feedback        │
│                          │ 👍 31                │
│ SYN-ACK                  │ 🤔 8                 │
│ [lesson content]         │ ❓ 3                 │
│                          │                      │
│                          │ Recent comments      │
│                          │ ...                  │
├──────────────────────────┴──────────────────────┤
│ Quiz status / previous section stats            │
│                              [ Done Section ]   │
└─────────────────────────────────────────────────┘
```

## Dashboard Data

- Room code.
- Student joined count.
- MSSV list.
- Current teaching Section.
- Released Section count.
- Reaction current/recent Section.
- Latest Comments.
- Quiz completion.
- Quiz average.

## Không cần

- Fancy chart.
- AI insight.
- Animation nặng.

## Definition of Done

Teacher có thể điều khiển buổi học mà không phải chuyển qua nhiều trang.

---

# PHASE 13 — End Session

## Mục tiêu

Kết thúc buổi học nhưng chưa xóa dữ liệu.

Teacher bấm:

```text
[ Kết thúc buổi học ]
```

Confirm:

```text
Sau khi kết thúc, sinh viên sẽ không thể gửi thêm
quiz, reaction hoặc comment.

[ Hủy ] [ Kết thúc ]
```

Server:

```text
status = ENDED
ended_at = now()
```

Sau đó redirect:

```text
/teacher/room/:id/summary
```

Student sau ENDED:

```text
Buổi học đã kết thúc.
Cảm ơn bạn đã tham gia.
```

Có thể cho xem released content read-only.

Không cho mutation mới.

---

# PHASE 14 — Post-class Summary

## Mục tiêu

Teacher có báo cáo ngay sau buổi học, không cần AI.

## Tổng quan

```text
TỔNG KẾT BUỔI HỌC

TCP Three-Way Handshake

42 sinh viên tham gia
8 sections
3 quiz questions
37 comments
```

## Participants

```text
Participants: 42
[ Xem danh sách MSSV ]
```

Không gọi `Absent` nếu không có roster gốc.

## Quiz

```text
Quiz completion     38 / 42
Average             78%

Question có tỷ lệ đúng thấp nhất
Question 2          47%
```

## Reaction theo Section

```text
Section 1
👍 35   🤔 4   ❓ 3

Section 2
👍 24   🤔 12  ❓ 6
```

## Section nhận nhiều phản hồi

Có thể tính metric đơn giản:

```text
attention_score =
    unsure_count
  + question_reaction_count
  + comment_count
```

Sau đó rank:

```text
1. Congestion Window
2. Slow Start
3. Fast Recovery
```

UI nên ghi:

```text
Section nhận nhiều phản hồi nhất
```

thay vì khẳng định chắc chắn `khó nhất`.

## Comments

- Total comments.
- Anonymous comments.
- Named comments.
- Comments/Section.
- Nút `Xem Class Voices`.

## Data source

Không cần report table riêng trong MVP. Query từ dữ liệu persisted của Room.

---

# PHASE 15 — Class Voices / Comment Wall truyền cảm hứng

## Mục tiêu

Tạo trải nghiệm tổng kết comment có cảm xúc, giúp Teacher nhìn thấy “tiếng nói của lớp học”.

Tên gợi ý:

```text
Class Voices
```

hoặc:

```text
Reflection Wall
```

## Entry point

```text
37 phản hồi
[ Xem Class Voices ]
```

## Normal Mode

Dạng card/masonry, group theo Section.

```text
SECTION 2 — SYN-ACK

┌──────────────────────────┐
│ "Nếu SYN bị mất thì      │
│ server xử lý sao?"       │
│                          │
│ Anonymous                │
└──────────────────────────┘

        ┌─────────────────────────┐
        │ "Em đã hiểu phần này    │
        │ rõ hơn rồi."            │
        │                         │
        │ 23110234                │
        └─────────────────────────┘
```

Filter:

```text
Tất cả | Section 1 | Section 2 | ...
```

## Presentation Mode

Nút:

```text
[ Trình chiếu phản hồi ]
```

Khi bật:

- Full screen.
- Comment xuất hiện lần lượt.
- Animation nhẹ.
- Section title xuất hiện trước nhóm Comment.
- Có Next/Previous bằng keyboard.
- Anonymous giữ nguyên Anonymous.

Ví dụ:

```text
SECTION 4

Congestion Window

31 👍     8 🤔     3 ❓

"Em nghĩ em hiểu được vì sao window
không tăng liên tục nữa."

                    — Anonymous
```

## Hiệu ứng nên dùng

- Typography lớn.
- Whitespace nhiều.
- Fade/slide nhẹ.
- Card nổi vừa phải.
- Chuyển Section có reaction summary.

Không dùng:

- Confetti liên tục.
- Auto audio.
- 3D nặng.
- Motion gây mất tập trung.

## Accessibility

- Respect `prefers-reduced-motion`.
- Keyboard navigation.
- Contrast đủ.
- Không phụ thuộc animation để hiểu nội dung.

## Definition of Done

```text
Summary
→ Class Voices
→ Normal Mode
→ Presentation Mode
```

---

# PHASE 16 — Realtime Hardening

## Mục tiêu

Đảm bảo nhiều client đồng thời không làm sai state.

## Test Section Release

```text
1 Teacher
20+ Student tabs

Teacher Done
→ tất cả nhận update
```

## Test Reactions

Nhiều Student phản ứng gần đồng thời:

- Không duplicate.
- Không mất update.
- Count cuối đúng DB.

## Test Comments

Nhiều insert đồng thời, Teacher thấy đủ.

## Test Reconnect

```text
Student disconnect
→ reconnect
→ fetch current Room state
→ tiếp tục
```

Nguyên tắc:

> Database là source of truth; Realtime chỉ để cập nhật nhanh.

Nếu bỏ lỡ event, client phải recover bằng fetch state hiện tại.

---

# PHASE 17 — Security Review

## RLS Audit

Tạo test identity:

```text
Teacher A
Teacher B
Student A
Student B
```

Kiểm tra:

```text
Teacher A != read/write Teacher B Room
Student != update Room
Student != release Section
Student != access future Section
Student != access Quiz answer keys
Student A != modify Student B Reaction/Comment
```

## Markdown XSS

Test payload như:

```html
<script>alert(1)</script>
```

và event-handler HTML độc hại.

Không được execute.

## Comment XSS

Comment phải render dưới dạng safe text/content.

## Room Code guessing

- Code space đủ lớn.
- Rate limit Join.
- Lỗi không leak quá nhiều thông tin.

## Anonymous Auth abuse

Khi deploy public Internet, cân nhắc CAPTCHA/Turnstile cho anonymous sign-in hoặc join flow.

## Service Role

Search code/build output để chắc chắn service-role key không xuất hiện ở client bundle.

---

# PHASE 18 — Test Automation

## Unit Tests

### Markdown

- Parse content.
- Parse code block.
- Parse quiz.
- Invalid quiz.
- Duplicate section ID.
- Unsupported directive.

### Business Logic

- Done Section.
- Released order.
- Quiz scoring.
- Reaction change.
- Attention score.
- Room lifecycle.

## Integration Tests

- Create Room.
- Save Lesson.
- Join Room.
- Release Section.
- Add/Change Reaction.
- Add Comment.
- Submit Quiz.
- End Room.
- Delete Room.

## E2E Teacher

```text
Open
→ Create Room
→ Upload Markdown
→ Preview
→ Start
→ See Room Code
→ See Student Join
→ Done Section
→ See Feedback
→ End
→ Summary
→ Class Voices
```

## E2E Student

```text
Open
→ Join
→ Enter MSSV
→ Wait
→ Receive Section
→ React
→ Comment
→ Quiz
→ Session Ended
```

## Multi-browser

Tối thiểu test:

```text
Teacher browser
Student browser A
Student browser B
```

---

# PHASE 19 — Delete Room + Data Lifecycle

## Mục tiêu

Teacher có thể xóa hoàn toàn dữ liệu buổi học.

Summary có nút:

```text
[ Xóa buổi học ]
```

Confirm rõ:

```text
Bạn có chắc muốn xóa buổi học?

Lesson, danh sách MSSV, quiz, reaction và comment
sẽ bị xóa vĩnh viễn.

[ Hủy ] [ Xóa vĩnh viễn ]
```

Sau Delete:

- Cascade delete.
- Teacher route không truy cập được.
- Student route không truy cập được.

Sau MVP có thể thêm auto-delete 7/30 ngày, nhưng MVP không cần.

---

# PHASE 20 — UI/UX Polish

## Teacher UI ưu tiên

1. Current Section rất rõ.
2. Nút Done nổi bật.
3. Feedback nhìn nhanh.
4. Room Code dễ copy.
5. Student count rõ.
6. End Session có confirm.

## Student UI ưu tiên

1. Một Section một Screen.
2. Reaction một chạm.
3. Comment form ngắn.
4. Waiting State rõ ràng.
5. Quiz mobile-friendly.
6. Không overload thông tin.

## State bắt buộc

```text
Loading
Empty
Error
Disconnected
Waiting
Room Ended
No Comments
Quiz Submitted
```

Không để blank screen.

---

# PHASE 21 — Deployment

## Stack

```text
Next.js    → Vercel
Supabase   → DB/Auth/Realtime
```

## Production Environment

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY
```

## Checklist

- Production migrations chạy đủ.
- RLS enabled.
- Realtime tables/publication cấu hình đúng.
- Anonymous Auth enabled.
- Environment đúng.
- Build pass.
- Smoke E2E pass.
- Secrets không leak.
- Rate limiting/CAPTCHA cân nhắc nếu public.

---

# PHASE 22 — Demo hoàn chỉnh

## Lesson Demo

```text
TCP Three-Way Handshake
```

Sections:

```text
1. TCP Overview
2. SYN
3. SYN-ACK
4. ACK
5. Quiz
6. Summary
```

## Teacher

```text
Create Room
→ Upload tcp.md
→ Preview
→ Start
→ Room Code: 7A29KQ
```

## Student

```text
Code: 7A29KQ
MSSV: 23110001
→ Join
```

Student Waiting.

Teacher dạy Section 1, Student chưa thấy.

Teacher bấm Done.

Student lập tức thấy Section 1.

Student click:

```text
👍
```

Teacher thấy count tăng.

Section 2, Student click:

```text
🤔
```

và gửi:

```text
"Tại sao SYN phải có sequence number?"
```

chọn Anonymous.

Teacher thấy Comment ngay.

Đến Quiz, Teacher release, Student làm Quiz, Teacher xem thống kê.

Teacher End Session.

Summary hiện:

```text
1 participant
Quiz 67%
5 reactions
2 comments
```

Teacher mở `Class Voices` và trình chiếu Comment.

---

## 23. Git Strategy với Codex

Branch gợi ý:

```text
main
├── feat/foundation
├── feat/database-rls
├── feat/create-room
├── feat/markdown
├── feat/join-room
├── feat/session-lifecycle
├── feat/student-viewer
├── feat/reactions
├── feat/comments
├── feat/quiz
├── feat/teacher-dashboard
├── feat/summary
├── feat/comment-wall
└── chore/security-testing
```

Nguyên tắc:

```text
1 feature
→ focused diff
→ tests
→ review
→ merge
```

---

## 24. Thứ tự triển khai bắt buộc

```text
Phase 0   Tài liệu
    ↓
Phase 1   Next.js + Supabase
    ↓
Phase 2   Schema + RLS
    ↓
Phase 3   Create Room
    ↓
Phase 4   Markdown
    ↓
Phase 5   Student Join
    ↓
Phase 6   Start + Waiting
    ↓
Phase 7   Teacher Done/Release
    ↓
Phase 8   Student Viewer
    ↓
Phase 9   Reaction
    ↓
Phase 10  Comment
    ↓
Phase 11  Quiz
    ↓
Phase 12  Teacher Dashboard
    ↓
Phase 13  End Session
    ↓
Phase 14  Summary
    ↓
Phase 15  Class Voices
    ↓
Phase 16  Realtime Hardening
    ↓
Phase 17  Security
    ↓
Phase 18  Tests
    ↓
Phase 19  Delete Lifecycle
    ↓
Phase 20  UX Polish
    ↓
Phase 21  Deploy
    ↓
Phase 22  Demo
```

---

## 25. Có thể gom thành Milestone

### Milestone A — Foundation

```text
Phase 0–2
```

Output:

```text
Project + Supabase + Schema + RLS
```

### Milestone B — Core Classroom

```text
Phase 3–8
```

Output:

```text
Teacher upload Lesson
Student join
Teacher release Section
Student follow
```

Đây là milestone quan trọng nhất.

### Milestone C — Feedback

```text
Phase 9–10
```

Output:

```text
Reaction + Comment realtime
```

### Milestone D — Quiz

```text
Phase 11
```

### Milestone E — Teacher Experience

```text
Phase 12–15
```

Output:

```text
Dashboard + Summary + Class Voices
```

### Milestone F — Production

```text
Phase 16–22
```

---

## 26. Definition of Done cho mọi Phase

Một phase chưa hoàn thành nếu chỉ có UI chạy.

Phải kiểm tra:

- Đúng requirement.
- Không scope creep.
- TypeScript không lỗi.
- Lint pass.
- Build pass.
- Relevant tests pass.
- Error state có xử lý.
- Loading state có xử lý.
- Permission đúng.
- RLS đúng nếu liên quan DB.
- Không expose secret.
- Không expose Quiz answer.
- Không XSS.
- Mobile không vỡ UI.
- Manual test.
- Review diff trước merge.

---

## 27. Nguyên tắc giao việc cho Codex

### Không build toàn bộ project một lần

Đi theo:

```text
Phase
→ Sub-feature
→ Review
→ Test
```

### Codex phải đọc docs trước

Mọi task liên quan Room/Lesson/Section/Quiz/Feedback phải bám:

```text
docs/requirements.md
docs/database.md
docs/markdown-spec.md
docs/security.md
```

### Không đổi schema tùy ý

Sau Phase 2, thay đổi schema phải có migration.

Không sửa DB bằng dashboard rồi quên migration.

### Không tắt RLS để fix nhanh

Nếu lỗi permission:

```text
review policy
→ fix policy
→ add test
```

### Không dùng Service Role ở Client

Tuyệt đối không.

### Source of truth

```text
Postgres = state thật
Realtime = notification/update channel
React state = UI cache
```

---

## 28. Quyết định MVP cần giữ cố định

```text
1 Room = 1 Lesson
```

```text
Student identity trong Room = MSSV
```

```text
Join Room = Attendance
```

```text
Teacher Done = Release Section
```

```text
Student chỉ xem Released Section
```

```text
1 Reaction / Student / Section
```

```text
N Comments / Student / Section
```

```text
1 Quiz Attempt / Student / Quiz
```

```text
No traditional account
```

```text
No AI
```

```text
No LMS features
```

```text
Report tính từ dữ liệu buổi học
```

```text
Delete Room = Delete all Room data
```

---

## 29. Backlog sau MVP

Không làm cho tới khi core flow ổn định:

- Export Markdown.
- Full Lesson Editor.
- Lesson asset ZIP.
- Reusable Lesson Library.
- Persistent Subject/Class roster.
- Compare Sessions.
- QR Join.
- Rotating Attendance Code.
- AI Summary.
- AI Comment Clustering.
- AI Quiz Generation.
- Export Report PDF.
- LMS Exercise Links.
- LTI.
- Teacher reply Comment.
- Comment Upvote.
- Lesson Versioning.

---

## 30. Tiêu chí MVP thành công

MVP thành công nếu demo trơn tru flow sau:

```text
GV mở ClassFlow
    ↓
Tạo Room
    ↓
Upload lesson.md
    ↓
Preview
    ↓
Start
    ↓
Share Room Code
    ↓
SV nhập Code + MSSV
    ↓
SV Waiting
    ↓
GV giảng Section 1
    ↓
GV Done
    ↓
SV thấy Section 1 ngay
    ↓
SV đọc
    ↓
SV click 🤔
    ↓
GV thấy 🤔 tăng ngay
    ↓
SV Comment
    ↓
GV thấy Comment ngay
    ↓
GV giảng tiếp
    ↓
GV Release Quiz
    ↓
SV làm Quiz
    ↓
GV thấy thống kê
    ↓
GV End Session
    ↓
Summary
    ↓
GV mở Class Voices
    ↓
Trình chiếu Comment
```

Nếu flow này ổn định, ClassFlow đã chứng minh đúng giá trị:

> **Sinh viên follow bài giảng tốt hơn, phản hồi dễ hơn, và giảng viên hiểu tình hình lớp rõ hơn ngay trong và sau buổi học.**

---

## 31. Ghi chú kỹ thuật Supabase

- Dùng Anonymous Auth để người dùng không phải tạo account nhưng vẫn có UID cho security.
- Enable RLS cho table public.
- Với MVP có thể dùng Supabase Realtime Postgres Changes vì đơn giản hơn để triển khai.
- Nếu sau này số lượng connection/message tăng mạnh, đánh giá chuyển realtime event quan trọng sang Broadcast.
- Database luôn là source of truth; reconnect phải fetch lại Room state thay vì dựa vào event đã bỏ lỡ.
- Anonymous identities có thể mất khi người dùng xóa browser data hoặc đổi thiết bị; MVP chấp nhận giới hạn này.

