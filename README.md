# MINCLASS

MINCLASS là ứng dụng hỗ trợ lớp học trực tiếp. Giảng viên quản lý môn học, lớp học phần, danh sách sinh viên và bài học; sinh viên theo dõi nội dung, phản hồi và làm quiz mà không cần tạo tài khoản.

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

1. Mở một môn học và chọn **Lesson Plan** để tạo, chỉnh sửa danh sách chương.
2. Các chương được sắp xếp theo tên và dùng để phân nhóm Lesson.
3. Chọn **Thêm lớp học phần**, nhập mã lớp và tên hiển thị.
4. Mở lớp học phần để quản lý roster và danh sách Lesson.

### Quản lý danh sách sinh viên

1. Chuẩn bị file `.txt`, mỗi dòng chứa một MSSV.
2. Upload file roster và kiểm tra phần preview.
3. Chỉ lưu khi danh sách không có MSSV sai định dạng hoặc bị trùng.
4. Sau khi lưu, trang lớp học phần hiển thị sĩ số và danh sách MSSV.

Việc cập nhật roster sau này không làm thay đổi dữ liệu điểm danh của các buổi học đã diễn ra.

### Tạo và chuẩn bị Lesson

1. Trong lớp học phần, chọn **Tạo Lesson** rồi chọn chương chứa Lesson.
2. Nhập tên và upload file bài học `.md`.
3. Kiểm tra nội dung trong phần preview rồi lưu.
4. Lesson mới tạo chưa LIVE và chưa cho sinh viên truy cập nội dung.

Nút **Cách viết file lesson** trên trang tạo Lesson mở hướng dẫn đầy đủ về định dạng file bài học.

### Dạy Lesson trực tiếp

1. Chọn **Start Lesson** để tạo Lesson Session LIVE.
2. Chia sẻ Session Code đang hiển thị cho sinh viên thuộc lớp học phần.
3. Dashboard hiển thị sĩ số, số sinh viên đã tham gia, section đang dạy, reaction, comment và tiến độ quiz.
4. Chọn **Done Section** để chuyển sang section tiếp theo. Sinh viên nhận nội dung mới qua realtime.
5. Chọn **Kết thúc buổi học** và xác nhận để đóng Session.

### Xem lại buổi học

Sau khi Session kết thúc, giảng viên có thể mở **Xem Lesson Review** để xem:

- Số sinh viên đã tham gia và danh sách vắng.
- Kết quả và thống kê quiz.
- Reaction theo từng section.
- Comment có tên hoặc ẩn danh.
- Class Voices ở chế độ danh sách hoặc trình chiếu.

Giảng viên có thể xóa một Session sau khi xác nhận. Attendance, participant, reaction, comment và dữ liệu quiz của Session đó sẽ bị xóa vĩnh viễn; Lesson gốc vẫn được giữ lại.

## Dành cho sinh viên

Sinh viên không cần email, mật khẩu hoặc tài khoản MINCLASS.

### Tham gia Lesson đang LIVE

1. Từ trang chủ, chọn **Khám phá bài học**.
2. Chọn môn học, lớp học phần và Lesson đang **LIVE**.
3. Nhập MSSV và Lesson Session Code do giảng viên cung cấp.
4. MSSV phải có trong roster của đúng lớp học phần.
5. Theo dõi section đang được giảng viên trình bày và các section đã mở trước đó.

Trong buổi học, sinh viên có thể:

- Chọn reaction **Hiểu**, **Chưa chắc** hoặc **Có câu hỏi**.
- Gửi nhiều comment và chọn hiện MSSV hoặc ẩn danh.
- Làm quiz sau khi section quiz được mở.
- Xem lại lựa chọn và kết quả sau khi nộp quiz.

Mỗi sinh viên chỉ được nộp một lần cho mỗi quiz trong Session.

### Xem lại Lesson đã kết thúc

1. Chọn Lesson có trạng thái **Đã kết thúc**.
2. Nhập MSSV; không cần Session Code.
3. MSSV thuộc roster được xem toàn bộ nội dung Lesson ở chế độ chỉ đọc.
4. Phần quiz hiển thị đáp án đúng và, nếu sinh viên đã làm bài, đáp án mà sinh viên đã chọn.

Ở chế độ xem lại, sinh viên không thể gửi reaction, comment, nộp lại quiz hoặc thay đổi dữ liệu tham gia.
