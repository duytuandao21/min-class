# MINCLASS — Hướng dẫn sử dụng

![MINCLASS](../picture/logo.png)

Tài liệu này dành cho người sử dụng MINCLASS. Sinh viên không cần tạo tài khoản và không cần Room Code.

## 1. Vai trò người dùng

### Giảng viên

Giảng viên chuẩn bị môn học, lớp học phần, roster và Lesson; bắt đầu buổi học, điều khiển Section và xem dữ liệu tổng kết.

### Sinh viên

Sinh viên browse bài học, nhập MSSV để tham gia Lesson LIVE hoặc xem lại Lesson đã kết thúc. Sinh viên không có email, mật khẩu hay tài khoản MINCLASS.

## 2. Đăng ký và đăng nhập

### Giảng viên

MINCLASS không có màn hình đăng ký. Tài khoản Teacher được người quản trị cấu hình trước trong Supabase.

1. Mở trang chủ MINCLASS.
2. Chọn **Đăng nhập** ở góc trên bên phải.
3. Nhập username `thaybao`.
4. Nhập mật khẩu Teacher do người quản trị cung cấp.
5. Chọn **Đăng nhập**.
6. Sau khi thành công, hệ thống chuyển đến `/teacher/subjects`.

Nếu đã đăng nhập, nút trên trang chủ hiển thị **Quản lý**. Tại trang quản trị, nút góc trên bên phải chỉ hiển thị **Đăng xuất**.

### Sinh viên

Sinh viên không đăng ký và không đăng nhập. MINCLASS tự tạo một anonymous session trong trình duyệt để bảo vệ dữ liệu của từng Student.

## 3. Hướng dẫn dành cho giảng viên

### 3.1. Tạo môn học

1. Mở trang **Danh sách môn học**.
2. Chọn **Thêm môn học**.
3. Nhập tên môn học và mã môn học nếu cần.
4. Lưu thông tin.

Mỗi thẻ môn học hiển thị tên, mã và số lớp học phần đã tạo. Có thể chỉnh sửa hoặc xóa môn học từ thẻ tương ứng.

### 3.2. Quản lý Lesson Plan

1. Mở chi tiết một môn học.
2. Chọn **Lesson Plan**.
3. Chọn **Thêm chương** để nhập tên Chapter, ví dụ `Chương 1: Giới thiệu`.
4. Mở menu `⋮` của Chapter để đổi tên hoặc xóa; chọn **+ Lesson** ngay trên Chapter để thêm bài.

Các Chapter/Lesson được sắp xếp tự nhiên theo tên. Khi tạo Course Section, hệ thống sao chép Lesson Plan thành dữ liệu độc lập của lớp. Nếu Lesson Plan thay đổi sau đó, hộp xác nhận cho phép áp dụng sang các lớp cũ (bật mặc định); Lesson đã có Session hoặc đã tùy chỉnh riêng được giữ nguyên. Nếu từng bỏ qua đồng bộ, giảng viên có thể mở lại Lesson Plan và áp dụng thay đổi về sau.

### 3.3. Tạo lớp học phần

1. Trong trang môn học, chọn **Thêm lớp học phần**.
2. Nhập mã lớp học phần.
3. Nhập tên hiển thị nếu cần.
4. Lưu thông tin.

Chọn vào mã trên thẻ lớp học phần để mở trang Course Section. Tại đây có thể chỉnh sửa, xóa, quản lý sinh viên, tạo Lesson và xuất dữ liệu.

### 3.4. Upload danh sách sinh viên

Chuẩn bị file `.txt`, mỗi dòng chứa một MSSV:

```text
23162011
23162012
23162013
```

Thao tác:

1. Mở khu vực **Quản lý danh sách sinh viên**.
2. Chọn file `.txt`.
3. Kiểm tra preview: số MSSV hợp lệ, dòng trùng và dòng không hợp lệ.
4. Chỉ chọn lưu khi danh sách không còn lỗi.
5. Dùng ô tìm kiếm để kiểm tra MSSV sau khi lưu.

MSSV được trim và chuẩn hóa thành chữ hoa. Dòng rỗng được bỏ qua. File tối đa 256 KB và danh sách tối đa 2.000 MSSV.

