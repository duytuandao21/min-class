# MINCLASS — Báo cáo audit hiệu suất

Ngày audit: 05/09/2026  
Phạm vi: toàn bộ source `src/`, cấu hình Next.js, dependencies, Supabase migrations/RLS/Realtime, static assets và luồng điều hướng hiện có.

> Đây là static code audit. Báo cáo không chạy migration, không thay đổi database, không đo Lighthouse/Web Vitals trên production và không có `EXPLAIN (ANALYZE, BUFFERS)` từ database thật. Vì vậy các nhận xét về query plan/scale là kết luận từ code và schema; số latency thực tế cần xác nhận bằng telemetry và Dashboard.

## 1. Executive Summary

Đánh giá tổng thể: **Trung bình**.

Điểm tốt:

- Project dùng App Router, Server Component mặc định và tách data access vào `features/*/server` hoặc `lib/` khá rõ.
- Không tìm thấy `select("*")` trong TypeScript; phần lớn query chỉ lấy cột cần thiết.
- Các query độc lập quan trọng đã dùng `Promise.all`.
- Realtime đều có cleanup bằng `removeChannel`; Student reconnect/focus có fetch lại database đúng nguyên tắc database là source of truth.
- Hầu hết FK/unique path chính như Section theo Lesson, Participant theo Room, Reaction, Quiz Attempt, Session Lesson và roster đã có index.
- Asset tĩnh dùng trong runtime nhỏ; không có custom web font gây render blocking.

Bottleneck lớn nhất:

1. **Teacher Live Dashboard thực hiện quá nhiều Supabase/Auth round-trip khi mở trang**, đồng thời có ba cơ chế đồng bộ độc lập và hai RPC nặng bị polling mỗi 3 giây.
2. **Anonymous Auth chặn toàn bộ giao diện public**, kể cả Home và trang browse vốn có thể render mà chưa cần phiên Student; Supabase browser SDK cũng đi vào bundle chung của toàn bộ public flow.
3. **Quiz Analytics, Summary và Class Voices có correlated subquery theo Quiz/Question/Option/Section**. Quiz Analytics đặc biệt đáng chú ý vì được gọi liên tục lúc LIVE.
4. **Public catalog ghép metadata ổn định với trạng thái LIVE động**, không có cache và tính status bằng function theo từng Lesson.
5. Một số dataset lịch sử/roster tăng không giới hạn và một số query lịch sử chưa có composite index khớp filter + sort.

Không phát hiện P0 có thể làm hệ thống ngừng hoạt động ngay ở quy mô hiện tại. Các P1 dưới đây có khả năng tác động trực tiếp đến thời gian mở trang, số request và tải database khi nhiều lớp chạy đồng thời.

## 2. Architecture Overview

### Frontend và rendering

- Next.js `16.3.1`, React `19.2.8`, TypeScript strict, Tailwind CSS 4.
- App Router hoàn toàn; không có `pages/`.
- Page/layout mặc định là Server Component. Các phần interaction, editor, popup, quiz và realtime là Client Component.
- Root layout tại `src/app/layout.tsx:16-21` bọc toàn bộ ứng dụng bằng `AnonymousAuthBootstrap`.
- Có loading boundary chung `src/app/loading.tsx`, loading riêng cho `/learn` và `/teacher/subjects`; chưa có loading boundary gần các route động nặng như Teacher Live/Summary/Chapter History.

### Backend và data access

- Không có backend framework riêng.
- Server Components, Server Actions và Route Handlers gọi Supabase bằng publishable key + cookie session.
- Query tập trung chủ yếu tại:
  - `src/features/subjects/server/queries.ts`
  - `src/features/catalog/server/queries.ts`
  - `src/features/rooms/server/queries.ts`
  - các Server Action trong `features/*/actions.ts`
- Business logic nhạy cảm nằm trong PostgreSQL RPC `security definer`, có kiểm tra ownership/session và RLS.

### Supabase và authentication

- Server client: `src/lib/supabase/server.ts:6-25`.
- Browser client: `src/lib/supabase/client.ts:7-11`.
- Student dùng Supabase Anonymous Auth; bootstrap tại `src/components/anonymous-auth-bootstrap.tsx`.
- Teacher dùng user thật có email cố định; `requireTeacher()` tại `src/features/auth/teacher-session.ts:29-32` và Teacher layout tại `src/app/teacher/layout.tsx:6-13`.
- Proxy gọi `supabase.auth.getClaims()` cho mọi request không phải static asset tại `src/lib/supabase/proxy.ts:32` và matcher `src/proxy.ts:9-10`.

### Realtime

- Student flow: subscribe `rooms` và `session_lessons`, sau event sẽ fetch snapshot mới.
- Teacher flow: ba client riêng theo dõi attendance, feedback và quiz; event chỉ trigger RPC fetch lại dữ liệu.
- `room_feedback_events` là bảng event trung gian được publish lên Realtime.

### Deployment

- `next.config.ts` dùng standalone khi không chạy trên Vercel; trên Vercel để Next tự chọn output.
- Không có `vercel.json`; không có region Vercel trong repository.
- Docker multi-stage dùng Node 22 Alpine.
- Request Server Component/Server Action đi theo `Browser → Vercel/Next server → Supabase`.
- Realtime, anonymous sign-in và các RPC client-side đi theo `Browser → Supabase`.
- **Cần kiểm tra trên Vercel Dashboard:** Function region và Web Analytics/Speed Insights.
- **Cần kiểm tra trên Supabase Dashboard:** project region, connection/query latency, Realtime connections và slow query report.

