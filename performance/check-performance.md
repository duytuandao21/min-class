Bạn đang đóng vai trò Senior Performance Engineer / Senior Next.js Engineer.

Tôi muốn bạn thực hiện một cuộc AUDIT HIỆU SUẤT TOÀN BỘ PROJECT hiện tại.

Tech stack chính của project:
- Next.js
- TypeScript
- Supabase
- PostgreSQL
- Supabase Auth
- Có thể có Supabase Realtime
- Deploy trên Vercel
- Project là một ứng dụng web phục vụ lớp học, có các chức năng như:
  - Subject / Course
  - Course Section
  - Chapter
  - Lesson
  - Live Session
  - Quiz
  - Comment / Reaction
  - Attendance
  - History / Report

MỤC TIÊU:
Tìm tất cả những điểm trong kiến trúc, frontend, backend, database và cách fetching dữ liệu có thể khiến website:
- Load lần đầu chậm
- Chuyển trang chậm
- Fetch dữ liệu chậm
- Có quá nhiều request
- Có request thừa
- Render lại không cần thiết
- Bundle JavaScript quá lớn
- Query Supabase chưa tối ưu
- Server-side request bị latency cao
- Realtime gây tốn tài nguyên
- UI phải chờ dữ liệu quá lâu
- Hiệu suất giảm khi số lượng user / lesson / comment / quiz tăng lên

QUAN TRỌNG — CHỈ AUDIT, KHÔNG ĐƯỢC THAY ĐỔI PROJECT:

1. KHÔNG chỉnh sửa bất kỳ file nào.
2. KHÔNG tạo file mới.
3. KHÔNG xóa file.
4. KHÔNG chạy migration làm thay đổi database.
5. KHÔNG refactor code.
6. KHÔNG commit.
7. KHÔNG tạo patch.
8. KHÔNG tự động fix lỗi.
9. KHÔNG thay đổi package.
10. KHÔNG viết implementation code để thay thế code hiện tại.

Bạn chỉ được:
- Đọc source code.
- Phân tích kiến trúc.
- Theo dõi dependency giữa các module.
- Phân tích query.
- Phân tích cách fetch dữ liệu.
- Phân tích rendering.
- Phân tích configuration.
- Đưa ra nhận xét và đề xuất.

Hãy coi repository hiện tại là READ-ONLY.

==================================================
PHASE 1 — HIỂU KIẾN TRÚC PROJECT
==================================================

Trước tiên hãy đọc toàn bộ cấu trúc project và xác định:

- Framework và version Next.js.
- App Router hay Pages Router.
- React version.
- Các package quan trọng.
- Cách tổ chức:
  - app/
  - pages/
  - components/
  - lib/
  - services/
  - hooks/
  - utils/
  - Supabase client/server
  - API routes
  - Server Actions
  - middleware
  - database migrations
- Các page/route chính.
- Luồng dữ liệu chính của ứng dụng.
- Component nào là Server Component.
- Component nào là Client Component.
- Auth được xử lý ở đâu.
- Supabase client được khởi tạo như thế nào.
- Các khu vực sử dụng Realtime.
- Cách project deploy lên Vercel.
- Có vercel.json / next.config / middleware hay config đặc biệt nào không.

Sau đó mô tả ngắn kiến trúc hiện tại.

KHÔNG đánh giá vội trước khi hiểu luồng project.

==================================================
PHASE 2 — AUDIT DATA FETCHING
==================================================

Kiểm tra TOÀN BỘ nơi project lấy dữ liệu.

Tìm:

- supabase.from(...)
- select(...)
- insert/update/delete
- rpc(...)
- fetch(...)
- Server Actions
- API Routes
- useEffect fetch
- React Query / SWR nếu có
- Promise.all
- Các helper/service thực hiện query.

Đặc biệt kiểm tra:

1. N+1 QUERY

Ví dụ kiểu:

Course
→ lấy Chapter
→ loop từng Chapter lấy Lesson
→ loop Lesson lấy thông tin khác

