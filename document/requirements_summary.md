# Tóm tắt yêu cầu ứng dụng

## 1. Ý tưởng

**MINCLASS** là nền tảng hỗ trợ giảng dạy trực tiếp theo từng phần nội dung, không phải hệ thống LMS.

Giảng viên quản lý môn học, lớp học phần, danh sách sinh viên và Lesson Plan. Mỗi Lesson được chuẩn bị bằng file Markdown, chia thành các Section nội dung hoặc Quiz. Khi bắt đầu buổi học, giảng viên điều khiển tiến trình Lesson; sinh viên theo dõi Section hiện tại trên thiết bị cá nhân, gửi reaction, comment và làm Quiz.

Sau buổi học, hệ thống lưu attendance, phản hồi, kết quả Quiz và tổng kết cá nhân để giảng viên xem lại hoặc xuất dữ liệu lớp học phần.

Sinh viên không cần tạo tài khoản và chỉ dùng MSSV thuộc danh sách lớp để tham gia.

---

## 2. Mục tiêu của ứng dụng

Ứng dụng được xây dựng nhằm hỗ trợ quá trình giảng dạy trực tiếp trên lớp, phù hợp với các môn Công nghệ thông tin.

Giảng viên chuẩn bị trước Lesson bằng file Markdown. Lesson được lưu lâu dài trong từng lớp học phần và có thể được sử dụng cho nhiều Session khác nhau.

Hệ thống giúp:

- Giảng viên quản lý Subject, Course Section, Lesson Plan và roster sinh viên.
- Sinh viên biết chính xác lớp đang học đến Section nào.
- Giảng viên kiểm soát tiến trình của buổi học.
- Sinh viên phản hồi mức độ hiểu bài ngay tại từng Section.
- Giảng viên theo dõi attendance, reaction, comment và kết quả Quiz gần realtime.
- Lưu lại dữ liệu của từng Session để xem lịch sử sau buổi học.
- Sinh viên thuộc roster xem lại Lesson đã kết thúc ở chế độ chỉ đọc.
- Giảng viên xuất dữ liệu tham gia và số lần phát biểu theo lớp học phần.

---

## 3. Đối tượng sử dụng

### Giảng viên

Hệ thống hiện sử dụng một tài khoản giảng viên với username `thaybao`. Mật khẩu được xác thực bằng Supabase Auth và không được lưu trong client.

Giảng viên có thể:

- Đăng nhập, đăng xuất và duy trì phiên đăng nhập.
- Tạo, chỉnh sửa và xóa môn học.
- Tạo, chỉnh sửa và xóa lớp học phần.
- Tạo và chỉnh sửa các Chapter trong Lesson Plan.
- Upload roster MSSV bằng file `.txt`.
- Tạo Lesson bằng file Markdown, preview trước khi lưu.
- Bắt đầu và kết thúc một Lesson Session.
- Điều khiển Section đang trình bày.
- Theo dõi số sinh viên tham gia, reaction, comment và Quiz gần realtime.
- Xem lịch sử Session và dữ liệu tổng kết sau buổi học.
- Trình chiếu Session Reviews và Class Voices.
- Xuất dữ liệu lớp học phần thành file Excel.

### Sinh viên

Sinh viên không có tài khoản, email, mật khẩu hoặc profile.

Sinh viên có thể:

- Browse Subject, Course Section và danh sách Lesson.
- Tham gia Lesson đang LIVE bằng MSSV thuộc roster.
- Theo dõi Section giảng viên đang trình bày.
- Xem lại các Section đã được mở.
- Gửi reaction và comment trên Section đang được phép truy cập.
- Chọn comment hiện MSSV hoặc ẩn danh.
- Làm Quiz và xem kết quả sau khi nộp.
- Gửi số lần phát biểu và lời review sau khi Session kết thúc.
- Xem lại Lesson đã kết thúc bằng MSSV ở chế độ read-only.

Sinh viên không cần Room Code, Session Code hoặc QR Code.

---

## 4. Cấu trúc nội dung