## 3. Top Performance Problems

| Priority | Problem | Location | Impact | Difficulty |
|---|---|---|---|---|
| P1 | Anonymous Auth chặn render toàn bộ public UI | `src/app/layout.tsx:20`; `src/components/anonymous-auth-bootstrap.tsx:28-71` | FCP/LCP và mọi public navigation phải chờ browser auth; có thể flash full-screen loading | Medium |
| P1 | Teacher Live mở trang với chuỗi query/auth dài | `src/app/teacher/rooms/[roomId]/page.tsx:25-32`; `src/features/rooms/server/queries.ts:120-212` | TTFB/navigation phụ thuộc nhiều round-trip tuần tự; độ trễ nhân lên nếu Vercel và Supabase khác region | Medium–High |
| P1 | Teacher Live có 3 channel và nhiều polling timer 3 giây độc lập | `teacher-room-overview.tsx:26-55`; `teacher-live-feedback.tsx:49-92`; `teacher-quiz-analytics.tsx:44-89` | Khoảng 60 lần sync/phút/dashboard ngay cả khi không có event; tải tăng tuyến tính theo số dashboard đang mở | Medium |
| P1 | Quiz Analytics RPC có correlated subquery và bị polling liên tục | `202609030004_chapter_lesson_sessions.sql:923-989`; `teacher-quiz-analytics.tsx:75` | CPU/IO database tăng theo Quiz × Question × Option × Attempt; là bottleneck chính khi nhiều lớp LIVE | High |
| P1 | Auth Teacher bị kiểm tra lặp trong cùng request | `teacher/layout.tsx:7`; `teacher-session.ts:14-32`; mỗi server query lại gọi `requireTeacher()` | `/teacher/rooms/[roomId]` có thể tạo nhiều auth call trùng; tăng TTFB và request count | Low |
| P2 | Public Lesson status là SQL N+1 theo Lesson | `202609030001_subject_template_lessons.sql:619-628`; `202609030004_chapter_lesson_sessions.sql:595-614` | Mỗi Lesson gọi function với tối đa hai `exists`; chậm dần khi Course Section có nhiều Lesson/Session | Medium |
| P2 | Không có cache cho public catalog metadata | `src/features/catalog/server/queries.ts:32-93`; không có `use cache`, `unstable_cache`, `revalidate` | Subject/Section/Chapter metadata bị gọi lại ở mỗi request/navigation | Medium |
| P2 | Metadata ổn định và trạng thái LIVE bị trả chung trong một RPC | `get_public_course_section_lessons` ở migration `202609030001...:619-628` | Không thể cache metadata dài mà vẫn giữ status tươi; tạo invalidation phức tạp | Medium |
| P2 | Course Section Teacher tải toàn bộ roster và serialize sang Client Component | `subjects/server/queries.ts:221-236`; `roster-student-list.tsx:10-88` | Cho phép đến 2.000 MSSV; tăng RSC payload, hydration và DOM | Medium |
| P2 | Class Voices và Summary dùng correlated count theo Section | `202609030010_class_voices_by_lesson.sql:29-83`; `202609030004...:1139-1154` | Trang hậu kỳ chậm theo số Section/Comment/Reaction; Class Voices trả toàn bộ comment | Medium–High |
| P2 | Bảng event Realtime tăng vĩnh viễn theo interaction | `202608200005_section_reflection.sql:1-11,36-68` | Mỗi reaction update/comment/quiz tạo row; session được lưu lịch sử nên bảng và WAL/Realtime traffic tăng lâu dài | Medium |
| P2 | Thiếu index khớp các trang lịch sử Room theo Course/Chapter | `subjects/server/queries.ts:245-257,394-399`; indexes hiện tại trong migrations | Query ENDED + ORDER BY `started_at` có thể scan/sort nhiều Room khi lịch sử tăng | Low |
| P2 | Session Reflection Realtime subscribe toàn bảng | `src/features/rooms/session-reflection-client.ts:43-51` | Mọi review của mọi Room trigger fetch ở mọi viewer đang mở; cross-class fan-out | Low |
| P2 | Public page lấy cả collection chỉ để xác định một parent | `learn/subjects/[subjectId]/page.tsx:9-14`; Course Section/Chapter pages | Over-fetch Subject/Course Sections và lặp RPC khi số môn/lớp tăng | Low–Medium |
| P3 | Native lesson images không có intrinsic width/height | `markdown-preview.tsx:19-21`; `lesson-image-uploader.tsx:184-205` | Có thể gây layout shift; ảnh library chỉ load khi popup mở nên ảnh hưởng thấp | Medium |
| P3 | Loading state còn thô và ở boundary quá cao | `src/app/loading.tsx`; thiếu loading gần `teacher/rooms`, summary/history | Perceived navigation chậm dù app đang fetch; không làm query chậm hơn | Low |

## 4. Data Fetching Audit

### N+1

**Public Lesson status — P2**

- File: `supabase/migrations/202609030001_subject_template_lessons.sql:619-628`.
- Function: `get_public_course_section_lessons`.
- Evidence: query duyệt Lesson và gọi `private.public_lesson_status(lessons.id)` cho từng row. Function tại `202609030004_chapter_lesson_sessions.sql:595-614` thực hiện tối đa hai `exists` vào `session_lessons + rooms` cho mỗi Lesson.
- Impact: số subquery tăng tuyến tính theo Lesson; mỗi Course Section mở lại đều tính từ đầu.
- Recommendation: tính status set-based bằng join/aggregate một lần theo danh sách Lesson; tách metadata khỏi live status để cache độc lập.