Việc cập nhật roster không thay đổi attendance của những Session đã diễn ra.

### 3.5. Tạo Lesson

1. Mở Chapter cần thêm bài và chọn **+ Lesson**; Chapter được xác định sẵn nên không cần chọn lại.
2. Chọn tối đa 20 file `.md`, sau đó chọn **Thêm vào danh sách**.
3. Dùng thanh Lesson để chuyển file; có thể đặt lại tên, xóa file hoặc chỉnh Markdown của từng bài.
4. Chuyển giữa **Edit mode** và **Preview mode** nếu cần kiểm tra trực quan. Không bắt buộc mở Preview mode trước khi lưu.
5. Chọn **Lưu** để tạo đồng loạt toàn bộ Lesson hợp lệ trong Chapter.

Nút **Cách viết file lesson** mở hướng dẫn cú pháp ngay trên trang tạo Lesson. Title được lấy từ frontmatter; tiền tố dạng `Chương x -`/`Chapter x -` được tự bỏ. **Thư viện ảnh Lesson** cho phép upload PNG/JPEG/WebP tối đa 5 MB, xem ảnh và sao chép cú pháp Markdown. Lesson mới lưu ở trạng thái chưa LIVE.

### 3.6. Bắt đầu Chapter LIVE

1. Tại thẻ Chapter, chọn **Live**.
2. Hệ thống tạo một Chapter Session gồm toàn bộ Lesson và snapshot roster hiện tại.
3. Nút **Live** đổi thành **Dashboard**; menu Chapter có **Lịch sử** sau khi đã có Session.
4. Yêu cầu sinh viên mở **Các bài học đang live**, chọn Chapter và nhập MSSV.

Một Course Section chỉ có một Chapter Session LIVE tại một thời điểm; các Course Section khác có thể LIVE đồng thời. MINCLASS không sử dụng Room Code hoặc Session Code.

### 3.7. Điều khiển buổi học

Dashboard cho phép chọn từng Lesson và hiển thị dữ liệu riêng của Lesson đó:

- Sĩ số của roster snapshot.
- Số sinh viên đã tham gia.
- Section đang trình bày.
- Reaction và comment mới.
- Tiến độ và kết quả Quiz.

Giảng viên dùng nút chuyển bài Previous/Next để trình bày Lesson khác mà không release nhầm nội dung. Chọn **Done Section** để release Section hiện tại; hoặc **Done toàn bộ chương** để release phần còn lại. Done toàn bộ chương và Kết thúc buổi học đều có popup xác nhận.

Không thể skip Section và không có Undo trong flow hiện tại.

### 3.8. Kết thúc buổi học

1. Chọn **Kết thúc buổi học**.
2. Đọc nội dung xác nhận.
3. Xác nhận kết thúc.

Sau khi kết thúc:

- Student chỉ được đọc nội dung đã mở.
- Không thể gửi reaction, comment hoặc Quiz mới.
- Student nhận popup **Tổng kết cá nhân** và có thể gửi một lần cho cả Chapter Session.
- Teacher được chuyển đến Summary.

### 3.9. Xem lịch sử và tổng kết

Mở Course Section → menu Chapter → **Lịch sử** để xem các Session của chương. Chọn Session để mở Summary.

Summary gồm attendance toàn buổi và phần nội dung/kết quả tách theo từng Lesson:

- Attendance snapshot, danh sách đã tham gia và danh sách vắng.
- Thống kê Quiz.
- Reaction theo Section.
- Comment có MSSV hoặc ẩn danh.
- Nội dung toàn bộ Chapter theo dạng chuyển Lesson và Section trái/phải.

Trong **Tổng kết buổi học**:

- **Xem Reviews**: xem số lần phát biểu và lời review cuối buổi; có chế độ trình chiếu.
- **Xem phản hồi**: mở Class Voices từ comment trong Session, lọc và trình chiếu theo Lesson.

### 3.10. Xuất dữ liệu Excel

Tại Course Section, chọn **Xuất dữ liệu**. File tải xuống gồm:

- MSSV trong roster hiện tại.
- Tổng số lần phát biểu.
- Số Chapter Session đã tham gia trên tổng số Chapter Session.