Cấu trúc dữ liệu chính:

```text
Teacher
│
└── Subject
    │
    ├── Lesson Plan / Chapter
    │
    └── Course Section
        │
        ├── Student Roster
        │
        └── Lesson
            │
            ├── Section
            ├── Quiz
            │
            └── Lesson Session
                ├── Attendance
                ├── Participant
                ├── Reaction
                ├── Comment
                ├── Quiz Attempt
                └── Session Reflection
```

Trong đó:

- **Subject** là môn học thuộc giảng viên.
- **Chapter** là chương trong Lesson Plan, dùng để nhóm các Lesson.
- **Course Section** là lớp học phần, có mã lớp, tên hiển thị và roster MSSV.
- **Lesson** là bài học được lưu lâu dài trong Course Section và thuộc một Chapter.
- **Section** là một phần nội dung tuần tự của Lesson.
- **Lesson Session** là một lần giảng dạy trực tiếp của Lesson.

Mỗi Lesson gồm nhiều Section theo thứ tự:

```text
Lesson
│
├── Content Section
├── Content Section
├── Reflection Section
├── Quiz Section
└── Content Section
```

Các loại Section hiện được hỗ trợ:

| Loại | Chức năng |
|---|---|
| `CONTENT` | Nội dung bài giảng |
| `REFLECTION` | Nội dung dùng để gợi ý sinh viên suy nghĩ hoặc phản hồi |
| `QUIZ` | Bộ câu hỏi trắc nghiệm |

Không hỗ trợ Slide, Video, Assignment, Exercise, Poll hoặc Code Runner.

---

## 5. Lesson bằng Markdown

Giảng viên tạo Lesson bằng cách nhập tên, chọn Chapter và upload file `.md`. Hệ thống parse, validate, hiển thị preview rồi mới cho phép lưu.

Ví dụ:

````markdown
---
title: TCP Introduction
description: Giới thiệu nguyên lý hoạt động của TCP
---

:::section
id: tcp-overview
title: Tổng quan TCP
type: content

TCP là giao thức hướng kết nối và cung cấp khả năng truyền dữ liệu tin cậy.

## Đặc điểm chính

- Thiết lập kết nối trước khi truyền dữ liệu.
- Đảm bảo đúng thứ tự.
- Hỗ trợ kiểm soát lỗi.

```text
Client -> SYN -> Server
```
:::

:::quiz
id: tcp-quiz
title: Kiểm tra nhanh
questions:
  - id: tcp-question-1
    type: single
    text: Gói tin đầu tiên trong TCP three-way handshake là gì?
    options:
      - id: syn
        text: SYN
        correct: true
      - id: ack
        text: ACK
        correct: false
      - id: fin
        text: FIN
        correct: false
:::
````

Markdown hiện hỗ trợ:

- Frontmatter `title` và `description` tùy chọn.
- Section nội dung và Section reflection.
- Paragraph và heading.
- Chữ đậm và chữ nghiêng.
- Danh sách.
- Link HTTP, HTTPS hoặc anchor.
- Image URL HTTP/HTTPS.
- Inline code và fenced code block.
- Quiz `single`, `multiple` và `true_false`.

Parser phải:

- Trả về dữ liệu đã chuẩn hóa, không tạo React component trực tiếp.
- Giữ đúng thứ tự Section, question và option.
- Phát hiện Section ID, question ID và option ID bị trùng.
- Kiểm tra số đáp án đúng phù hợp với loại Quiz.
- Từ chối file rỗng, sai cấu trúc hoặc lớn hơn 1 MB.
- Từ chối HTML tùy ý và URL không an toàn để hạn chế XSS.

---

## 6. Luồng hoạt động chính

### Chuẩn bị môn học

```text
Giảng viên đăng nhập
    │
    ▼
Tạo Subject
    │
    ├── Tạo Chapter trong Lesson Plan
    │
    └── Tạo Course Section
            │
            ├── Upload roster MSSV
            │
            └── Tạo Lesson bằng Markdown
```

### Tổ chức buổi học trực tiếp