**Quiz Analytics — P1**

- File: `supabase/migrations/202609030004_chapter_lesson_sessions.sql:923-989`.
- Evidence: với mỗi Quiz tạo subquery Questions; với mỗi Question tạo subquery Options; với mỗi Option lại `count(*)` qua `quiz_answers`, `quiz_attempts`, `participants`. Participant count còn được tính lại ba lần tại dòng 973-976.
- Impact: tăng gần theo số Quiz × Question × Option, cộng số attempt; RPC này bị polling mỗi 3 giây.
- Recommendation: aggregate Answer/Option/Participant trong các CTE set-based một lần; chỉ query Lesson đang xem; chỉ chạy khi có event Quiz hoặc fallback thưa hơn.

**Class Voices/Summary — P2**

- `202609030010_class_voices_by_lesson.sql:29-83`: ba reaction count và một comments aggregate cho từng Section.
- `202609030004_chapter_lesson_sessions.sql:1139-1154`: hai count tương quan cho từng Section để tìm section nhiều phản hồi nhất.
- Recommendation: group reaction/comment một lần theo `section_id`, sau đó join vào Section.

### Request waterfall

**Teacher Live — P1**

- `getTeacherRoom()` chạy: auth → `(room + attendance)` → `session_lessons` → lesson labels → selected Lesson → Course Section → Sections.
- Sau khi hoàn thành toàn bộ chuỗi trên, page mới chạy song song Feedback và Quiz Analytics tại `teacher/rooms/[roomId]/page.tsx:29-32`; mỗi function lại xác thực Teacher.
- Ước tính static path: tối đa khoảng **14 Supabase SDK/Auth operations** cho một lần mở trực tiếp, tính cả proxy và Teacher layout; đây là số operation trong code, không khẳng định mọi operation đều thành một HTTP request riêng do SDK/JWKS cache.
- Recommendation: memoize auth trong phạm vi request; trả Room + Lesson list/progress/context/selected Sections trong một RPC hoặc một relation query; giữ Feedback/Quiz streaming bằng Suspense nếu chưa thể hợp nhất.

**Student Live — P2**

- `getStudentRoom()` tại `rooms/server/queries.ts:215-309`: `auth.getUser` → ba request song song → snapshot → reactions → reflection nếu ENDED.
- Các bước sau phụ thuộc identity/selected Lesson nên không thể song song toàn bộ, nhưng participant/access lookup có thể được gom vào một RPC session context.

**Ended Review — P2**

- Review và lesson labels chạy song song tại `learn/review/[sessionId]/page.tsx:25-28`.
- Bên trong `getStudentEndedLessonReview`, Review + Reflection chạy song song, sau đó lại gọi Gate Context để lấy Subject/Course Section (`catalog/server/queries.ts:105-145`). Context có thể trả ngay trong review RPC, giảm một round-trip.

### Duplicate requests

- Teacher layout đã `requireTeacher()` nhưng `getSubjects`, `getSubjectDetail`, `getTeacherRoom`, `getTeacherFeedbackSnapshot`, `getTeacherQuizAnalytics`, Summary/Voices đều tự gọi lại.
- Đây là defense-in-depth đúng về authorization, nhưng thiếu request memoization khiến cùng một user bị `auth.getUser()` lặp nhiều lần trong một render.
- Public Course Section và Chapter Access cùng gọi ba RPC tương tự; mỗi navigation làm lại toàn bộ.
- Lesson Editor sau save dùng `router.push()` rồi `router.refresh()` (`lesson-editor-form.tsx:92-93` và create form `:79-80`), có khả năng tạo refresh dư vì route mới đã tự fetch. Cần xác minh bằng Network panel trước khi bỏ.

### Over-fetching / fetch quá sớm

- `getCourseSectionRosterDetail()` tải toàn bộ roster, chapter, lesson và session history ngắn gọn để render một page. Roster được serialize toàn bộ vào Client Component.
- Public Chapter Access tải toàn bộ Course Sections của Subject, toàn bộ Chapters và toàn bộ Lessons của Course Section chỉ để hiển thị một Chapter (`chapters/[chapterId]/page.tsx:30-43`).
- Summary/Class Voices chủ ý cần dataset tổng hợp, nhưng Class Voices trả toàn bộ comments của toàn bộ released Sections; không pagination/chunking.
- `getTeacherRoomSummary()` gọi đủ summary, attendance, reflections, lesson labels ngay khi mở Summary dù một số nhóm nội dung nằm xa viewport.

### Client-side fetching

- Client fetching hợp lý cho Realtime, optimistic reaction/comment và Quiz theo Section.
- `StudentQuiz` chỉ fetch Quiz khi Quiz Section mount (`student-quiz.tsx:19-40`), tránh tải quiz chưa mở — đây là lựa chọn tốt.
- Điểm chưa tối ưu là polling fallback quá dày trên Teacher, không phải việc client fetch tự thân.

## 5. Supabase / Database Audit

### Quan hệ và index hiện có đáng chú ý

