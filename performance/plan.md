# Kế hoạch cải thiện hiệu suất MINCLASS

## 1. Mục tiêu

Cải thiện tốc độ tải và độ phản hồi của toàn bộ MINCLASS mà không thay đổi luồng nghiệp vụ, quyền truy cập, RLS, cơ chế điểm danh, Realtime hoặc dữ liệu lịch sử hiện tại.

Các nguyên tắc bắt buộc:

- PostgreSQL tiếp tục là nguồn dữ liệu thật.
- Realtime chỉ dùng để thông báo thay đổi; sau reconnect phải tải lại dữ liệu từ database.
- Không bỏ kiểm tra authorization phía server.
- Không cache dữ liệu private giữa các Teacher.
- Không cache dài trạng thái LIVE, attendance, section release, reaction, comment hoặc quiz progress.
- Ưu tiên giảm truy vấn và dữ liệu dư thừa trước khi thay đổi kiến trúc lớn.
- Mỗi nhóm tối ưu phải được đo trước và sau khi triển khai.

## 2. Kết quả rà soát hiện tại

Các nguyên nhân chính có khả năng làm trang tải chậm:

1. Anonymous Auth đang chặn quá trình hiển thị của nhiều trang public.
2. Một request Teacher có thể xác thực lặp lại ở proxy, layout và feature query.
3. Dashboard LIVE có nhiều luồng polling chạy song song mỗi 3 giây bên cạnh Realtime.
4. Course Section thực hiện nhiều lượt truy vấn và luôn tải toàn bộ roster.
5. Trang Subject Detail tải toàn bộ Lesson Plan dù popup chưa mở.
6. Một số trang public tải toàn bộ collection rồi mới tìm đối tượng đang truy cập.
7. Quiz Analytics và Summary tính lại dữ liệu lớn khi có sự kiện mới.
8. Nhiều trang chờ tất cả dữ liệu hoàn tất thay vì hiển thị và stream từng phần.
9. Một số query lịch sử có thể chưa được hỗ trợ bởi index phù hợp.

## 3. Kế hoạch triển khai theo mức ưu tiên

### Giai đoạn 0 — Thiết lập số liệu gốc

Trước khi tối ưu, đo trên production build thay vì chỉ đánh giá bằng `pnpm dev`:

- TTFB và thời gian render của trang chủ.
- Trang danh sách Subject và Course Section.
- Trang xem trước Chapter.
- Trang Student LIVE.
- Teacher Live Dashboard.
- Session Summary và Lesson Review.
- Số request Supabase khi tải từng trang.
- Số request/phút khi Dashboard LIVE đang mở.
- Thời gian thực thi các RPC Summary và Quiz Analytics.

Công cụ đo đề xuất:

- Chrome DevTools Performance và Network.
- Next.js production build.
- Supabase Query Performance và slow-query logs.
- `EXPLAIN (ANALYZE, BUFFERS)` cho các query database nặng.

Không dùng bundle size thô để kết luận nếu chưa xác định chunk thuộc route nào.

### Giai đoạn 1 — Loại bỏ chờ Anonymous Auth không cần thiết

Hiện tại bootstrap Anonymous Auth có thể làm trang public chờ Supabase trước khi render.

Phương án:

- Cho trang chủ và catalog public hiển thị ngay.
- Khởi tạo Anonymous Auth dưới nền nếu cần.
- Chỉ bắt buộc anonymous session tại access gate, bước nhập MSSV, join LIVE hoặc thao tác Student cần identity.
- Giữ nguyên việc kiểm tra MSSV và quyền truy cập phía server.

Kỳ vọng:

- Trang chủ và trang khám phá hiển thị nhanh hơn.
- Giảm loading toàn màn hình khi chuyển route public.
- Không thay đổi luồng tham gia lớp của sinh viên.

Kiểm chứng:

- Student mới vẫn join được bằng MSSV.
- Tab ẩn danh vẫn khởi tạo đúng anonymous identity.
- Non-roster Student vẫn bị chặn.
- Refresh và chuyển trang không làm mất quyền truy cập hợp lệ.

### Giai đoạn 2 — Loại bỏ xác thực Teacher lặp trong cùng request

Một lượt tải Teacher route có thể kiểm tra authentication ở proxy, layout và feature query.

Phương án:

- Memoize Teacher identity trong phạm vi một server request.
- Mọi query/action vẫn phải gọi hàm authorization chung.
- Không dùng cache toàn cục hoặc cache dùng chung giữa người dùng.
- RLS tiếp tục là lớp bảo vệ cuối cùng.

