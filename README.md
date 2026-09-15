# MINCLASS

MINCLASS là ứng dụng hỗ trợ lớp học trực tiếp. Giảng viên quản lý môn học, Lesson Plan mẫu, lớp học phần, danh sách sinh viên và các buổi học theo chương; theo dõi dữ liệu tham gia và xuất báo cáo Excel. Sinh viên xem trước hoặc theo dõi nội dung đang LIVE, phản hồi, làm quiz và xem lại buổi học mà không cần tạo tài khoản.

## Chạy project

Cài dependencies:

```bash
pnpm install
```

Tạo `.env.local` từ `.env.example` và điền cấu hình Supabase:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Áp dụng các migration và chạy project:

```bash
pnpm exec supabase db push
pnpm dev
```

Truy cập [http://localhost:3000](http://localhost:3000).

Các lệnh kiểm tra và build:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm start
```

## Dành cho giảng viên

### Đăng nhập và quản lý môn học

1. Từ trang chủ, chọn **Đăng nhập**.
2. Đăng nhập bằng tài khoản giảng viên để vào trang quản lý.
3. Chọn **Thêm môn học** để tạo môn học mới.
4. Có thể chỉnh sửa hoặc xóa môn học đã tạo.

### Lesson Plan và lớp học phần

1. Mở một môn học và chọn **Lesson Plan** để tạo chương, upload Lesson mẫu, chỉnh sửa trực tiếp Markdown hoặc tải file `.md` hiện tại.
2. Các chương và Lesson được sắp xếp theo tên. Có thể thu gọn từng chương để quản lý nội dung gọn hơn.
3. Khi tạo lớp học phần, hệ thống sao chép độc lập toàn bộ Chapter và Lesson mẫu hiện có của môn học.
4. Khi thêm, sửa hoặc xóa nội dung mẫu sau đó, hệ thống hỏi có áp dụng thay đổi cho các lớp học phần cũ hay không; tùy chọn áp dụng được bật mặc định.
5. Lesson đã có lịch sử Session hoặc đã được chỉnh sửa riêng trong lớp học phần được giữ nguyên để bảo toàn dữ liệu.
6. Chọn **Thêm lớp học phần**, nhập mã lớp và tên hiển thị, sau đó mở lớp để quản lý roster, chương và Lesson riêng của lớp đó.

### Quản lý danh sách sinh viên

1. Chuẩn bị file `.txt`, mỗi dòng chứa một MSSV.
2. Upload file roster và kiểm tra phần preview.
3. Chỉ lưu khi danh sách không có MSSV sai định dạng hoặc bị trùng.
4. Sau khi lưu, trang lớp học phần hiển thị sĩ số và danh sách MSSV.

Việc cập nhật roster sau này không làm thay đổi dữ liệu điểm danh của các buổi học đã diễn ra.

### Xuất dữ liệu lớp học phần

Tại trang Course Section, chọn **Xuất dữ liệu** để tải file Excel tổng hợp theo danh sách MSSV trong roster hiện tại. File gồm:

- **MSSV**.
- **Tổng số lần phát biểu** mà sinh viên đã tự ghi nhận trong các Session thuộc lớp học phần.
- **Số buổi tham gia**, hiển thị theo dạng số Session chương đã tham gia trên tổng số Session chương của lớp học phần.

Mỗi lần giảng viên bắt đầu một chương sẽ tạo một buổi học để điểm danh, không phụ thuộc chương đó có bao nhiêu Lesson. Nếu một chương được tổ chức nhiều Session thì mỗi Session được tính là một buổi. Tổng số lần phát biểu được cộng từ tất cả Session thuộc lớp học phần.

File Excel có thông tin mã lớp, tên lớp, sĩ số, tổng số buổi học, bộ lọc cột và phần tiêu đề được cố định để dễ theo dõi.

### Tạo và chuẩn bị Lesson

1. Trong lớp học phần, mở chương cần sử dụng và chọn **+ Lesson**; hoặc tạo thêm chương riêng cho lớp học phần nếu cần.
2. Nhập tên và upload file bài học `.md`.
3. Chuyển đổi giữa **Edit mode** và **Preview mode** để chỉnh trực tiếp Markdown và xem kết quả đồng bộ tức thời. Có thể lưu bản cuối cùng ở cả hai chế độ.
4. Dùng **Thư viện ảnh Lesson** để upload ảnh, xem ảnh lớn và sao chép cú pháp Markdown chèn vào nội dung.
5. Nhúng video từ link HTTPS công khai vào Section Markdown bằng cú pháp `[video: Tên video](https://link-video)` trên một dòng riêng; không cần upload video lên MINCLASS. Hỗ trợ file video trực tiếp và link YouTube, Vimeo, Dailymotion, Google Drive, Loom. Với nguồn khác, nên dùng URL nhúng do dịch vụ cung cấp.
6. Lesson mới tạo chưa LIVE. Giảng viên có thể sửa, tải `.md` hoặc xóa Lesson tại trang Course Section.

Nút **Cách viết file lesson** trên trang tạo Lesson mở hướng dẫn đầy đủ về định dạng file bài học.
Video được hiển thị bằng khung 16:9 trong Preview, LIVE và trang ôn tập. Nếu dịch vụ chặn nhúng, yêu cầu đăng nhập hoặc không hỗ trợ phát trên trình duyệt, người xem có thể mở link video gốc; chất lượng phát phụ thuộc vào nguồn video và đường truyền.

### Dạy Lesson trực tiếp

1. Tại Chapter trong Course Section, chọn **Live** để bắt đầu một Session cho toàn bộ chương. Hệ thống chụp roster hiện tại làm dữ liệu điểm danh riêng cho buổi học.
2. Tất cả Lesson trong chương được đưa vào cùng Session; nhiều chương có thể được tổ chức thành các Session riêng.
3. Yêu cầu sinh viên mở **Các bài học đang live**, chọn đúng chương và nhập MSSV thuộc lớp học phần; sinh viên không cần Session Code.
4. Mở **Dashboard** để chuyển qua từng Lesson và theo dõi riêng section đang dạy, reaction, comment và tiến độ quiz của Lesson đó.
5. Chọn **Done Section** để release section hiện tại cho sinh viên. Giảng viên vẫn có thể chuyển Lesson để trình bày mà không release nhầm nội dung.
6. Có thể chọn **Done toàn bộ chương** để release phần còn lại hoặc chọn **Kết thúc buổi học**; cả hai thao tác đều có popup xác nhận.
7. Sau khi kết thúc, nội dung, điểm danh và phản hồi của Session được giữ lại ở chế độ lịch sử.

### Xem lại buổi học

Trong trang Course Section, chọn **Lịch sử** tại Chapter để xem các Session đã kết thúc. Trang Summary chia nội dung và kết quả theo từng Lesson trong chương:

- Số sinh viên đã tham gia và danh sách vắng.
- Kết quả và thống kê quiz.
- Reaction và comment theo từng section của từng Lesson.
- Kết quả quiz và tỷ lệ trả lời đúng theo từng Lesson.
- Nội dung toàn bộ chương có thể xem theo kiểu chuyển qua lại giữa các Lesson và section.
- Dữ liệu buổi học vẫn được lưu sau khi tải lại trang.

Trong mục **Tổng kết buổi học**:

- **Xem Reviews** hiển thị MSSV, số lần phát biểu do sinh viên tự ghi nhận và lời review cuối buổi. Giảng viên có thể xem dạng danh sách hoặc trình chiếu; review mới được cập nhật realtime.
- **Xem phản hồi** mở Class Voices, lọc comment theo từng Lesson và hỗ trợ chế độ trình chiếu theo Lesson.

Giảng viên có thể xóa một Session sau khi xác nhận. Attendance, participant, reaction, comment và dữ liệu quiz của Session đó sẽ bị xóa vĩnh viễn; Lesson gốc vẫn được giữ lại.

## Dành cho sinh viên

Sinh viên không cần email, mật khẩu hoặc tài khoản MINCLASS.

### Tham gia Lesson đang LIVE

1. Từ trang chủ, chọn **Các bài học đang live** để vào nhanh danh sách Session đang diễn ra; hoặc chọn **Khám phá bài học** để duyệt theo môn học và lớp học phần.
2. Chọn Chapter đang **LIVE** và nhập MSSV có trong roster của lớp học phần.
3. Chỉ cần nhập MSSV một lần để tham gia toàn bộ Lesson trong Chapter Session đó.
4. Chuyển qua các Lesson trong chương và theo dõi section giảng viên đã release. Section tiếp theo chỉ xuất hiện sau khi giảng viên bấm **Done Section**.

Sinh viên không cần tài khoản, mật khẩu hoặc Session Code. Số người tham gia và các thay đổi trong buổi học được đồng bộ realtime.

Trong buổi học, sinh viên có thể:

- Chọn reaction **Hiểu**, **Chưa chắc** hoặc **Có câu hỏi**.
- Gửi nhiều comment và chọn hiện MSSV hoặc ẩn danh.
- Làm quiz sau khi section quiz được mở.
- Xem lại lựa chọn và kết quả sau khi nộp quiz.

Mỗi sinh viên chỉ được nộp một lần cho mỗi quiz trong Session.

Với Chapter được giảng viên bật **Mở xem trước**, sinh viên thuộc roster có thể nhập MSSV để đọc trước nội dung ở chế độ chỉ đọc. Xem trước không tạo điểm danh, không cho reaction, comment hoặc làm quiz và được nhận biết bằng trạng thái **Bản xem trước**.

Khi giảng viên kết thúc Session, trang Lesson đang mở sẽ tự hiển thị phần **Tổng kết cá nhân**. Sinh viên có thể nhập số lần mình đã phát biểu và gửi một lời review ngắn. Mỗi sinh viên chỉ gửi được một lần; nội dung đã gửi không thể chỉnh sửa, được cập nhật ngay cho giảng viên và có thể xem lại sau khi rời buổi học.
Nếu sinh viên đã tham gia nhưng chưa gửi Tổng kết cá nhân, form sẽ tự hiện lại mỗi lần mở buổi học đã kết thúc hoặc trang ôn tập, kể cả sau khi đổi phiên Student và xác minh lại đúng MSSV. Sinh viên có thể đóng form trong lần xem hiện tại; MSSV chỉ có trong roster nhưng không tham gia sẽ không thấy form.

### Xem lại Lesson đã kết thúc

1. Chọn Chapter có trạng thái **Đã kết thúc**.
2. Nhập MSSV để xác minh quyền xem lại; không cần Session Code.
3. MSSV thuộc roster được chuyển qua toàn bộ Lesson và section đã học trong chương ở chế độ chỉ đọc.
4. Phần quiz hiển thị đáp án đúng và, nếu sinh viên đã làm bài, đáp án mà sinh viên đã chọn.
5. Nếu đã gửi Tổng kết cá nhân, sinh viên có thể xem lại số lần phát biểu và lời review của chính mình.

Ở chế độ xem lại, sinh viên không thể gửi reaction, comment, nộp lại quiz hoặc thay đổi dữ liệu tham gia.
