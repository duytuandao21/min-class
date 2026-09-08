# MINCLASS — Technical Documentation

## 1. System architecture

MINCLASS là một Next.js App Router application kết nối trực tiếp với Supabase. Project không có backend framework riêng; server-side orchestration nằm trong Server Components, Server Actions, Route Handlers và PostgreSQL RPC.

```mermaid
flowchart LR
    T[Teacher browser] --> N[Next.js App Router]
    S[Student browser] --> N
    N --> SC[Server Components]
    N --> SA[Server Actions / Route Handlers]
    SC --> SSR[Supabase SSR client]
    SA --> SSR
    T --> BC[Supabase browser client]
    S --> BC
    SSR --> A[Supabase Auth]
    SSR --> D[(PostgreSQL + RLS)]
    BC --> A
    BC --> D
    D --> RT[Supabase Realtime]
    RT --> T
    RT --> S
```

Nguyên tắc trạng thái:

- PostgreSQL là source of truth.
- Realtime event chỉ yêu cầu client đồng bộ lại dữ liệu.
- React state là cache và trạng thái tương tác tạm thời.
- Sau reconnect, client fetch lại snapshot từ database.

## 2. Frontend architecture

### App Router

Server Components được dùng mặc định để load dữ liệu và kiểm tra quyền trước khi render. Client Components chỉ dùng cho form tương tác, browser API, optimistic UI, carousel và Realtime subscriptions.

Các route chính:

| Route | Vai trò | Chức năng |
|---|---|---|
| `/` | Public | Landing page |
| `/teacher/login` | Teacher | Đăng nhập |
| `/teacher/subjects` | Teacher | Danh sách Subject |
| `/teacher/subjects/[subjectId]` | Teacher | Subject Detail, Course Section và Lesson Plan modal qua `?lessonPlan=open` |
| `/teacher/subjects/[subjectId]/sections/[courseSectionId]` | Teacher | Roster, Chapter/Lesson riêng của lớp, Live, History và export |
| `.../lessons/new?chapterId=...` | Teacher | Upload/chỉnh sửa/preview và tạo tối đa 20 Lesson vào Chapter hiện tại |
| `.../lessons/[lessonId]` | Teacher | Lesson Detail và Session History |
| `/teacher/rooms/[roomId]` | Teacher | Live Dashboard |
| `/teacher/rooms/[roomId]/summary` | Teacher | Session Summary/Lesson Review |
| `/teacher/rooms/[roomId]/reviews` | Teacher | Session Reviews |
| `/teacher/rooms/[roomId]/voices` | Teacher | Class Voices |
| `/learn` | Student/Public | Danh sách Subject |
| `/learn/live` | Student/Public | Danh sách Chapter Session đang LIVE |
| `/learn/subjects/[subjectId]` | Student/Public | Danh sách Course Section |
| `/learn/subjects/[subjectId]/sections/[courseSectionId]` | Student | Xác minh MSSV một lần và hiển thị Chapter theo trạng thái |
| `.../chapters/[chapterId]` | Student | Xem trước Chapter, tham gia LIVE hoặc mở Session đã kết thúc |
| `/learn/lessons/[lessonId]` | Student | MSSV access gate |
| `/student/rooms/[roomId]` | Student | Chapter Session LIVE/ENDED với điều hướng Lesson |
| `/learn/review/[sessionId]` | Student | Ended Lesson Review |
| `.../export` | Teacher | Download Excel |

Tên route `/rooms/` được giữ để tái sử dụng live core; về nghiệp vụ, `roomId` hiện đại diện cho Lesson Session.

### Component boundaries

- Page/Server Component gọi feature query để lấy snapshot ban đầu.
- Feature component nhận typed data và xử lý trình bày.
- Form tương tác gọi Server Action hoặc browser-side RPC wrapper.
- Business validation không đặt trực tiếp trong JSX.
- Markdown được parse thành normalized domain data trước khi render.

## 3. Backend architecture

Backend của MINCLASS gồm hai lớp:

### Next.js server layer

- Server Components load dữ liệu theo route; Course Section đọc cookie xác minh MSSV và render thẳng nội dung mà không qua màn hình kiểm tra phía client.
- Server Actions validate `FormData`, gọi Supabase và revalidate/redirect.
- Route Handler tạo file Excel ở server.
- Supabase SSR client chuyển tiếp Auth cookie từ request.
- Proxy refresh Supabase session bằng `getClaims()`.