Kỳ vọng:

- Giảm lượt gọi Supabase Auth trên Teacher pages.
- Không làm thay đổi authorization hiện tại.

Kiểm chứng:

- Teacher đã đăng nhập truy cập bình thường.
- Người chưa đăng nhập vẫn bị chuyển về login.
- Teacher A không đọc hoặc sửa dữ liệu Teacher B.
- Logout làm mất quyền truy cập ngay.

### Giai đoạn 3 — Tối ưu Realtime và polling của Dashboard LIVE

Teacher Dashboard hiện có nhiều component polling độc lập mỗi 3 giây, đồng thời vẫn lắng nghe Realtime.

Phương án:

- Dùng Realtime khi kết nối ổn định.
- Chỉ bật polling dự phòng khi Realtime bị gián đoạn.
- Đồng bộ lại khi tab được focus, trình duyệt online trở lại hoặc channel reconnect.
- Debounce các sự kiện đến liên tiếp.
- Chỉ cho phép một request đồng bộ đang chạy; nếu có sự kiện mới thì thực hiện thêm một lần sau khi request hiện tại hoàn tất.
- Không thay đổi nguyên tắc fetch lại database sau sự kiện.

Kỳ vọng:

- Giảm mạnh request nền trên mỗi Dashboard.
- Quiz, reaction, comment và attendance vẫn cập nhật gần Realtime.
- Tránh nhiều RPC analytics chạy đồng thời khi cả lớp submit quiz.

Kiểm chứng:

- Reaction và comment xuất hiện không cần reload.
- Attendance cập nhật khi Student join.
- Quiz analytics cập nhật sau submit.
- Ngắt mạng rồi kết nối lại vẫn đồng bộ đúng.
- Khi Realtime lỗi, polling dự phòng vẫn giữ dữ liệu cập nhật.

### Giai đoạn 4 — Tách query nhẹ cho Course Section và trang Lesson

Course Section hiện tải Subject, Course Section, Chapters, Lessons, roster, sessions và session mappings. Một số trang tạo/sửa Lesson cũng dùng query lớn này dù chỉ cần metadata.

Phương án:

- Tạo query nhẹ cho Subject, Course Section và danh sách Chapter.
- Trang tạo/sửa Lesson chỉ lấy context cần thiết.
- Tải roster khi phần quản lý danh sách sinh viên được mở hoặc khi thực sự cần.
- Phân trang hoặc virtualize danh sách roster nếu số lượng lớn.
- Lấy trực tiếp session mới nhất bằng database thay vì tải nhiều session rồi lọc trong ứng dụng.
- Giữ dữ liệu trạng thái Chapter/Session đủ mới, không cache dài.

Kỳ vọng:

- Course Section hiển thị phần đầu và danh sách Chapter nhanh hơn.
- Trang tạo/sửa Lesson giảm số lượt query và kích thước RSC payload.

Kiểm chứng:

- Chapter và Lesson vẫn đúng thứ tự.
- Trạng thái LIVE/Dashboard và lịch sử vẫn đúng.
- Roster hiển thị đầy đủ khi mở.
- Upload roster vẫn đồng bộ attendance cho session LIVE theo logic hiện tại.

### Giai đoạn 5 — Lazy-load Lesson Plan và dữ liệu phụ

Trang Subject Detail hiện có thể tải Chapters và Template Lessons ngay cả khi Lesson Plan chưa được mở.

Phương án:

- Chỉ tải Subject và danh sách Course Section ở lần render đầu.
- Tải Lesson Plan khi giảng viên mở popup.
- Sau thêm, sửa, xóa hoặc đồng bộ, chỉ refresh dữ liệu Lesson Plan liên quan.
- Thư viện ảnh chỉ tải khi mở và có thể giữ cache client trong phiên hiện tại; invalidate sau upload hoặc xóa ảnh.

Kỳ vọng:

- Subject Detail nhẹ hơn khi môn học có nhiều Chapter và Lesson mẫu.
- Giảm hydration và dữ liệu gửi xuống browser.

Kiểm chứng:

- Mở Lesson Plan lần đầu vẫn hiện đầy đủ dữ liệu.
- Các thao tác thêm, sửa, xóa và đồng bộ lớp học phần vẫn chính xác.
- Đóng và mở lại popup không hiển thị dữ liệu cũ sau mutation.