```text
Giảng viên chọn Start Lesson
    │
    ▼
Hệ thống tạo Lesson Session LIVE
    │
    ├── Snapshot roster làm attendance
    └── Mở Section đầu tiên
    │
    ▼
Sinh viên chọn Lesson LIVE và nhập MSSV
    │
    ▼
Hệ thống kiểm tra MSSV trong attendance snapshot
    │
    ▼
Sinh viên theo dõi Section hiện tại
    │
    ├── Reaction
    ├── Comment
    └── Quiz
    │
    ▼
Giảng viên chuyển sang Section tiếp theo
    │
    ▼
Sinh viên được đồng bộ qua Realtime
    │
    ▼
Giảng viên kết thúc Session
    │
    ▼
Summary / Lesson Review / Class Voices
```

Quy tắc Session:

- Một Course Section chỉ có một Lesson Session LIVE tại một thời điểm.
- Một Lesson có thể có nhiều Session lịch sử.
- Khi Start, roster hiện tại được snapshot sang attendance của Session.
- Student ngoài snapshot không được tham gia.
- Mỗi MSSV chỉ được ghi nhận một lần trong Session.
- Việc thay roster sau này không làm thay đổi attendance lịch sử.
- Hệ thống tiếp tục dùng bảng `rooms` làm Lesson Session nội bộ để tái sử dụng live logic hiện có.

---

## 7. Chế độ học

### Teacher-paced Mode

MINCLASS hiện chỉ hỗ trợ chế độ giảng viên điều khiển tiến trình bài học.

Ví dụ:

```text
01 — Tổng quan TCP          ✓
02 — TCP Handshake          ← Current
03 — Quiz                   🔒
04 — Tổng kết               🔒
```

Khi bắt đầu Session, Section đầu tiên được mở và hiển thị cho Student. Khi giảng viên chuyển Section:

1. Section hiện tại được hoàn thành.
2. Section kế tiếp được mở.
3. Section kế tiếp trở thành Section đang trình bày.
4. Student nhận thay đổi realtime mà không cần tải lại trang.

Student có thể quay lại các Section đã mở nhưng không thể truy cập Section tương lai bằng UI hoặc gọi trực tiếp Supabase.

Ứng dụng chưa hỗ trợ Self-paced Mode.

---

## 8. Theo dõi mức độ hiểu bài

Trên mỗi Section đã mở, sinh viên có thể chọn một reaction:

```text
👍 Hiểu
🤔 Chưa chắc
❓ Có câu hỏi
```

Quy tắc:

- Một Student chỉ có một reaction trên mỗi Section trong Session.
- Student có thể đổi reaction khi Session còn LIVE.
- Reaction dùng optimistic UI.
- Giảng viên thấy số lượng reaction cập nhật gần realtime.
- Sau khi Session kết thúc, Student không thể tạo hoặc sửa reaction.

Sinh viên cũng có thể gửi comment:

- Nội dung từ 1–500 ký tự và không được để trống.
- Có thể gửi nhiều comment trên Section đã mở.
- Có thể chọn hiện MSSV hoặc ẩn danh.
- Danh tính hiển thị được xác định phía server/database, không tin dữ liệu từ client.
- Comment ẩn danh chỉ hiển thị là **Anonymous** cho giảng viên.
- Comment được render an toàn, không thực thi HTML hoặc script.

---

## 9. Quiz

MINCLASS hỗ trợ:

- `SINGLE_CHOICE`.
- `MULTIPLE_CHOICE`.
- `TRUE_FALSE`.

Flow làm Quiz:

```text
Quiz Section được mở
    │
    ▼
Student chọn đáp án
    │
    ▼
Student Submit
    │
    ▼
Server chấm điểm từ answer key riêng tư
    │
    ▼
Student xem điểm và đáp án đã chọn
```

Quy tắc:

- Mỗi Student chỉ submit một lần cho mỗi Quiz trong Session.
- Client chỉ gửi question ID và selected option IDs.
- Client không tự tính hoặc gửi score.
- Answer key không được đọc trước khi submit trong Session LIVE.
- Student không thể sửa Quiz result hoặc submit lại.
- Sau khi submit, Student được xem lựa chọn, đúng/sai và đáp án đúng theo chính sách hiện tại.
- Sau khi Session kết thúc, Student thuộc roster được xem đáp án đúng trong Lesson Review.

Giảng viên có thể xem gần realtime:

- Số Student đã submit.
- Completion rate.
- Điểm trung bình.
- Correct rate theo câu hỏi.
- Answer distribution.

---

## 10. Tổng kết và Class Voices

### Tổng kết cá nhân của sinh viên

Sau khi giảng viên kết thúc Session, Student có thể gửi một lần:

- Số lần phát biểu, từ 0 đến 999.
- Lời review buổi học.

Dữ liệu được gắn với Participant của Session. Sau khi gửi, Student không thể chỉnh sửa và có thể xem lại trong Lesson Review. Giảng viên nhận review mới gần realtime.

### Class Voices

Class Voices tổng hợp các comment trong buổi học:

- Hiển thị comment theo card.
- Group hoặc filter theo Section.
- Comment có tên hiển thị đúng MSSV.
- Comment ẩn danh chỉ hiển thị **Anonymous**.
- Hỗ trợ Presentation Mode toàn màn hình.
- Điều hướng bằng Previous, Next hoặc bàn phím.
- Hỗ trợ Exit, responsive và `prefers-reduced-motion`.

Session Reviews được trình bày riêng với MSSV, số lần phát biểu và lời review cuối buổi.

---

## 11. Dashboard dành cho giảng viên

Trong Lesson Session LIVE, giảng viên có thể xem:

- Trạng thái lớp học đang diễn ra.
- Sĩ số từ attendance snapshot.
- Số sinh viên đã tham gia.
- Section đang trình bày và vị trí Section.
- Nút chuyển sang Section tiếp theo.
- Reaction của Section.
- Comment mới.
- Tiến độ và kết quả Quiz.
- Session Review mới sau khi kết thúc.

Ví dụ:

```text
TCP INTRODUCTION — LIVE

Sĩ số
45

Đã tham gia
42

Section hiện tại
02 — TCP Three-Way Handshake

Reaction
👍 24   🤔 8   ❓ 4

Quiz
Đã nộp 31 / 42
```

PostgreSQL là nguồn trạng thái thật. Supabase Realtime chỉ thông báo cho UI đồng bộ lại dữ liệu. Sau reconnect, client phải fetch lại snapshot từ database.

---

## 12. Báo cáo sau buổi học

Sau khi Session kết thúc, hệ thống hiển thị Lesson Review và Summary.

### Attendance

- Tổng số sinh viên trong roster snapshot.
- Số đã tham gia.
- Số vắng.
- Danh sách MSSV đã tham gia.
- Danh sách MSSV vắng.

### Quiz

- Số lượt submit.
- Điểm trung bình.
- Correct rate theo từng câu hỏi.
- Answer distribution.

### Reaction và Comment

- Reaction breakdown theo từng Section.
- Tổng số comment.
- Số comment có MSSV.
- Số comment ẩn danh.
- Section nhận nhiều phản hồi nhất.

### Tổng kết buổi học

- **Xem Reviews** để xem và trình chiếu lời review cuối buổi.
- **Xem phản hồi** để mở Class Voices từ comment trong Session.

### Student Lesson Review

Sinh viên chọn Lesson đã kết thúc và nhập MSSV:

- MSSV phải thuộc roster của Course Section.
- Không yêu cầu Room Code hoặc Session Code.
- Student thuộc roster vẫn được xem Lesson dù không tham gia Session.
- Hiển thị toàn bộ Section và đáp án Quiz ở chế độ read-only.
- Nếu Student đã làm Quiz, hiển thị đáp án đã chọn và trạng thái đúng/sai.
- Nếu đã gửi tổng kết cá nhân, Student xem lại dữ liệu của chính mình.
- Không hiển thị toàn bộ comment của lớp cho Student.
- Không cho gửi thêm hoặc sửa reaction, comment, Quiz, attendance hay tổng kết.