Mỗi lần giảng viên Start một Chapter được tính là một buổi học, bất kể Chapter có bao nhiêu Lesson. Nếu một Chapter được tổ chức nhiều Session thì mỗi Session là một buổi riêng.

### 3.11. Xóa dữ liệu

Subject, Course Section và Lesson Session đều yêu cầu xác nhận trước khi xóa.

Khi xóa Session, attendance, participant, reaction, comment, Quiz result và review của Session bị xóa vĩnh viễn; Lesson gốc vẫn được giữ lại.

## 4. Hướng dẫn dành cho sinh viên

### 4.1. Tìm Lesson

1. Mở trang chủ.
2. Chọn **Khám phá bài học**.
3. Chọn Subject.
4. Chọn Course Section.
5. Nhập MSSV một lần tại Course Section để xem danh sách Chapter; phiên xác minh được dùng lại khi chuyển giữa các chương.

Chapter có các trạng thái:

- **Sắp diễn ra**: chưa thể truy cập nội dung.
- **Xem trước**: nội dung chỉ đọc, không tính điểm danh và không cho tương tác.
- **LIVE**: có thể tham gia bằng MSSV.
- **Đã kết thúc**: có thể xem lại Session gần nhất.

### 4.2. Tham gia Chapter LIVE

1. Chọn **Các bài học đang live** ở trang chủ hoặc chọn Chapter có trạng thái **LIVE** trong Course Section.
2. Nhập MSSV có trong roster của Course Section.
3. Chọn tham gia.

Student không cần nhập Room Code. LIVE luôn xác minh MSSV riêng dù trước đó đã vào Course Section. Sau khi join, Student chỉ nhập một lần để truy cập toàn bộ Lesson trong Chapter Session. Nếu MSSV không thuộc lớp học phần, hệ thống từ chối truy cập.

Cùng một MSSV có thể tiếp tục học từ trình duyệt hoặc thiết bị khác. Hệ thống vẫn chỉ ghi nhận một lần điểm danh và dùng chung dữ liệu Participant của MSSV trong Session.

### 4.3. Theo dõi nội dung

- Màn hình hiển thị một Section tại một thời điểm.
- Dùng Previous/Next để chuyển giữa các Section đã mở.
- Không thể chuyển đến Section chưa được giảng viên mở.
- Khi giảng viên chuyển Section, nội dung mới được cập nhật gần realtime.
- Nếu mất kết nối realtime, ứng dụng sẽ đồng bộ lại trạng thái từ database.

### 4.4. Gửi reaction

Chọn một trong ba reaction:

- 👍 **Hiểu**.
- 🤔 **Chưa chắc**.
- ❓ **Có câu hỏi**.

Mỗi Student có một reaction trên mỗi Section và có thể đổi lựa chọn khi Session còn LIVE.

### 4.5. Gửi comment

1. Nhập comment từ 1–500 ký tự.
2. Chọn **Hiện MSSV** hoặc **Ẩn danh**.
3. Gửi comment.

Student có thể gửi nhiều comment. Comment ẩn danh chỉ hiển thị **Anonymous** cho giảng viên.

### 4.6. Làm Quiz

1. Mở Quiz Section khi giảng viên đã cho phép truy cập.
2. Chọn đáp án cho từng câu.
3. Chọn **Nộp bài**.
4. Xem điểm và phần xem lại đáp án.

Mỗi Quiz chỉ được nộp một lần. Đáp án đúng không được cung cấp trước khi nộp.

### 4.7. Gửi tổng kết cá nhân

Sau khi giảng viên kết thúc Session, **Tổng kết cá nhân** xuất hiện dưới dạng popup dễ nhận biết:

1. Nhập số lần phát biểu bằng số nguyên từ 0 đến 999.
2. Nhập lời review buổi học nếu muốn.
3. Chọn gửi.

Mỗi Student chỉ gửi một lần và không thể chỉnh sửa sau khi gửi.

### 4.8. Xem lại Lesson đã kết thúc

1. Mở Subject và nhập MSSV một lần khi vào Course Section.
2. Chọn Chapter **Đã kết thúc**; hệ thống dùng phiên đã xác minh để mở Session gần nhất.
3. Chuyển giữa các Lesson và xem toàn bộ nội dung, đáp án Quiz ở chế độ read-only.