### Giai đoạn 6 — Giảm overfetch ở Public Catalog

Một số trang public tải toàn bộ Course Sections, Chapters và Lessons rồi mới chọn đối tượng theo URL.

Phương án:

- Dùng query/RPC theo đúng `subject_id`, `course_section_id` và `chapter_id` đang truy cập.
- Chỉ trả về metadata và Lesson thuộc Chapter cần hiển thị.
- Cache ngắn hạn dữ liệu ổn định như Subject, tên Course Section, tên Chapter và tiêu đề Lesson.
- Tách trạng thái LIVE/ENDED khỏi metadata được cache.

Kỳ vọng:

- Trang Course Section và Chapter của sinh viên có payload nhỏ hơn.
- Thời gian phản hồi ít tăng theo tổng số lớp và Lesson trong hệ thống.

Kiểm chứng:

- Student chỉ thấy dữ liệu public được phép.
- Trạng thái LIVE thay đổi đúng thời điểm.
- Preview vẫn yêu cầu MSSV thuộc roster.
- Không expose roster hoặc answer key khi LIVE.

### Giai đoạn 7 — Tối ưu Teacher LIVE và Student LIVE server queries

Teacher LIVE hiện có nhiều truy vấn phụ thuộc tuần tự để lấy Room, attendance, session lessons, lesson labels, selected Lesson và sections. Student LIVE cũng có nhiều bước lấy access, snapshot và trạng thái cá nhân.

Phương án:

- Gom phần context thường dùng thành một RPC hoặc query server chuyên biệt.
- Chỉ trả dữ liệu của Lesson đang chọn cho feedback và quiz analytics.
- Stream các khối phụ như analytics thay vì chặn nội dung Lesson chính.
- Không gom dữ liệu nếu làm RLS khó kiểm soát; ưu tiên query rõ ràng và an toàn.

Kỳ vọng:

- Teacher Dashboard và Student LIVE mở nhanh hơn.
- Chuyển Lesson trong cùng Chapter giảm lượng dữ liệu phải tải lại.

Kiểm chứng:

- Section release, reaction, comment và quiz vẫn gắn đúng Lesson và Session.
- Chuyển Lesson không hiển thị nhầm dữ liệu Lesson trước.
- Student ngoài attendance snapshot không truy cập được.

### Giai đoạn 8 — Tối ưu Summary, Review và Class Voices

Summary hiện gọi nhiều RPC và truy vấn tuần tự để lấy context điều hướng. Dữ liệu dưới màn hình đầu tiên cũng được tải trước khi trang hiển thị.

Phương án:

- Trả navigation context cùng dữ liệu Summary chính.
- Stream Attendance, Quiz, Comments, Reactions và Class Voices theo từng khối.
- Chỉ tải chi tiết Lesson khi phần tương ứng được mở.
- Phân trang Class Voices và danh sách comment khi dữ liệu lớn.
- Cache dữ liệu Session đã ENDED sau khi quá trình nhận review kết thúc; invalidate nếu có review mới.

Kỳ vọng:

- Header và nội dung tổng quan hiển thị sớm.
- Lịch sử dài không làm toàn bộ trang chậm theo số lượng dữ liệu.

Kiểm chứng:

- Dữ liệu lịch sử vẫn tồn tại sau refresh.
- Attendance, quiz, reaction và comment đúng theo từng Lesson.
- Phản hồi cuối buổi vẫn thuộc toàn Session theo logic hiện tại.
- Teacher A không xem được lịch sử Teacher B.

### Giai đoạn 9 — Tối ưu Quiz Analytics tại database

Quiz Analytics có thể tính lại toàn bộ Room khi chỉ cần Lesson đang chọn, đặc biệt nặng khi nhiều sinh viên submit gần nhau.

Phương án:

- Đo RPC bằng `EXPLAIN (ANALYZE, BUFFERS)` với dữ liệu lớp thực tế.
- Chuyển sang aggregate theo tập dữ liệu nếu đang dùng nhiều truy vấn con tương quan.
- Hỗ trợ lọc theo Lesson hoặc danh sách Section IDs.
- Không gửi answer key trước khi Student submit hoặc khi Session còn LIVE.

Kỳ vọng:

- Giảm thời gian cập nhật analytics trong lớp đông.
- Giảm tải database khi có burst submit.

Kiểm chứng:

- Submission count, average, correct rate và answer distribution không đổi.
- Student không submit hai lần nếu rule hiện tại cấm.
- Answer key không bị leak khi LIVE.

