# MINCLASS — Project Overview

MINCLASS là classroom companion cho lớp học trực tiếp, giúp giảng viên điều khiển bài học theo từng Section và nhận phản hồi từ sinh viên gần realtime. Ứng dụng không phải LMS: phạm vi tập trung vào chuẩn bị Lesson, tổ chức Lesson Session, attendance, reaction, comment, Quiz và tổng kết sau buổi học.

## Website giải quyết vấn đề gì?

Trong lớp học trực tiếp, sinh viên thường khó biết giảng viên đang trình bày đến đâu, còn giảng viên khó thu thập nhanh mức độ hiểu bài của cả lớp. MINCLASS giải quyết bằng flow Teacher-paced:

1. Giảng viên chuẩn bị Lesson Plan theo Chapter và có thể upload nhiều Lesson Markdown cùng lúc.
2. Giảng viên bắt đầu một Chapter Session chứa toàn bộ Lesson của chương và điều khiển Section riêng theo từng Lesson.
3. Sinh viên thuộc roster tham gia bằng MSSV, không cần tài khoản, Room Code hoặc Session Code.
4. Sinh viên chuyển giữa các Lesson trong chương, theo dõi Section đã release, gửi reaction/comment và làm Quiz.
5. Giảng viên theo dõi dữ liệu gần realtime, kết thúc Session và xem Summary theo từng Lesson.

## Chức năng chính

### Dành cho giảng viên

- Đăng nhập bằng tài khoản Teacher được cấu hình trong Supabase Auth.
- Quản lý Subject và Course Section.
- Quản lý Lesson Plan theo Chapter; đồng bộ thay đổi có chọn lọc sang các lớp học phần đã tồn tại.
- Upload roster MSSV từ file `.txt`, preview và kiểm tra dữ liệu trước khi lưu.
- Upload tối đa 20 Lesson Markdown vào Chapter, chỉnh sửa/preview từng Lesson và lưu đồng loạt; Preview mode không bắt buộc trước khi lưu.
- Upload ảnh vào Thư viện ảnh Lesson và sao chép cú pháp Markdown để chèn vào bài.
- Mở Chapter cho sinh viên xem trước ở chế độ chỉ đọc.
- Start/End Chapter Session, chuyển Lesson và điều khiển/release Section theo thứ tự.
- Theo dõi attendance, reaction, comment và Quiz gần realtime.
- Xem Session History, Summary, Session Reviews và Class Voices.
- Xuất dữ liệu Course Section thành file Excel.

### Dành cho sinh viên

- Vào Course Section bằng MSSV một lần để xem các Chapter được phép truy cập; phiên được dùng lại khi chuyển Chapter.
- Mở trước Chapter được Teacher cho phép ở chế độ chỉ đọc, không tính điểm danh.
- Tham gia Chapter LIVE bằng MSSV thuộc roster; bước LIVE vẫn xác minh riêng.
- Xem Section hiện tại và các Section đã mở.
- Gửi reaction, comment có tên hoặc ẩn danh.
- Làm Quiz một lần và xem kết quả sau khi nộp.
- Gửi tổng kết cá nhân sau khi Session kết thúc.
- Xem lại Lesson đã kết thúc ở chế độ read-only.

## Tech stack

| Thành phần | Công nghệ |
|---|---|
| Web application | Next.js App Router, React, TypeScript strict |
| Styling | Tailwind CSS |
| Database và Auth | Supabase PostgreSQL, Auth, RLS |
| Lesson images | Supabase Storage (`lesson-images`) |
| Live updates | Supabase Realtime |
| Validation | Zod, PostgreSQL constraints |
| Markdown | Unified, Remark, YAML, React Markdown |
| Export | ExcelJS |
| Testing | Vitest, Supabase SQL tests |
| Package manager | pnpm |

## Cấu trúc project

```text
min-class/
├── document/                   Tài liệu Markdown và Word bàn giao
├── picture/                    Logo, background và asset giao diện
├── src/
│   ├── app/                    Next.js App Router pages và route handlers
│   ├── components/             Component dùng chung
│   ├── features/
│   │   ├── auth/               Teacher authentication
│   │   ├── catalog/            Student catalog và Lesson access gate
│   │   ├── lessons/            Markdown, Lesson và Session actions
│   │   ├── rooms/              Live flow, feedback, Quiz và Summary
│   │   └── subjects/           Subject, Course Section, roster và export
│   └── lib/supabase/           Browser/server Supabase clients, Auth cookie và session refresh
├── supabase/
│   ├── migrations/             Schema, RLS, RPC và Realtime migrations
│   └── tests/                  Database/RLS integration tests
├── test/                       File Lesson mẫu
├── Dockerfile                  Production multi-stage image
└── package.json                Scripts và dependencies
```

Chi tiết kiến trúc nằm trong [Technical Documentation](<./Technical Documentation.docx>). Schema và ERD nằm trong [Database Documentation](<./Database Documentation.docx>).

## Yêu cầu môi trường

- Node.js `>= 20.9.0`.
- pnpm `11.5.0` hoặc phiên bản tương thích với `packageManager` trong `package.json`.
- Một Supabase project.
- Supabase CLI nếu áp dụng migrations từ máy local.
- Docker nếu triển khai bằng container.

Supabase Auth phải bật:

- Email/password authentication cho Teacher.
- Anonymous sign-ins cho Student.

## Cài đặt

```bash
pnpm install
```

Tạo `.env.local` từ `.env.example` và điền cấu hình Supabase:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Áp dụng migrations theo thứ tự trong `supabase/migrations/`:

```bash
pnpm exec supabase db push
```

Teacher Auth hiện nhận username `thaybao` và ánh xạ đến email nội bộ `thaybao@minclass.local`. Supabase Auth phải có permanent user với email này; mật khẩu nên được cấu hình và chuyển giao qua kênh riêng, không ghi vào repository.

## Chạy development

```bash
pnpm dev
```

Mở [http://localhost:3000](http://localhost:3000).

Các lệnh kiểm tra:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:db
```

`pnpm test:db` yêu cầu Supabase local stack phù hợp với cấu hình dự án.

## Build và chạy production

```bash
pnpm build
pnpm start
```

Next.js được cấu hình `standalone` khi không chạy trên Vercel.

### Build bằng Docker

```bash
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co \
  --build-arg NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key \
  -t minclass .

docker run --rm -p 3000:3000 \
  -e NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co \
  -e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key \
  minclass
```

Hai biến `NEXT_PUBLIC_*` được đưa vào browser bundle nên chỉ dùng URL và publishable key. Không sử dụng Supabase service-role key trong ứng dụng web.

## Environment variables

| Biến | Bắt buộc | Mục đích |
|---|---:|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Có | URL của Supabase project |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Có | Publishable/anon key dùng với Auth và RLS |

Project hiện không yêu cầu service-role key.

## Demo và deployment

- Local development: [http://localhost:3000](http://localhost:3000)
- Production demo: [https://min-class.vercel.app](https://min-class.vercel.app)



## Tài liệu liên quan

- [User Guide](<./User Guide.docx>)
- [Technical Documentation](<./Technical Documentation.docx>)
- [Database Documentation](<./Database Documentation.docx>)