- `sections (lesson_id, position)` unique: hỗ trợ load Section theo Lesson và order.
- `participants (room_id, mssv)` và `(room_id, user_id)` unique: hỗ trợ join/access; thêm `participants_user_id_idx`.
- `section_reactions (section_id, participant_id)` unique; có index riêng cho Section/Participant.
- `section_comments (section_id, created_at desc)` và Participant index.
- Quiz: `quizzes(section_id)` unique; Questions `(quiz_id, position)`; Options `(question_id, position)`; Attempts `(quiz_id, participant_id)`; Answers `(attempt_id, question_id)`.
- Subject/Course: `subjects(teacher_id, created_at desc)`, `course_sections(subject_id, created_at)`.
- Roster: unique `(course_section_id, normalized_mssv)`.
- Lesson: `(course_section_id, created_at desc)`, `(chapter_id, created_at desc)`, template `(subject_id, chapter_id, created_at)`.
- Chapters: Course/Subject + normalized name indexes.
- Attendance: PK `(session_id, mssv)` và `(session_id, joined_at)`.
- Session Lessons: PK `(session_id, lesson_id)` và reverse `(lesson_id, session_id)`.
- Access Grant: unique `(room_id,user_id)`, `(room_id,mssv)` và reverse `(user_id,room_id)`.
- Realtime event: `(room_id, id desc)`.

### Index có thể thiếu

1. **Room history theo Course Section**
   - Query: `subjects/server/queries.ts:245-250`, `202609030011...:35-47`.
   - Filter: `course_section_id`, `status`; sort `started_at desc` ở UI query.
   - Index hiện có: partial unique `(course_section_id) WHERE status='ACTIVE'`, không hỗ trợ tốt lịch sử ENDED + sort.
   - Candidate cần benchmark: `(course_section_id, status, started_at desc)` hoặc partial cho `ACTIVE/ENDED`.

2. **Room history theo Chapter**
   - Query: `subjects/server/queries.ts:394-399` lọc `course_section_id`, `chapter_id`, status và sort `started_at desc`.
   - Candidate: `(course_section_id, chapter_id, started_at desc)` với predicate trạng thái cần thiết.

3. **Public LIVE list**
   - Query: `202609030004...:581-592` lọc `rooms.status='ACTIVE'`, sort `started_at desc`.
   - Partial unique active Course index có thể đủ khi số Course nhỏ; chỉ thêm `(started_at desc) WHERE status='ACTIVE'` nếu `EXPLAIN` cho thấy sort/scan đáng kể.

4. **Session Reflection Realtime filter**
   - Table không có `room_id`; subscribe hiện không thể filter theo Room và phải fan-out toàn bảng.
   - Đây trước hết là vấn đề data/event model, không nên thêm index mù quáng.

### Query có nguy cơ full scan / sort

- Room history khi số session tăng do index chưa khớp như trên.
- `get_teacher_class_voices` và Summary phải đọc toàn bộ feedback của Room theo thiết kế; index Section/Participant giúp join nhưng correlated aggregate vẫn tốn CPU.
- `get_teacher_course_section_export` đọc toàn roster và tất cả session attendance/reflection của Course Section. Đây là hành vi đúng cho export; chỉ nên tối ưu sau khi đo.

### Pagination và giới hạn

- Live Feedback giới hạn 30 comment mới nhất — tốt.
- Roster không pagination, giới hạn nghiệp vụ tối đa 2.000 MSSV.
- Subject/Course/Chapter/Lesson/Session history không pagination.
- Summary, Class Voices, Reviews và export không pagination; các trang này có dataset tăng theo lịch sử/feedback.

### RLS impact

- RLS dùng nhiều helper `private.is_room_teacher`, `private.is_room_participant` và `exists` qua quan hệ. Đây là đúng về security nhưng có thể được đánh giá theo từng row trên direct table select/Realtime authorization.
- Nhiều policy gọi trực tiếp `auth.uid()`/`auth.jwt()` thay vì init-plan subselect. Chỉ nên thay đổi khi `EXPLAIN` trên query thật chứng minh per-row overhead; các RPC `security definer` hiện đã gom phần lớn read nặng.
- Không đề xuất tắt RLS hay dùng service role để tối ưu.

## 6. Realtime Audit

### Subscription và cleanup

- `StudentLessonPlayer` tạo một channel với ba listeners, filter rõ theo Room; cleanup đầy đủ (`student-lesson-player.tsx:90-147`).
- Attendance, Feedback, Quiz mỗi phần Teacher tạo một channel riêng; đều cleanup bằng `removeChannel`.
- Không thấy leak subscription rõ ràng khi component unmount.

### Scope/filter

- Room/session listeners có filter theo `room_id/session_id` — tốt.
- `useTeacherSessionReflectionsRealtime` subscribe `session_reflections` không filter (`session-reflection-client.ts:43-51`). Review từ bất kỳ lớp nào đều kích hoạt sync Room hiện tại.
- Event Feedback dùng `room_feedback_events`, filter theo Room; phù hợp hơn subscribe trực tiếp toàn bảng reaction/comment.

### Duplicate workload

Teacher Live đồng thời mount:

- Attendance: 1 channel + polling 3 giây.
- Feedback: 1 channel + polling 3 giây.
- Quiz: 1 channel + polling 3 giây.

Ngay cả khi không có thay đổi, một dashboard có thể gọi ba RPC mỗi 3 giây, tức khoảng 60 sync/phút. Feedback và Quiz cùng nghe một bảng event nhưng dùng hai channel khác nhau. Quiz chỉ xử lý `kind === 'QUIZ'`, tuy vậy timer vẫn gọi analytics liên tục.

### Data nên realtime

- Section release/progress.
- Room end/delete.
- Attendance joined count.
- Reaction aggregate và latest comments.
- Quiz submission progress.
- Session Review mới gửi nếu Teacher đang mở viewer.

### Data không cần realtime

- Subject/Course/Chapter/Lesson metadata.
- Roster list đầy đủ.
- Session history đã ENDED.
- Summary/Class Voices sau khi session đã ổn định, trừ review cuối buổi đang nhận trong thời gian ngắn.