### Supabase database layer

- PostgreSQL lưu trạng thái thật.
- RLS bảo vệ direct table access.
- Database constraints bảo vệ invariant và duplicate.
- Security-definer RPC xử lý các transaction nhạy cảm.
- Triggers phát Realtime event hoặc bảo vệ quan hệ.
- Advisory lock ngăn race condition khi Start Session và thay roster.

Project không dùng service-role key trong runtime và không có NestJS/Express API riêng.

## 4. Các module chính

| Module | Vị trí | Trách nhiệm |
|---|---|---|
| Auth | `src/features/auth/` | Teacher login/logout, server-side identity guard |
| Subjects | `src/features/subjects/` | Subject, Course Section, Chapter, roster và Excel export |
| Lessons | `src/features/lessons/` | Markdown parser, Lesson creation, preview và Session start |
| Catalog | `src/features/catalog/` | Public catalog, MSSV gate và Ended Lesson Review |
| Rooms | `src/features/rooms/` | Section flow, attendance, reaction, comment, Quiz, Summary và presentation |
| Supabase | `src/lib/supabase/` | Browser/server client, config và cookie refresh |
| Shared UI | `src/components/` | Back link, add action button và anonymous bootstrap |

### Auth module

- `teacher-session.ts`: xác minh permanent Teacher trên server.
- `actions.ts`: login/logout bằng Supabase Auth.
- `teacher-auth-form.tsx`: form đăng nhập.
- `teacher-account-menu.tsx`: đăng xuất.

### Subjects module

- CRUD Subject, Course Section và Chapter; liên kết bản mẫu với bản sao riêng của từng lớp học phần.
- Đồng bộ có chọn lọc thay đổi Lesson Plan sang Course Section cũ; giữ nguyên Lesson đã có Session hoặc đã được tùy chỉnh riêng.
- Parse/preview/replace roster.
- Query Course Section Detail và Session metadata.
- Tạo workbook Excel từ dữ liệu aggregate của database.

### Lessons module

- `markdown/parser.ts`: parse frontmatter và `:::section`/`:::quiz` directives.
- `markdown/schema.ts`: normalized Lesson schema.
- Form tạo Lesson hỗ trợ tối đa 20 file `.md`, danh sách tab, đổi tên/xóa/chỉnh sửa/preview từng file và batch save vào Chapter đã chọn.
- Lesson Plan và Course Section dùng các batch RPC riêng nhưng giữ cùng trải nghiệm tạo Lesson.
- Thư viện ảnh dùng Supabase Storage bucket `lesson-images`, giới hạn PNG/JPEG/WebP 5 MB và đường dẫn được phân vùng theo Teacher/Subject.
- `session-actions.ts`: Start Chapter Session chứa toàn bộ Lesson của Chapter.
- Lesson Review Player hiển thị Section theo kiểu trái/phải.

### Rooms module

- `lesson-flow.ts`: parse Student Lesson snapshot.
- `feedback.ts`: reaction/comment domain schemas.
- `quiz.ts`: Quiz snapshot và analytics schemas.
- `summary.ts`: Summary data contract.
- `class-voices.ts`: Class Voices data contract.
- Realtime clients subscribe rồi gọi lại snapshot loader.

## 5. Luồng dữ liệu chính

### Tạo Lesson

```mermaid
sequenceDiagram
    actor Teacher
    participant Form as Lesson Form
    participant Parser as Markdown Parser
    participant Action as Server Action
    participant DB as PostgreSQL RPC

    Teacher->>Form: Mở + Lesson tại Chapter, chọn tối đa 20 file .md
    Form->>Parser: Parse và validate từng file
    Parser-->>Form: Danh sách Lesson đã chuẩn hóa / validation errors
    Form-->>Teacher: Chỉnh sửa hoặc Preview tùy chọn
    Teacher->>Action: Save all
    Action->>Action: Validate input và ownership
    Action->>DB: create_course_section_lessons_batch(...) hoặc create_subject_template_lessons_batch(...)
    DB->>DB: Insert toàn bộ Lesson, Section, Quiz và answer key trong transaction
    DB-->>Action: Danh sách Lesson ID
    Action-->>Teacher: Quay lại Chapter
```