Nếu đã làm Quiz, màn hình hiển thị đáp án đã chọn và đúng/sai. Nếu đã gửi tổng kết cá nhân, Student xem lại số lần phát biểu và review của chính mình.

## 5. Ảnh minh họa

### 5.1. Danh sách môn học

![Danh sách môn học của giảng viên](../screenshot/teacher-subjects.png)

*Giảng viên xem các môn học đã tạo, mã môn học, số lớp học phần và sử dụng nút **Thêm môn học** để tạo mới.*

### 5.2. Course Section và danh sách sinh viên

![Trang quản lý Course Section](../screenshot/course-section.png)

*Trang Course Section thể hiện quan hệ Chapter–Lesson, cho phép thêm Chapter/Lesson tại đúng vị trí, mở xem trước, bắt đầu Chapter LIVE, xem lịch sử, xuất Excel và quản lý roster.*

### 5.3. Teacher Live Dashboard

![Teacher Live Dashboard](../screenshot/teacher-live-dashboard.png)

*Khi Chapter đang LIVE, giảng viên chuyển giữa các Lesson, theo dõi dữ liệu riêng của bài đang chọn và dùng **Done Section** để release Section cho sinh viên.*

### 5.4. Sinh viên xem Lesson LIVE

![Sinh viên xem Lesson LIVE và gửi phản hồi](../screenshot/student-live-lesson.png)

*Sinh viên chuyển giữa các Lesson trong Chapter Session, đọc Section đã release, chọn reaction và gửi comment có MSSV hoặc ẩn danh.*

### 5.5. Session Reviews cuối buổi học

![Danh sách Session Reviews](../screenshot/lesson-review.png)

*Giảng viên xem MSSV, số lần phát biểu và lời review mà sinh viên đã gửi sau khi Session kết thúc; dữ liệu này cũng có thể được trình chiếu.*

### 5.6. Class Voices Presentation Mode

![Class Voices Presentation Mode](../screenshot/class-voices.png)

*Class Voices lọc phản hồi theo Lesson và trình bày từng comment, hỗ trợ Previous, Next và Exit khi tổng kết buổi học.*

## 6. Các lỗi thường gặp

### “Không thể khởi tạo phiên”

Nguyên nhân thường gặp:

- Supabase URL hoặc publishable key chưa đúng.
- Anonymous sign-ins chưa được bật trong Supabase Auth.
- Mạng không kết nối được tới Supabase.

Hãy tải lại trang sau khi người quản trị kiểm tra cấu hình.

### “Tên đăng nhập hoặc mật khẩu không đúng”

- Username Teacher phải là `thaybao`.
- Kiểm tra mật khẩu được quản trị viên cung cấp.
- Kiểm tra permanent user `thaybao@minclass.local` trong Supabase Auth.

### “Không thể tải dữ liệu môn học”

- Kiểm tra kết nối Supabase.
- Đảm bảo migrations đã được áp dụng đầy đủ.
- Đăng xuất rồi đăng nhập lại nếu phiên Teacher hết hạn.

### “Bạn không thuộc lớp học phần này”

MSSV không có trong attendance snapshot của Session LIVE hoặc roster dùng để xem lại Lesson. Kiểm tra đúng Course Section và MSSV đã được chuẩn hóa.

### Không tự mở được Chapter sau khi đã xác minh MSSV

Phiên xác minh Course Section được lưu bằng cookie phiên. Hãy quay lại Course Section, kiểm tra badge MSSV ở góc phải hoặc chọn **Đổi** để xác minh lại. Chapter LIVE vẫn luôn yêu cầu nhập MSSV riêng.

### Không thấy reaction, comment, participant hoặc Quiz cập nhật

- Kiểm tra kết nối mạng của Teacher và Student.
- Chờ hệ thống reconnect và fetch lại snapshot.
- Nếu vẫn không cập nhật, tải lại Dashboard và kiểm tra Supabase Realtime publication.

### Không thể nộp lại Quiz hoặc tổng kết cá nhân

Đây là quy tắc của hệ thống: mỗi Quiz attempt và mỗi Session Reflection chỉ được gửi một lần.