### Scale

- **10 users/lớp:** kiến trúc hiện tại hoạt động được; bottleneck chủ yếu là request thừa phía Teacher.
- **100 users/lớp:** event row/WAL tăng theo reaction/comment/quiz; mỗi event có thể kích hoạt full snapshot/analytics. Burst submit Quiz là rủi ro lớn nhất.
- **500 users/lớp:** mỗi Quiz event làm Teacher fetch lại analytics tổng hợp có thể tạo query chồng nhau; `syncVersionRef` bỏ kết quả cũ ở UI nhưng không hủy query đã gửi tới database.
- **Nhiều lớp đồng thời:** polling tải tăng theo số Teacher dashboard, trong khi `session_reflections` không filter gây cross-room fan-out.

Recommendation:

- Dùng một coordinator/channel cho Teacher Dashboard và debounce/coalesce event trong khoảng ngắn.
- Chỉ fallback polling khi channel degraded; trạng thái connected không cần polling 3 giây.
- Quiz chỉ sync theo Quiz event, focus/online và một fallback thưa hơn.
- Thêm Room scope vào event dành cho Session Reflection hoặc subscribe một event table/broadcast có filter.

## 7. Next.js Rendering Audit

### Server vs Client

- Page data-heavy chủ yếu là Server Component — phù hợp.
- Client Component được dùng đúng cho realtime, forms, modal, editor, carousel và browser API.
- Không có Context Provider cấp cao ngoài `AnonymousAuthBootstrap`.

### Client boundary cấp root

`AnonymousAuthBootstrap` không biến Server Component children thành Client Component source, nhưng nó vẫn:

- bắt root public tree phải hydrate wrapper;
- đưa Supabase browser auth code vào public shell;
- không trả `children` cho đến khi `getSession`/anonymous sign-in hoàn tất;
- chạy lại effect theo `pathname`; state của pathname mới mặc định thành `loading`, có thể tạo flash khi navigation.

Đây là vấn đề FCP/LCP/perceived navigation đáng ưu tiên nhất ở frontend.

### Client Component lớn

- `management-forms.tsx` 322 dòng.
- `class-voices-viewer.tsx` 302 dòng.
- `session-reviews-viewer.tsx` 252 dòng.
- `student-lesson-player.tsx` 251 dòng.
- `lesson-plan-manager.tsx` 225 dòng.
- `student-quiz.tsx` 212 dòng.

Số dòng không tự động là lỗi. Phần lớn chỉ tải ở route cần tương tác. Tuy nhiên `LessonEditorForm`/create form import `MarkdownPreview`, kéo `react-markdown` vào editor client bundle; hợp lý cho live preview nhưng nên đo bundle trước khi thêm editor/library mới.

### Rerender

- Teacher Feedback mỗi snapshot update rerender toàn feedback card và filter arrays tại render (`teacher-live-feedback.tsx:29-34`). Dataset bị giới hạn comment 30 nên hiện tại chấp nhận được.
- Quiz Analytics thay toàn snapshot và rerender toàn bộ Quiz/Question/Option mỗi lần polling; đây là hotspot rõ hơn.
- Roster filter dùng `useMemo`, nhưng vẫn map/filter toàn bộ mảng và render toàn kết quả; ổn với 110, không tốt nếu tiến gần giới hạn 2.000.

### Suspense/loading

- Các route nặng await toàn bộ data trước khi render; không có component-level Suspense cho phần chậm như analytics/summary.
- Root/learn loading tồn tại nên navigation có fallback, nhưng boundary gần route sẽ cho skeleton sát ngữ cảnh và cho phép stream phần header trước.

### Web Vitals dự kiến

- TTFB: ảnh hưởng bởi Server query waterfall và region.
- FCP/LCP public: ảnh hưởng trực tiếp bởi AnonymousAuthBootstrap chặn children.
- INP: có thể ảnh hưởng khi Quiz/Voices/Roster render list lớn; hiện chưa có bằng chứng đo runtime.
- Hydration: tập trung ở editor/live/review, không lan toàn app ngoài auth wrapper.

## 8. Bundle Audit

Dependencies đáng chú ý:

- `@supabase/supabase-js` + `@supabase/ssr`: cần cho Auth/Realtime; hiện browser auth được kéo vào mọi public route do root bootstrap.
- `react-markdown`: cần khi render lesson và preview, xuất hiện trong Client Component live/editor.
- `unified`, `remark-parse`, `unist-util-visit`, `yaml`: parser; hiện parse qua server actions/server pages, không thấy import trực tiếp parser vào browser component.
- `exceljs`: package tương đối nặng nhưng chỉ được import ở route export/server module; không có evidence đi vào client bundle.
- Không có chart library, icon library lớn, animation framework, date library hay rich-text editor.

Không có fresh production bundle report trong repository. `.next/build-manifest.json` có timestamp 04/09/2026 nhưng không đủ để quy attribution theo route; không dùng nó để kết luận kích thước bundle. Nên chạy bundle analyzer trong một audit đo lường riêng, không thêm dependency vĩnh viễn nếu chỉ dùng một lần.

## 9. Cache Strategy

Project hiện không dùng `use cache`, React `cache()`, `unstable_cache`, `revalidateTag` hay client cache như SWR/React Query. Server Actions chỉ dùng `revalidatePath`. `next.config.ts` chưa bật Next 16 Cache Components.