### Start và join Chapter Session

```mermaid
sequenceDiagram
    actor Teacher
    actor Student
    participant App as Next.js
    participant Auth as Supabase Auth
    participant DB as PostgreSQL RPC

    Teacher->>App: Chọn Live tại Chapter
    App->>DB: start_chapter_session(chapter_id)
    DB->>DB: Verify owner + acquire advisory lock
    DB->>DB: Create ACTIVE room/session + session_lessons
    DB->>DB: Snapshot roster to session_attendance
    Student->>Auth: Anonymous session
    Student->>App: Chọn Chapter LIVE và submit MSSV
    App->>DB: join_live_chapter_session(session_id, mssv)
    DB->>DB: Verify ACTIVE session + attendance snapshot
    DB->>DB: Create/reuse participant + set joined_at
    DB-->>Student: Session access
```

### Section và Realtime

```mermaid
sequenceDiagram
    actor Teacher
    participant DB as PostgreSQL
    participant RT as Supabase Realtime
    actor Student

    Teacher->>DB: release_session_lesson_section(room_id, lesson_id)
    DB->>DB: Cập nhật teaching_section/released_through riêng của Lesson
    DB-->>RT: rooms UPDATE event
    RT-->>Student: Change notification
    Student->>DB: get_student_lesson_snapshot(room_id)
    DB-->>Student: Only released Sections
```

### Quiz submit

```mermaid
sequenceDiagram
    actor Student
    participant RPC as submit_session_quiz
    participant Key as quiz_answer_keys
    participant DB as PostgreSQL
    participant RT as Realtime

    Student->>RPC: Question IDs + selected option IDs
    RPC->>DB: Verify participant, Session ACTIVE và Section released
    RPC->>Key: Read private answer key
    RPC->>DB: Store attempt, answers và server-calculated score
    DB-->>RT: QUIZ feedback event
    RPC-->>Student: Score and allowed review data
```

## 6. Authentication và authorization

### Teacher authentication

- UI nhận username `thaybao`.
- Server ánh xạ username đến email Supabase Auth `thaybao@minclass.local`.
- Password được Supabase Auth xác thực.
- `requireTeacher()` chặn server-side cho route Teacher.
- RLS/RPC đồng thời kiểm tra `auth.uid()`, anonymous claim và email Teacher.

Không chỉ dựa vào client redirect để bảo vệ route.

### Student identity

- `AnonymousAuthBootstrap` khởi tạo Supabase anonymous session ở nền cho route Student; trang public không chờ Auth để render catalog.
- Course Section xác minh roster một lần, lưu MSSV vào cookie phiên `HttpOnly` theo lớp và dùng lại khi mở Chapter xem trước/đã kết thúc. Chapter LIVE vẫn xác minh MSSV riêng.
- Một MSSV có thể join cùng Session từ nhiều anonymous browser; `participants` giữ một bản ghi canonical theo Session/MSSV và `lesson_session_access_grants` ánh xạ các phiên trình duyệt vào bản ghi đó.
- Student không có account UI.

### Authorization layers

```text
Input validation (Zod)
        ↓
Server route/action ownership check
        ↓
PostgreSQL RPC validation
        ↓
RLS + foreign key + unique/check constraints
```

Các nguyên tắc quan trọng:

- Teacher chỉ truy cập cây dữ liệu thuộc `teacher_id/auth.uid()`.
- Student LIVE phải thuộc attendance snapshot.
- Student Review phải có access grant được cấp sau MSSV verification.
- Unreleased Section không được trả về.
- Answer key không được cấp direct `SELECT` cho Student.
- Anonymous masking được tính ở server/database.
- Mutation sau `ENDED` bị RPC/database từ chối.

## 7. Realtime architecture

Realtime được dùng cho:

- Trạng thái Section và End Session từ `rooms`.
- Participant count từ `participants`/`session_attendance`.
- Reaction/comment/Quiz qua `room_feedback_events`.
- Session Review qua `session_reflections`.

Client subscription không tự coi payload là source of truth. Sự kiện Realtime liên tiếp được debounce/coalesce trước khi refetch snapshot. Dashboard chỉ bật polling dự phòng khi channel lỗi, timeout hoặc đóng; khi kết nối lại, client dừng polling và tải lại snapshot mới nhất.

