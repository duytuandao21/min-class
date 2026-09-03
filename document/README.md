# MINCLASS — Project Overview

![MINCLASS logo](../picture/logo.png)

MINCLASS là classroom companion cho lớp học trực tiếp, giúp giảng viên điều khiển bài học theo từng Section và nhận phản hồi từ sinh viên gần realtime. Ứng dụng không phải LMS: phạm vi tập trung vào chuẩn bị Lesson, tổ chức Lesson Session, attendance, reaction, comment, Quiz và tổng kết sau buổi học.

## Website giải quyết vấn đề gì?

Trong lớp học trực tiếp, sinh viên thường khó biết giảng viên đang trình bày đến đâu, còn giảng viên khó thu thập nhanh mức độ hiểu bài của cả lớp. MINCLASS giải quyết bằng flow Teacher-paced:

1. Giảng viên chuẩn bị Lesson bằng Markdown.
2. Giảng viên bắt đầu một Session và điều khiển Section hiện tại.
3. Sinh viên thuộc roster tham gia bằng MSSV, không cần tài khoản hoặc Room Code.
4. Sinh viên theo dõi nội dung, gửi reaction/comment và làm Quiz.
5. Giảng viên theo dõi dữ liệu gần realtime và xem lại lịch sử sau buổi học.

## Chức năng chính

### Dành cho giảng viên

- Đăng nhập bằng tài khoản Teacher được cấu hình trong Supabase Auth.
- Quản lý Subject và Course Section.
- Quản lý Lesson Plan theo Chapter.
- Upload roster MSSV từ file `.txt`, preview và kiểm tra dữ liệu trước khi lưu.
- Tạo Lesson từ Markdown, validate và preview trước khi lưu.
- Start/End Lesson Session và điều khiển Section theo thứ tự.
- Theo dõi attendance, reaction, comment và Quiz gần realtime.
- Xem Session History, Summary, Session Reviews và Class Voices.
- Xuất dữ liệu Course Section thành file Excel.

### Dành cho sinh viên

- Browse Subject, Course Section và Lesson công khai.
- Tham gia Lesson LIVE bằng MSSV thuộc roster.
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
| Live updates | Supabase Realtime |
| Validation | Zod, PostgreSQL constraints |
| Markdown | Unified, Remark, YAML, React Markdown |
| Export | ExcelJS |
| Testing | Vitest, Supabase SQL tests |
| Package manager | pnpm |

## Cấu trúc project

```text
min-class/
├── docs/                       Tài liệu bàn giao
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
│   └── lib/supabase/           Browser/server Supabase clients và session refresh
├── supabase/
│   ├── migrations/             Schema, RLS, RPC và Realtime migrations
│   └── tests/                  Database/RLS integration tests
├── test/                       File Lesson mẫu
├── Dockerfile                  Production multi-stage image
└── package.json                Scripts và dependencies
```

Chi tiết kiến trúc nằm trong [Technical Documentation](./TECHNICAL_DOCUMENTATION.md). Schema và ERD nằm trong [Database Documentation](./DATABASE_DOCUMENTATION.md).

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

- [User Guide](./USER_GUIDE.md)
- [Technical Documentation](./TECHNICAL_DOCUMENTATION.md)
- [Database Documentation](./DATABASE_DOCUMENTATION.md)
- [Requirements Summary](./requirements_summary.md)