| Data | Cache? | Suggested strategy | Reason |
|---|---|---|---|
| Subject public metadata | Có, dài | Cache theo tag Subject; revalidate khi Teacher CRUD | Ít đổi, nhiều Student cùng đọc |
| Course Section public metadata | Có, dài | Cache theo Subject/Course tag | Ít đổi; hiện bị fetch lại để tìm một row |
| Chapter metadata | Có, dài | Cache theo Course Section; invalidate khi thêm/đổi/xóa Chapter | Không phụ thuộc phiên Student |
| Lesson title/chapter/order | Có, trung bình–dài | Tách khỏi status rồi cache theo Course Section | Metadata ổn định nhưng status hiện đang trộn chung |
| Lesson Markdown đã lưu | Có điều kiện | Cache theo Lesson version/updated_at; invalidate khi edit | Nội dung không đổi trong session lịch sử |
| Public LIVE status/list | Cache rất ngắn hoặc không | Query riêng; event/revalidate khi Start/End | Phải phản ánh LIVE nhanh |
| Teacher Subject/Course management | Request memo + cache private ngắn nếu đo thấy cần | Memo auth trong request trước; chỉ cache private có invalidation rõ | Dữ liệu riêng, mutation thường xuyên hơn public metadata |
| Live Room/session progress | Không cache dài | Database + Realtime; fetch lại khi reconnect | Trạng thái điều khiển lớp phải mới |
| Attendance live | Không cache dài | Realtime event + fetch snapshot; fallback polling khi degraded | Joined count thay đổi liên tục |
| Reaction/Comment live | Không cache dài | Event trigger snapshot; debounce burst | Cần gần realtime |
| Quiz Analytics live | Không cache dài | Event-triggered, coalesce/debounce; tránh fixed polling | Nặng và thay đổi theo submit |
| ENDED Summary/Class Voices | Có sau khi ổn định | Cache immutable theo Room; invalidate ngắn hạn nếu Session Review còn nhận | Phần lớn dữ liệu không đổi sau End |
| Lesson image list | Cache ngắn theo Subject | Cache trong modal session hoặc revalidate sau upload | Hiện mỗi mở popup đều list Storage lại |

Lưu ý Next.js 16: repository chưa bật `cacheComponents`; không nên chép máy móc ví dụ `use cache` mà cần chọn model tương thích config hiện tại và không đọc cookies bên trong shared cache. Không cache kết quả RLS giữa user nếu key không bao gồm identity.

## 10. Page-by-page Performance Analysis

Số request dưới đây là operation nhìn thấy trong code, không bao gồm internal subquery bên trong RPC và asset request.

### 10.1 Home `/`

- Data cần: Teacher login state.
- Fetch hiện tại: server `getTeacherIdentity()` + proxy auth; browser lại bootstrap Anonymous Auth nếu không phải Teacher route.
- Điểm chậm: toàn UI bị giữ cho đến khi Anonymous Auth ready dù Home không cần quyền Student.
- Over-fetch: tạo/check Student session chỉ để xem landing page.
- Cache: phần nội dung Home có thể static; chỉ account button là dynamic/stream riêng.
- Realtime: không cần.
- Priority: **High**.

### 10.2 Public browse `/learn` → Subject → Course Section

- Data: Subjects; Course Sections; Chapters; Lesson metadata/status.
- Fetch: 1 RPC ở root; Subject page 2 RPC song song; Course Section page 3 RPC song song.
- Điểm chậm: Anonymous bootstrap; không cache metadata; Course Section list/status tính lại mỗi lần.
- N+1: status function theo từng Lesson ở database.
- Waterfall: không đáng kể trong page vì đã `Promise.all`.
- Cache: metadata có; status tách riêng và cache ngắn/không cache.
- Realtime: không cần trên catalog; refresh khi Student mở chapter là đủ cho MVP.
- Priority: **High**.

### 10.3 Chapter access `/learn/.../chapters/[chapterId]`

- Data: một Course Section, một Chapter, các Lesson trong Chapter, trạng thái.
- Fetch hiện tại: toàn Course Sections của Subject + toàn Chapters + toàn Lessons của Section, ba RPC song song.
- Data thừa: các Course Section/Chapter/Lesson không được render.
- Cache: metadata có; trạng thái ngắn.
- Priority: **Medium**.

### 10.4 Student Live `/student/rooms/[roomId]`

- Data: identity access, lesson labels, selected snapshot, own reactions, reflection nếu ended.
- Fetch: auth → ba request song song → snapshot → reaction → optional reflection.
- Điểm chậm: nhiều stage tuần tự; Quiz Section phát sinh thêm client RPC khi mount.
- Realtime: cần và được filter theo Room; reconnect fetch database đúng.
- Cache: không cache live snapshot; lesson labels có thể giữ client-side trong cùng session.
- Priority: **Medium**.

### 10.5 Teacher Subjects `/teacher/subjects`

- Data: Subject + count Course Section.
- Fetch: proxy auth + layout auth + query auth + một select có relation count.
- Điểm chậm: auth lặp; query data bản thân gọn.
- Cache: request memo auth; private metadata cache ngắn nếu cần.
- Priority: **Medium**.

### 10.6 Subject detail `/teacher/subjects/[subjectId]`

- Data: Subject, Course Sections, Chapters, template Lesson metadata.
- Fetch: Subject trước, sau đó ba query song song.
- Điểm chậm: hai stage và auth lặp; mọi template Lesson metadata được truyền vào Lesson Plan Manager dù popup chưa mở.
- Fetch quá sớm: Lesson Plan data được tải ngay cả khi modal đóng.
- Cache: Subject/Course metadata private ngắn; Lesson Plan có thể lazy fetch khi mở nếu dataset lớn.
- Priority: **Medium**.