Hãy tìm tất cả trường hợp tương tự.

2. REQUEST WATERFALL

Ví dụ:

request A
↓ chờ xong
request B
↓ chờ xong
request C

Trong khi có thể thực hiện song song hoặc lấy chung.

3. REQUEST TRÙNG LẶP

Kiểm tra xem:
- Parent component fetch
- Child component lại fetch cùng dữ liệu
- Header fetch
- Page fetch
- Hook fetch

có đang gọi cùng resource nhiều lần không.

4. FETCH QUÁ NHIỀU DATA

Tìm các trường hợp:

select("*")

hoặc query lấy:
- content Markdown
- description dài
- quiz
- comment
- relation

trong khi UI chỉ cần:
- id
- title
- count
- status

5. FETCH DATA QUÁ SỚM

Ví dụ:
- Fetch nội dung Lesson dù user chưa mở Lesson.
- Fetch lịch sử dù user chưa mở History.
- Fetch toàn bộ quiz dù chưa mở quiz.
- Fetch comments của tất cả session.

6. CLIENT-SIDE FETCHING KHÔNG CẦN THIẾT

Xác định những query hiện đang chạy từ Client Component nhưng có thể gây:
- màn hình trắng
- spinner lâu
- waterfall
- duplicate request
- bundle lớn.

7. SERVER-SIDE FETCHING

Kiểm tra:
- Server Component
- Route Handler
- Server Action

có gọi database nhiều lần trong một request hay không.

==================================================
PHASE 3 — AUDIT SUPABASE / DATABASE
==================================================

Đọc schema/migrations hiện có.

Phân tích các bảng chính và relationship.

Kiểm tra:

- Primary key
- Foreign key
- Index
- Unique index
- Composite index
- Constraint
- RLS policies

Tìm các query thường xuyên sử dụng:

WHERE
JOIN
ORDER BY
GROUP BY
COUNT
IN

và đánh giá xem các cột tương ứng có index phù hợp hay không.

Đặc biệt chú ý các relationship kiểu:

Subject
→ Course Section
→ Chapter
→ Lesson
→ Session

và:

Session
→ Student
→ Attendance

Session
→ Comment

Session
→ Reaction

Session
→ Quiz
→ Quiz Answer

Đánh giá khả năng cần index cho các cột dạng:

- subject_id
- course_section_id
- chapter_id
- lesson_id
- session_id
- student_id
- user_id
- created_at
- order_index
- status

KHÔNG tạo index.

Chỉ xác định:
- Index hiện có.
- Index có thể thiếu.
- Query nào sẽ hưởng lợi.
- Vì sao.

Ngoài ra kiểm tra:

- Có query COUNT(*) thường xuyên không.
- Có load toàn bộ rows chỉ để đếm không.
- Có pagination không.
- Có nguy cơ table scan không.
- Có query relation quá sâu không.
- Có query lấy dataset tăng không giới hạn không.
- RLS policy có khả năng làm query phức tạp không.

==================================================
PHASE 4 — AUDIT SUPABASE REALTIME
==================================================

Tìm tất cả code liên quan đến:

- channel(...)
- postgres_changes
- subscribe()
- removeChannel()
- unsubscribe

Kiểm tra:

- Subscribe được tạo khi nào.
- Có unsubscribe đúng khi component unmount không.
- Có duplicate subscription không.
- Một user có thể tạo bao nhiêu subscription.
- Subscription có filter theo session/class/lesson không.
- Có đang subscribe toàn table không.
- Có subscribe realtime ở những màn hình không thật sự cần realtime không.

Phân loại data:

NÊN realtime.

và:

KHÔNG cần realtime.

Đánh giá khả năng scale khi:
- 10 users
- 100 users
- 500 users
- nhiều lớp chạy đồng thời.

==================================================
PHASE 5 — AUDIT NEXT.JS RENDERING
==================================================

Phân tích:

- Server Components
- Client Components
- "use client"
- Layout
- Nested layouts
- Suspense
- loading.tsx
- dynamic routes
- error boundaries

Tìm:

1. Client Component quá lớn.

2. Component có "use client" nhưng thực tế không cần.

3. "use client" ở component cấp cao làm nhiều component con bị đưa sang client bundle.

4. Props lớn truyền từ Server → Client.

5. Hydration quá nhiều.

6. Component rerender không cần thiết.

7. Context Provider đặt quá cao.

8. useEffect gây request hoặc rerender liên tục.

9. State được đặt ở phạm vi lớn hơn cần thiết.

10. Các component nặng được load ngay từ đầu.

Đánh giá những phần có thể ảnh hưởng đến:
- TTFB
- FCP
- LCP
- INP
- Hydration
- Navigation speed.

==================================================
PHASE 6 — AUDIT JAVASCRIPT BUNDLE
==================================================

Kiểm tra package.json và imports.

Tìm các dependency có khả năng nặng như:

- Markdown editor
- Code editor
- syntax highlighting
- charts
- animation
- icons
- date libraries
- rich text editor
- UI libraries

Kiểm tra:

- Có import toàn bộ library khi chỉ dùng một phần không.
- Có package bị duplicate chức năng không.
- Component nặng có được load trên page không cần nó không.
- Editor có load ngay cả khi chỉ xem danh sách Lesson không.
- Chart có load trước khi user xem report không.

Không thay dependency.

Chỉ đưa ra nhận xét.

==================================================
PHASE 7 — AUDIT IMAGE / FONT / STATIC ASSETS
==================================================

Kiểm tra:

- next/image
- thẻ img
- ảnh kích thước lớn
- ảnh chưa optimize
- SVG
- icon
- font

Đánh giá:

- Có font blocking render không.
- Có tải quá nhiều font weight không.
- Có ảnh load dù chưa xuất hiện trong viewport không.
- Có asset lớn bất thường không.

==================================================
PHASE 8 — AUDIT CACHING
==================================================

Kiểm tra hiện tại project đang sử dụng hay không:

- Next.js cache
- revalidate
- cache()
- unstable_cache hoặc API caching tương ứng với version Next.js đang dùng
- router cache
- browser cache
- React Query / SWR cache

Phân loại dữ liệu của project thành:

A. DATA CÓ THỂ CACHE DÀI

Ví dụ:
- Subject metadata
- Chapter
- Lesson metadata

B. DATA CACHE NGẮN

C. DATA KHÔNG NÊN CACHE

Ví dụ:
- Live Session state
- Comment realtime
- Reaction realtime
- Attendance realtime

Đề xuất chiến lược cache phù hợp.

Không implement.

==================================================
PHASE 9 — AUDIT NAVIGATION
==================================================

Kiểm tra luồng điều hướng:

Dashboard
→ Subject
→ Course Section
→ Chapter
→ Lesson
→ Live Session

Phân tích:

- Mỗi lần chuyển route fetch lại bao nhiêu dữ liệu.
- Có fetch lại data đã có không.
- Có thể reuse layout/data không.
- Có prefetch không.
- Navigation nào đang blocking.
- Có loading state hợp lý không.

==================================================
PHASE 10 — AUDIT VERCEL / SUPABASE LATENCY
==================================================

Kiểm tra các config trong repository có liên quan đến deployment.

Xác định:

- Vercel function region có được cấu hình không.
- Supabase region có thể xác định từ project/config hay không.
- Request Supabase được thực hiện:
    Browser → Supabase

hay:

    Browser → Vercel → Supabase

Đánh giá khả năng latency nếu:

User ở Việt Nam
Supabase ở Singapore
Vercel Function ở Mỹ.

Nếu không thể xác định region từ repository:
KHÔNG được đoán.

Hãy ghi rõ:

"Cần kiểm tra trên Vercel Dashboard"

hoặc:

"Cần kiểm tra trên Supabase Dashboard".

==================================================
PHASE 11 — AUDIT PAGE CỤ THỂ
==================================================

Xác định 5–10 page/flow quan trọng nhất của ứng dụng.

Ví dụ:

- Login
- Dashboard
- Subject
- Course Section
- Lesson list
- Lesson detail
- Start Live Session
- Student join
- Live classroom
- Session history/report

Với từng page hãy mô tả:

Page X

Data cần thiết:
- ...

Hiện tại đang fetch:
- ...

Số query/request có thể xảy ra:
- ...

Điểm có khả năng chậm:
- ...

Data đang lấy thừa:
- ...

Có waterfall không:
- ...

Có N+1 không:
- ...

Có thể cache không:
- ...

Realtime cần thiết không:
- ...

Mức độ ưu tiên tối ưu:
- Critical / High / Medium / Low

==================================================
PHASE 12 — SCALE ANALYSIS
==================================================

Không chỉ đánh giá performance ở dữ liệu hiện tại.

Hãy xem xét khi project tăng lên:

Scenario A:
- 5 môn
- 10 lớp
- 30 sinh viên/lớp

Scenario B:
- 50 lớp
- 1000 sinh viên

Scenario C:
- Nhiều lớp Live đồng thời
- Mỗi lớp 50–100 sinh viên
- Comment + Reaction + Quiz diễn ra liên tục

Chỉ ra những kiến trúc hiện tại có khả năng trở thành bottleneck.

==================================================
PHASE 13 — TÌM "QUICK WINS"
==================================================

Tìm những vấn đề:

- Dễ sửa về sau
- Ít ảnh hưởng kiến trúc
- Nhưng tăng hiệu suất rõ rệt

Ví dụ:

- bỏ query thừa
- giảm select
- thêm index
- lazy load
- bỏ duplicate request
- cache metadata
- tránh fetch content không cần thiết
- fix duplicate realtime subscription

Nhưng chỉ ĐỀ XUẤT.

KHÔNG thực hiện.

==================================================
YÊU CẦU BẰNG CHỨNG
==================================================

Mỗi nhận xét phải dựa trên CODE THỰC TẾ trong repository.

Không đưa ra nhận xét chung chung kiểu:

"Bạn nên dùng caching."

Thay vào đó phải chỉ rõ:

- File nào.
- Component/function nào.
- Query nào.
- Pattern nào đang xảy ra.
- Vì sao nó ảnh hưởng hiệu suất.
- Khi nào vấn đề xuất hiện.
- Độ nghiêm trọng.

Nếu có thể hãy ghi:

File:
<path>

Function / Component:
<name>

Vấn đề:
<description>

Evidence:
<đoạn logic hoặc hành vi tìm thấy, không cần copy code dài>

Impact:
<ảnh hưởng>

Recommendation:
<đề xuất>

Không cần viết code sửa.

==================================================
OUTPUT CUỐI CÙNG
==================================================

Sau khi kiểm tra TOÀN BỘ repository, hãy tạo báo cáo theo cấu trúc sau.

# 1. Executive Summary

Đánh giá tổng thể hiệu suất project:

- Tốt / Khá / Trung bình / Kém
- Các bottleneck lớn nhất.
- Khu vực cần ưu tiên.

# 2. Architecture Overview

Mô tả ngắn:
- Frontend
- Backend
- Supabase
- Rendering
- Data fetching
- Realtime
- Deployment

# 3. Top Performance Problems

Lập bảng:

| Priority | Problem | Location | Impact | Difficulty |
|----------|---------|----------|--------|------------|

Priority sử dụng:

P0 = Critical
P1 = High
P2 = Medium
P3 = Low

Sắp xếp vấn đề quan trọng nhất lên đầu.

# 4. Data Fetching Audit

Liệt kê:
- N+1
- Waterfall
- Duplicate requests
- Over-fetching
- Unnecessary client fetch
- Sequential request

# 5. Supabase / Database Audit

Liệt kê:
- Query đáng chú ý
- Index hiện có
- Index có thể thiếu
- Query có nguy cơ full scan
- Pagination
- Relation query
- RLS impact

# 6. Realtime Audit

Phân tích:
- subscription
- cleanup
- duplication
- scope/filter
- khả năng scale