### Xuất dữ liệu lớp học phần

Giảng viên có thể tải file Excel gồm:

- MSSV từ roster hiện tại.
- Tổng số lần phát biểu theo MSSV.
- Số Lesson đã tham gia trên tổng số Lesson của Course Section.

Một Lesson được tính là một buổi học. Nếu Lesson có nhiều Session và Student tham gia nhiều lần, Lesson đó vẫn chỉ được tính một buổi tham gia.

---

## 13. Yêu cầu MVP hiện tại

### MVP gồm

1. Giảng viên đăng nhập và đăng xuất bằng tài khoản được cấu hình.
2. Giảng viên quản lý Subject.
3. Giảng viên quản lý Course Section.
4. Giảng viên quản lý Chapter trong Lesson Plan.
5. Giảng viên upload và quản lý roster MSSV bằng file `.txt`.
6. Giảng viên tạo Lesson bằng file Markdown, preview và lưu lâu dài.
7. Hệ thống parse Markdown thành Section và Quiz đã chuẩn hóa.
8. Giảng viên Start một Lesson Session LIVE.
9. Hệ thống snapshot roster để ghi nhận attendance theo Session.
10. Sinh viên browse Subject, Course Section và Lesson.
11. Sinh viên tham gia Lesson LIVE chỉ bằng MSSV thuộc roster.
12. Giảng viên điều khiển Section theo thứ tự.
13. Sinh viên nhận Section mới qua Realtime.
14. Sinh viên gửi reaction và comment trên Section đã mở.
15. Sinh viên làm Quiz một lần và được server chấm điểm.
16. Giảng viên xem Live Dashboard gần realtime.
17. Giảng viên kết thúc Session.
18. Sinh viên gửi số lần phát biểu và lời review cuối buổi một lần.
19. Giảng viên xem Session History, Summary, Session Reviews và Class Voices.
20. Sinh viên thuộc roster xem lại Lesson đã kết thúc.
21. Giảng viên xuất dữ liệu Course Section thành file Excel.
22. Giảng viên xóa Subject, Course Section hoặc Lesson Session thuộc quyền sở hữu sau bước xác nhận.

### Yêu cầu bảo mật

- Các route Teacher phải được kiểm tra quyền ở server.
- RLS bảo vệ dữ liệu Subject, Course Section, roster, Lesson và Session.
- Teacher chỉ được quản lý dữ liệu thuộc chính mình.
- Student không được tải toàn bộ roster hoặc truy cập dữ liệu lớp khác.
- Section chưa mở không được trả về cho Student.
- Quiz answer key không được cấp quyền đọc trực tiếp khi Session LIVE.
- Reaction, comment, Quiz Attempt và Session Reflection phải gắn đúng Participant và Session.
- Anonymous comment không được làm lộ MSSV.
- Markdown và comment phải được render an toàn để chống XSS.
- Database constraint, transaction và lock phải ngăn duplicate Session, duplicate join, duplicate reaction và duplicate Quiz submit.
- Không expose service-role key và không dùng service role để né RLS.

### Không thuộc MVP hiện tại

- Tài khoản hoặc màn hình đăng nhập Student.
- Đăng ký nhiều Teacher hoặc hệ thống role phức tạp.
- Room Code, Session Code hoặc QR Code.
- Self-paced Mode.
- Exercise, Assignment, Gradebook hoặc Leaderboard.
- Poll, upvote, reply hoặc chat.
- Video, iframe hoặc slide/PDF player.
- Code Runner.
- AI Summary hoặc AI Analytics.
- GPS, nhận diện khuôn mặt hoặc điểm danh theo vị trí.

---

## 14. Công nghệ sử dụng

- **Next.js App Router, React và TypeScript**: xây dựng ứng dụng web full-stack.
- **Tailwind CSS**: xây dựng giao diện responsive.
- **Supabase**: cung cấp Auth, PostgreSQL, Row Level Security và Realtime.