### 10.7 Course Section Teacher `/teacher/subjects/.../sections/[courseSectionId]`

- Data: ownership context, roster, Chapters, Lessons, latest Session per Lesson.
- Fetch: Subject → Course Section → ba query song song → Rooms → Session placements.
- Số operation: khoảng 10 khi tính proxy/layout/auth.
- Data thừa: toàn roster luôn được serialize/hydrate; session history quét tất cả active/ended Room của Course Section để lấy latest mapping.
- Cache: không cache roster/live mapping; metadata có thể memo/cache private ngắn.
- Priority: **High**.

### 10.8 Teacher Live Dashboard `/teacher/rooms/[roomId]`

- Data: Room, attendance, Lesson list/progress, selected sections, Feedback, Quiz Analytics.
- Fetch: chuỗi nhiều stage; Feedback/Quiz chỉ bắt đầu sau Room context.
- Realtime: 3 channels, 3 polling loops; Quiz RPC nặng.
- N+1: trong Quiz Analytics SQL.
- Cache: không cache live; tối ưu round-trip, event coalescing và query shape.
- Priority: **Critical path / High**.

### 10.9 Summary `/teacher/rooms/[roomId]/summary`

- Data: room summary, attendance, reflections, labels, section placement, ownership navigation context.
- Fetch: bốn RPC song song → Sections → Room → Lesson → Course Section.
- Điểm chậm: RPC Summary tự gọi Quiz Analytics nặng; navigation context thêm ba query tuần tự.
- Data thừa: nhiều phần dưới fold tải cùng lúc.
- Cache: sau ENDED có thể cache theo Room, chú ý Session Review cuối buổi có thể đến sau End.
- Priority: **High**.

### 10.10 Class Voices / Reviews / History

- Data: toàn comments/reactions hoặc reflections/history của Session.
- Fetch: một RPC chính nhưng RPC Class Voices dùng correlated aggregate và không pagination.
- UI: viewer 252–302 dòng client, giữ toàn dataset để filter/presentation.
- Cache: dữ liệu ENDED phù hợp cache; paginate/chunk khi comments nhiều.
- Realtime: Reviews chỉ cần trong cửa sổ Teacher đang chờ Student gửi; filter hiện chưa theo Room.
- Priority: **Medium**.

## 11. Scalability Risks

### Scenario A — 5 môn, 10 lớp, 30 sinh viên/lớp

- Kiến trúc hiện tại đủ dùng.
- Tác động cảm nhận chủ yếu từ Auth bootstrap và region latency, không phải kích thước dữ liệu.
- Polling Teacher vẫn lãng phí nhưng chưa gây tải database lớn nếu chỉ một vài dashboard.

### Scenario B — 50 lớp, 1.000 sinh viên

- Public metadata không cache khiến mỗi browse lại vào Supabase.
- Room history query thiếu composite index bắt đầu phải scan/sort nhiều row hơn.
- Course Section page tải roster toàn bộ và Session mapping; RSC payload/DOM lớn nếu roster mỗi lớp tăng.
- `room_feedback_events` tích lũy theo toàn bộ lịch sử.
- Summary/Class Voices không pagination có thể trả JSON lớn.

### Scenario C — nhiều lớp LIVE, 50–100 sinh viên/lớp

- Mỗi Teacher dashboard polling Attendance + Feedback + Quiz khoảng 60 lần/phút dù không có event.
- Burst 100 Quiz submissions tạo 100 event; mỗi event có thể khởi động analytics mới. `syncVersionRef` chỉ bỏ response cũ, không giảm database work đã gửi.
- Quiz Analytics nested aggregate là bottleneck database lớn nhất.
- Reaction thay đổi nhiều lần tạo event row và Realtime WAL cho từng update.
- Session Reflection subscribe toàn bảng gây fan-out giữa lớp.
- Nếu Vercel Function region khác Supabase region, mọi Server query stage cộng thêm cross-region RTT. Region không xác định được từ repo.

## 12. Quick Wins

1. Memoize `getTeacherIdentity()` bằng React request cache để mọi `requireTeacher()` trong cùng render dùng chung kết quả.
2. Chỉ chạy polling 3 giây khi Realtime ở trạng thái degraded; khi subscribed chỉ sync theo event/focus/online.
3. Bỏ polling cố định cho Quiz Analytics; debounce/coalesce nhiều Quiz event trong một khoảng ngắn.
4. Không chặn Home/public catalog bằng Anonymous Auth; khởi tạo phiên tại access gate/live interaction cần nó.
5. Gộp Room/selected Lesson/context/Sections của Teacher Live vào một RPC/context query để giảm waterfall.
6. Trả `subjectId/courseSectionId` ngay từ Ended Review RPC, bỏ Gate Context round-trip sau review.
7. Tạo RPC lấy đúng Course Section/Chapter context thay vì tải toàn collection rồi `.find()`.
8. Tách Lesson metadata cacheable khỏi LIVE status động.
9. Thêm filter theo Room cho event Session Reflection hoặc dùng room-scoped event table.
10. Benchmark và thêm index Room history đúng filter/sort nếu `EXPLAIN` xác nhận.

## 13. Recommended Optimization Roadmap

### PHASE 1 — Immediate

- Đo baseline: Vercel TTFB, browser Network request count, Supabase query latency, Realtime connection count.
- Sửa Anonymous Auth blocking trên public shell.
- Request-memoize Teacher identity.
- Chuyển polling 3 giây thành degraded fallback và debounce event burst.