### Giai đoạn 10 — Kiểm tra và bổ sung database index

Chỉ thêm index sau khi có bằng chứng từ execution plan.

Các mẫu query cần kiểm tra:

- Session theo `course_section_id`, `status`, `started_at DESC`.
- Session history theo Chapter.
- Latest session của Lesson hoặc Chapter.
- Feedback events theo Room và Lesson.
- Quiz attempts/submissions theo Session, Lesson và Participant.

Yêu cầu:

- Tạo migration mới, không sửa migration đã apply.
- Đo tốc độ đọc trước và sau khi thêm index.
- Kiểm tra chi phí insert/update vì các bảng LIVE có tần suất ghi cao.

## 4. Cải thiện tốc độ cảm nhận

Các thay đổi sau không nhất thiết giảm thời gian database nhưng giúp người dùng thấy trang phản hồi sớm hơn:

- Thêm route-level loading cho Teacher LIVE, Summary, Course Section và Chapter Review.
- Dùng Suspense boundary cho Roster, Analytics, Reviews và Class Voices.
- Hiển thị header và metadata trước khi phần dữ liệu nặng hoàn tất.
- Không render toàn bộ nội dung của Chapter đang thu gọn nếu người dùng chưa mở.
- Cân nhắc tắt prefetch cho các link ít khả năng được mở trong danh sách rất dài.

## 5. Các khu vực chưa cần ưu tiên

- `exceljs` đang dùng phía server cho chức năng export, không phải nguyên nhân chính của bundle client.
- Ảnh runtime chính có dung lượng tương đối nhỏ; tối ưu ảnh không mang lại tác động lớn bằng giảm request Supabase.
- Không cần thêm Redux hoặc React Query chỉ để cải thiện tốc độ.
- Không nên tạo snapshot/report table nếu số liệu lịch sử vẫn có thể derive hiệu quả từ dữ liệu hiện tại.
- Không nên thay đổi toàn bộ kiến trúc hoặc viết lại live core.

## 6. Thứ tự ưu tiên tổng hợp

1. Đo production baseline.
2. Không chặn trang public bằng Anonymous Auth.
3. Memoize Teacher identity trong phạm vi request.
4. Chuyển polling Dashboard thành cơ chế dự phòng cho Realtime.
5. Debounce và coalesce các lần refresh do Realtime.
6. Dùng query nhẹ cho Course Section và trang tạo/sửa Lesson.
7. Lazy-load roster và Lesson Plan.
8. Giảm overfetch ở public catalog.
9. Stream Teacher LIVE, Summary và Review.
10. Tối ưu Quiz Analytics.
11. Đo query plan và bổ sung index phù hợp.

## 7. Tiêu chí hoàn thành

Kế hoạch tối ưu được xem là hoàn thành khi:

- Các trang chính có số liệu trước và sau để so sánh.
- Trang public không chờ Auth nếu chưa cần identity.
- Không có xác thực Teacher dư thừa trong cùng request.
- Dashboard không polling liên tục khi Realtime ổn định.
- Course Section không tải roster và Lesson Plan không cần thiết ở lần render đầu.
- Public catalog không tải toàn bộ collection chỉ để lấy một đối tượng.
- Summary và Analytics không chặn phần nội dung chính của trang.
- Không phát sinh lỗi RLS, IDOR hoặc leak dữ liệu giữa các lớp/Teacher.
- Student LIVE, preview, attendance, quiz, reaction, comment và review giữ nguyên hành vi hiện tại.
- `lint`, `typecheck`, unit tests, integration tests, E2E và production build đều thành công sau từng giai đoạn triển khai.

## 8. Rủi ro cần theo dõi

- Cache sai phạm vi có thể làm lộ dữ liệu giữa các Teacher.
- Cache trạng thái LIVE quá lâu có thể hiển thị trạng thái cũ.
- Loại bỏ polling hoàn toàn có thể gây mất cập nhật khi Realtime gián đoạn.
- Gom quá nhiều logic vào RPC có thể làm authorization khó kiểm tra.
- Lazy-load không có loading/error state phù hợp có thể khiến giao diện khó hiểu.
- Index bổ sung không phù hợp có thể làm chậm thao tác ghi trong buổi học.

Vì vậy, mỗi giai đoạn nên được triển khai độc lập, đo lại hiệu suất, chạy đầy đủ kiểm thử liên quan và review security trước khi chuyển sang giai đoạn tiếp theo.