# 7. Next.js Rendering Audit

Phân tích:
- Server vs Client Component
- Hydration
- "use client"
- rerender
- Suspense
- loading state

# 8. Bundle Audit

Liệt kê package/component có khả năng ảnh hưởng bundle.

# 9. Cache Strategy

Đưa ra ma trận:

| Data | Cache? | Suggested strategy | Reason |
|------|--------|--------------------|--------|

# 10. Page-by-page Performance Analysis

Phân tích từng page/flow quan trọng.

# 11. Scalability Risks

Chỉ ra vấn đề khi số user/data tăng lên.

# 12. Quick Wins

Top những thay đổi có:
- Effort thấp
- Impact cao

# 13. Recommended Optimization Roadmap

Chia thành:

PHASE 1 — Immediate
Những vấn đề cần ưu tiên nhất.

PHASE 2 — Database & Fetching

PHASE 3 — Frontend / Rendering

PHASE 4 — Realtime & Scaling

PHASE 5 — Advanced Optimization

# 14. Top 10 việc nên làm trước

Đưa ra danh sách chính xác theo thứ tự:

1.
2.
3.
...
10.

Mỗi mục cần ghi:

Impact: High / Medium / Low
Effort: High / Medium / Low

# 15. Things NOT Worth Optimizing Yet

Đây là phần quan trọng.

Chỉ ra những thứ hiện tại KHÔNG đáng tốn thời gian tối ưu vì:
- impact thấp
- premature optimization
- không phải bottleneck thực tế

==================================================
NGUYÊN TẮC PHÂN TÍCH
==================================================

Không được mặc định rằng một kỹ thuật nào đó là tốt.

Ví dụ:

Không được nói:
"Server Component luôn nhanh hơn."

Mà phải phân tích dựa trên cách project hiện tại sử dụng nó.

Không được nói:
"Thêm index sẽ nhanh hơn."

Mà phải xác định query cụ thể nào cần index.

Không được nói:
"Dùng cache."

Mà phải chỉ ra data nào có thể cache và data nào không thể cache.

Không được nói:
"Dùng Promise.all."

Mà phải chỉ ra request nào đang chạy sequential nhưng độc lập với nhau.

Không được tối ưu theo lý thuyết.

Chỉ đề xuất khi có evidence từ codebase.

==================================================
ĐẶC BIỆT CHÚ Ý
==================================================

Hãy tìm kỹ các pattern sau trong TOÀN BỘ repository:

- select("*")
- useEffect()
- "use client"
- supabase.from
- .select(
- .eq(
- .order(
- .single()
- .maybeSingle()
- Promise.all
- await
- fetch(
- router.refresh()
- router.push()
- revalidatePath
- revalidateTag
- dynamic(
- channel(
- subscribe(
- postgres_changes
- COUNT
- loops chứa database query
- map(async ...)
- for (...) await
- repeated createClient()
- nested Supabase relation queries

Tuy nhiên đừng kết luận pattern đó là lỗi chỉ vì tìm thấy nó.

Phải đọc context và xác định nó có thực sự ảnh hưởng performance hay không.

==================================================
CUỐI CÙNG
==================================================

Đây là PERFORMANCE AUDIT, không phải refactor task.

KHÔNG sửa code.

KHÔNG tạo code.

KHÔNG tạo migration.

KHÔNG tạo patch.

KHÔNG commit.

KHÔNG thay đổi bất kỳ file nào.

Sau khi audit xong chỉ trả về BÁO CÁO PHÂN TÍCH + ĐỀ XUẤT.

Trước khi kết thúc, hãy tự kiểm tra lại rằng bạn đã xem:
- frontend
- Next.js rendering
- data fetching
- Supabase queries
- database migrations/schema
- indexes
- RLS
- realtime
- bundle/dependencies
- assets
- caching
- routing/navigation
- Vercel config
- scalability

Nếu một phần không thể đánh giá do thiếu thông tin ngoài repository, hãy ghi rõ thông tin nào cần được kiểm tra thêm thay vì tự suy đoán.