### PHASE 2 — Database & Fetching

- Tối ưu set-based cho Quiz Analytics trước.
- Hợp nhất Teacher Live context để giảm round-trip.
- Tách public metadata/status; thêm detail RPC đúng entity.
- Chạy `EXPLAIN (ANALYZE, BUFFERS)` trên Room history, Quiz Analytics, Class Voices, Summary và export bằng dữ liệu representative.
- Thêm index chỉ sau khi query plan xác nhận.

### PHASE 3 — Frontend / Rendering

- Thêm loading/Suspense boundary gần Teacher Live, Summary và History.
- Lazy load Lesson Plan data/modal nếu template dataset lớn.
- Pagination/windowing roster nếu giới hạn thực tế vượt vài trăm.
- Đo client route chunks; chỉ tách component khi bundle analyzer cho thấy lợi ích.

### PHASE 4 — Realtime & Scaling

- Một room-scoped dashboard sync coordinator.
- Coalesce event và chống concurrent in-flight query, không chỉ bỏ stale response.
- Room-scope Session Reflection subscription.
- Có retention/cleanup strategy cho `room_feedback_events` vì đây là notification log, không phải business history.

### PHASE 5 — Advanced Optimization

- Cache immutable ENDED snapshots nếu query vẫn nặng sau tối ưu SQL.
- Materialized/denormalized aggregate chỉ khi telemetry chứng minh aggregate trực tiếp không đạt SLO.
- Load test nhiều lớp LIVE đồng thời và thiết lập performance budget.

## 14. Top 10 việc nên làm trước

1. **Ngừng chặn public UI bởi Anonymous Auth; bootstrap đúng lúc cần Student identity.**  
   Impact: High · Effort: Medium

2. **Chỉ polling khi Realtime degraded, không polling 3 giây khi connected.**  
   Impact: High · Effort: Low

3. **Bỏ fixed polling Quiz Analytics và debounce/coalesce Quiz events.**  
   Impact: High · Effort: Medium

4. **Memoize Teacher Auth trong phạm vi một server request.**  
   Impact: High · Effort: Low

5. **Viết lại Quiz Analytics thành aggregate set-based.**  
   Impact: High · Effort: High

6. **Giảm waterfall của `getTeacherRoom()` bằng một context RPC/query.**  
   Impact: High · Effort: High

7. **Tách public Lesson metadata khỏi LIVE status và cache metadata.**  
   Impact: High · Effort: Medium

8. **Room-scope Session Reflection Realtime.**  
   Impact: Medium · Effort: Low–Medium

9. **Benchmark/thêm composite index cho Room history theo Course Section/Chapter.**  
   Impact: Medium · Effort: Low

10. **Giới hạn/paginate roster và Class Voices khi dataset vượt ngưỡng.**  
    Impact: Medium · Effort: Medium

## 15. Things NOT Worth Optimizing Yet

- **Không thay toàn bộ Server Component bằng client cache library.** Data live và RLS đang phù hợp với server/RPC; thêm React Query/SWR toàn app sẽ tăng bundle và complexity trước khi giải quyết round-trip/SQL thật sự.
- **Không thêm Redux/Context global để giảm rerender.** Không có evidence state propagation toàn app là bottleneck.
- **Không thay Tailwind hoặc CSS hiện tại.** CSS không phải nguồn chậm nổi bật trong code audit.
- **Không tối ưu `Intl.DateTimeFormat` nhỏ lẻ.** Chi phí không đáng kể so với network/database.
- **Không thay `react-markdown` trước khi đo bundle.** Nó là chức năng cốt lõi và được route-scope tương đối tốt.
- **Không loại `exceljs` chỉ vì package lớn.** Nó chạy server-side ở route export; chưa có evidence ảnh hưởng client hoặc đường tải chính.
- **Không chuyển mọi `<img>` sang `next/image` một cách máy móc.** Lesson images là URL động từ Markdown/Storage và lazy load; trước hết bổ sung kích thước/aspect ratio và đo CLS.
- **Không tạo report snapshot/materialized view ngay.** Với 50–100 sinh viên, tối ưu query set-based và event cadence nên làm trước.
- **Không thêm index cho mọi FK/status/created_at.** Index làm tăng write/WAL; chỉ thêm cho Room history/analytics sau `EXPLAIN` trên dữ liệu thật.
- **Không cache Live Room/Reaction/Attendance dài.** Tính đúng và độ tươi quan trọng hơn cache hit.
- **Không tối ưu screenshot/document assets.** Các file trong `screenshot/` và `document/` không được import vào runtime app.

## Kết luận kiểm tra phạm vi

Đã kiểm tra: frontend, Next.js rendering, data fetching, Supabase queries/RPC, migrations/schema, indexes, RLS patterns, Realtime, dependencies/bundle imports, images/fonts/assets, caching, routes/navigation, deployment config và ba scenario scale.

Thông tin còn cần ngoài repository:

- Vercel Function region, cold-start và production Web Vitals.
- Supabase project region, Database/Realtime metrics và slow query logs.
- `EXPLAIN (ANALYZE, BUFFERS)` với dữ liệu gần production.
- Browser Network trace của Home, Course Section, Teacher Live và Summary.
- Số Room/Session/Comment/Reaction/Quiz Attempt thực tế và tốc độ tăng `room_feedback_events`.
- `AGENTS.md` tham chiếu `PLANS.md` và thư mục `docs/`, nhưng các đường dẫn này không tồn tại trong repository tại thời điểm audit; báo cáo không thể dùng chúng làm nguồn bổ sung.