## 8. Markdown architecture và XSS

Pipeline:

```text
Raw Markdown
  → Normalize newline/BOM
  → Parse YAML frontmatter/directives
  → Validate allowed Markdown AST nodes and URLs
  → Normalize Lesson domain data
  → Persist source + normalized relational records
  → Render with React Markdown without raw HTML
```

Chỉ hỗ trợ paragraph, heading, strong, emphasis, list, link, image, inline code, fenced code và line break. HTML tùy ý bị parser từ chối. Link/ảnh chỉ chấp nhận protocol được cho phép.

## 9. External services

### Supabase

Supabase là external service duy nhất của runtime:

- Auth: permanent Teacher và anonymous Student identity.
- PostgreSQL: domain data và transaction logic.
- RLS: row-level authorization.
- Realtime: change notification.

Ứng dụng không tích hợp email provider, payment, AI hay analytics service bên thứ ba. Supabase Storage được dùng cho ảnh Markdown của Lesson qua bucket public `lesson-images`; quyền upload/update/delete vẫn được bảo vệ bằng policy theo Teacher và Subject.

## 10. Các quyết định kỹ thuật quan trọng

### Evolve `rooms` thành Lesson Session

Live Room core được tái sử dụng làm Chapter Session thay vì tạo hệ thống song song. `rooms.course_section_id` và `rooms.chapter_id` xác định buổi học; `session_lessons` chứa các Lesson cùng trạng thái Section riêng. `rooms.lesson_id` và `code` vẫn tồn tại để tương thích dữ liệu cũ nhưng không còn là quan hệ chính của flow Chapter hiện tại.

### Persistent Lesson tách khỏi Session

Lesson Plan của Subject là bản mẫu. Khi tạo Course Section, hệ thống sao chép Chapter/Lesson thành bản độc lập và lưu liên kết `template_chapter_id`/`template_lesson_id` để có thể đồng bộ có chọn lọc về sau. Mỗi lần Start chỉ tạo Chapter Session và các row `session_lessons`, không sao chép hay thay đổi nội dung Lesson.

### Attendance snapshot

Roster được chụp một lần vào `session_attendance` khi Start Chapter. Một Session là một buổi điểm danh dù Chapter có bao nhiêu Lesson; nếu cùng Chapter được Start nhiều lần thì mỗi Session là một buổi riêng. Update roster sau này không sửa lịch sử Session.

### Query và rendering hiệu năng

Public catalog dùng các RPC gộp `get_public_subject_course_sections`, `get_public_course_section_catalog` và `get_public_chapter_catalog` để giảm round trip. Teacher Summary được tách thành overview nhẹ, attendance và dữ liệu từng Lesson để stream/lazy-load. Quiz analytics có hàm dựng dùng chung và query theo Lesson; các index lịch sử Chapter Session và covering index cho Quiz Answer hỗ trợ các truy vấn thường xuyên.

### Database RPC cho mutation nhạy cảm

Join, Start, release Section, submit Quiz, End, Summary và access Review được xử lý trong database để tránh client bypass và giảm race condition.

### Answer key riêng tư

`quiz_answer_keys` không được gửi trước submit. Server/RPC chấm điểm. Ended Review chỉ trả answer key sau khi xác minh Session và MSSV.

### Không dùng service role

Mọi runtime request dùng publishable key cộng Auth session và RLS. Service role không được đưa vào browser hoặc dùng để sửa lỗi quyền.

## 11. Testing

- Unit tests đặt cạnh feature dưới tên `*.test.ts`.
- Database/RLS tests nằm trong `supabase/tests/`.
- Markdown parser, roster parser, auth action, Session flow, feedback, Quiz, Summary, review và export đều có test tương ứng.

Các lệnh:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:db
pnpm build
```

## 12. Deployment

- Next.js tạo standalone output ngoài Vercel.
- Dockerfile dùng multi-stage build và chạy bằng non-root user.
- Supabase URL/publishable key cần có ở build time và runtime.
- App server nên deploy gần region của Supabase để giảm latency từ các query nối tiếp.
- Production URL phải được thêm vào Supabase Auth site URL và redirect allow list.
